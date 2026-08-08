from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

# User Schemas
class UserRegister(BaseModel):
    name: str
    email: str
    phone: str
    password: str
    role: str = "CUSTOMER" # CUSTOMER, SHOPKEEPER, DELIVERY_PARTNER, ADMIN

class UserLogin(BaseModel):
    email: str
    password: str

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    phone: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

# Shop Schemas
class ShopCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: str
    address: str
    landmark: Optional[str] = None
    latitude: float = 18.5204
    longitude: float = 73.8567

class ShopUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    address: Optional[str] = None
    landmark: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class ShopOut(BaseModel):
    id: int
    owner_id: int
    name: str
    description: Optional[str] = None
    category: str
    address: str
    landmark: Optional[str] = None
    latitude: float
    longitude: float
    rating: float
    verified: bool

    class Config:
        from_attributes = True

# Product Schemas
class ProductCreate(BaseModel):
    shop_id: int
    name: str
    description: Optional[str] = None
    category: str
    price: float
    stock: int = 10
    image: Optional[str] = "📦"

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[int] = None
    image: Optional[str] = None

class ProductOut(BaseModel):
    id: int
    shop_id: int
    name: str
    description: Optional[str] = None
    category: str
    price: float
    stock: int
    image: Optional[str] = None

    class Config:
        from_attributes = True

# Order Schemas
class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int

class OrderCreate(BaseModel):
    shop_id: int
    items: List[OrderItemCreate]
    delivery_address: str
    landmark: Optional[str] = None
    latitude: float = 18.5204
    longitude: float = 73.8567
    payment_method: str = "COD" # COD or ONLINE_DEMO

class OrderItemOut(BaseModel):
    id: int
    product_id: int
    quantity: int
    price: float
    product: Optional[ProductOut] = None

    class Config:
        from_attributes = True

class OrderOut(BaseModel):
    id: int
    customer_id: int
    shop_id: int
    delivery_partner_id: Optional[int] = None
    total_amount: float
    delivery_address: str
    landmark: Optional[str] = None
    latitude: float
    longitude: float
    payment_method: str
    status: str
    created_at: datetime
    shop: Optional[ShopOut] = None
    customer: Optional[UserOut] = None
    delivery_partner: Optional[UserOut] = None
    items: List[OrderItemOut] = []

    class Config:
        from_attributes = True

class OrderStatusUpdate(BaseModel):
    status: str # PLACED, SHOP_ACCEPTED, PREPARING, READY_FOR_PICKUP, PICKED_UP, OUT_FOR_DELIVERY, DELIVERED, REJECTED

# Smart Recommendation Schemas
class SmartRecommendationOut(BaseModel):
    shop: ShopOut
    product: ProductOut
    distance_km: float
    score: float
    reasons: List[str]

# Rating Schemas
class RatingCreate(BaseModel):
    order_id: int
    shop_id: int
    rating: float
    review: Optional[str] = None

class RatingOut(BaseModel):
    id: int
    customer_id: int
    shop_id: int
    order_id: int
    rating: float
    review: Optional[str] = None

    class Config:
        from_attributes = True

# Insights Schema
class DemandInsightsOut(BaseModel):
    total_orders: int
    total_revenue: float
    popular_products: List[dict]
    low_stock_products: List[ProductOut]
    demand_trend: str
