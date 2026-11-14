from pathlib import Path
import threading
import time

import cv2
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from ultralytics import YOLO


# --------------------------------------------------
# APPLICATION
# --------------------------------------------------

app = FastAPI(title="SmartPredict PPE Detection System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5177",
        "http://127.0.0.1:5177",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# MODEL PATH
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = (
    BASE_DIR
    / "runs"
    / "SmartPredict_PPE"
    / "weights"
    / "best.pt"
)

if not MODEL_PATH.is_file():
    raise FileNotFoundError(
        f"Trained PPE model not found: {MODEL_PATH}"
    )

model = YOLO(str(MODEL_PATH))

print("PPE MODEL LOADED SUCCESSFULLY")
print("Available classes:", model.names)


# --------------------------------------------------
# CAMERA AND LOCK
# --------------------------------------------------

camera = None
lock = threading.Lock()

latest_status = {
    "worker": False,
    "helmet": "UNKNOWN",
    "gloves": "UNKNOWN",
    "mask": "UNKNOWN",
    "vest": "UNKNOWN",
    "goggles": "UNKNOWN",
    "boots": "UNKNOWN",
    "violations": [],
    "message": "Waiting for detection",
}


# --------------------------------------------------
# CLASS NORMALIZATION
# --------------------------------------------------

def normalize(name):
    return "".join(
        char for char in str(name).lower()
        if char.isalnum()
    )


CLASS_MAPPING = {
    "helmet": ("helmet", "nohelmet"),
    "gloves": ("gloves", "nogloves"),
    "mask": ("mask", "nomask"),
    "vest": ("safetyvest", "nosafetyvest"),
    "goggles": ("safetyglasses", "noglasses"),
    "boots": ("safetyshoe", "nosafetyshoe"),
}


# --------------------------------------------------
# PPE DETECTION
# --------------------------------------------------

def detect_frame(frame):
    global latest_status

    result = model.predict(
        frame,
        imgsz=640,
        conf=0.35,
        verbose=False,
    )[0]

    detected = set()

    if result.boxes is not None:
        for box in result.boxes:
            class_id = int(box.cls[0])
            class_name = normalize(result.names[class_id])
            detected.add(class_name)

    worker_detected = (
        "person" in detected or "worker" in detected
    )

    equipment = {}

    for item, (positive, negative) in CLASS_MAPPING.items():
        if positive in detected:
            equipment[item] = "DETECTED"
        elif negative in detected:
            equipment[item] = "NOT DETECTED"
        else:
            equipment[item] = "UNKNOWN"

    violations = [
        item
        for item, value in equipment.items()
        if value == "NOT DETECTED"
    ]

    if not worker_detected:
        message = "No worker detected"
    elif violations:
        message = "PPE violation detected"
    else:
        message = "No explicit PPE violation detected"

    with lock:
        latest_status = {
            "worker": worker_detected,
            **equipment,
            "violations": violations,
            "message": message,
        }

    return result.plot()


# --------------------------------------------------
# VIDEO STREAM
# --------------------------------------------------

def video_generator():
    while True:
        with lock:
            current_camera = camera

        if current_camera is None or not current_camera.isOpened():
            break

        success, frame = current_camera.read()

        if not success:
            time.sleep(0.1)
            continue

        try:
            annotated_frame = detect_frame(frame)

            success, buffer = cv2.imencode(
                ".jpg",
                annotated_frame,
            )

            if not success:
                continue

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n"
                + buffer.tobytes()
                + b"\r\n"
            )

        except Exception as error:
            print("Frame detection error:", error)
            time.sleep(0.1)


# --------------------------------------------------
# CAMERA STARTUP
# --------------------------------------------------

@app.on_event("startup")
def start_camera():
    global camera

    camera = cv2.VideoCapture(0)

    if not camera.isOpened():
        camera.release()
        camera = None
        raise RuntimeError(
            "Laptop camera could not be opened. "
            "Check camera permissions or close other camera apps."
        )

    print("Laptop camera started successfully")


# --------------------------------------------------
# CAMERA SHUTDOWN
# --------------------------------------------------

@app.on_event("shutdown")
def stop_camera():
    global camera

    if camera is not None:
        camera.release()
        camera = None

    print("Camera stopped")


# --------------------------------------------------
# HOME API
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "PPE Detection Backend is Running",
        "status": "Success",
    }


# --------------------------------------------------
# PPE STATUS API
# --------------------------------------------------

@app.get("/api/ppe-status")
def get_ppe_status():
    with lock:
        return latest_status.copy()


# --------------------------------------------------
# LIVE VIDEO API
# --------------------------------------------------

@app.get("/video")
def video():
    if camera is None or not camera.isOpened():
        return {
            "error": "Camera is not available"
        }

    return StreamingResponse(
        video_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )