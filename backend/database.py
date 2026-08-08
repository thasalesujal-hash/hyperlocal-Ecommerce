from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import hashlib
import os

SQLALCHEMY_DATABASE_URL = "sqlite:///./hyperlocal.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def seed_demo_data(db):
    from models import User, Shop, Product, Order, OrderItem, Rating
    
    # Check if data already exists
    if db.query(User).first():
        return

    print("Seeding demo data into SQLite database...")
    
    # 1. Create Users
    default_pass = hash_password("password123")
    admin_pass = hash_password("admin123")
    
    u_customer = User(name="Ramesh Kumar", email="customer@town.com", phone="9876543210", password_hash=default_pass, role="CUSTOMER")
    u_shop1 = User(name="Sharma Ji", email="grocer@town.com", phone="9876543211", password_hash=default_pass, role="SHOPKEEPER")
    u_shop2 = User(name="Verma Medicals", email="medical@town.com", phone="9876543212", password_hash=default_pass, role="SHOPKEEPER")
    u_shop3 = User(name="Yadav Dairy", email="dairy@town.com", phone="9876543213", password_hash=default_pass, role="SHOPKEEPER")
    u_rider1 = User(name="Rahul Rider (Local Delivery)", email="rider@town.com", phone="9876543214", password_hash=default_pass, role="DELIVERY_PARTNER")
    u_rider2 = User(name="Vikram Express", email="rider2@town.com", phone="9876543215", password_hash=default_pass, role="DELIVERY_PARTNER")
    u_admin = User(name="Town Admin", email="admin@town.com", phone="9876543216", password_hash=admin_pass, role="ADMIN")
    
    db.add_all([u_customer, u_shop1, u_shop2, u_shop3, u_rider1, u_rider2, u_admin])
    db.commit()
    
    # 2. Create Shops
    s1 = Shop(
        owner_id=u_shop1.id, name="Sharma Grocery", description="Fresh daily essentials and grains", 
        category="Grocery", address="Shop 12, Main Bazaar", landmark="Near Bus Stand", 
        latitude=18.5204, longitude=73.8567, rating=4.7, verified=True
    )
    s2 = Shop(
        owner_id=u_shop1.id, name="Fresh Mart", description="Vegetables, fruits and organic staples", 
        category="Grocery & Fruits", address="Plot 4, Mandi Complex", landmark="Opposite Grain Market", 
        latitude=18.5250, longitude=73.8590, rating=4.5, verified=True
    )
    s3 = Shop(
        owner_id=u_shop2.id, name="City Medical Store", description="24/7 medicines and healthcare supplies", 
        category="Medical", address="Station Road, Civil Lines", landmark="Opposite Civil Hospital", 
        latitude=18.5180, longitude=73.8530, rating=4.9, verified=True
    )
    s4 = Shop(
        owner_id=u_shop1.id, name="Ganesh Stationery", description="School items, books and Xerox", 
        category="Stationery", address="School Road", landmark="Near City High School", 
        latitude=18.5220, longitude=73.8540, rating=4.3, verified=True
    )
    s5 = Shop(
        owner_id=u_shop3.id, name="Local Dairy", description="Pure cow milk, curd, paneer, and butter", 
        category="Dairy", address="Temple Chowk", landmark="Near Ganesh Temple", 
        latitude=18.5210, longitude=73.8580, rating=4.8, verified=True
    )
    
    db.add_all([s1, s2, s3, s4, s5])
    db.commit()
    
    # 3. Create Products
    products = [
        # Sharma Grocery
        Product(shop_id=s1.id, name="Basmati Rice (1kg)", description="Premium long grain rice", category="Grocery", price=60.0, stock=50, image="🌾"),
        Product(shop_id=s1.id, name="Wheat Flour / Atta (5kg)", description="Whole wheat fresh flour", category="Grocery", price=180.0, stock=30, image="🌾"),
        Product(shop_id=s1.id, name="Sugar (1kg)", description="Refined white sugar", category="Grocery", price=42.0, stock=40, image="🍬"),
        Product(shop_id=s1.id, name="Sunflower Cooking Oil (1L)", description="Healthy cooking oil", category="Grocery", price=135.0, stock=25, image="🍾"),
        Product(shop_id=s1.id, name="Parle-G Biscuits (Pack of 5)", description="Glucose biscuits", category="Snacks", price=30.0, stock=80, image="🍪"),
        
        # Fresh Mart
        Product(shop_id=s2.id, name="Fresh Kolam Rice (1kg)", description="Daily cooking rice", category="Grocery", price=55.0, stock=35, image="🌾"),
        Product(shop_id=s2.id, name="Fresh Tomatoes (1kg)", description="Farm fresh red tomatoes", category="Vegetables", price=25.0, stock=20, image="🍅"),
        Product(shop_id=s2.id, name="Potatoes (1kg)", description="Fresh local potatoes", category="Vegetables", price=20.0, stock=60, image="🥔"),
        
        # City Medical
        Product(shop_id=s3.id, name="Paracetamol 650mg (Strip of 10)", description="Fever & pain relief tablet", category="Medical", price=30.0, stock=100, image="💊"),
        Product(shop_id=s3.id, name="Hand Sanitizer 100ml", description="70% alcohol antiseptic", category="Medical", price=50.0, stock=45, image="🧴"),
        Product(shop_id=s3.id, name="First Aid Cotton Roll", description="Sterilized medical cotton", category="Medical", price=25.0, stock=15, image="🩹"),
        
        # Ganesh Stationery
        Product(shop_id=s4.id, name="Classmate Long Notebook (200 pgs)", description="Single line spiral notebook", category="Stationery", price=65.0, stock=40, image="📓"),
        Product(shop_id=s4.id, name="Blue Ballpoint Pens (Pack of 5)", description="Smooth writing pens", category="Stationery", price=40.0, stock=75, image="🖊️"),
        
        # Local Dairy
        Product(shop_id=s5.id, name="Fresh Whole Milk (1L)", description="Pure farm cow milk", category="Dairy", price=56.0, stock=6, image="🥛"), # low stock alert!
        Product(shop_id=s5.id, name="Fresh Curd / Dahi (500g)", description="Chilled rich curd", category="Dairy", price=35.0, stock=18, image="🥣"),
        Product(shop_id=s5.id, name="Desi Butter / Makhan (200g)", description="Unsalted homemade butter", category="Dairy", price=90.0, stock=12, image="🧈"),
    ]
    
    db.add_all(products)
    db.commit()
    
    print("Demo data seeded successfully!")
