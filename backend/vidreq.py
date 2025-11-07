from flask import Flask, Response, request
import cv2
import os

app = Flask(__name__)
RTSP_URL = os.getenv("RTSP_URL", "rtsp://192.168.1.174:554/ch01/1")  # Ensure DISPLAY is set for GUI operations

# RTSP stream URL
cap = cv2.VideoCapture(RTSP_URL)
if not cap.isOpened():
    print("❌ Could not open stream at {RTSP_URL}")
else:
    print("✅ Stream is live")

# cap.release()

def generate_frames():
    print("starting generate_frames loop", flush=True)
    cap = get_cap()
    while True:
        success, frame = cap.read()
        if not success:
            print("⚠️ Kein Frame erhalten.")
            break

        height, width, _ = frame.shape

        # Guide lines (Rückfahrkamera-Stil)
        bottom_left = (int(width * 0.2), height)
        top_left = (int(width * 0.35), int(height * 0.6))
        bottom_right = (int(width * 0.8), height)
        top_right = (int(width * 0.65), int(height * 0.6))

        cv2.line(frame, bottom_left, top_left, (255, 255, 255), 1)
        cv2.line(frame, bottom_right, top_right, (255, 255, 255), 1)

        def interpolate(y, pt_bottom, pt_top):
            return int(pt_bottom[0] + (pt_top[0] - pt_bottom[0]) * ((height - y) / (height - pt_top[1])))

        for color, y in [((0, 255, 0), int(height * 0.6)),
                         ((0, 255, 255), int(height * 0.7)),
                         ((0, 0, 255), int(height * 0.8))]:
            x1 = interpolate(y, bottom_left, top_left)
            x2 = interpolate(y, bottom_right, top_right)
            cv2.line(frame, (x1, y), (x2, y), color, 2)

        # Convert to JPEG
        _, buffer = cv2.imencode('.jpg', frame)
        frame = buffer.tobytes()

        # MJPEG stream yield
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
        

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/')
def index():
    return 'Video stream available at <a href="/video_feed">/video_feed</a>'

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=7737)