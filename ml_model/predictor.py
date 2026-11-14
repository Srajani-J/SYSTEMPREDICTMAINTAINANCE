"""
Reusable failure prediction with SHAP explanations.

The response carries a ``model_version`` (a content hash of the saved artifact)
and the ``decision_threshold`` used to turn a probability into a class, so a
stored prediction can be traced back to the exact model that produced it.
"""

import hashlib
from pathlib import Path

import joblib
import pandas as pd
import shap

MODEL_PATH = Path(__file__).resolve().parent / "failure_model.joblib"

# Probability above which a reading is reported as a predicted failure.
# The dataset is imbalanced (3.39% failures); this is a deliberate choice and
# is returned with every prediction rather than hidden in the model.
DECISION_THRESHOLD = 0.5


def _artifact_digest(path: Path, chunk_size: int = 1 << 20) -> str:
    """Short content hash identifying the loaded model artifact."""
    digest = hashlib.sha256()

    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(chunk_size), b""):
            digest.update(block)

    return digest.hexdigest()[:12]


_saved = joblib.load(MODEL_PATH)
_model = _saved["model"]
_FEATURES = _saved["features"]
_explainer = shap.TreeExplainer(_model)

MODEL_VERSION = f"randomforest-{_artifact_digest(MODEL_PATH)}"


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

    probability = float(_model.predict_proba(data)[0, 1])
    prediction = int(probability >= DECISION_THRESHOLD)

    raw_values = _explainer.shap_values(data)

    # Extract the SHAP values for the failure class.
    if isinstance(raw_values, list):
        contributions = raw_values[1][0]
    elif getattr(raw_values, "ndim", 0) == 3:
        contributions = raw_values[0, :, 1]
    else:
        contributions = raw_values[0]

    explanations = []
    for name, value in zip(_FEATURES, contributions):
        contribution = float(value)
        explanations.append(
            {
                "sensor": name,
                "shap_value": round(contribution, 4),
                "direction": (
                    "toward_failure"
                    if contribution > 0
                    else "away_from_failure"
                    if contribution < 0
                    else "neutral"
                ),
            }
        )

    explanations.sort(
        key=lambda item: abs(item["shap_value"]),
        reverse=True,
    )

    return {
        "prediction": prediction,
        "status": (
            "failure_predicted" if prediction == 1 else "no_failure_predicted"
        ),
        "failure_probability": round(probability, 4),
        "decision_threshold": DECISION_THRESHOLD,
        "model": "RandomForestClassifier",
        "model_version": MODEL_VERSION,
        "explanations": explanations,
        "note": (
            "SHAP explains model output, not real-world causation. "
            "This model was trained on the project's dataset."
        ),
    }
