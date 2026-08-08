import math
from sqlalchemy.orm import Session
from sqlalchemy import func
import models, schemas
from auth import hash_password

# ----------------------------------------------------
# HAVERSINE DISTANCE CALCULATION
# ----------------------------------------------------
def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0 # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = R * c
    return round(distance, 2)

# ----------------------------------------------------
# SMART NEARBY SHOP RECOMMENDATION ALGORITHM
# ----------------------------------------------------
def search_products_with_recommendation(
    db: Session, 
    query: str, 
    cust_lat: float = 18.5204, 
    cust_lng: float = 73.8567
):
    """
    Smart Nearby Shop Recommendation Algorithm:
    1. Search products by name/category.
    2. For each product found, check stock availability.
    3. Calculate Haversine distance between customer & shop.
    4. Consider shop rating & price.
    5. Score = (availability_score * 50) + (rating * 10) - (distance_km * 5) - (price_factor)
    """
    search_term = f"%{query.strip()}%"
    products = db.query(models.Product).join(models.Shop).filter(
        models.Shop.verified == True,
        (models.Product.name.ilike(search_term)) | 
        (models.Product.category.ilike(search_term)) | 
        (models.Product.description.ilike(search_term))
    ).all()

    recommendations = []

    for product in products:
        shop = product.shop
        dist_km = calculate_haversine_distance(cust_lat, cust_lng, shop.latitude, shop.longitude)
        
        # Availability Score: 1.0 if stock > 0, else 0
        availability_score = 1.0 if product.stock > 0 else 0.0
        
        # Rating (1 to 5)
        rating_score = shop.rating or 4.0
        
        # Price Factor: normalized small penalty for high price
        price_factor = (product.price / 10.0)
        
        # Recommendation Score Formula
        score = (availability_score * 50.0) + (rating_score * 10.0) - (dist_km * 5.0) - price_factor
        score = round(score, 1)

        # Transparent Explanation Bullet Points
        reasons = [
            f"✓ Product Available ({product.stock} units in stock)" if product.stock > 0 else "❌ Out of Stock",
            f"✓ {dist_km} km away from your location",
            f"✓ {shop.rating}★ rating shop",
            f"✓ ₹{product.price} price"
        ]

        recommendations.append({
            "shop": shop,
            "product": product,
            "distance_km": dist_km,
            "score": score,
            "reasons": reasons
        })

    # Sort by recommendation score descending
    recommendations.sort(key=lambda x: x["score"], reverse=True)
    return recommendations


# ----------------------------------------------------
# USER CRUD
# ----------------------------------------------------
def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserRegister):
    hashed_pwd = hash_password(user.password)
    db_user = models.User(
        name=user.name,
        email=user.email.lower().strip(),
        phone=user.phone,
        password_hash=hashed_pwd,
        role=user.role.upper()
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_all_users(db: Session):
    return db.query(models.User).all()


# ----------------------------------------------------
# SHOP CRUD
# ----------------------------------------------------
def get_shops(db: Session, verified_only: bool = True):
    query = db.query(models.Shop)
    if verified_only:
        query = query.filter(models.Shop.verified == True)
    return query.all()

def get_shop_by_id(db: Session, shop_id: int):
    return db.query(models.Shop).filter(models.Shop.id == shop_id).first()

def create_shop(db: Session, shop: schemas.ShopCreate, owner_id: int):
    db_shop = models.Shop(
        owner_id=owner_id,
        name=shop.name,
        description=shop.description,
        category=shop.category,
        address=shop.address,
        landmark=shop.landmark,
        latitude=shop.latitude,
        longitude=shop.longitude,
        rating=4.5,
        verified=True
    )
    db.add(db_shop)
    db.commit()
    db.refresh(db_shop)
    return db_shop

def verify_shop(db: Session, shop_id: int, verified: bool = True):
    shop = get_shop_by_id(db, shop_id)
    if shop:
        shop.verified = verified
        db.commit()
        db.refresh(shop)
    return shop


# ----------------------------------------------------
# PRODUCT CRUD
# ----------------------------------------------------
def get_products(db: Session, shop_id: int = None):
    query = db.query(models.Product)
    if shop_id:
        query = query.filter(models.Product.shop_id == shop_id)
    return query.all()

def get_product_by_id(db: Session, product_id: int):
    return db.query(models.Product).filter(models.Product.id == product_id).first()

def create_product(db: Session, product: schemas.ProductCreate):
    db_product = models.Product(
        shop_id=product.shop_id,
        name=product.name,
        description=product.description,
        category=product.category,
        price=product.price,
        stock=product.stock,
        image=product.image or "📦"
    )
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

def update_product(db: Session, product_id: int, product_update: schemas.ProductUpdate):
    db_prod = get_product_by_id(db, product_id)
    if not db_prod:
        return None
    for key, value in product_update.dict(exclude_unset=True).items():
        setattr(db_prod, key, value)
    db.commit()
    db.refresh(db_prod)
    return db_prod

def delete_product(db: Session, product_id: int):
    db_prod = get_product_by_id(db, product_id)
    if db_prod:
        db.delete(db_prod)
        db.commit()
        return True
    return False


# ----------------------------------------------------
# ORDER & WORKFLOW CRUD
# ----------------------------------------------------
def create_order(db: Session, customer_id: int, order_data: schemas.OrderCreate):
    # 1. Validate Shop
    shop = get_shop_by_id(db, order_data.shop_id)
    if not shop:
        raise ValueError("Shop not found")
        
    total_amount = 0.0
    items_to_create = []

    # 2. Check & Decrement Stock
    for item in order_data.items:
        prod = get_product_by_id(db, item.product_id)
        if not prod:
            raise ValueError(f"Product ID {item.product_id} not found")
        if prod.stock < item.quantity:
            raise ValueError(f"Insufficient stock for {prod.name}. Available: {prod.stock}")
        
        # Decrement stock immediately
        prod.stock -= item.quantity
        item_price = prod.price * item.quantity
        total_amount += item_price

        items_to_create.append({
            "product_id": prod.id,
            "quantity": item.quantity,
            "price": prod.price
        })

    # 3. Create Order
    db_order = models.Order(
        customer_id=customer_id,
        shop_id=shop.id,
        delivery_partner_id=None,
        total_amount=total_amount,
        delivery_address=order_data.delivery_address,
        landmark=order_data.landmark,
        latitude=order_data.latitude,
        longitude=order_data.longitude,
        payment_method=order_data.payment_method,
        status="PLACED"
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)

    # 4. Create Order Items
    for itm in items_to_create:
        db_item = models.OrderItem(
            order_id=db_order.id,
            product_id=itm["product_id"],
            quantity=itm["quantity"],
            price=itm["price"]
        )
        db.add(db_item)
    
    db.commit()
    db.refresh(db_order)
    return db_order

def get_order_by_id(db: Session, order_id: int):
    return db.query(models.Order).filter(models.Order.id == order_id).first()

def get_customer_orders(db: Session, customer_id: int):
    return db.query(models.Order).filter(models.Order.customer_id == customer_id).order_by(models.Order.created_at.desc()).all()

def get_shop_orders(db: Session, shop_owner_id: int):
    return db.query(models.Order).join(models.Shop).filter(models.Shop.owner_id == shop_owner_id).order_by(models.Order.created_at.desc()).all()

def update_order_status(db: Session, order_id: int, new_status: str, partner_id: int = None):
    order = get_order_by_id(db, order_id)
    if not order:
        return None
    
    order.status = new_status
    if partner_id:
        order.delivery_partner_id = partner_id
        
    db.commit()
    db.refresh(order)
    return order

def get_available_delivery_requests(db: Session):
    # Available for delivery: status is READY_FOR_PICKUP or PREPARING or SHOP_ACCEPTED without assigned rider
    return db.query(models.Order).filter(
        models.Order.status.in_(["READY_FOR_PICKUP", "PREPARING", "SHOP_ACCEPTED"]),
        models.Order.delivery_partner_id == None
    ).order_by(models.Order.created_at.desc()).all()

def get_partner_deliveries(db: Session, partner_id: int):
    return db.query(models.Order).filter(models.Order.delivery_partner_id == partner_id).order_by(models.Order.created_at.desc()).all()

def create_rating(db: Session, customer_id: int, rating_data: schemas.RatingCreate):
    order = get_order_by_id(db, rating_data.order_id)
    if not order or order.customer_id != customer_id:
        raise ValueError("Order not found or not owned by customer")
        
    db_rating = models.Rating(
        customer_id=customer_id,
        shop_id=rating_data.shop_id,
        order_id=rating_data.order_id,
        rating=rating_data.rating,
        review=rating_data.review
    )
    db.add(db_rating)
    
    # Recalculate Shop average rating
    avg_rating = db.query(func.avg(models.Rating.rating)).filter(models.Rating.shop_id == rating_data.shop_id).scalar()
    if avg_rating:
        shop = get_shop_by_id(db, rating_data.shop_id)
        if shop:
            shop.rating = round(float(avg_rating), 1)

    db.commit()
    db.refresh(db_rating)
    return db_rating


# ----------------------------------------------------
# SPECIAL FEATURE: SHOP DEMAND INSIGHTS
# ----------------------------------------------------
def get_shop_demand_insights(db: Session, shop_owner_id: int):
    shops = db.query(models.Shop).filter(models.Shop.owner_id == shop_owner_id).all()
    shop_ids = [s.id for s in shops]

    if not shop_ids:
        return {
            "total_orders": 0,
            "total_revenue": 0.0,
            "popular_products": [],
            "low_stock_products": [],
            "demand_trend": "No shop found"
        }

    orders = db.query(models.Order).filter(models.Order.shop_id.in_(shop_ids)).all()
    total_orders = len(orders)
    total_revenue = sum(o.total_amount for o in orders if o.status != "REJECTED")

    # Popular Products
    popular_query = db.query(
        models.Product.name, 
        func.sum(models.OrderItem.quantity).label("total_qty")
    ).join(models.OrderItem, models.Product.id == models.OrderItem.product_id)\
     .filter(models.Product.shop_id.in_(shop_ids))\
     .group_by(models.Product.id)\
     .order_by(func.sum(models.OrderItem.quantity).desc()).limit(5).all()

    popular_products = [{"name": p[0], "quantity_sold": p[1]} for p in popular_query]

    # Low stock alert (< 10 units)
    low_stock = db.query(models.Product).filter(
        models.Product.shop_id.in_(shop_ids),
        models.Product.stock <= 10
    ).all()

    # Trend calculation
    trend_text = "Stable town demand. Staples like Rice, Milk & Atta are in high demand this week."
    if popular_products:
        top_item = popular_products[0]["name"]
        trend_text = f"🔥 '{top_item}' is experiencing surging demand in town this week!"

    return {
        "total_orders": total_orders,
        "total_revenue": round(total_revenue, 2),
        "popular_products": popular_products,
        "low_stock_products": low_stock,
        "demand_trend": trend_text
    }
