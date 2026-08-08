/* ══════════════════════════════════════════════
   HYPERLOCAL CONNECT — Main Application JS
   All functions updated for new HTML structure
══════════════════════════════════════════════ */

const API_BASE = "";

const state = {
  token: localStorage.getItem("token") || null,
  user: JSON.parse(localStorage.getItem("user")) || null,
  activeRoleView: "CUSTOMER",
  location: { lat: 18.5204, lng: 73.8567, address: "Town Main Chowk", landmark: "Near Ganesh Temple, opposite City School" },
  cart: [],
  lowBandwidth: false,
  pollTimer: null,
  shopsMap: null,
  shopsMarkers: [],
  pickerMap: null,
  pickerMarker: null,
  routeMap: null,
  routePolyline: null,
  riderMarker: null
};

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => initApp());

function initApp() {
  bindEvents();
  updateAuthUI();
  updateLocationUI();

  if (localStorage.getItem("darkMode") === "true") {
    document.body.classList.add("dark-mode");
    const btn = document.getElementById("theme-toggle-btn");
    if (btn) btn.title = "Light Mode";
  }

  if (state.token && state.user) {
    switchRoleView(state.user.role);
  } else {
    switchRoleView("CUSTOMER");
  }

  loadNearbyShops();
  loadPopularProducts();
  startOrderPolling();
}

function bindEvents() {
  document.getElementById("btn-low-bw")?.addEventListener("click", toggleLowBandwidth);
  document.getElementById("search-btn")?.addEventListener("click", handleSearch);
  document.getElementById("search-input")?.addEventListener("keypress", e => { if (e.key === "Enter") handleSearch(); });

  document.querySelectorAll(".demo-login-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      const email = e.target.dataset.email;
      const pass = e.target.dataset.pass || "password123";
      performLogin(email, pass);
    });
  });

  document.querySelectorAll(".role-pill").forEach(pill => {
    pill.addEventListener("click", e => {
      const role = e.currentTarget.dataset.role;
      switchRoleView(role);
    });
  });
}

// ──────────────────────────────────────────────
// DARK MODE & LOW BANDWIDTH
// ──────────────────────────────────────────────
function toggleDarkMode() {
  const isDark = document.body.classList.toggle("dark-mode");
  localStorage.setItem("darkMode", isDark);
  const btn = document.getElementById("theme-toggle-btn");
  if (btn) btn.textContent = isDark ? "☀️" : "🌙";
}

function toggleLowBandwidth() {
  state.lowBandwidth = !state.lowBandwidth;
  document.body.classList.toggle("low-bw", state.lowBandwidth);
  const btn = document.getElementById("btn-low-bw");
  if (btn) btn.textContent = state.lowBandwidth ? "⚡" : "📶";
}

// ──────────────────────────────────────────────
// CATEGORY FILTER
// ──────────────────────────────────────────────
async function filterCategory(event, category) {
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
  event.target.classList.add("active");
  if (category === "ALL") { loadPopularProducts(); return; }
  try {
    const res = await fetch(`${API_BASE}/products`);
    const products = await res.json();
    const filtered = products.filter(p => p.category.toLowerCase().includes(category.toLowerCase()));
    renderProductCards(filtered, "popular-products-grid");
  } catch (e) { console.error(e); }
}

// ──────────────────────────────────────────────
// AUTH
// ──────────────────────────────────────────────
async function performLogin(email, password) {
  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) { const e = await res.json(); alert(`Login failed: ${e.detail}`); return; }
    const data = await res.json();
    state.token = data.access_token;
    state.user  = data.user;
    localStorage.setItem("token", state.token);
    localStorage.setItem("user",  JSON.stringify(state.user));
    updateAuthUI();
    switchRoleView(state.user.role);
    closeModal("auth-modal");
    alert(`Welcome, ${state.user.name}! (${state.user.role})`);
  } catch (e) { console.error(e); alert("Network error."); }
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
  const password = document.getElementById("register-pass").value;
  const role = document.getElementById("register-role").value;

  if (!name || !email || !phone || !password) {
    alert("Please complete all registration fields.");
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
      body: JSON.stringify({ name, email, phone, password, role })
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

function logout() {
  state.token = null;
  state.user  = null;
  state.cart  = [];
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  updateAuthUI();
  updateCartBadge();
  switchRoleView("CUSTOMER");
  alert("Logged out.");
}

function updateAuthUI() {
  const c = document.getElementById("auth-status-container");
  if (!c) return;
  if (state.user) {
    c.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:.8rem;font-weight:600;color:var(--c-muted);">${state.user.name}</span>
        <button onclick="logout()" class="btn btn-outline btn-sm">Logout</button>
      </div>`;
  } else {
    c.innerHTML = `<button onclick="openModal('auth-modal')" class="btn btn-primary btn-sm">Login</button>`;
  }
}

// ──────────────────────────────────────────────
// ROLE SWITCHER
// ──────────────────────────────────────────────
function switchRoleView(role) {
  state.activeRoleView = role;

  document.querySelectorAll(".role-pill").forEach(p => {
    p.classList.toggle("active", p.dataset.role === role);
  });

  document.querySelectorAll(".view-section").forEach(s => s.style.display = "none");

  if (role === "CUSTOMER")          { document.getElementById("customer-view").style.display = ""; loadCustomerOrders(); }
  else if (role === "SHOPKEEPER")   { document.getElementById("shopkeeper-view").style.display = ""; loadShopkeeperOrders(); loadShopkeeperProducts(); loadShopkeeperInsights(); }
  else if (role === "DELIVERY_PARTNER") { document.getElementById("delivery-view").style.display = ""; loadDeliveryRequests(); loadDeliveryHistory(); }
  else if (role === "ADMIN")        { document.getElementById("admin-view").style.display = ""; loadAdminDashboard(); }
}

// ──────────────────────────────────────────────
// LOCATION
// ──────────────────────────────────────────────
function updateLocationUI() {
  const el = document.getElementById("current-location-text");
  if (el) el.textContent = `${state.location.address} · ${state.location.landmark}`;
}

function openLocationModal() {
  openModal("location-modal");
  setTimeout(() => {
    if (typeof L === "undefined") return;
    if (!state.pickerMap) {
      state.pickerMap = L.map("picker-leaflet-map").setView([state.location.lat, state.location.lng], 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(state.pickerMap);
      state.pickerMap.on("click", e => {
        const lat = roundCoord(e.latlng.lat), lng = roundCoord(e.latlng.lng);
        document.getElementById("loc-lat-input").value = lat;
        document.getElementById("loc-lng-input").value = lng;
        if (state.pickerMarker) state.pickerMap.removeLayer(state.pickerMarker);
        state.pickerMarker = L.marker([lat, lng]).addTo(state.pickerMap).bindPopup("📍 Your Location").openPopup();
      });
    } else {
      state.pickerMap.invalidateSize();
      state.pickerMap.setView([state.location.lat, state.location.lng], 14);
    }
    if (state.pickerMarker) state.pickerMap.removeLayer(state.pickerMarker);
    state.pickerMarker = L.marker([state.location.lat, state.location.lng]).addTo(state.pickerMap);
  }, 200);
}

function useBrowserGPS() {
  if (!navigator.geolocation) { alert("GPS not supported."); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    state.location.lat = roundCoord(pos.coords.latitude);
    state.location.lng = roundCoord(pos.coords.longitude);
    state.location.address = `GPS Location (${state.location.lat}, ${state.location.lng})`;
    updateLocationUI();
    closeModal("location-modal");
    loadNearbyShops();
    alert("Location updated via GPS!");
  }, err => alert(`GPS Error: ${err.message}`));
}

function saveManualLocation() {
  const addr = document.getElementById("loc-address-input")?.value;
  const land = document.getElementById("loc-landmark-input")?.value;
  const lat  = parseFloat(document.getElementById("loc-lat-input")?.value || 18.5204);
  const lng  = parseFloat(document.getElementById("loc-lng-input")?.value || 73.8567);
  if (addr) state.location.address  = addr;
  if (land) state.location.landmark = land;
  state.location.lat = lat;
  state.location.lng = lng;
  updateLocationUI();
  closeModal("location-modal");
  loadNearbyShops();
}

function roundCoord(n) { return Math.round(n * 10000) / 10000; }

// ──────────────────────────────────────────────
// SEARCH + SMART RECOMMENDATION
// ──────────────────────────────────────────────
async function handleSearch() {
  const q = document.getElementById("search-input")?.value?.trim();
  const recSection = document.getElementById("smart-rec-section");
  if (!q) { if (recSection) recSection.style.display = "none"; return; }

  try {
    const res  = await fetch(`${API_BASE}/search?query=${encodeURIComponent(q)}&lat=${state.location.lat}&lng=${state.location.lng}`);
    const recs = await res.json();
    const container = document.getElementById("smart-rec-results");
    if (!container) return;
    recSection.style.display = "";

    if (!recs || recs.length === 0) {
      container.innerHTML = `<p style="color:var(--c-muted);padding:16px;">No products found for "<strong>${q}</strong>". Try "Rice", "Milk", or "Paracetamol".</p>`;
      return;
    }

    const top = recs[0];
    let html = `
      <div class="rec-card">
        <div class="rec-top-badge">⭐ Top Match</div>
        <div class="rec-product-name">${top.product.name}</div>
        <div class="rec-shop-info">🏪 ${top.shop.name} · ${top.shop.category} · ${top.shop.landmark || top.shop.address}</div>
        <div class="rec-score-pill">💡 Smart Score: <strong>${top.score}</strong></div>
        <div class="rec-reasons">
          ${top.reasons.map(r => `<div class="reason-item">${r}</div>`).join("")}
        </div>
        <div style="display:flex;gap:10px;margin-top:16px;align-items:center;">
          <span style="font-size:1.6rem;font-weight:900;font-family:'Outfit',sans-serif;color:var(--c-accent);">₹${top.product.price}</span>
          <button onclick="addToCart(${top.product.id},'${escapeQ(top.product.name)}',${top.product.price},${top.shop.id})" class="btn btn-accent">🛒 Add to Cart</button>
        </div>
      </div>`;

    if (recs.length > 1) {
      html += `<h3 class="section-title" style="margin:18px 0 12px;">Other Matches</h3><div class="cards-grid">`;
      recs.slice(1).forEach(item => {
        html += `
          <div class="card">
            <div class="card-emoji">${item.product.image || "📦"}</div>
            <div class="card-title">${item.product.name}</div>
            <div class="card-sub">🏪 ${item.shop.name} · ${item.distance_km} km</div>
            <div class="card-footer">
              <span class="card-price">₹${item.product.price}</span>
              <button onclick="addToCart(${item.product.id},'${escapeQ(item.product.name)}',${item.product.price},${item.shop.id})" class="btn btn-primary btn-sm">+ Add</button>
            </div>
          </div>`;
      });
      html += `</div>`;
    }
    container.innerHTML = html;
  } catch (e) { console.error(e); }
}

// ──────────────────────────────────────────────
// NEARBY SHOPS + LEAFLET MAP
// ──────────────────────────────────────────────
async function loadNearbyShops() {
  try {
    const res  = await fetch(`${API_BASE}/nearby-shops?lat=${state.location.lat}&lng=${state.location.lng}`);
    const data = await res.json();
    const container = document.getElementById("nearby-shops-grid");
    if (!container) return;

    container.innerHTML = data.map(item => `
      <div class="card">
        <div class="card-emoji">🏪</div>
        <div class="card-title">${item.shop.name}</div>
        <div class="card-sub">${item.shop.category}</div>
        <div class="card-rating">★ ${item.shop.rating} · ${item.distance_km} km</div>
        <div style="font-size:.78rem;color:var(--c-muted);margin-top:-2px;">📍 ${item.shop.landmark || item.shop.address}</div>
        <button onclick="filterShopProducts(${item.shop.id},'${escapeQ(item.shop.name)}')" class="btn btn-outline btn-sm" style="margin-top:8px;width:100%;">View Products</button>
      </div>`).join("");

    renderShopsOnMap(data);
  } catch (e) { console.error(e); }
}

function renderShopsOnMap(shopsData) {
  if (typeof L === "undefined") return;
  const el = document.getElementById("shops-leaflet-map");
  if (!el) return;

  if (!state.shopsMap) {
    state.shopsMap = L.map("shops-leaflet-map").setView([state.location.lat, state.location.lng], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(state.shopsMap);
  } else {
    state.shopsMap.setView([state.location.lat, state.location.lng], 14);
  }

  state.shopsMarkers.forEach(m => state.shopsMap.removeLayer(m));
  state.shopsMarkers = [];

  // Customer pin
  const custPin = L.circleMarker([state.location.lat, state.location.lng], {
    radius: 10, fillColor: "#4f46e5", color: "#fff", weight: 2.5, fillOpacity: 1
  }).addTo(state.shopsMap).bindPopup(`<b>📍 Your Location</b><br>${state.location.landmark}`);
  state.shopsMarkers.push(custPin);

  shopsData.forEach(({ shop, distance_km }) => {
    const m = L.marker([shop.latitude, shop.longitude]).addTo(state.shopsMap);
    m.bindPopup(`
      <div style="font-family:'Outfit',sans-serif;min-width:200px;">
        <div style="font-weight:800;font-size:1rem;color:#4f46e5;">🏪 ${shop.name}</div>
        <div style="font-size:.82rem;color:#64748b;margin:3px 0;">${shop.category} · ★ ${shop.rating}</div>
        <div style="font-size:.78rem;color:#64748b;">📍 ${shop.landmark || shop.address} (${distance_km} km)</div>
        <button onclick="filterShopProducts(${shop.id},'${escapeQ(shop.name)}')" style="margin-top:8px;background:#10b981;color:#fff;border:none;padding:6px 12px;border-radius:8px;cursor:pointer;font-weight:700;font-size:.82rem;width:100%;">View Products</button>
      </div>`);
    state.shopsMarkers.push(m);
  });
}

// ──────────────────────────────────────────────
// PRODUCTS
// ──────────────────────────────────────────────
async function loadPopularProducts() {
  try {
    const res  = await fetch(`${API_BASE}/products`);
    const data = await res.json();
    renderProductCards(data, "popular-products-grid");
  } catch (e) { console.error(e); }
}

function renderProductCards(products, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!products || products.length === 0) {
    container.innerHTML = `<p style="color:var(--c-muted);">No products found.</p>`;
    return;
  }
  container.innerHTML = products.map(prod => `
    <div class="card">
      <div class="card-emoji">${prod.image || "📦"}</div>
      <div class="card-title">${prod.name}</div>
      <div class="card-sub">${prod.category} · Stock: ${prod.stock}</div>
      <div class="card-footer">
        <span class="card-price">₹${prod.price}</span>
        <button onclick="addToCart(${prod.id},'${escapeQ(prod.name)}',${prod.price},${prod.shop_id})" class="btn btn-primary btn-sm">+ Cart</button>
      </div>
    </div>`).join("");
}

async function filterShopProducts(shopId, shopName) {
  try {
    const res  = await fetch(`${API_BASE}/products?shop_id=${shopId}`);
    const data = await res.json();
    const title = document.getElementById("popular-products-title");
    if (title) title.textContent = `Products at ${shopName}`;
    renderProductCards(data, "popular-products-grid");
  } catch (e) { console.error(e); }
}

// ──────────────────────────────────────────────
// CART
// ──────────────────────────────────────────────
function addToCart(productId, name, price, shopId) {
  if (state.cart.length > 0 && state.cart[0].shopId !== shopId) {
    if (!confirm("Cart has items from another shop. Clear cart and add this item?")) return;
    state.cart = [];
  }
  const existing = state.cart.find(i => i.productId === productId);
  if (existing) existing.quantity++;
  else state.cart.push({ productId, name, price, shopId, quantity: 1 });
  updateCartBadge();
  alert(`✅ "${name}" added to cart!`);
}

function updateCartBadge() {
  const total = state.cart.reduce((s, i) => s + i.quantity, 0);
  const badge = document.getElementById("cart-count-badge");
  if (badge) badge.textContent = total;
}

function openCartModal() {
  const list  = document.getElementById("cart-items-list");
  const total = document.getElementById("cart-total-price");
  if (!list) return;

  if (state.cart.length === 0) {
    list.innerHTML = `<p style="color:var(--c-muted);text-align:center;padding:20px;">Your cart is empty 🛒</p>`;
    if (total) total.textContent = "0";
  } else {
    let sum = 0;
    list.innerHTML = state.cart.map((item, idx) => {
      const t = item.price * item.quantity;
      sum += t;
      return `
        <div class="cart-item">
          <div>
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-price">₹${item.price} × ${item.quantity} = ₹${t.toFixed(2)}</div>
          </div>
          <div class="cart-item-qty">
            <button class="qty-btn" onclick="changeCartQty(${idx},-1)">−</button>
            <span>${item.quantity}</span>
            <button class="qty-btn" onclick="changeCartQty(${idx},1)">+</button>
          </div>
        </div>`;
    }).join("");
    if (total) total.textContent = sum.toFixed(2);
  }

  const addr = document.getElementById("checkout-address");
  const land = document.getElementById("checkout-landmark");
  if (addr) addr.value = state.location.address;
  if (land) land.value = state.location.landmark;
  openModal("cart-modal");
}

function changeCartQty(index, delta) {
  state.cart[index].quantity += delta;
  if (state.cart[index].quantity <= 0) state.cart.splice(index, 1);
  updateCartBadge();
  openCartModal();
}

async function placeOrder() {
  if (!state.token || !state.user) { alert("Please login first."); openModal("auth-modal"); return; }
  if (state.cart.length === 0) { alert("Cart is empty."); return; }

  const shopId  = state.cart[0].shopId;
  const items   = state.cart.map(i => ({ product_id: i.productId, quantity: i.quantity }));
  const addr    = document.getElementById("checkout-address")?.value || state.location.address;
  const land    = document.getElementById("checkout-landmark")?.value || state.location.landmark;
  const payment = document.getElementById("checkout-payment")?.value || "COD";

  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${state.token}` },
      body: JSON.stringify({ shop_id: shopId, items, delivery_address: addr, landmark: land, latitude: state.location.lat, longitude: state.location.lng, payment_method: payment })
    });
    if (!res.ok) { const e = await res.json(); alert(`Order Failed: ${e.detail}`); return; }
    const order = await res.json();
    state.cart = [];
    updateCartBadge();
    closeModal("cart-modal");
    alert(`🎉 Order #${order.id} placed successfully!`);
    loadCustomerOrders();
    loadPopularProducts();
  } catch (e) { console.error(e); alert("Network error."); }
}

// ──────────────────────────────────────────────
// ORDER RENDERING (shared across roles)
// ──────────────────────────────────────────────
const STEPS = ["PLACED","SHOP_ACCEPTED","PREPARING","READY_FOR_PICKUP","PICKED_UP","OUT_FOR_DELIVERY","DELIVERED"];
const STEP_SHORT = ["Placed","Accepted","Preparing","Ready","Picked","On Way","Done"];

function renderOrderCard(order, viewRole) {
  const ci = STEPS.indexOf(order.status);

  let actions = "";
  if (viewRole === "SHOPKEEPER") {
    if (order.status === "PLACED")        actions = `<button onclick="updateOrderStatus(${order.id},'SHOP_ACCEPTED')" class="btn btn-accent btn-sm">✅ Accept</button><button onclick="updateOrderStatus(${order.id},'REJECTED')" class="btn btn-danger btn-sm">❌ Reject</button>`;
    else if (order.status === "SHOP_ACCEPTED") actions = `<button onclick="updateOrderStatus(${order.id},'PREPARING')" class="btn btn-primary btn-sm">👨‍🍳 Start Preparing</button>`;
    else if (order.status === "PREPARING")     actions = `<button onclick="updateOrderStatus(${order.id},'READY_FOR_PICKUP')" class="btn btn-accent btn-sm">📦 Ready for Pickup</button>`;
  } else if (viewRole === "DELIVERY_PARTNER") {
    if (!order.delivery_partner_id)            actions = `<button onclick="acceptDeliveryRequest(${order.id})" class="btn btn-accent btn-sm">🤝 Accept Delivery</button>`;
    else if (order.status === "READY_FOR_PICKUP") actions = `<button onclick="updateOrderStatus(${order.id},'PICKED_UP')" class="btn btn-primary btn-sm">📦 Mark Picked Up</button>`;
    else if (order.status === "PICKED_UP")        actions = `<button onclick="updateOrderStatus(${order.id},'OUT_FOR_DELIVERY')" class="btn btn-primary btn-sm">🚴 Out for Delivery</button>`;
    else if (order.status === "OUT_FOR_DELIVERY") actions = `<button onclick="updateOrderStatus(${order.id},'DELIVERED')" class="btn btn-accent btn-sm">✅ Mark Delivered</button>`;
  } else if (viewRole === "CUSTOMER" && order.status === "DELIVERED") {
    actions = `<button onclick="openRatingModal(${order.id},${order.shop_id})" class="btn btn-outline btn-sm">⭐ Rate</button>`;
  }

  // Timeline steps
  const tlHtml = STEPS.map((step, idx) => {
    let cls = "";
    if (order.status === "REJECTED") { cls = idx === 0 ? "rejected" : ""; }
    else if (idx < ci)  cls = "done";
    else if (idx === ci) cls = "current";
    return `<div class="tl-step ${cls}">${idx+1}<div class="tl-label">${STEP_SHORT[idx]}</div></div>`;
  }).join("");

  return `
    <div class="order-card">
      <div class="order-top">
        <div>
          <div class="order-id">Order #${order.id} <span class="badge badge-${order.status}">${order.status.replace(/_/g," ")}</span></div>
          <div class="order-meta">🏪 ${order.shop?.name || "Shop"} · ₹${order.total_amount} · ${order.payment_method}</div>
          <div class="order-landmark">📍 ${order.landmark || order.delivery_address}</div>
        </div>
        <div class="order-actions">${actions}</div>
      </div>
      <div class="timeline-wrap">${tlHtml}</div>
      <div class="order-items-box">
        🛍️ <strong>Items:</strong> ${order.items?.map(i => `${i.product?.name || "Product"} ×${i.quantity} (₹${i.price})`).join("  ·  ") || "—"}
      </div>
    </div>`;
}

async function updateOrderStatus(orderId, status) {
  try {
    const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${state.token}` },
      body: JSON.stringify({ status })
    });
    if (!res.ok) { alert("Status update failed."); return; }
    refreshCurrentRoleView();
  } catch (e) { console.error(e); }
}

// ──────────────────────────────────────────────
// CUSTOMER ORDERS
// ──────────────────────────────────────────────
async function loadCustomerOrders() {
  if (!state.token || state.user?.role !== "CUSTOMER") return;
  try {
    const res    = await fetch(`${API_BASE}/customer/orders`, { headers: { "Authorization": `Bearer ${state.token}` } });
    const orders = await res.json();
    const c = document.getElementById("customer-orders-list");
    if (!c) return;
    c.innerHTML = orders.length ? orders.map(o => renderOrderCard(o, "CUSTOMER")).join("") : `<p style="color:var(--c-muted);">No orders yet. Start shopping!</p>`;
  } catch (e) { console.error(e); }
}

// ──────────────────────────────────────────────
// SHOPKEEPER
// ──────────────────────────────────────────────
async function loadShopkeeperOrders() {
  if (!state.token || state.user?.role !== "SHOPKEEPER") return;
  try {
    const res    = await fetch(`${API_BASE}/shopkeeper/orders`, { headers: { "Authorization": `Bearer ${state.token}` } });
    const orders = await res.json();
    const c = document.getElementById("shopkeeper-orders-list");
    if (!c) return;
    c.innerHTML = orders.length ? orders.map(o => renderOrderCard(o, "SHOPKEEPER")).join("") : `<p style="color:var(--c-muted);">No incoming orders yet.</p>`;
  } catch (e) { console.error(e); }
}

async function loadShopkeeperProducts() {
  if (!state.token || state.user?.role !== "SHOPKEEPER") return;
  try {
    const res  = await fetch(`${API_BASE}/products`);
    const data = await res.json();
    const c = document.getElementById("shopkeeper-products-list");
    if (!c) return;
    c.innerHTML = data.map(p => `
      <div class="card">
        <div class="card-emoji">${p.image || "📦"}</div>
        <div class="card-title">${p.name}</div>
        <div class="card-sub">${p.category}</div>
        <div class="card-footer">
          <span class="card-price">₹${p.price}</span>
          <span style="font-size:.8rem;font-weight:700;color:${p.stock<=10?"var(--c-danger)":"var(--c-muted)"};">Stock: ${p.stock}</span>
        </div>
        <button onclick="editProductStock(${p.id},${p.stock})" class="btn btn-outline btn-sm" style="margin-top:8px;width:100%;">Edit Stock</button>
      </div>`).join("");
  } catch (e) { console.error(e); }
}

async function loadShopkeeperInsights() {
  if (!state.token || state.user?.role !== "SHOPKEEPER") return;
  try {
    const res  = await fetch(`${API_BASE}/shopkeeper/insights`, { headers: { "Authorization": `Bearer ${state.token}` } });
    const data = await res.json();
    const ord  = document.getElementById("insight-total-orders");
    const rev  = document.getElementById("insight-total-revenue");
    const trend= document.getElementById("insight-demand-trend");
    const low  = document.getElementById("insight-low-stock-list");
    if (ord)   ord.textContent   = data.total_orders;
    if (rev)   rev.textContent   = `₹${data.total_revenue}`;
    if (trend) trend.textContent = data.demand_trend;
    if (low) {
      low.innerHTML = data.low_stock_products.length
        ? data.low_stock_products.map(p => `<div style="color:var(--c-danger);font-weight:700;margin-bottom:6px;">⚠️ ${p.name} — Only ${p.stock} units left</div>`).join("")
        : `<p style="color:var(--c-accent);font-weight:600;">✅ All stock levels healthy!</p>`;
    }
  } catch (e) { console.error(e); }
}

async function addProductSubmit() {
  const name  = document.getElementById("prod-name-input")?.value;
  const cat   = document.getElementById("prod-cat-input")?.value  || "Grocery";
  const price = parseFloat(document.getElementById("prod-price-input")?.value || 0);
  const stock = parseInt(document.getElementById("prod-stock-input")?.value    || 10);
  const image = document.getElementById("prod-icon-input")?.value || "📦";
  if (!name || price <= 0) { alert("Please enter valid name and price."); return; }
  try {
    const res = await fetch(`${API_BASE}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${state.token}` },
      body: JSON.stringify({ shop_id: 1, name, category: cat, price, stock, image })
    });
    if (res.ok) { alert(`"${name}" added!`); closeModal("add-product-modal"); loadShopkeeperProducts(); loadPopularProducts(); }
    else alert("Failed to add product.");
  } catch (e) { console.error(e); }
}

async function editProductStock(prodId, current) {
  const newStock = prompt("Enter new stock quantity:", current);
  if (newStock === null) return;
  try {
    await fetch(`${API_BASE}/products/${prodId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${state.token}` },
      body: JSON.stringify({ stock: parseInt(newStock) })
    });
    loadShopkeeperProducts();
  } catch (e) { console.error(e); }
}

// ──────────────────────────────────────────────
// DELIVERY PARTNER
// ──────────────────────────────────────────────
async function loadDeliveryRequests() {
  if (!state.token || state.user?.role !== "DELIVERY_PARTNER") return;
  try {
    const res  = await fetch(`${API_BASE}/delivery/requests`, { headers: { "Authorization": `Bearer ${state.token}` } });
    const data = await res.json();
    const c = document.getElementById("delivery-requests-list");
    if (!c) return;
    c.innerHTML = data.length ? data.map(o => renderOrderCard(o, "DELIVERY_PARTNER")).join("") : `<p style="color:var(--c-muted);">No delivery requests nearby right now.</p>`;
  } catch (e) { console.error(e); }
}

async function acceptDeliveryRequest(orderId) {
  try {
    const res = await fetch(`${API_BASE}/delivery/accept/${orderId}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${state.token}` }
    });
    if (res.ok) { alert(`Accepted delivery for Order #${orderId}!`); loadDeliveryRequests(); loadDeliveryHistory(); }
    else { const e = await res.json(); alert(`Failed: ${e.detail}`); }
  } catch (e) { console.error(e); }
}

async function loadDeliveryHistory() {
  if (!state.token || state.user?.role !== "DELIVERY_PARTNER") return;
  try {
    const res   = await fetch(`${API_BASE}/delivery/history`, { headers: { "Authorization": `Bearer ${state.token}` } });
    const deliveries = await res.json();
    const done  = deliveries.filter(d => d.status === "DELIVERED");
    const earn  = done.length * 40;
    const countEl = document.getElementById("rider-deliveries-count");
    const earnEl  = document.getElementById("rider-earnings-total");
    if (countEl) countEl.textContent = done.length;
    if (earnEl)  earnEl.textContent  = `₹${earn}`;

    const c = document.getElementById("delivery-history-list");
    if (!c) return;
    c.innerHTML = deliveries.length ? deliveries.map(o => renderOrderCard(o, "DELIVERY_PARTNER")).join("") : `<p style="color:var(--c-muted);">No deliveries yet.</p>`;

    // Live route map
    const active = deliveries.find(d => d.status !== "DELIVERED" && d.status !== "REJECTED") || deliveries[0];
    if (active?.shop) {
      initDeliveryRouteMap(active.shop.latitude, active.shop.longitude, active.latitude || 18.5204, active.longitude || 73.8567, active.shop.name, active.landmark || active.delivery_address);
    }
  } catch (e) { console.error(e); }
}

// ──────────────────────────────────────────────
// ADMIN
// ──────────────────────────────────────────────
async function loadAdminDashboard() {
  if (!state.token || state.user?.role !== "ADMIN") return;
  try {
    const res  = await fetch(`${API_BASE}/admin/dashboard`, { headers: { "Authorization": `Bearer ${state.token}` } });
    const data = await res.json();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("admin-total-users",  data.metrics.total_users);
    set("admin-total-shops",  data.metrics.total_shops);
    set("admin-total-orders", data.metrics.total_orders);
    set("admin-total-sales",  `₹${data.metrics.total_sales}`);

    const tbody = document.getElementById("admin-shops-table");
    if (tbody) {
      tbody.innerHTML = data.shops.map(s => `
        <tr>
          <td><strong>#${s.id}</strong></td>
          <td><strong>${s.name}</strong></td>
          <td>${s.category}</td>
          <td>${s.landmark || s.address}</td>
          <td>${s.verified ? '<span class="badge badge-DELIVERED">Verified</span>' : '<span class="badge badge-PLACED">Pending</span>'}</td>
          <td><button onclick="toggleVerifyShop(${s.id},${!s.verified})" class="btn btn-sm ${s.verified ? "btn-outline" : "btn-accent"}">${s.verified ? "Unverify" : "Verify"}</button></td>
        </tr>`).join("");
    }
  } catch (e) { console.error(e); }
}

async function toggleVerifyShop(shopId, verified) {
  try {
    const res = await fetch(`${API_BASE}/admin/shops/${shopId}/verify?verified=${verified}`, {
      method: "PUT", headers: { "Authorization": `Bearer ${state.token}` }
    });
    if (res.ok) loadAdminDashboard();
  } catch (e) { console.error(e); }
}

// ──────────────────────────────────────────────
// RATINGS
// ──────────────────────────────────────────────
function openRatingModal(orderId, shopId) {
  document.getElementById("rating-order-id").value = orderId;
  document.getElementById("rating-shop-id").value  = shopId;
  openModal("rating-modal");
}

async function submitRating() {
  const orderId = parseInt(document.getElementById("rating-order-id").value);
  const shopId  = parseInt(document.getElementById("rating-shop-id").value);
  const rating  = parseFloat(document.getElementById("rating-score-select").value);
  const review  = document.getElementById("rating-review-text").value;
  try {
    const res = await fetch(`${API_BASE}/ratings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${state.token}` },
      body: JSON.stringify({ order_id: orderId, shop_id: shopId, rating, review })
    });
    if (res.ok) { alert("Thanks for your rating!"); closeModal("rating-modal"); loadNearbyShops(); }
    else alert("Error submitting rating.");
  } catch (e) { console.error(e); }
}

// ──────────────────────────────────────────────
// LEAFLET — DELIVERY ROUTE MAP
// ──────────────────────────────────────────────
function initDeliveryRouteMap(shopLat, shopLng, custLat, custLng, shopName, landmark) {
  if (typeof L === "undefined") return;
  const el = document.getElementById("route-leaflet-map");
  if (!el) return;
  if (!state.routeMap) {
    state.routeMap = L.map("route-leaflet-map").setView([shopLat, shopLng], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(state.routeMap);
  } else { state.routeMap.invalidateSize(); }
  if (state.routePolyline) state.routeMap.removeLayer(state.routePolyline);
  L.marker([shopLat, shopLng]).addTo(state.routeMap).bindPopup(`<b>🏪 ${shopName}</b>`);
  L.marker([custLat, custLng]).addTo(state.routeMap).bindPopup(`<b>📍 ${landmark}</b>`).openPopup();
  state.routePolyline = L.polyline([[shopLat, shopLng],[custLat, custLng]], { color: "#10b981", weight: 4, dashArray: "8,8" }).addTo(state.routeMap);
  state.routeMap.fitBounds(state.routePolyline.getBounds(), { padding: [30, 30] });
  if (state.riderMarker) state.routeMap.removeLayer(state.riderMarker);
  state.riderMarker = L.circleMarker([(shopLat+custLat)/2, (shopLng+custLng)/2], {
    radius: 9, fillColor: "#f59e0b", color: "#fff", weight: 2.5, fillOpacity: 1
  }).addTo(state.routeMap).bindPopup("🚴 Rider");
}

// ──────────────────────────────────────────────
// POLLING & UTILS
// ──────────────────────────────────────────────
function startOrderPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(refreshCurrentRoleView, 4000);
}

function refreshCurrentRoleView() {
  if (state.activeRoleView === "CUSTOMER")          loadCustomerOrders();
  else if (state.activeRoleView === "SHOPKEEPER")   { loadShopkeeperOrders(); loadShopkeeperInsights(); }
  else if (state.activeRoleView === "DELIVERY_PARTNER") { loadDeliveryRequests(); loadDeliveryHistory(); }
  else if (state.activeRoleView === "ADMIN")        loadAdminDashboard();
}

function openModal(id)  { const el = document.getElementById(id); if (el) el.style.display = "flex"; }
function closeModal(id) { const el = document.getElementById(id); if (el) el.style.display = "none"; }
function escapeQ(s)     { return s ? s.replace(/'/g, "\\'") : ""; }
