# Predictive Maintenance Research & Dataset

## Project Part

**Predictive Maintenance Research & Initial Dataset Development**

## Deliverables

This package contains:

```text
Predictive-Maintenance/
|
+-- README.md
+-- research/
|   +-- sensor_parameters.md
|   +-- sample_machine_data.csv
|
+-- scripts/
    +-- generate_dataset.py
```

## What this part of the project does

This part identifies important machine parameters for failure prediction and creates an initial synthetic CSV dataset.

### Selected parameters

- Temperature
- Vibration
- Pressure
- Rotational Speed
- Torque
- Tool Wear
- Failure

## Dataset

The included dataset contains 1,000 synthetic records.

Target:

```text
failure
0 = No failure
1 = Failure
```

## How to regenerate the dataset

Requirements:

- Python 3.x

Open a terminal in the project root and run:

```bash
python scripts/generate_dataset.py
```

The script creates:

```text
research/sample_machine_data.csv
```

## Important

The CSV is synthetic. The ranges are illustrative for development and should not be treated as machine-specific safety/failure thresholds.

For a real predictive-maintenance system, use validated sensor data and historical maintenance/failure records.

## Suggested next project stages

1. Load the CSV
2. Check missing values and duplicates
3. Perform exploratory data analysis
4. Visualize sensor distributions
5. Analyze feature relationships
6. Split data into training and testing sets
7. Train classification models
8. Compare evaluation metrics
9. Build a failure-risk prediction interface
10. Connect the model to real-time or historical sensor data
