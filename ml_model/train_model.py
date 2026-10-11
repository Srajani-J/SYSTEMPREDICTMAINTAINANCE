
from pathlib import Path

import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    roc_auc_score,
)

# Project paths
PROJECT_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = PROJECT_DIR / "sample_machine_data.csv"
OUTPUT_DIR = Path(__file__).resolve().parent

# 1. Load and validate the dataset
df = pd.read_csv(DATA_PATH)

required_columns = [
    "temperature",
    "vibration",
    "pressure",
    "speed",
    "torque",
    "tool_wear",
    "failure",
]

missing_columns = set(required_columns) - set(df.columns)
if missing_columns:
    raise ValueError(f"Missing required columns: {missing_columns}")

if df[required_columns].isnull().any().any():
    raise ValueError("Missing values found in required columns.")

if not set(df["failure"].unique()).issubset({0, 1}):
    raise ValueError("The failure column must contain only 0 and 1.")

print("Dataset shape:", df.shape)
print("\nFailure distribution:")
print(df["failure"].value_counts())

# 2. Separate inputs and target
features = [
    "temperature",
    "vibration",
    "pressure",
    "speed",
    "torque",
    "tool_wear",
]

X = df[features]
y = df["failure"].astype(int)

if y.nunique() != 2 or y.value_counts().min() < 2:
    raise ValueError("Not enough examples of both classes to train.")

# 3. Split data into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y,
)

# 4. Train a Random Forest classifier
model = RandomForestClassifier(
    n_estimators=200,
    class_weight="balanced",
    random_state=42,
    min_samples_leaf=2,
)

model.fit(X_train, y_train)

# 5. Evaluate on the held-out test set
predictions = model.predict(X_test)
probabilities = model.predict_proba(X_test)[:, 1]

print("\n--- MODEL EVALUATION ---")
print(f"Accuracy: {accuracy_score(y_test, predictions):.3f}")
print(f"ROC-AUC:  {roc_auc_score(y_test, probabilities):.3f}")

print("\nClassification report:")
print(
    classification_report(
        y_test,
        predictions,
        labels=[0, 1],
        target_names=["No failure", "Failure"],
        zero_division=0,
    )
)

print("Confusion matrix (rows=actual, columns=predicted):")
print(confusion_matrix(y_test, predictions, labels=[0, 1]))

# 6. Save model and feature information
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

model_path = OUTPUT_DIR / "failure_model.joblib"
joblib.dump(
    {
        "model": model,
        "features": features,
        "target": "failure",
    },
    model_path,
)

# 7. Show global feature importance
importance = pd.Series(
    model.feature_importances_,
    index=features,
).sort_values(ascending=False)

print("\n--- FEATURE IMPORTANCE ---")
print(importance.to_string())

importance.to_csv(OUTPUT_DIR / "feature_importance.csv")

print(f"\nSaved model to: {model_path}")
print(f"Saved feature importance to: {OUTPUT_DIR / 'feature_importance.csv'}")
