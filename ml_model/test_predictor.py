
from predictor import predict_machine

readings = {
    "temperature": 80,
    "vibration": 0.8,
    "pressure": 100,
    "speed": 1500,
    "torque": 45,
    "tool_wear": 150,
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
