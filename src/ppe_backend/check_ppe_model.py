from ultralytics import YOLO
from pathlib import Path

BASE = Path(__file__).resolve().parent

MODEL_PATH = BASE / "runs" / "SmartPredict_PPE" / "weights" / "best.pt"

if not MODEL_PATH.exists():
    raise FileNotFoundError("Trained model not found!")

model = YOLO(str(MODEL_PATH))

print("PPE MODEL LOADED SUCCESSFULLY")

print("\nAvailable Classes:")
print(model.names)

 # Automatically find the PPE dataset folder
DATASET_DIR = next(BASE.glob("PPE_Kit*"), None)

if DATASET_DIR is None:
    raise FileNotFoundError("PPE dataset folder not found!")

TEST_DIR = DATASET_DIR / "test" / "images"

print("Test folder:", TEST_DIR)
if not TEST_DIR.exists():
    raise FileNotFoundError(f"Test images not found: {TEST_DIR}")

results = model.predict(
    source=str(TEST_DIR),
    conf=0.25,
    save=True
)

print("\nPPE IMAGE TESTING COMPLETED!")
print("Check the runs/detect folder for results.")

