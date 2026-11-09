from ultralytics import YOLO
from pathlib import Path

# Backend directory
BASE = Path(__file__).resolve().parent

# Find extracted PPE dataset folder
DATASET_DIR = next(BASE.glob("PPE_Kit*"), None)

if DATASET_DIR is None:
    raise FileNotFoundError("PPE dataset folder not found!")

# Dataset YAML
DATA = DATASET_DIR / "data.yaml"

if not DATA.exists():
    raise FileNotFoundError(f"data.yaml not found: {DATA}")

print("Dataset found:", DATA)

# Load YOLOv8 Nano
model = YOLO("yolov8n.pt")

# Train model
results = model.train(
    data=str(DATA),
    epochs=10,
    imgsz=416,
    batch=2,
    device="cpu",
    workers=0,
    name="SmartPredict_PPE",
    project=str(BASE / "runs"),
    exist_ok=True
)

print("Training completed!")

best_model = BASE / "runs" / "SmartPredict_PPE" / "weights" / "best.pt"

print("Best model location:", best_model)             