
from pathlib import Path

import joblib
import pandas as pd
import shap

# Load the saved model
folder = Path(__file__).resolve().parent
saved_data = joblib.load(folder / "failure_model.joblib")

model = saved_data["model"]
features = saved_data["features"]

# Example sensor readings (same values tested earlier)
sensor_values = {
    "temperature": 80,
    "vibration": 0.8,
    "pressure": 100,
    "speed": 1500,
    "torque": 45,
    "tool_wear": 150,
}

sensor_data = pd.DataFrame(
    [[sensor_values[name] for name in features]],
    columns=features,
)

# Calculate SHAP explanations for the Random Forest
explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(sensor_data)

# Support SHAP's common output formats for binary classification
if isinstance(shap_values, list):
    # Older SHAP format: one array per class
    failure_values = shap_values[1][0]
elif getattr(shap_values, "ndim", 0) == 3:
    # Newer format: samples x features x classes
    failure_values = shap_values[0, :, 1]
else:
    # Two-dimensional output: samples x features
    failure_values = shap_values[0]

# Show the model prediction
probability = model.predict_proba(sensor_data)[0, 1]
prediction = int(model.predict(sensor_data)[0])

print("SMARTPREDICT - SHAP EXPLANATION")
print("-" * 40)
print(f"Predicted class: {prediction}")
print(f"Failure probability: {probability:.1%}")
print("\nIndividual feature contributions:")

explanation = pd.Series(
    failure_values,
    index=features,
).sort_values(key=abs, ascending=False)

for feature, contribution in explanation.items():
    direction = (
        "pushes toward failure"
        if contribution > 0
        else "pushes away from failure"
        if contribution < 0
        else "no contribution"
    )
    print(f"{feature}: {contribution:+.4f} ({direction})")

print(
    "\nNote: SHAP contributions explain the model's output, "
    "not real-world causation."
)
