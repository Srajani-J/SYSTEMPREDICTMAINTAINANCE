# SmartPredict — Machine Learning Module

## Purpose
Predict machine failure from six sensor measurements and provide individual prediction explanations using SHAP.

## Model
- Algorithm: Random Forest Classifier
- Dataset: `sample_machine_data.csv`
- Records: 1,000
- Target: `failure` (0 = no failure, 1 = failure)
- Features: `temperature`, `vibration`, `pressure`, `speed`, `torque`, `tool_wear`
- Test split: 200 records
- Reported test accuracy: 100%
- Reported ROC-AUC: 1.000

**Limitation:** These metrics are from the current synthetic dataset and test split. They do not establish real-world industrial performance.

## Main files
- `train_model.py` — trains and evaluates the model
- `predict_failure.py` — interactive prediction demonstration
- `explain_prediction.py` — SHAP explanation demonstration
- `predictor.py` — reusable prediction function
- `test_predictor.py` — tests the reusable function
- `failure_model.joblib` — saved model and feature order
- `feature_importance.csv` — global feature importance

## Backend integration
Import the function:

`from predictor import predict_machine`

Call it with a dictionary containing all six required sensor readings:

`result = predict_machine(sensor_readings)`

The returned dictionary includes:
- `prediction`: 0 or 1
- `status`: prediction status string
- `failure_probability`: estimated probability between 0 and 1
- `explanations`: sensor names, SHAP values and contribution directions
- `model`: model name
- `note`: explanation limitation

## Dependencies
Install the required packages with:

`python -m pip install pandas scikit-learn joblib shap`

## Important notes
- Supply all six features as numeric values.
- SHAP contributions explain the model output, not real-world causation.
- The current model does not validate physical sensor limits or establish a production-ready maintenance risk policy.
