from pathlib import Path

import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    roc_auc_score,
)

# Project paths
PROJECT_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = PROJECT_DIR / "data archive" / "ai4i2020_cleaned.csv"
OUTPUT_DIR = Path(__file__).resolve().parent

# 1. Load and validate the dataset
df = pd.read_csv(DATA_PATH)

features = [
    "Air temperature [K]",
    "Process temperature [K]",
    "Rotational speed [rpm]",
    "Torque [Nm]",
    "Tool wear [min]",
]
target = "Machine failure"

required_columns = features + [target]
missing_columns = set(required_columns) - set(df.columns)

if missing_columns:
    raise ValueError(f"Missing required columns: {missing_columns}")

if df[required_columns].isnull().any().any():
    raise ValueError("Missing values found in features or target.")

if not set(df[target].unique()).issubset({0, 1}):
    raise ValueError(f"{target} must contain only 0 and 1.")

if df[target].nunique() != 2 or df[target].value_counts().min() < 2:
    raise ValueError("Not enough examples of both classes to train.")

X = df[features].apply(pd.to_numeric, errors="raise")
y = df[target].astype(int)

print("Dataset:", DATA_PATH)
print("Dataset shape:", df.shape)
print("Number of records:", len(df))
print("\nFailure distribution:")
print(y.value_counts().sort_index())
print(f"\nFailure rate: {y.mean():.2%}")

# 2. Split into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y,
)

print(f"\nTraining records: {len(X_train)}")
print(f"Testing records: {len(X_test)}")

# 3. Train the Random Forest classifier
model = RandomForestClassifier(
    n_estimators=200,
    class_weight="balanced",
    random_state=42,
    min_samples_leaf=2,
    n_jobs=-1,
)

model.fit(X_train, y_train)

# 4. Evaluate on held-out test records
predictions = model.predict(X_test)
probabilities = model.predict_proba(X_test)[:, 1]

print("\n--- MODEL EVALUATION ---")
print(f"Accuracy:          {accuracy_score(y_test, predictions):.3f}")
print(f"Balanced accuracy: {balanced_accuracy_score(y_test, predictions):.3f}")
print(f"ROC-AUC:           {roc_auc_score(y_test, probabilities):.3f}")

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

# 5. Save the model in the existing artifact format
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

model_path = OUTPUT_DIR / "failure_model.joblib"

joblib.dump(
    {
        "model": model,
        "features": features,
        "target": target,
    },
    model_path,
)

# 6. Save feature importance
importance = pd.Series(
    model.feature_importances_,
    index=features,
).sort_values(ascending=False)

print("\n--- FEATURE IMPORTANCE ---")
print(importance.to_string())

importance_path = OUTPUT_DIR / "feature_importance.csv"
importance.rename_axis("feature").to_csv(
    importance_path,
    header=["importance"],
)

print(f"\nSaved model to: {model_path}")
print(f"Saved feature importance to: {importance_path}")