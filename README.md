# Hyperlocal Commerce & Delivery Platform for Underserved Towns

A complete, working MVP platform designed to connect Customers, Local Shopkeepers, and Local Delivery Partners in underserved/small towns.

---

## 🌟 Key Features

### 1. 🛒 Customer Workflow & Smart Recommendation Engine
- **Set Location**: Browser GPS Geolocation or manual Landmark entry (*e.g., "Near Ganesh Temple, opposite City School"*).
- **Smart Nearby Shop Recommendation Engine**:
  - Automatically scores matching shops using the formula:
    `score = (availability_score * 50) + (rating * 10) - (distance_km * 5) - (price_factor)`
  - Transparent reasoning breakdown showing availability, distance, shop rating, and price.
- **Cart & Orders**: Multi-item cart, Cash on Delivery (COD) & Demo Online Payment methods.
- **Visual Order Lifecycle Tracker**: Live status updates across 7 steps:
  `PLACED` -> `SHOP_ACCEPTED` -> `PREPARING` -> `READY_FOR_PICKUP` -> `PICKED_UP` -> `OUT_FOR_DELIVERY` -> `DELIVERED`.
- **Ratings & Reviews**: Post-delivery rating submission for shops.

### 2. 🏪 Shopkeeper Workflow & Demand Insights
- **Order Management**: Accept or Reject incoming orders, update status (`PREPARING`, `READY_FOR_PICKUP`).
- **Product Inventory**: Add/Edit/Delete products and update stock levels. Stock automatically decreases upon customer order.
- **Shop Demand Insights**: Analytics dashboard displaying total revenue, orders, low-stock warnings (< 10 units), and local demand trends.

### 3. 🚴 Delivery Partner Workflow & Local Employment
- **Local Employment**: Registration for local town members to deliver items and earn ₹40 per delivery.
- **Duty Toggle**: Set Online/Offline availability.
- **Delivery Requests**: View nearby available requests, accept order, view pickup shop location and landmark customer address.
- **Status Progress**: Transition status from `PICKED_UP` to `OUT_FOR_DELIVERY` to `DELIVERED`.

### 4. 🛡️ Admin Portal
- Platform metrics: Total Users, Shops, Orders, and GMV Sales.
- Shop verification management (Verify/Unverify shops).

### 5. ⚡ Special Hackathon Features
- **Landmark-Based Delivery**: Landmark field support for precise small-town location delivery.
- **Low-Bandwidth Mode**: Toggleable mode for 2G/3G networks, disabling heavy graphics and shadows.
- **Auto-Seeded Demo Data**: Pre-populated town users, shops, products, and ratings on backend startup.

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3 (Vanilla design system with low-bandwidth toggle), JavaScript (Vanilla ES6).
- **Backend**: Python FastAPI with Uvicorn.
- **Database**: SQLite with SQLAlchemy ORM.
- **Authentication**: JWT Token-based role auth (Customer, Shopkeeper, Delivery Partner, Admin).

---

## 🚀 Quick Setup & Running Instructions

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Launch the Application
```bash
python main.py
```
*Or using Uvicorn:*
```bash
uvicorn main:app --reload --port 8000
```

### 3. Open in Browser
Open your browser and navigate to:
`http://127.0.0.1:8000`

---

## 🔑 Quick Demo Login Credentials

The application automatically seeds the database with these test accounts:

| Role | Email | Password |
|---|---|---|
| **Customer** | `customer@town.com` | `password123` |
| **Shopkeeper (Grocery)** | `grocer@town.com` | `password123` |
| **Shopkeeper (Medical)** | `medical@town.com` | `password123` |
| **Delivery Partner** | `rider@town.com` | `password123` |
| **Admin** | `admin@town.com` | `admin123` |
