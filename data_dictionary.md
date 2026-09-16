# Data Dictionary

| Column | Type | Description |
|---|---|---|
| machine_id | string | Unique record/machine identifier |
| temperature | float | Temperature in °C |
| vibration | float | Illustrative vibration level in mm/s |
| pressure | float | Pressure in bar |
| speed | float | Rotational speed in RPM |
| torque | float | Torque in Nm |
| tool_wear | float | Synthetic tool-wear index from 0 to 100 |
| failure | integer | Target: 0 = no failure, 1 = failure |

**Note:** This is a synthetic dataset for development. Thresholds are illustrative, not universal engineering limits.
