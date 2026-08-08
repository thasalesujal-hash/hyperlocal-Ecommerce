from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import os

from database import engine, Base, SessionLocal, seed_demo_data, ensure_schema
import models, schemas, crud, auth

# Create database tables
Base.metadata.create_all(bind=engine)
ensure_schema()

# Initialize seed data
db_session = SessionLocal()
try:
    seed_demo_data(db_session)
finally:
    db_session.close()

app = FastAPI(
    title="Hyperlocal Commerce & Delivery Platform API",
    description="Backend API for Hyperlocal Commerce in Underserved Towns",
    version="1.0.0"
)

# Enable CORS for local testing & hackathon presentation
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------------------------------
# AUTH ENDPOINTS
# ----------------------------------------------------
@app.post("/register", response_model=schemas.UserOut)
def register(user_data: schemas.UserRegister, db: Session = Depends(auth.get_db)):
    existing = crud.get_user_by_email(db, user_data.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db, user_data)

@app.post("/login", response_model=schemas.Token)
def login(login_data: schemas.UserLogin, db: Session = Depends(auth.get_db)):
    user = crud.get_user_by_email(db, login_data.email)
    if not user or not auth.verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = auth.create_access_token(data={"sub": user.email, "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@app.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


# ----------------------------------------------------
# SHOPS & SMART RECOMMENDATIONS
# ----------------------------------------------------
@app.get("/shops", response_model=List[schemas.ShopOut])
def list_shops(verified_only: bool = True, db: Session = Depends(auth.get_db)):
    return crud.get_shops(db, verified_only=verified_only)

@app.post("/shops", response_model=schemas.ShopOut)
def create_shop(
    shop_data: schemas.ShopCreate, 
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    if current_user.role not in ["SHOPKEEPER", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Only shopkeepers can create shops")
    return crud.create_shop(db, shop_data, owner_id=current_user.id)

@app.get("/nearby-shops")
def get_nearby_shops(
    lat: float = 18.5204, 
    lng: float = 73.8567, 
    db: Session = Depends(auth.get_db)
):
    shops = crud.get_shops(db, verified_only=True)
    result = []
    for shop in shops:
        dist = crud.calculate_haversine_distance(lat, lng, shop.latitude, shop.longitude)
        result.append({
            "shop": shop,
            "distance_km": dist
        })
    result.sort(key=lambda x: x["distance_km"])
    return result

@app.get("/search", response_model=List[schemas.SmartRecommendationOut])
def smart_search(
    query: str, 
    lat: float = 18.5204, 
    lng: float = 73.8567, 
    db: Session = Depends(auth.get_db)
):
    return crud.search_products_with_recommendation(db, query=query, cust_lat=lat, cust_lng=lng)


# ----------------------------------------------------
# PRODUCTS
# ----------------------------------------------------
@app.get("/products", response_model=List[schemas.ProductOut])
def list_products(shop_id: Optional[int] = None, db: Session = Depends(auth.get_db)):
    return crud.get_products(db, shop_id=shop_id)

@app.post("/products", response_model=schemas.ProductOut)
def create_product(
    product_data: schemas.ProductCreate, 
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    if current_user.role not in ["SHOPKEEPER", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Only shopkeepers can add products")
    return crud.create_product(db, product_data)

@app.put("/products/{product_id}", response_model=schemas.ProductOut)
def update_product(
    product_id: int, 
    product_update: schemas.ProductUpdate, 
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    prod = crud.update_product(db, product_id, product_update)
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    return prod

@app.delete("/products/{product_id}")
def delete_product(
    product_id: int, 
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    success = crud.delete_product(db, product_id)
    if not success:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted successfully"}


# ----------------------------------------------------
# ORDERS & LIFECYCLE
# ----------------------------------------------------
@app.post("/orders", response_model=schemas.OrderOut)
def place_order(
    order_data: schemas.OrderCreate, 
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    try:
        return crud.create_order(db, customer_id=current_user.id, order_data=order_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/orders/{order_id}", response_model=schemas.OrderOut)
def get_order(
    order_id: int, 
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    order = crud.get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@app.get("/customer/orders", response_model=List[schemas.OrderOut])
def get_customer_orders(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    return crud.get_customer_orders(db, customer_id=current_user.id)

@app.get("/shopkeeper/orders", response_model=List[schemas.OrderOut])
def get_shopkeeper_orders(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    return crud.get_shop_orders(db, shop_owner_id=current_user.id)

@app.put("/orders/{order_id}/status", response_model=schemas.OrderOut)
def change_order_status(
    order_id: int, 
    status_update: schemas.OrderStatusUpdate, 
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    valid_statuses = [
        "PLACED", "SHOP_ACCEPTED", "PREPARING", "READY_FOR_PICKUP", 
        "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED", "REJECTED"
    ]
    if status_update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")
    
    partner_id = current_user.id if current_user.role == "DELIVERY_PARTNER" else None
    updated = crud.update_order_status(db, order_id, status_update.status, partner_id=partner_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Order not found")
    return updated

@app.post("/orders/{order_id}/return", response_model=schemas.OrderOut)
def request_return(
    order_id: int,
    return_data: schemas.ReturnRequestCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    if current_user.role != "CUSTOMER":
        raise HTTPException(status_code=403, detail="Only customers can request returns")
    try:
        return crud.request_order_return(db, order_id, current_user.id, return_data.reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ----------------------------------------------------
# DELIVERY PARTNER FLOW
# ----------------------------------------------------
@app.get("/delivery/requests", response_model=List[schemas.OrderOut])
def get_delivery_requests(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    if current_user.role not in ["DELIVERY_PARTNER", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Only delivery partners can access requests")
    return crud.get_available_delivery_requests(db)

@app.post("/delivery/accept/{order_id}", response_model=schemas.OrderOut)
def accept_delivery(
    order_id: int, 
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    if current_user.role != "DELIVERY_PARTNER":
        raise HTTPException(status_code=403, detail="Only delivery partners can accept delivery")
    
    order = crud.get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.delivery_partner_id is not None:
        raise HTTPException(status_code=400, detail="Delivery already accepted by another partner")
        
    updated = crud.update_order_status(db, order_id, order.status, partner_id=current_user.id)
    return updated

@app.get("/delivery/history", response_model=List[schemas.OrderOut])
def get_delivery_history(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    return crud.get_partner_deliveries(db, partner_id=current_user.id)

@app.put("/delivery/location", response_model=schemas.DeliveryLocationOut)
def update_delivery_location(
    location: schemas.DeliveryLocationUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    if current_user.role != "DELIVERY_PARTNER":
        raise HTTPException(status_code=403, detail="Only delivery partners can share location")
    if not (-90 <= location.latitude <= 90 and -180 <= location.longitude <= 180):
        raise HTTPException(status_code=400, detail="Invalid coordinates")
    return crud.save_delivery_location(db, current_user.id, location)

@app.get("/orders/{order_id}/delivery-location", response_model=schemas.DeliveryLocationOut)
def get_order_delivery_location(
    order_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    order = crud.get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if current_user.role == "CUSTOMER" and order.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="You cannot view this delivery")
    if current_user.role == "DELIVERY_PARTNER" and order.delivery_partner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not assigned to this delivery")
    if not order.delivery_partner_id:
        raise HTTPException(status_code=404, detail="Delivery partner not assigned")
    location = crud.get_delivery_location(db, order.delivery_partner_id)
    if not location:
        raise HTTPException(status_code=404, detail="Delivery partner location not available")
    return location


# ----------------------------------------------------
# RATINGS & REVIEWS
# ----------------------------------------------------
@app.post("/ratings", response_model=schemas.RatingOut)
def add_rating(
    rating_data: schemas.RatingCreate, 
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    try:
        return crud.create_rating(db, customer_id=current_user.id, rating_data=rating_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ----------------------------------------------------
# SHOP DEMAND INSIGHTS & ANALYTICS
# ----------------------------------------------------
@app.get("/shopkeeper/insights")
def shopkeeper_insights(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    if current_user.role not in ["SHOPKEEPER", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Only shopkeepers can view insights")
    return crud.get_shop_demand_insights(db, shop_owner_id=current_user.id)


# ----------------------------------------------------
# ADMIN DASHBOARD
# ----------------------------------------------------
@app.get("/admin/dashboard")
def admin_dashboard(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin authorization required")
    
    users = db.query(models.User).all()
    shops = db.query(models.Shop).all()
    orders = db.query(models.Order).all()
    
    total_sales = sum(o.total_amount for o in orders if o.status != "REJECTED")

    return {
        "metrics": {
            "total_users": len(users),
            "total_shops": len(shops),
            "total_orders": len(orders),
            "total_sales": round(total_sales, 2)
        },
        "users": users,
        "shops": shops,
        "recent_orders": orders[:10]
    }

@app.put("/admin/shops/{shop_id}/verify", response_model=schemas.ShopOut)
def admin_verify_shop(
    shop_id: int, 
    verified: bool = True,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin authorization required")
    return crud.verify_shop(db, shop_id, verified)


# ----------------------------------------------------
# SERVE FRONTEND STATIC FILES
# ----------------------------------------------------
frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.exists(frontend_path):
    css_path = os.path.join(frontend_path, "css")
    js_path = os.path.join(frontend_path, "js")
    if os.path.exists(css_path):
        app.mount("/css", StaticFiles(directory=css_path), name="css")
    if os.path.exists(js_path):
        app.mount("/js", StaticFiles(directory=js_path), name="js")
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")

    @app.get("/")
    def serve_frontend():
        return FileResponse(os.path.join(frontend_path, "index.html"))

