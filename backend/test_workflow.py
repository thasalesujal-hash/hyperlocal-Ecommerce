import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000"

def safe_print(*args, **kwargs):
    text = " ".join(str(a) for a in args)
    safe_text = text.encode("ascii", errors="replace").decode("ascii")
    print(safe_text, **kwargs)

def test_full_scenario():
    safe_print("==================================================")
    safe_print("STARTING FULL END-TO-END HACKATHON WORKFLOW TEST")
    safe_print("==================================================")

    # 1. Customer Login
    safe_print("\n1. Logging in as Customer (customer@town.com)...")
    res = requests.post(f"{BASE_URL}/login", json={"email": "customer@town.com", "password": "password123"})
    assert res.status_code == 200, f"Customer login failed: {res.text}"
    cust_token = res.json()["access_token"]
    cust_headers = {"Authorization": f"Bearer {cust_token}"}
    safe_print("[OK] Customer logged in successfully!")

    # 2. Smart Recommendation Search for "Rice"
    safe_print("\n2. Customer searches for 'Rice' (Location: 18.5204, 73.8567)...")
    res = requests.get(f"{BASE_URL}/search?query=Rice&lat=18.5204&lng=73.8567")
    assert res.status_code == 200, f"Search failed: {res.text}"
    recs = res.json()
    assert len(recs) > 0, "No recommendations returned for Rice"
    top_rec = recs[0]
    safe_print(f"[OK] Smart Recommendation Result: '{top_rec['product']['name']}' at '{top_rec['shop']['name']}'")
    safe_print(f"  Match Score: {top_rec['score']}")
    safe_print("  Reasons:", top_rec['reasons'])

    # 3. Customer Places Order
    safe_print("\n3. Customer places order for Basmati Rice (COD payment)...")
    order_payload = {
        "shop_id": top_rec['shop']['id'],
        "items": [{"product_id": top_rec['product']['id'], "quantity": 1}],
        "delivery_address": "House 45, Main Chowk",
        "landmark": "Near Ganesh Temple, opposite City School",
        "latitude": 18.5204,
        "longitude": 73.8567,
        "payment_method": "COD"
    }
    res = requests.post(f"{BASE_URL}/orders", json=order_payload, headers=cust_headers)
    assert res.status_code == 200, f"Order placement failed: {res.text}"
    order = res.json()
    order_id = order['id']
    safe_print(f"[OK] Order #{order_id} placed successfully! Initial Status: {order['status']}")

    # 4. Shopkeeper Login & Accept Order
    safe_print("\n4. Logging in as Shopkeeper (grocer@town.com)...")
    res = requests.post(f"{BASE_URL}/login", json={"email": "grocer@town.com", "password": "password123"})
    assert res.status_code == 200, "Shopkeeper login failed"
    shop_token = res.json()["access_token"]
    shop_headers = {"Authorization": f"Bearer {shop_token}"}

    safe_print(f"\n5. Shopkeeper accepts Order #{order_id}...")
    res = requests.put(f"{BASE_URL}/orders/{order_id}/status", json={"status": "SHOP_ACCEPTED"}, headers=shop_headers)
    assert res.status_code == 200, "Accept order failed"
    safe_print("[OK] Status updated to 'SHOP_ACCEPTED'")

    safe_print(f"\n6. Shopkeeper prepares order and marks 'READY_FOR_PICKUP'...")
    res = requests.put(f"{BASE_URL}/orders/{order_id}/status", json={"status": "PREPARING"}, headers=shop_headers)
    res = requests.put(f"{BASE_URL}/orders/{order_id}/status", json={"status": "READY_FOR_PICKUP"}, headers=shop_headers)
    assert res.status_code == 200, "Ready for pickup failed"
    safe_print("[OK] Status updated to 'READY_FOR_PICKUP'")

    # 5. Delivery Partner Login & Process Delivery
    safe_print("\n7. Logging in as Delivery Partner (rider@town.com)...")
    res = requests.post(f"{BASE_URL}/login", json={"email": "rider@town.com", "password": "password123"})
    assert res.status_code == 200, "Rider login failed"
    rider_token = res.json()["access_token"]
    rider_headers = {"Authorization": f"Bearer {rider_token}"}

    safe_print(f"\n8. Delivery Partner accepts delivery for Order #{order_id}...")
    res = requests.post(f"{BASE_URL}/delivery/accept/{order_id}", headers=rider_headers)
    assert res.status_code == 200, "Accept delivery failed"
    safe_print("[OK] Delivery partner assigned!")

    safe_print(f"\n9. Delivery Partner transitions status: PICKED_UP -> OUT_FOR_DELIVERY -> DELIVERED...")
    res = requests.put(f"{BASE_URL}/orders/{order_id}/status", json={"status": "PICKED_UP"}, headers=rider_headers)
    res = requests.put(f"{BASE_URL}/orders/{order_id}/status", json={"status": "OUT_FOR_DELIVERY"}, headers=rider_headers)
    res = requests.put(f"{BASE_URL}/orders/{order_id}/status", json={"status": "DELIVERED"}, headers=rider_headers)
    assert res.status_code == 200, "Delivery lifecycle failed"
    safe_print("[OK] Order status is now 'DELIVERED'!")

    # 6. Customer Rates Order
    safe_print("\n10. Customer rates the shop and delivery (5 stars)...")
    rating_payload = {
        "order_id": order_id,
        "shop_id": top_rec['shop']['id'],
        "rating": 5.0,
        "review": "Super fast local delivery to Ganesh Temple landmark!"
    }
    res = requests.post(f"{BASE_URL}/ratings", json=rating_payload, headers=cust_headers)
    assert res.status_code == 200, "Rating failed"
    safe_print("[OK] Rating submitted!")

    # 7. Shop Demand Insights
    safe_print("\n11. Fetching Shop Demand Insights for Shopkeeper...")
    res = requests.get(f"{BASE_URL}/shopkeeper/insights", headers=shop_headers)
    assert res.status_code == 200, "Insights failed"
    insights = res.json()
    safe_print("[OK] Shop Insights Data:")
    safe_print(f"  - Total Orders: {insights['total_orders']}")
    safe_print(f"  - Revenue: INR {insights['total_revenue']}")
    safe_print(f"  - Trend: {insights['demand_trend']}")

    safe_print("\n==================================================")
    safe_print("ALL WORKFLOW STEPS PASSED PERFECTLY!")
    safe_print("==================================================")

if __name__ == "__main__":
    test_full_scenario()
