
from pathlib import Path
import joblib
import pandas as pd

# Locate the saved model
MODEL_PATH = Path(__file__).resolve().parent / "failure_model.joblib"

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        "Model not found. Run train_model.py first."
    )

saved_data = joblib.load(MODEL_PATH)
model = saved_data["model"]
features = saved_data["features"]

print("SMARTPREDICT - MACHINE FAILURE PREDICTION")
print("-" * 45)

# Collect new sensor readings
values = {}

for feature in features:
    while True:
        try:
            values[feature] = float(
                input(f"Enter {feature}: ")
            )
            break
        except ValueError:
            print("Please enter a valid number.")

# Arrange the readings in the correct feature order
sensor_data = pd.DataFrame(
    [[values[f] for f in features]],
    columns=features,
)

# Predict the failure class and estimated probability
prediction = int(model.predict(sensor_data)[0])
probability = model.predict_proba(sensor_data)[0][1]

print("\n--- PREDICTION RESULT ---")

if prediction == 1:
    print("Result: FAILURE PREDICTED")
else:
    print("Result: NO FAILURE PREDICTED")

print(f"Estimated failure probability: {probability:.1%}")

# Explain the model's overall feature importance
print("\n--- MODEL EXPLANATION ---")

importance = pd.Series(
    model.feature_importances_,
    index=features,
).sort_values(ascending=False)

for feature, score in importance.head(3).items():
    print(f"{feature}: importance = {score:.3f}")

print(
    "\nNote: Feature importance describes overall model "
    "behavior, not the cause of this individual prediction."
)
