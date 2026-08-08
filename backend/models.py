from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=False)
    address = Column(String, nullable=True)
    shop_name = Column(String, nullable=True)
    shop_category = Column(String, nullable=True)
    vehicle_type = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="CUSTOMER") # CUSTOMER, SHOPKEEPER, DELIVERY_PARTNER, ADMIN
    created_at = Column(DateTime, default=datetime.utcnow)

    shops = relationship("Shop", back_populates="owner")
    orders = relationship("Order", foreign_keys="[Order.customer_id]", back_populates="customer")
    deliveries = relationship("Order", foreign_keys="[Order.delivery_partner_id]", back_populates="delivery_partner")
    ratings = relationship("Rating", back_populates="customer")

class Shop(Base):
    __tablename__ = "shops"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, nullable=False)
    address = Column(String, nullable=False)
    landmark = Column(String, nullable=True)
    latitude = Column(Float, nullable=False, default=18.5204)
    longitude = Column(Float, nullable=False, default=73.8567)
    rating = Column(Float, default=4.5)
    verified = Column(Boolean, default=True)

    owner = relationship("User", back_populates="shops")
    products = relationship("Product", back_populates="shop", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="shop")
    ratings = relationship("Rating", back_populates="shop")

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    stock = Column(Integer, nullable=False, default=10)
    image = Column(String, nullable=True)

    shop = relationship("Shop", back_populates="products")
    order_items = relationship("OrderItem", back_populates="product")

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    delivery_partner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    total_amount = Column(Float, nullable=False)
    delivery_address = Column(String, nullable=False)
    landmark = Column(String, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    payment_method = Column(String, nullable=False, default="COD") # COD, ONLINE_DEMO
    status = Column(String, nullable=False, default="PLACED") 
    # PLACED, SHOP_ACCEPTED, PREPARING, READY_FOR_PICKUP, PICKED_UP, OUT_FOR_DELIVERY, DELIVERED, REJECTED
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("User", foreign_keys=[customer_id], back_populates="orders")
    shop = relationship("Shop", back_populates="orders")
    delivery_partner = relationship("User", foreign_keys=[delivery_partner_id], back_populates="deliveries")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    rating = relationship("Rating", back_populates="order", uselist=False)

class DeliveryLocation(Base):
    __tablename__ = "delivery_locations"

    id = Column(Integer, primary_key=True, index=True)
    partner_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    partner = relationship("User")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    price = Column(Float, nullable=False)

    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")

class Rating(Base):
    __tablename__ = "ratings"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    rating = Column(Float, nullable=False)
    review = Column(Text, nullable=True)

    customer = relationship("User", back_populates="ratings")
    shop = relationship("Shop", back_populates="ratings")
    order = relationship("Order", back_populates="rating")
