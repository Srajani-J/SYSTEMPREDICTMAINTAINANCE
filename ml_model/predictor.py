
from pathlib import Path

import joblib
import pandas as pd
import shap

# Load the model once when this module is imported
MODEL_PATH = Path(__file__).resolve().parent / "failure_model.joblib"

_saved = joblib.load(MODEL_PATH)
_model = _saved["model"]
_FEATURES = _saved["features"]
_explainer = shap.TreeExplainer(_model)


def predict_machine(sensor_readings: dict) -> dict:
    """Predict failure and explain the model's output."""

    missing = [name for name in _FEATURES if name not in sensor_readings]
    if missing:
        raise ValueError(f"Missing sensor readings: {missing}")

    try:
        values = [float(sensor_readings[name]) for name in _FEATURES]
    except (TypeError, ValueError) as exc:
        raise ValueError("All sensor readings must be numbers.") from exc

    if not all(pd.notna(value) for value in values):
        raise ValueError("Sensor readings must be finite numbers.")

    if not all(abs(value) != float("inf") for value in values):
        raise ValueError("Sensor readings must be finite numbers.")

    data = pd.DataFrame([values], columns=_FEATURES)

    prediction = int(_model.predict(data)[0])
    probability = float(_model.predict_proba(data)[0, 1])

    raw_values = _explainer.shap_values(data)

    # Extract the SHAP values for the failure class
    if isinstance(raw_values, list):
        contributions = raw_values[1][0]
    elif getattr(raw_values, "ndim", 0) == 3:
        contributions = raw_values[0, :, 1]
    else:
        contributions = raw_values[0]

    explanations = []
    for name, value in zip(_FEATURES, contributions):
        contribution = float(value)
        explanations.append({
            "sensor": name,
            "shap_value": round(contribution, 4),
            "direction": (
                "toward_failure" if contribution > 0
                else "away_from_failure" if contribution < 0
                else "neutral"
            ),
        })

    explanations.sort(
        key=lambda item: abs(item["shap_value"]),
        reverse=True,
    )

    return {
        "prediction": prediction,
        "status": (
            "failure_predicted" if prediction == 1
            else "no_failure_predicted"
        ),
        "failure_probability": round(probability, 4),
        "model": "RandomForestClassifier",
        "explanations": explanations,
        "note": (
            "SHAP explains model output, not real-world causation. "
            "This model was trained on the project's dataset."
        ),
    }
