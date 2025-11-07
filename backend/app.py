from flask import Flask, render_template, Response, jsonify, request
from dotenv import load_dotenv
import requests
import cv2
import os
import json
import threading
import time
from queue import Queue, Empty

load_dotenv()


app = Flask(__name__, static_folder="static", template_folder="templates")

RTSP_URL = os.getenv("RTSP_URL", "rtsp://192.168.1.174:554/ch01/1")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/coords")
def coords():
    try:
        ESP32_IP = os.getenv("ESP32_IP", "192.168.1.159")
        r = requests.get(f"http://{ESP32_IP}/getCoords", timeout=2)
        return jsonify(r.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/incidents')
def get_incidents():
    """Return a list of incidents for the dashboard"""
    return jsonify(MOCK_INCIDENTS)


@app.route('/time_slots', methods=['GET', 'POST', 'PUT', 'DELETE'])
def handle_time_slots():
    """Handle time slot CRUD operations"""
    if request.method == 'GET':
        return jsonify({"ok": True, "data": TIME_SLOTS})
    
    if request.method == 'POST':
        slot = request.json
        if not slot or 'id' not in slot or 'start' not in slot or 'end' not in slot:
            return jsonify({"ok": False, "error": "Invalid slot data"}), 400
        TIME_SLOTS.append(slot)
        return jsonify({"ok": True, "data": slot})
    
    if request.method in ['PUT', 'DELETE']:
        slot_id = request.args.get('id')
        if not slot_id:
            return jsonify({"ok": False, "error": "Missing slot ID"}), 400
            
        slot_id = int(slot_id)
        slot_index = next((i for i, s in enumerate(TIME_SLOTS) if s['id'] == slot_id), -1)
        
        if slot_index == -1:
            return jsonify({"ok": False, "error": "Slot not found"}), 404
            
        if request.method == 'DELETE':
            TIME_SLOTS.pop(slot_index)
            return jsonify({"ok": True})
        else:  # PUT
            slot = request.json
            if not slot or 'start' not in slot or 'end' not in slot:
                return jsonify({"ok": False, "error": "Invalid slot data"}), 400
            TIME_SLOTS[slot_index].update(slot)
            return jsonify({"ok": True, "data": TIME_SLOTS[slot_index]})
    
    return jsonify({"ok": False, "error": "Method not allowed"}), 405


# Mock incidents data for initial setup
MOCK_INCIDENTS = [
    {"timestamp": "2025-10-30 10:00:00", "type": "System", "description": "System initialized"},
    {"timestamp": "2025-10-30 10:01:00", "type": "Status", "description": "All systems operational"}
]


def generate_frames():
    cap = cv2.VideoCapture(RTSP_URL)
    if not cap.isOpened():
        print("Error: Could not open video stream.")
        return

    while True:
        success, frame = cap.read()
        if not success:
            break
        _, buffer = cv2.imencode(".jpg", frame)
        yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n")
    
    cap.release()


@app.route("/video_feed")
def video_feed():
    print("🎥 entering /video_feed route", flush=True)
    return Response(generate_frames(),
                    mimetype="multipart/x-mixed-replace; boundary=frame")


# Mock time slots data
TIME_SLOTS = []
BUFFER_SIZE = int(os.getenv("BUFFER_SIZE", "2"))  # Keep only latest frames


# Dashboard routes with AJAX support
@app.route("/dashboard")
def dashboard():
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return render_template("dashboard_content.html")
    else:
        return render_template("dashboard.html")


@app.route("/patrol")
def patrol():
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return render_template("patrol_content.html")
    else:
        return render_template("patrol.html")


@app.route("/maintenance")
def maintenance():
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return render_template("maintenance_content.html")
    else:
        return render_template("maintenance.html")


@app.route("/analytics")
def analytics():
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return render_template("analytics_content.html")
    else:
        return render_template("analytics.html")


# --- In-memory time_slots endpoints for local testing ---
TIME_SLOTS = [
    {"id": 0, "start": "08:00", "end": "12:00"},
    {"id": 1, "start": "13:00", "end": "18:00"}
]
TIME_SLOTS_LOCK = threading.Lock()


# --- In-memory schedules storage (per-day) ---
SCHEDULES = {}
SCHEDULES_LOCK = threading.Lock()


@app.route('/time_slots', methods=['GET', 'POST'])
def time_slots():
    # GET: return list of slots, POST: add/update slot (form encoded)
    if request.method == 'GET':
        with TIME_SLOTS_LOCK:
            return jsonify(TIME_SLOTS)

    # POST -> add or update
    id_raw = request.form.get('id') or request.json and request.json.get('id')
    start = request.form.get('start') or (request.json and request.json.get('start'))
    end = request.form.get('end') or (request.json and request.json.get('end'))

    if id_raw is None or start is None or end is None:
        return ("Missing id/start/end", 400)

    try:
        slot_id = int(id_raw)
    except ValueError:
        return ("Invalid id", 400)

    with TIME_SLOTS_LOCK:
        for s in TIME_SLOTS:
            if s['id'] == slot_id:
                s['start'] = start
                s['end'] = end
                return ("Updated", 200)
        # not found -> append
        TIME_SLOTS.append({"id": slot_id, "start": start, "end": end})
    return ("Created", 201)


@app.route('/schedules', methods=['GET', 'POST', 'PUT', 'DELETE'])
def schedules():
    """Simple schedules CRUD. Data model (server-side):
    SCHEDULES = { 'YYYY-MM-DD': [ {id: <str|int>, start: 'HH:MM', end: 'HH:MM'} ] }
    GET /schedules -> returns full map
    GET /schedules?date=YYYY-MM-DD -> returns list for date
    POST /schedules -> create entry, JSON body: {date, start, end, id?}
    PUT /schedules -> replace all for date, JSON body: {date, schedules: [...]}
    DELETE /schedules?date=...&id=... -> delete entry for date by id, or if id=all delete all for date
    """
    if request.method == 'GET':
        date = request.args.get('date')
        with SCHEDULES_LOCK:
            if date:
                return jsonify({"ok": True, "data": SCHEDULES.get(date, [])})
            else:
                return jsonify({"ok": True, "data": SCHEDULES})

    if request.method == 'POST':
        body = request.get_json(silent=True) or {}
        date = body.get('date')
        start = body.get('start')
        end = body.get('end')
        if not date or not start or not end:
            return jsonify({"ok": False, "error": "Missing date/start/end"}), 400
        entry_id = body.get('id') or str(int(time.time() * 1000))
        entry = {"id": entry_id, "start": start, "end": end}
        with SCHEDULES_LOCK:
            SCHEDULES.setdefault(date, []).append(entry)
        return jsonify({"ok": True, "data": entry}), 201

    if request.method == 'PUT':
        body = request.get_json(silent=True) or {}
        date = body.get('date')
        schedules = body.get('schedules')
        if not date or schedules is None:
            return jsonify({"ok": False, "error": "Missing date or schedules"}), 400
        # validate schedules is a list of objects with start/end
        if not isinstance(schedules, list):
            return jsonify({"ok": False, "error": "schedules must be an array"}), 400
        with SCHEDULES_LOCK:
            SCHEDULES[date] = []
            for s in schedules:
                sid = s.get('id') or str(int(time.time() * 1000))
                SCHEDULES[date].append({"id": sid, "start": s.get('start', ''), "end": s.get('end', '')})
        return jsonify({"ok": True, "data": SCHEDULES[date]})

    if request.method == 'DELETE':
        date = request.args.get('date')
        id_ = request.args.get('id')
        if not date:
            return jsonify({"ok": False, "error": "Missing date"}), 400
        with SCHEDULES_LOCK:
            if date not in SCHEDULES:
                return jsonify({"ok": False, "error": "Date not found"}), 404
            if id_ is None or id_ == 'all':
                SCHEDULES.pop(date, None)
                return jsonify({"ok": True})
            # delete single by id
            before = len(SCHEDULES.get(date, []))
            SCHEDULES[date] = [s for s in SCHEDULES.get(date, []) if str(s.get('id')) != str(id_)]
            after = len(SCHEDULES.get(date, []))
            if after == before:
                return jsonify({"ok": False, "error": "Not found"}), 404
            return jsonify({"ok": True})

    return jsonify({"ok": False, "error": "Method not allowed"}), 405


@app.route('/time_slots_delete', methods=['POST'])
def time_slots_delete():
    id_raw = request.form.get('id') or (request.json and request.json.get('id'))
    if id_raw is None:
        return ("Missing id", 400)
    try:
        slot_id = int(id_raw)
    except ValueError:
        return ("Invalid id", 400)

    with TIME_SLOTS_LOCK:
        for i, s in enumerate(TIME_SLOTS):
            if s['id'] == slot_id:
                TIME_SLOTS.pop(i)
                return ("Deleted", 200)
    return ("Not found", 404)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)