import requests
from flask import Flask, jsonify
import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.stdout.reconfigure(encoding='utf-8')

app = Flask(__name__)
ESP32_IP = os.getenv("ESP32_IP", "192.168.1.159")
GPS_ENDPOINT = f"http://{ESP32_IP}/getCoords"

@app.route("/getCoords")
def get_coords():
    """Fetch coordinates from ESP32 and return as JSON"""
    try:
        response = requests.get(GPS_ENDPOINT, timeout=5)
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        print(f"❌ Error fetching coordinates: {e}")
        return {"error": str(e)}, 503
    except ValueError:
        print("❌ Error processing the response: Not a valid JSON reply.")
        return {"error": "Invalid JSON from ESP32"}, 502

if __name__ == "__main__":
    print(f"🛰️ GPS service starting on port 7738...")
    print(f"📡 ESP32 endpoint: {GPS_ENDPOINT}")
    app.run(host="0.0.0.0", port=7738)