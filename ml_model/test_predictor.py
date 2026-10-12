from predictor import predict_machine

# Test readings must use the five features from ai4i2020_cleaned.csv.
# These are example values, not a real machine diagnosis.
readings = {
    "Air temperature [K]": 300.0,
    "Process temperature [K]": 310.0,
    "Rotational speed [rpm]": 1500,
    "Torque [Nm]": 40.0,
    "Tool wear [min]": 100,
}

result = predict_machine(readings)

print("Prediction:", result["status"])
print("Failure probability:", result["failure_probability"])
print("\nExplanations:")

for item in result["explanations"]:
    print(
        item["sensor"],
        item["shap_value"],
        item["direction"],
    )