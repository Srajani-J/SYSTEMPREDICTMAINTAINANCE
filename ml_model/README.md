SmartPredict — Machine Learning Module
1. Purpose

Predict machine failure using sensor measurements from the AI4I 2020 predictive maintenance dataset. The module also uses SHAP to explain individual predictions.

2. Dataset
Dataset: Cleaned AI4I 2020 predictive maintenance dataset
Records: 10,000
Columns: 14
Target: Machine failure (0 = no failure, 1 = failure)
Non-failure records: 9,661 (96.61%)
Failure records: 339 (3.39%)

Dataset quality checks

Missing values: 0 across all 14 columns.
Duplicate rows: 0.
Failure rate: 3.39%, indicating a class-imbalanced dataset.
Preprocessing: The model uses the cleaned AI4I 2020 dataset supplied in the project. Refer to the dataset-cleaning report for details of the cleaning operations performed.

Input features used by the model

Air temperature [K]
Process temperature [K]
Rotational speed [rpm]
Torque [Nm]
Tool wear [min]

The original dataset also contains identifiers, product type, the machine-failure target, and failure-mode indicators. The model uses only the five sensor features listed above.

3. Model
Algorithm: Random Forest Classifier
Training records: 8,000
Testing records: 2,000
Split: 80% training and 20% testing
Input features
Air temperature [K]
Process temperature [K]
Rotational speed [rpm]
Torque [Nm]
Tool wear [min]
4. Evaluation results
Metric	Result
Accuracy	97.5%
Balanced accuracy	88.7%
ROC-AUC	0.972

Confusion matrix (rows = actual, columns = predicted):

[[1895, 37],
 [  14, 54]]


The model detected 54 of 68 actual failures and missed 14. It also produced 37 false alarms. Failure-class precision was 0.59 and recall was 0.79.

5. Explainable AI

The reusable predictor uses SHAP TreeExplainer to calculate feature contributions.

Each explanation includes:

sensor: feature name
shap_value: numerical contribution
direction: toward_failure, away_from_failure, or neutral

SHAP explains model output; it does not prove real-world causation.

6. Main files
train_model.py — trains and evaluates the model
predictor.py — reusable prediction and explanation function
test_predictor.py — tests the reusable predictor
predict_failure.py — prediction demonstration
explain_prediction.py — explanation demonstration
failure_model.joblib — saved model and feature configuration
feature_importance.csv — global feature importance
failure_model_backup.joblib — backup model
7. Using the predictor

Run this example from the project root:

from ml_model.predictor import predict_machine

sensor_readings = {
    "Air temperature [K]": 300.0,
    "Process temperature [K]": 310.0,
    "Rotational speed [rpm]": 1500,
    "Torque [Nm]": 40.0,
    "Tool wear [min]": 100
}

result = predict_machine(sensor_readings)
print(result)


The returned dictionary includes the predicted class, status, estimated failure probability, model name, SHAP explanations and a limitation note.

8. Dependencies

Install the required packages in your Python environment:

python -m pip install pandas scikit-learn joblib shap

9. Limitations
Accuracy alone is insufficient for evaluating an imbalanced dataset.
The model missed 14 actual failures in the reported test set.
Real-world industrial performance has not been established.
SHAP contributions are not proof of causation.
Further validation is needed before using predictions for real maintenance decisions.