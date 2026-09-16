import csv
import random
from pathlib import Path

# Reproducible synthetic dataset
random.seed(42)

OUTPUT = Path(__file__).resolve().parents[1] / "research" / "sample_machine_data.csv"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

rows = []

for i in range(1, 1001):
    machine_id = f"M{i:04d}"

    # Illustrative synthetic class distribution:
    # approximately 80% normal and 20% failure examples.
    failure = random.choices([0, 1], weights=[80, 20], k=1)[0]

    if failure == 0:
        temperature = round(random.uniform(55, 75), 2)
        vibration = round(random.uniform(1.0, 3.5), 2)
        pressure = round(random.uniform(98, 106), 2)
        speed = round(random.uniform(1450, 1550), 2)
        torque = round(random.uniform(35, 48), 2)
        tool_wear = round(random.uniform(5, 55), 2)
    else:
        temperature = round(random.uniform(80, 100), 2)
        vibration = round(random.uniform(4.5, 8.0), 2)
        pressure = round(random.uniform(108, 120), 2)
        speed = round(random.uniform(1350, 1440), 2)
        torque = round(random.uniform(50, 65), 2)
        tool_wear = round(random.uniform(65, 100), 2)

    rows.append([
        machine_id,
        temperature,
        vibration,
        pressure,
        speed,
        torque,
        tool_wear,
        failure
    ])

with OUTPUT.open("w", newline="", encoding="utf-8") as file:
    writer = csv.writer(file)

    writer.writerow([
        "machine_id",
        "temperature",
        "vibration",
        "pressure",
        "speed",
        "torque",
        "tool_wear",
        "failure"
    ])

    writer.writerows(rows)

print("Dataset created successfully!")
print(f"Records: {len(rows)}")
print(f"Output: {OUTPUT}")
