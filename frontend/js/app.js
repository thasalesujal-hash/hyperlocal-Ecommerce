/* Hyperlocal Commerce & Delivery Platform - Main JavaScript Application */

const API_BASE = ""; // Relative path to FastAPI server

// Application State
const state = {
  token: localStorage.getItem("token") || null,
  user: JSON.parse(localStorage.getItem("user")) || null,
  activeRoleView: "CUSTOMER", // CUSTOMER, SHOPKEEPER, DELIVERY_PARTNER, ADMIN
  location: {
    lat: 18.5204,
    lng: 73.8567,
    address: "Town Main Chowk",
    landmark: "Near Ganesh Temple, opposite City School"
  },
  cart: [],
  lowBandwidth: false,
  pollTimer: null,
  // Leaflet Map instances
  shopsMap: null,
  shopsMarkers: [],
  pickerMap: null,
  pickerMarker: null,
  routeMap: null,
  routePolyline: null,
  riderMarker: null,
  customerTrackingMaps: {},
  locationWatchId: null
};

// DOM Initialization
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

function initApp() {
  bindEvents();
  updateAuthUI();
  updateLocationUI();
  
  // Restore Dark Mode setting if saved
  if (localStorage.getItem("darkMode") === "true") {
    document.body.classList.add("dark-mode");
    const btn = document.getElementById("theme-toggle-btn");
    if (btn) btn.innerText = "☀️ Light Mode";
  }

  if (state.token && state.user) {
    switchRoleView(state.user.role);
  } else {
    switchRoleView("CUSTOMER");
  }

  // Initial Data Load
  loadNearbyShops();
  loadPopularProducts();
  
  // Start Real-Time Order Polling
  startOrderPolling();
}

// Dark Mode Toggle
function toggleDarkMode() {
  const isDark = document.body.classList.toggle("dark-mode");
  localStorage.setItem("darkMode", isDark);
  const btn = document.getElementById("theme-toggle-btn");
  if (btn) btn.innerText = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
}

// Category Filter Handler
async function filterCategory(category) {
  document.querySelectorAll(".category-chip").forEach(chip => chip.classList.remove("active"));
  event.target.classList.add("active");

  if (category === "ALL") {
    loadPopularProducts();
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/products`);
    const products = await res.json();
    const filtered = products.filter(p => p.category.toLowerCase().includes(category.toLowerCase()));
    
    const container = document.getElementById("popular-products-grid");
    if (!container) return;

    if (filtered.length === 0) {
      container.innerHTML = `<p style="color: var(--text-muted);">No products found in category '${category}'.</p>`;
      return;
    }

    container.innerHTML = filtered.map(prod => `
      <div class="card">
        <div>
          <div class="card-img">${prod.image || "📦"}</div>
          <div class="card-title">${prod.name}</div>
          <div class="card-subtitle">Category: ${prod.category} • Stock: ${prod.stock}</div>
        </div>
        <div class="card-footer">
          <div class="card-price">₹${prod.price}</div>
          <button onclick="addToCart(${prod.id}, '${escapeQuote(prod.name)}', ${prod.price}, ${prod.shop_id})" class="btn btn-primary btn-sm">+ Cart</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error("Filter category error:", err);
  }
}

function bindEvents() {
  // Low Bandwidth Toggle
  document.getElementById("btn-low-bw")?.addEventListener("click", toggleLowBandwidth);

  // Search Bar
  document.getElementById("search-btn")?.addEventListener("click", handleSearch);
  document.getElementById("search-input")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSearch();
  });
  document.getElementById("checkout-payment")?.addEventListener("change", updatePaymentUI);
  document.getElementById("online-payment-type")?.addEventListener("change", updatePaymentUI);

  // Location Picker
  document.getElementById("location-btn")?.addEventListener("click", openLocationModal);

  // Quick Demo Logins
  document.querySelectorAll(".demo-login-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const email = e.target.dataset.email;
      const pass = e.target.dataset.pass || "password123";
      performLogin(email, pass);
    });
  });

  // Role View Switchers (Top Banner)
  document.querySelectorAll(".role-pill").forEach(pill => {
    pill.addEventListener("click", (e) => {
      const role = e.target.dataset.role;
      switchRoleView(role);
    });
  });
}

// ----------------------------------------------------
// AUTHENTICATION & ROLE SWITCHING
// ----------------------------------------------------
async function performLogin(email, password) {
  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    
    if (!res.ok) {
      const err = await res.json();
      alert(`Login failed: ${err.detail || "Invalid credentials"}`);
      return;
    }

    const data = await res.json();
    state.token = data.access_token;
    state.user = data.user;
    localStorage.setItem("token", state.token);
    localStorage.setItem("user", JSON.stringify(state.user));

    updateAuthUI();
    switchRoleView(state.user.role);
    closeModal("auth-modal");
    alert(`Welcome back, ${state.user.name} (${state.user.role})!`);
  } catch (err) {
    console.error("Login error:", err);
    alert("Network or server error during login.");
  }
}

function switchAuthMode(mode) {
  const isRegistering = mode === "register";
  document.getElementById("login-form").style.display = isRegistering ? "none" : "flex";
  document.getElementById("register-form").style.display = isRegistering ? "flex" : "none";
  document.getElementById("auth-modal-title").textContent = isRegistering ? "📝 Create Account" : "👤 Login";
}

async function performRegister() {
  const name = document.getElementById("register-name").value.trim();
  const email = document.getElementById("register-email").value.trim();
  const phone = document.getElementById("register-phone").value.trim();
  const address = document.getElementById("register-address").value.trim();
  const password = document.getElementById("register-pass").value;
  const role = document.getElementById("register-role").value;
  const shopName = document.getElementById("register-shop-name").value.trim();
  const shopCategory = document.getElementById("register-shop-category").value.trim();
  const vehicleType = document.getElementById("register-vehicle-type").value;

  if (!name || !email || !phone || !address || !password) {
    alert("Please complete all registration fields.");
    return;
  }
  if (role === "SHOPKEEPER" && (!shopName || !shopCategory)) {
    alert("Please add your shop name and category.");
    return;
  }
  if (password.length < 6) {
    alert("Password must be at least 6 characters.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, address, password, role, shop_name: shopName, shop_category: shopCategory, vehicle_type: vehicleType })
    });
    if (!res.ok) {
      const err = await res.json();
      alert(`Registration failed: ${err.detail || "Unable to create account"}`);
      return;
    }
    alert("Account created successfully. Logging you in now.");
    await performLogin(email, password);
  } catch (e) {
    console.error(e);
    alert("Network error. Please try again.");
  }
}

function toggleRegistrationRoleFields() {
  const role = document.getElementById("register-role")?.value;
  const shopFields = document.getElementById("shopkeeper-registration-fields");
  const deliveryFields = document.getElementById("delivery-registration-fields");
  if (shopFields) shopFields.style.display = role === "SHOPKEEPER" ? "flex" : "none";
  if (deliveryFields) deliveryFields.style.display = role === "DELIVERY_PARTNER" ? "flex" : "none";
}

function logout() {
  stopDeliveryLocationSharing();
  state.token = null;
  state.user = null;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  state.cart = [];
  updateCartBadge();
  updateAuthUI();
  switchRoleView("CUSTOMER");
  alert("Logged out successfully.");
}

function updateAuthUI() {
  const authContainer = document.getElementById("auth-status-container");
  if (!authContainer) return;

  if (state.user) {
    authContainer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 0.85rem; font-weight: 600;">👤 ${state.user.name} <small>(${state.user.role})</small></span>
        <button onclick="logout()" class="btn btn-outline btn-sm">Logout</button>
      </div>
    `;
  } else {
    authContainer.innerHTML = `
      <button onclick="openModal('auth-modal')" class="btn btn-primary btn-sm">Login / Register</button>
    `;
  }
}

function switchRoleView(role) {
  state.activeRoleView = role;

  // Update Pills UI
  document.querySelectorAll(".role-pill").forEach(pill => {
    if (pill.dataset.role === role) pill.classList.add("active");
    else pill.classList.remove("active");
  });

  // Hide all view sections
  document.querySelectorAll(".role-view-section").forEach(sec => sec.style.display = "none");

  // Show target view
  if (role === "CUSTOMER") {
    document.getElementById("customer-view").style.display = "block";
    loadCustomerOrders();
  } else if (role === "SHOPKEEPER") {
    document.getElementById("shopkeeper-view").style.display = "block";
    loadShopkeeperOrders();
    loadShopkeeperProducts();
    loadShopkeeperInsights();
  } else if (role === "DELIVERY_PARTNER") {
    document.getElementById("delivery-view").style.display = "block";
    loadDeliveryRequests();
    loadDeliveryHistory();
    startDeliveryLocationSharing();
  } else if (role === "ADMIN") {
    document.getElementById("admin-view").style.display = "block";
    loadAdminDashboard();
  }
}

// ----------------------------------------------------
// LOCATION MANAGEMENT (GPS + LANDMARK)
// ----------------------------------------------------
function updateLocationUI() {
  const locEl = document.getElementById("current-location-text");
  if (locEl) {
    locEl.innerHTML = `📍 ${state.location.address} <small>(${state.location.landmark})</small>`;
  }
}

function useBrowserGPS() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.location.lat = roundCoord(pos.coords.latitude);
      state.location.lng = roundCoord(pos.coords.longitude);
      state.location.address = `GPS (${state.location.lat}, ${state.location.lng})`;
      updateLocationUI();
      closeModal("location-modal");
      // Refresh search/nearby shops
      loadNearbyShops();
      alert(`Location updated via GPS!`);
    },
    (err) => {
      alert(`GPS Error: ${err.message}. Please enter landmark manually.`);
    }
  );
}

function saveManualLocation() {
  const addr = document.getElementById("loc-address-input")?.value;
  const landmark = document.getElementById("loc-landmark-input")?.value;
  const lat = parseFloat(document.getElementById("loc-lat-input")?.value || 18.5204);
  const lng = parseFloat(document.getElementById("loc-lng-input")?.value || 73.8567);

  if (addr) state.location.address = addr;
  if (landmark) state.location.landmark = landmark;
  state.location.lat = lat;
  state.location.lng = lng;

  updateLocationUI();
  closeModal("location-modal");
  loadNearbyShops();
}

function roundCoord(num) {
  return Math.round(num * 10000) / 10000;
}

// ----------------------------------------------------
// CUSTOMER & SMART RECOMMENDATIONS
// ----------------------------------------------------
async function handleSearch() {
  const q = document.getElementById("search-input")?.value;
  if (!q) {
    document.getElementById("smart-rec-section").style.display = "none";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/search?query=${encodeURIComponent(q)}&lat=${state.location.lat}&lng=${state.location.lng}`);
    const recommendations = await res.json();

    const recContainer = document.getElementById("smart-rec-results");
    const recSection = document.getElementById("smart-rec-section");

    if (!recommendations || recommendations.length === 0) {
      recContainer.innerHTML = `<p style="color: var(--gray-600);">No products found matching '${q}'. Try searching 'Rice', 'Milk', or 'Paracetamol'.</p>`;
      recSection.style.display = "block";
      return;
    }

    recSection.style.display = "block";
    
    // Top recommended item
    const topRec = recommendations[0];

    let html = `
      <div class="rec-card">
        <div class="rec-badge">⭐ Recommended Shop</div>
        <div class="rec-header">
          <div>
            <div class="rec-prod-name">${topRec.product.name}</div>
            <div class="rec-shop-name">🏪 ${topRec.shop.name} • <small>${topRec.shop.category}</small></div>
          </div>
          <div class="rec-price">₹${topRec.product.price}</div>
        </div>
        
        <div class="rec-reasons">
          <div style="font-weight:700; margin-bottom: 6px; font-size: 0.85rem; color: var(--primary);">Smart Algorithm Match Score: ${topRec.score}</div>
          ${topRec.reasons.map(r => `<div class="reason-item">${r}</div>`).join('')}
        </div>

        <div style="margin-top: 14px; display: flex; gap: 10px;">
          <button onclick="addToCart(${topRec.product.id}, '${escapeQuote(topRec.product.name)}', ${topRec.product.price}, ${topRec.shop.id})" class="btn btn-accent btn-sm">🛒 Add to Cart</button>
        </div>
      </div>
    `;

    // Other matching options if any
    if (recommendations.length > 1) {
      html += `<h4 style="margin: 15px 0 10px 0; font-size: 0.95rem;">Other Available Shops:</h4><div class="grid">`;
      recommendations.slice(1).forEach(item => {
        html += `
          <div class="card">
            <div>
              <div class="card-title">${item.product.name}</div>
              <div class="card-subtitle">🏪 ${item.shop.name} (${item.distance_km} km away)</div>
              <div style="font-size: 0.8rem; color: var(--accent); font-weight:600;">Match Score: ${item.score}</div>
            </div>
            <div class="card-footer">
              <div class="card-price">₹${item.product.price}</div>
              <button onclick="addToCart(${item.product.id}, '${escapeQuote(item.product.name)}', ${item.product.price}, ${item.shop.id})" class="btn btn-primary btn-sm">+ Add</button>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    recContainer.innerHTML = html;
  } catch (err) {
    console.error("Search error:", err);
  }
}

async function loadNearbyShops() {
  try {
    const res = await fetch(`${API_BASE}/nearby-shops?lat=${state.location.lat}&lng=${state.location.lng}`);
    const data = await res.json();
    const container = document.getElementById("nearby-shops-grid");
    if (!container) return;

    container.innerHTML = data.map(item => `
      <div class="card">
        <div>
          <div class="card-img">🏪</div>
          <div class="card-title">${item.shop.name}</div>
          <div class="card-subtitle">${item.shop.category} • ${item.shop.landmark || item.shop.address}</div>
          <div style="font-size: 0.85rem; color: var(--warning); font-weight: 700;">★ ${item.shop.rating} (${item.distance_km} km away)</div>
        </div>
        <div class="card-footer">
          <button onclick="filterShopProducts(${item.shop.id}, '${escapeQuote(item.shop.name)}')" class="btn btn-outline btn-sm" style="width:100%;">View Shop Products</button>
        </div>
      </div>
    `).join('');

    // Initialize/update Leaflet Town Map
    renderShopsOnMap(data);
  } catch (err) {
    console.error("Error loading nearby shops:", err);
  }
}

// ----------------------------------------------------
function openLocationModal() {
  openModal("location-modal");

  // Initialize interactive map pin picker after modal is visible
  setTimeout(() => {
    if (typeof L === 'undefined') return;
    const mapEl = document.getElementById("picker-leaflet-map");
    if (!mapEl) return;

    if (!state.pickerMap) {
      state.pickerMap = L.map('picker-leaflet-map').setView([state.location.lat, state.location.lng], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(state.pickerMap);

      // Map click handler to pick location
      state.pickerMap.on('click', (e) => {
        const lat = roundCoord(e.latlng.lat);
        const lng = roundCoord(e.latlng.lng);
        document.getElementById("loc-lat-input").value = lat;
        document.getElementById("loc-lng-input").value = lng;
        
        if (state.pickerMarker) state.pickerMap.removeLayer(state.pickerMarker);
        state.pickerMarker = L.marker([lat, lng]).addTo(state.pickerMap).bindPopup("Selected Location Pin").openPopup();
      });
    } else {
      state.pickerMap.invalidateSize();
      state.pickerMap.setView([state.location.lat, state.location.lng], 14);
    }

    if (state.pickerMarker) state.pickerMap.removeLayer(state.pickerMarker);
    state.pickerMarker = L.marker([state.location.lat, state.location.lng]).addTo(state.pickerMap);
  }, 200);
}

function initDeliveryRouteMap(shopLat, shopLng, custLat, custLng, shopName, landmark) {
  if (typeof L === 'undefined') return;

  const mapEl = document.getElementById("route-leaflet-map");
  if (!mapEl) return;

  if (!state.routeMap) {
    state.routeMap = L.map('route-leaflet-map').setView([shopLat, shopLng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(state.routeMap);
  } else {
    state.routeMap.invalidateSize();
  }

  // Clear polyline & markers
  if (state.routePolyline) state.routeMap.removeLayer(state.routePolyline);

  // Shop Pickup Marker
  const m1 = L.marker([shopLat, shopLng]).addTo(state.routeMap).bindPopup(`<b>🏪 Pickup: ${shopName}</b>`);
  
  // Customer Landmark Marker
  const m2 = L.marker([custLat, custLng]).addTo(state.routeMap).bindPopup(`<b>📍 Delivery Landmark: ${landmark}</b>`).openPopup();

  // Polyline path
  const latlngs = [[shopLat, shopLng], [custLat, custLng]];
  state.routePolyline = L.polyline(latlngs, { color: '#10b981', weight: 4, dashArray: '8, 8' }).addTo(state.routeMap);
  state.routeMap.fitBounds(state.routePolyline.getBounds(), { padding: [30, 30] });

  // Animated Rider Marker (Midpoint simulation)
  if (state.riderMarker) state.routeMap.removeLayer(state.riderMarker);
  const midLat = (shopLat + custLat) / 2;
  const midLng = (shopLng + custLng) / 2;
  state.riderMarker = L.circleMarker([midLat, midLng], {
    radius: 8,
    fillColor: "#f59e0b",
    color: "#ffffff",
    weight: 2,
    fillOpacity: 1
  }).addTo(state.routeMap).bindPopup("🚴 Rider En Route");
}
function renderShopsOnMap(shopsData) {
  if (typeof L === 'undefined') return;

  const mapEl = document.getElementById("shops-leaflet-map");
  if (!mapEl) return;

  if (!state.shopsMap) {
    state.shopsMap = L.map('shops-leaflet-map').setView([state.location.lat, state.location.lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(state.shopsMap);
  } else {
    state.shopsMap.setView([state.location.lat, state.location.lng], 14);
  }

  // Clear existing markers
  state.shopsMarkers.forEach(m => state.shopsMap.removeLayer(m));
  state.shopsMarkers = [];

  // Add Customer Location Pin (Blue Circle)
  const custMarker = L.circleMarker([state.location.lat, state.location.lng], {
    radius: 9,
    fillColor: "#2563eb",
    color: "#ffffff",
    weight: 2,
    opacity: 1,
    fillOpacity: 0.9
  }).addTo(state.shopsMap).bindPopup(`<b>📍 Your Location</b><br>${state.location.landmark}`);
  state.shopsMarkers.push(custMarker);

  // Add Shop Pins
  shopsData.forEach(item => {
    const s = item.shop;
    const marker = L.marker([s.latitude, s.longitude]).addTo(state.shopsMap);
    marker.bindPopup(`
      <div style="font-family:sans-serif;">
        <strong style="color:#2563eb; font-size:1rem;">🏪 ${s.name}</strong><br>
        <small>${s.category} • ★ ${s.rating}</small><br>
        <span style="font-size:0.8rem; color:#475569;">📍 ${s.landmark || s.address} (${item.distance_km} km)</span><br>
        <button onclick="filterShopProducts(${s.id}, '${escapeQuote(s.name)}')" style="margin-top:6px; background:#10b981; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-weight:600;">View Products</button>
      </div>
    `);
    state.shopsMarkers.push(marker);
  });
}

async function loadPopularProducts() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    const data = await res.json();
    const container = document.getElementById("popular-products-grid");
    if (!container) return;

    container.innerHTML = data.map(prod => `
      <div class="card">
        <div>
          <div class="card-img">${prod.image || "📦"}</div>
          <div class="card-title">${prod.name}</div>
          <div class="card-subtitle">Stock: ${prod.stock} units</div>
        </div>
        <div class="card-footer">
          <div class="card-price">₹${prod.price}</div>
          <button onclick="addToCart(${prod.id}, '${escapeQuote(prod.name)}', ${prod.price}, ${prod.shop_id})" class="btn btn-primary btn-sm">+ Cart</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error("Error loading popular products:", err);
  }
}

async function filterShopProducts(shopId, shopName) {
  try {
    const res = await fetch(`${API_BASE}/products?shop_id=${shopId}`);
    const data = await res.json();
    
    document.getElementById("popular-products-title").innerText = `Products at ${shopName}`;
    const container = document.getElementById("popular-products-grid");
    if (!container) return;

    if (data.length === 0) {
      container.innerHTML = `<p style="color: var(--gray-600);">No products found in this shop.</p>`;
      return;
    }

    container.innerHTML = data.map(prod => `
      <div class="card">
        <div>
          <div class="card-img">${prod.image || "📦"}</div>
          <div class="card-title">${prod.name}</div>
          <div class="card-subtitle">Stock: ${prod.stock} units</div>
        </div>
        <div class="card-footer">
          <div class="card-price">₹${prod.price}</div>
          <button onclick="addToCart(${prod.id}, '${escapeQuote(prod.name)}', ${prod.price}, ${prod.shop_id})" class="btn btn-primary btn-sm">+ Cart</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error("Filter shop error:", err);
  }
}

// ----------------------------------------------------
// CART & ORDER PLACEMENT
// ----------------------------------------------------
function addToCart(productId, name, price, shopId) {
  // If cart has items from a different shop, clear or confirm
  if (state.cart.length > 0 && state.cart[0].shopId !== shopId) {
    if (!confirm("Your cart has items from another shop. Clear cart to add this item?")) return;
    state.cart = [];
  }

  const existing = state.cart.find(i => i.productId === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({ productId, name, price, shopId, quantity: 1 });
  }

  updateCartBadge();
  alert(`Added '${name}' to cart!`);
}

function updateCartBadge() {
  const totalItems = state.cart.reduce((sum, i) => sum + i.quantity, 0);
  const badge = document.getElementById("cart-count-badge");
  if (badge) badge.innerText = totalItems;
}

function openCartModal() {
  const container = document.getElementById("cart-items-list");
  const totalEl = document.getElementById("cart-total-price");
  if (!container) return;

  if (state.cart.length === 0) {
    container.innerHTML = `<p style="color: var(--gray-600);">Your cart is empty.</p>`;
    totalEl.innerText = "0";
  } else {
    let total = 0;
    container.innerHTML = state.cart.map((item, idx) => {
      const itemTotal = item.price * item.quantity;
      total += itemTotal;
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid var(--gray-200); padding-bottom:8px;">
          <div>
            <div style="font-weight:700;">${item.name}</div>
            <div style="font-size:0.85rem; color:var(--gray-600);">₹${item.price} x ${item.quantity} = ₹${itemTotal}</div>
          </div>
          <div>
            <button onclick="changeCartQty(${idx}, -1)" class="btn btn-outline btn-sm">-</button>
            <span style="margin: 0 8px; font-weight:700;">${item.quantity}</span>
            <button onclick="changeCartQty(${idx}, 1)" class="btn btn-outline btn-sm">+</button>
          </div>
        </div>
      `;
    }).join('');
    totalEl.innerText = total;
  }

  // Pre-fill delivery address with current location
  const addrInput = document.getElementById("checkout-address");
  const landmarkInput = document.getElementById("checkout-landmark");
  if (addrInput) addrInput.value = state.location.address;
  if (landmarkInput) landmarkInput.value = state.location.landmark;

  openModal("cart-modal");
}

function changeCartQty(index, delta) {
  state.cart[index].quantity += delta;
  if (state.cart[index].quantity <= 0) {
    state.cart.splice(index, 1);
  }
  updateCartBadge();
  openCartModal();
}

async function placeOrder() {
  if (!state.token || !state.user) {
    alert("Please login as a Customer to place an order.");
    openModal("auth-modal");
    return;
  }

  if (state.cart.length === 0) {
    alert("Your cart is empty.");
    return;
  }

  const shopId = state.cart[0].shopId;
  const items = state.cart.map(i => ({ product_id: i.productId, quantity: i.quantity }));
  const deliveryAddress = document.getElementById("checkout-address")?.value || state.location.address;
  const landmark = document.getElementById("checkout-landmark")?.value || state.location.landmark;
  const paymentMethod = document.getElementById("checkout-payment")?.value || "COD";

  if (paymentMethod === "ONLINE_DEMO" && !isDemoPaymentValid()) return;

  const payload = {
    shop_id: shopId,
    items: items,
    delivery_address: deliveryAddress,
    landmark: landmark,
    latitude: state.location.lat,
    longitude: state.location.lng,
    payment_method: paymentMethod
  };

  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${state.token}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      alert(`Order Failed: ${err.detail || "Error placing order"}`);
      return;
    }

    const order = await res.json();
    state.cart = [];
    updateCartBadge();
    closeModal("cart-modal");

    alert(`🎉 Order #${order.id} Placed Successfully via ${paymentMethod}! Track status in Active Orders.`);
    loadCustomerOrders();
    loadPopularProducts(); // Stock decreased
  } catch (err) {
    console.error("Place order error:", err);
    alert("Network error while placing order.");
  }
}

function updatePaymentUI() {
  const isOnline = document.getElementById("checkout-payment")?.value === "ONLINE_DEMO";
  const paymentFields = document.getElementById("online-payment-fields");
  const paymentType = document.getElementById("online-payment-type")?.value || "UPI";
  const cardFields = document.getElementById("card-payment-fields");
  const upiInput = document.getElementById("upi-id-input");
  const placeButton = document.getElementById("place-order-btn");
  if (paymentFields) paymentFields.style.display = isOnline ? "block" : "none";
  if (cardFields) cardFields.style.display = isOnline && paymentType === "CARD" ? "block" : "none";
  if (upiInput) upiInput.style.display = isOnline && paymentType === "UPI" ? "block" : "none";
  if (placeButton) placeButton.textContent = isOnline ? "💳 Pay & Place Order" : "Confirm & Place Order";
}

function isDemoPaymentValid() {
  const paymentType = document.getElementById("online-payment-type")?.value || "UPI";
  if (paymentType === "UPI") {
    const upiId = document.getElementById("upi-id-input")?.value.trim();
    if (!upiId || !upiId.includes("@")) {
      alert("Enter a valid demo UPI ID, such as name@upi.");
      return false;
    }
    return true;
  }

  const cardNumber = document.getElementById("card-number-input")?.value.replace(/\s/g, "");
  const expiry = document.getElementById("card-expiry-input")?.value.trim();
  const cvv = document.getElementById("card-cvv-input")?.value.trim();
  if (!/^\d{12,19}$/.test(cardNumber) || !/^\d{2}\/\d{2}$/.test(expiry) || !/^\d{3,4}$/.test(cvv)) {
    alert("Enter valid demo card details.");
    return false;
  }
  return true;
}

// ----------------------------------------------------
// ORDER TRACKING & LIFECYCLE
// ----------------------------------------------------
async function loadCustomerOrders() {
  if (!state.token || !state.user || state.user.role !== "CUSTOMER") return;

  try {
    const res = await fetch(`${API_BASE}/customer/orders`, {
      headers: { "Authorization": `Bearer ${state.token}` }
    });
    const orders = await res.json();

    const container = document.getElementById("customer-orders-list");
    if (!container) return;

    if (orders.length === 0) {
      container.innerHTML = `<p style="color: var(--gray-600);">No active or past orders found.</p>`;
      return;
    }

    container.innerHTML = orders.map(order => renderOrderCard(order, "CUSTOMER")).join('');
    initializeCustomerTracking(orders);
  } catch (err) {
    console.error("Error loading customer orders:", err);
  }
}

function renderOrderCard(order, viewRole) {
  const steps = ["PLACED", "SHOP_ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"];
  const currentStepIdx = steps.indexOf(order.status);
  
  let actionButtons = "";
  
  if (viewRole === "SHOPKEEPER") {
    if (order.status === "PLACED") {
      actionButtons = `
        <button onclick="updateOrderStatus(${order.id}, 'SHOP_ACCEPTED')" class="btn btn-accent btn-sm">Accept Order</button>
        <button onclick="updateOrderStatus(${order.id}, 'REJECTED')" class="btn btn-danger btn-sm">Reject</button>
      `;
    } else if (order.status === "SHOP_ACCEPTED") {
      actionButtons = `<button onclick="updateOrderStatus(${order.id}, 'PREPARING')" class="btn btn-primary btn-sm">Start Preparing</button>`;
    } else if (order.status === "PREPARING") {
      actionButtons = `<button onclick="updateOrderStatus(${order.id}, 'READY_FOR_PICKUP')" class="btn btn-accent btn-sm">Mark Ready for Pickup</button>`;
    }
  } else if (viewRole === "DELIVERY_PARTNER") {
    if (!order.delivery_partner_id) {
      actionButtons = `<button onclick="acceptDeliveryRequest(${order.id})" class="btn btn-accent btn-sm">Accept Delivery Request</button>`;
    } else if (order.status === "READY_FOR_PICKUP") {
      actionButtons = `<button onclick="updateOrderStatus(${order.id}, 'PICKED_UP')" class="btn btn-primary btn-sm">Mark Order Picked Up</button>`;
    } else if (order.status === "PICKED_UP") {
      actionButtons = `<button onclick="updateOrderStatus(${order.id}, 'OUT_FOR_DELIVERY')" class="btn btn-primary btn-sm">Mark Out for Delivery</button>`;
    } else if (order.status === "OUT_FOR_DELIVERY") {
      actionButtons = `<button onclick="updateOrderStatus(${order.id}, 'DELIVERED')" class="btn btn-accent btn-sm">Mark Delivered</button>`;
    }
  } else if (viewRole === "CUSTOMER" && order.status === "DELIVERED") {
    actionButtons = `<button onclick="openRatingModal(${order.id}, ${order.shop_id})" class="btn btn-outline btn-sm">⭐ Rate Shop & Delivery</button>`;
  }

  const isLiveDelivery = viewRole === "CUSTOMER" && order.delivery_partner_id && ["PICKED_UP", "OUT_FOR_DELIVERY"].includes(order.status);
  const liveTracking = isLiveDelivery ? `
    <div class="live-delivery-panel">
      <div class="live-delivery-heading">🚴 Delivery partner location <span class="live-dot">LIVE</span></div>
      <div id="customer-tracking-${order.id}" class="customer-tracking-map"></div>
      <div id="customer-tracking-status-${order.id}" class="live-delivery-status">Waiting for the delivery partner's GPS location…</div>
    </div>` : "";

  return `
    <div class="card" style="margin-bottom: 20px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div class="card-title">Order #${order.id} • <span class="status-badge badge-${order.status}">${order.status}</span></div>
          <div class="card-subtitle">Shop: ${order.shop ? order.shop.name : 'Local Store'} | Paid: ₹${order.total_amount} (${order.payment_method})</div>
          <div style="font-size:0.85rem; color:var(--gray-600); margin-top:4px;">
            📍 Landmark Delivery Address: <strong>${order.landmark || order.delivery_address}</strong>
          </div>
        </div>
        <div>${actionButtons}</div>
      </div>

      <!-- VISUAL LIFECYCLE TIMELINE -->
      <div class="timeline">
        ${steps.map((step, idx) => {
          let stepClass = "";
          if (order.status === "REJECTED") {
            stepClass = "rejected";
          } else if (idx < currentStepIdx) {
            stepClass = "completed";
          } else if (idx === currentStepIdx) {
            stepClass = "active";
          }
          return `
            <div class="timeline-step ${stepClass}">
              ${idx + 1}
              <div class="timeline-label">${step.replace(/_/g, ' ')}</div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- ITEM LIST -->
      <div style="background:var(--gray-100); padding:10px; border-radius:8px; font-size:0.85rem;">
        <strong>Ordered Items:</strong>
        ${order.items.map(i => `<div>• ${i.product ? i.product.name : 'Product'} x${i.quantity} (₹${i.price})</div>`).join('')}
      </div>
      ${liveTracking}
    </div>
  `;
}

async function initializeCustomerTracking(orders) {
  const activeOrders = orders.filter(order => order.delivery_partner_id && ["PICKED_UP", "OUT_FOR_DELIVERY"].includes(order.status));
  for (const order of activeOrders) {
    const statusEl = document.getElementById(`customer-tracking-status-${order.id}`);
    try {
      const res = await fetch(`${API_BASE}/orders/${order.id}/delivery-location`, {
        headers: { "Authorization": `Bearer ${state.token}` }
      });
      if (!res.ok) {
        if (statusEl) statusEl.textContent = "Waiting for the delivery partner to share their location…";
        continue;
      }
      const location = await res.json();
      if (statusEl) statusEl.textContent = `Last updated ${new Date(location.updated_at).toLocaleTimeString()}`;
      renderCustomerTrackingMap(order, location);
    } catch (e) {
      if (statusEl) statusEl.textContent = "Live location is temporarily unavailable.";
    }
  }
}

function renderCustomerTrackingMap(order, location) {
  if (typeof L === "undefined") return;
  const mapId = `customer-tracking-${order.id}`;
  const mapEl = document.getElementById(mapId);
  if (!mapEl) return;
  let tracking = state.customerTrackingMaps[order.id];
  if (!tracking) {
    const map = L.map(mapId).setView([location.latitude, location.longitude], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
    tracking = { map, marker: null };
    state.customerTrackingMaps[order.id] = tracking;
  }
  tracking.map.invalidateSize();
  if (tracking.marker) tracking.map.removeLayer(tracking.marker);
  tracking.marker = L.marker([location.latitude, location.longitude]).addTo(tracking.map).bindPopup("🚴 Delivery partner").openPopup();
  tracking.map.setView([location.latitude, location.longitude], 15);
}

async function updateOrderStatus(orderId, status) {
  try {
    const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${state.token}`
      },
      body: JSON.stringify({ status })
    });
    
    if (!res.ok) {
      alert("Failed to update status.");
      return;
    }

    alert(`Order #${orderId} status updated to '${status}'!`);
    refreshCurrentRoleView();
  } catch (err) {
    console.error("Status update error:", err);
  }
}

// ----------------------------------------------------
// SHOPKEEPER DASHBOARD & DEMAND INSIGHTS
// ----------------------------------------------------
async function loadShopkeeperOrders() {
  if (!state.token || !state.user || state.user.role !== "SHOPKEEPER") return;
  try {
    const res = await fetch(`${API_BASE}/shopkeeper/orders`, {
      headers: { "Authorization": `Bearer ${state.token}` }
    });
    const orders = await res.json();
    const container = document.getElementById("shopkeeper-orders-list");
    if (!container) return;

    if (orders.length === 0) {
      container.innerHTML = `<p style="color: var(--gray-600);">No incoming orders for your shop yet.</p>`;
      return;
    }
    container.innerHTML = orders.map(order => renderOrderCard(order, "SHOPKEEPER")).join('');
  } catch (err) {
    console.error("Error loading shopkeeper orders:", err);
  }
}

async function loadShopkeeperProducts() {
  if (!state.token || !state.user || state.user.role !== "SHOPKEEPER") return;
  try {
    const res = await fetch(`${API_BASE}/products`);
    const products = await res.json();
    const container = document.getElementById("shopkeeper-products-list");
    if (!container) return;

    container.innerHTML = products.map(prod => `
      <div class="card">
        <div>
          <div class="card-img">${prod.image || '📦'}</div>
          <div class="card-title">${prod.name}</div>
          <div class="card-subtitle">Price: ₹${prod.price} | Stock: ${prod.stock}</div>
        </div>
        <div class="card-footer">
          <button onclick="editProductStock(${prod.id}, ${prod.stock})" class="btn btn-outline btn-sm">Edit Stock</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error("Error loading shopkeeper products:", err);
  }
}

async function loadShopkeeperInsights() {
  if (!state.token || !state.user || state.user.role !== "SHOPKEEPER") return;
  try {
    const res = await fetch(`${API_BASE}/shopkeeper/insights`, {
      headers: { "Authorization": `Bearer ${state.token}` }
    });
    const data = await res.json();

    document.getElementById("insight-total-orders").innerText = data.total_orders;
    document.getElementById("insight-total-revenue").innerText = `₹${data.total_revenue}`;
    document.getElementById("insight-demand-trend").innerText = data.demand_trend;

    const lowStockContainer = document.getElementById("insight-low-stock-list");
    if (data.low_stock_products.length === 0) {
      lowStockContainer.innerHTML = `<p style="color:var(--accent-hover); font-weight:600;">✓ All stock levels healthy!</p>`;
    } else {
      lowStockContainer.innerHTML = data.low_stock_products.map(p => `
        <div style="color:var(--danger); font-weight:700; margin-bottom:4px;">
          ⚠️ ${p.name} - Only ${p.stock} remaining!
        </div>
      `).join('');
    }
  } catch (err) {
    console.error("Error loading insights:", err);
  }
}

async function addProductSubmit() {
  const shopId = 1; // Default Sharma Grocery / user's shop for demo
  const name = document.getElementById("prod-name-input")?.value;
  const category = document.getElementById("prod-cat-input")?.value || "Grocery";
  const price = parseFloat(document.getElementById("prod-price-input")?.value || 0);
  const stock = parseInt(document.getElementById("prod-stock-input")?.value || 10);
  const image = document.getElementById("prod-icon-input")?.value || "🌾";

  if (!name || price <= 0) {
    alert("Please enter valid product name and price.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${state.token}`
      },
      body: JSON.stringify({ shop_id: shopId, name, category, price, stock, image })
    });

    if (res.ok) {
      alert(`Product '${name}' added to your shop inventory!`);
      closeModal("add-product-modal");
      loadShopkeeperProducts();
      loadPopularProducts();
    } else {
      alert("Failed to add product.");
    }
  } catch (err) {
    console.error("Add product error:", err);
  }
}

async function editProductStock(prodId, currentStock) {
  const newStock = prompt("Enter new stock quantity:", currentStock);
  if (newStock === null) return;

  try {
    const res = await fetch(`${API_BASE}/products/${prodId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${state.token}`
      },
      body: JSON.stringify({ stock: parseInt(newStock) })
    });
    if (res.ok) {
      loadShopkeeperProducts();
      loadPopularProducts();
    }
  } catch (err) {
    console.error("Edit stock error:", err);
  }
}

// ----------------------------------------------------
// DELIVERY PARTNER DASHBOARD
// ----------------------------------------------------
function startDeliveryLocationSharing() {
  if (state.locationWatchId || !navigator.geolocation) return;
  state.locationWatchId = navigator.geolocation.watchPosition(async position => {
    try {
      await fetch(`${API_BASE}/delivery/location`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${state.token}` },
        body: JSON.stringify({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6))
        })
      });
    } catch (err) {
      console.error("Delivery location update error:", err);
    }
  }, err => console.warn("Delivery location unavailable:", err.message), { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });
}

function stopDeliveryLocationSharing() {
  if (state.locationWatchId !== null) {
    navigator.geolocation.clearWatch(state.locationWatchId);
    state.locationWatchId = null;
  }
}

async function loadDeliveryRequests() {
  if (!state.token || !state.user || state.user.role !== "DELIVERY_PARTNER") return;
  try {
    const res = await fetch(`${API_BASE}/delivery/requests`, {
      headers: { "Authorization": `Bearer ${state.token}` }
    });
    const requests = await res.json();
    const container = document.getElementById("delivery-requests-list");
    if (!container) return;

    if (requests.length === 0) {
      container.innerHTML = `<p style="color: var(--gray-600);">No available delivery requests nearby right now.</p>`;
      return;
    }
    container.innerHTML = requests.map(order => renderOrderCard(order, "DELIVERY_PARTNER")).join('');
  } catch (err) {
    console.error("Error loading delivery requests:", err);
  }
}

async function acceptDeliveryRequest(orderId) {
  try {
    const res = await fetch(`${API_BASE}/delivery/accept/${orderId}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${state.token}` }
    });
    if (res.ok) {
      alert(`Accepted delivery for Order #${orderId}! Navigating to shop pickup...`);
      loadDeliveryRequests();
      loadDeliveryHistory();
    } else {
      const err = await res.json();
      alert(`Accept failed: ${err.detail}`);
    }
  } catch (err) {
    console.error("Accept delivery error:", err);
  }
}

async function loadDeliveryHistory() {
  if (!state.token || !state.user || state.user.role !== "DELIVERY_PARTNER") return;
  try {
    const res = await fetch(`${API_BASE}/delivery/history`, {
      headers: { "Authorization": `Bearer ${state.token}` }
    });
    const deliveries = await res.json();
    const container = document.getElementById("delivery-history-list");
    if (!container) return;

    const completed = deliveries.filter(d => d.status === "DELIVERED");
    const earnings = completed.length * 40; // ₹40 per delivery incentive for local partners

    document.getElementById("rider-deliveries-count").innerText = completed.length;
    document.getElementById("rider-earnings-total").innerText = `₹${earnings}`;

    if (deliveries.length === 0) {
      container.innerHTML = `<p style="color: var(--gray-600);">No assigned deliveries yet.</p>`;
      return;
    }
    container.innerHTML = deliveries.map(order => renderOrderCard(order, "DELIVERY_PARTNER")).join('');

    // Trigger Leaflet live route map for the active delivery
    const activeOrder = deliveries.find(d => d.status !== "DELIVERED" && d.status !== "REJECTED") || deliveries[0];
    if (activeOrder && activeOrder.shop) {
      initDeliveryRouteMap(
        activeOrder.shop.latitude, 
        activeOrder.shop.longitude, 
        activeOrder.latitude || 18.5204, 
        activeOrder.longitude || 73.8567, 
        activeOrder.shop.name, 
        activeOrder.landmark || activeOrder.delivery_address
      );
    }
  } catch (err) {
    console.error("Error loading delivery history:", err);
  }
}

// ----------------------------------------------------
// ADMIN DASHBOARD
// ----------------------------------------------------
async function loadAdminDashboard() {
  if (!state.token || !state.user || state.user.role !== "ADMIN") return;
  try {
    const res = await fetch(`${API_BASE}/admin/dashboard`, {
      headers: { "Authorization": `Bearer ${state.token}` }
    });
    const data = await res.json();

    document.getElementById("admin-total-users").innerText = data.metrics.total_users;
    document.getElementById("admin-total-shops").innerText = data.metrics.total_shops;
    document.getElementById("admin-total-orders").innerText = data.metrics.total_orders;
    document.getElementById("admin-total-sales").innerText = `₹${data.metrics.total_sales}`;

    const shopTable = document.getElementById("admin-shops-table");
    if (shopTable) {
      shopTable.innerHTML = data.shops.map(s => `
        <tr>
          <td>#${s.id}</td>
          <td><strong>${s.name}</strong></td>
          <td>${s.category}</td>
          <td>${s.landmark || s.address}</td>
          <td>${s.verified ? '✅ Verified' : '❌ Pending'}</td>
          <td>
            <button onclick="toggleVerifyShop(${s.id}, ${!s.verified})" class="btn btn-sm ${s.verified ? 'btn-outline' : 'btn-accent'}">
              ${s.verified ? 'Unverify' : 'Verify Shop'}
            </button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error("Error loading admin dashboard:", err);
  }
}

async function toggleVerifyShop(shopId, verified) {
  try {
    const res = await fetch(`${API_BASE}/admin/shops/${shopId}/verify?verified=${verified}`, {
      method: "PUT",
      headers: { "Authorization": `Bearer ${state.token}` }
    });
    if (res.ok) {
      loadAdminDashboard();
    }
  } catch (err) {
    console.error("Verify shop error:", err);
  }
}

// ----------------------------------------------------
// RATING MODAL
// ----------------------------------------------------
function openRatingModal(orderId, shopId) {
  document.getElementById("rating-order-id").value = orderId;
  document.getElementById("rating-shop-id").value = shopId;
  openModal("rating-modal");
}

async function submitRating() {
  const orderId = parseInt(document.getElementById("rating-order-id").value);
  const shopId = parseInt(document.getElementById("rating-shop-id").value);
  const rating = parseFloat(document.getElementById("rating-score-select").value);
  const review = document.getElementById("rating-review-text").value;

  try {
    const res = await fetch(`${API_BASE}/ratings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${state.token}`
      },
      body: JSON.stringify({ order_id: orderId, shop_id: shopId, rating, review })
    });

    if (res.ok) {
      alert("Thank you! Your rating and review have been submitted.");
      closeModal("rating-modal");
      loadNearbyShops();
    } else {
      alert("Error submitting rating.");
    }
  } catch (err) {
    console.error("Submit rating error:", err);
  }
}

// ----------------------------------------------------
// SPECIAL FEATURE: LOW-BANDWIDTH MODE TOGGLE
// ----------------------------------------------------
function toggleLowBandwidth() {
  state.lowBandwidth = !state.lowBandwidth;
  if (state.lowBandwidth) {
    document.body.classList.add("low-bandwidth-active");
    document.getElementById("btn-low-bw").innerText = "⚡ High-Speed Mode";
    alert("⚡ Low-Bandwidth Mode Enabled: Optimized for 2G/3G connections with minimal data usage!");
  } else {
    document.body.classList.remove("low-bandwidth-active");
    document.getElementById("btn-low-bw").innerText = "📶 Low-Bandwidth Mode";
  }
}

// ----------------------------------------------------
// REAL-TIME POLLING & UTILS
// ----------------------------------------------------
function startOrderPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(() => {
    refreshCurrentRoleView();
  }, 3000); // 3 seconds poll for quick hackathon updates
}

function refreshCurrentRoleView() {
  if (state.activeRoleView === "CUSTOMER") {
    loadCustomerOrders();
  } else if (state.activeRoleView === "SHOPKEEPER") {
    loadShopkeeperOrders();
    loadShopkeeperInsights();
  } else if (state.activeRoleView === "DELIVERY_PARTNER") {
    loadDeliveryRequests();
    loadDeliveryHistory();
  } else if (state.activeRoleView === "ADMIN") {
    loadAdminDashboard();
  }
}

function openModal(id) {
  document.getElementById(id).style.display = "flex";
}

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

function escapeQuote(str) {
  return str ? str.replace(/'/g, "\\'") : '';
}
