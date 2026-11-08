
from functools import lru_cache
from math import isfinite
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ml_model.predictor import predict_machine

from backend.notification_service import (
    initialize_notification_db,
    create_notification,
    list_notifications,
    assign_notification,
    acknowledge_notification,
    resolve_notification,
)


# ==================================================
# APPLICATION CONFIGURATION
# ==================================================

app = FastAPI(
    title="SmartPredict API",
    description=(
        "Predictive maintenance API using the AI4I dataset, "
        "Random Forest, SHAP explainability and maintenance notifications."
    ),
    version="2.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================================================
# NOTIFICATION DATABASE INITIALIZATION
# ==================================================

initialize_notification_db()


# ==================================================
# DATASET CONFIGURATION
# ==================================================

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_FILE = (
    BASE_DIR
    / "data archive"
    / "ai4i2020_cleaned.csv"
)

REQUIRED_COLUMNS = [
    "UDI",
    "Product ID",
    "Type",
    "Air temperature [K]",
    "Process temperature [K]",
    "Rotational speed [rpm]",
    "Torque [Nm]",
    "Tool wear [min]",
    "Machine failure",
]


@lru_cache(maxsize=1)
def load_dataset():
    """Load and validate the cleaned dataset."""

    if not DATA_FILE.exists():
        raise FileNotFoundError(
            f"Dataset not found: {DATA_FILE}"
        )

    df = pd.read_csv(DATA_FILE)

    missing_columns = [
        column
        for column in REQUIRED_COLUMNS
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            f"Missing dataset columns: {missing_columns}"
        )

    return df


def get_dataset():
    """Load the dataset and return a useful API error if needed."""

    try:
        return load_dataset()

    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        ) from exc


def safe_float(value):
    """Convert a dataset value into a JSON-safe float."""

    number = float(value)

    if not isfinite(number):
        return None

    return round(number, 2)


def pagination_response(total, limit, offset, data):
    """Build a consistent paginated API response."""

    return {
        "total_count": total,
        "count": len(data),
        "limit": limit,
        "offset": offset,
        "data": data,
    }


# ==================================================
# REQUEST MODELS
# ==================================================

class PredictionRequest(BaseModel):

    air_temperature: float = Field(
        allow_inf_nan=False
    )

    process_temperature: float = Field(
        allow_inf_nan=False
    )

    rotational_speed: float = Field(
        allow_inf_nan=False
    )

    torque: float = Field(
        allow_inf_nan=False
    )

    tool_wear: float = Field(
        allow_inf_nan=False
    )

    # Optional profile details for notifications.
    profile_id: str | None = None

    product_id: str | None = None


class AssignNotificationRequest(BaseModel):

    assigned_to: str = Field(
        min_length=2,
        max_length=120
    )


# ==================================================
# ROOT ENDPOINT
# ==================================================

@app.get("/")
def root():

    return {
        "message": "SmartPredict API is running",
        "project": "SmartPredict",
        "version": "2.2.0",
        "dataset": DATA_FILE.name,
        "notification_system": "enabled",
    }


# ==================================================
# API STATUS
# ==================================================

@app.get("/api/status")
def api_status():

    return {
        "status": "online",
        "project": "SmartPredict",
        "version": "2.2.0",
        "message": "SmartPredict API is working successfully",
        "notification_system": "enabled",
    }


# ==================================================
# MACHINE HEALTH / DASHBOARD RECORDS
# ==================================================

@app.get("/api/health")
def get_machine_health(
    limit: int = Query(
        default=100,
        ge=1,
        le=1000
    ),
    offset: int = Query(
        default=0,
        ge=0
    ),
):
    """
    Return paginated historical AI4I dataset records.

    Important:
    - These are historical records, not live telemetry.
    - No validated health score is available.
    - Vibration and pressure are not present in the dataset.
    - Failure is the historical Machine failure label.
    """

    df = get_dataset()

    total_count = len(df)

    page = df.iloc[offset:offset + limit]

    machines = []

    for _, row in page.iterrows():

        record_id = int(row["UDI"])

        failure = int(row["Machine failure"])

        air_temperature_k = float(
            row["Air temperature [K]"]
        )

        process_temperature_k = float(
            row["Process temperature [K]"]
        )

        rpm = safe_float(
            row["Rotational speed [rpm]"]
        )

        record = {

            "record_id": record_id,

            "machine_id": f"UDI-{record_id:05d}",

            "product_id": str(row["Product ID"]),

            "product_type": str(row["Type"]),

            # No validated health score is available.
            "health": None,

            "status": (
                "FAILURE_RECORDED"
                if failure == 1
                else "NO_FAILURE_RECORDED"
            ),

            # Air temperature in Celsius.
            "temperature": round(
                air_temperature_k - 273.15,
                2
            ),

            # Original air temperature in Kelvin.
            "temperature_k": round(
                air_temperature_k,
                2
            ),

            # Process temperature in Celsius.
            "process_temperature": round(
                process_temperature_k - 273.15,
                2
            ),

            # Original process temperature in Kelvin.
            "process_temperature_k": round(
                process_temperature_k,
                2
            ),

            # Not available in the AI4I dataset.
            "vibration": None,

            "pressure": None,

            "speed": rpm,

            "rpm": rpm,

            "torque": safe_float(
                row["Torque [Nm]"]
            ),

            "tool_wear": safe_float(
                row["Tool wear [min]"]
            ),

            # Historical target, not a model prediction.
            "failure": failure,
        }

        machines.append(record)

    return {
        "total_count": total_count,
        "count": len(machines),
        "limit": limit,
        "offset": offset,
        "machines": machines,
        "data_source": "AI4I 2020 cleaned dataset",
        "record_type": "historical_dataset_records",
        "health_score_available": False,
    }


# ==================================================
# SENSOR DATA ENDPOINT
# ==================================================

@app.get("/api/sensors")
def get_sensors(
    limit: int = Query(
        default=100,
        ge=1,
        le=1000
    ),
    offset: int = Query(
        default=0,
        ge=0
    ),
):
    """
    Return paginated original AI4I dataset records.
    """

    df = get_dataset()

    total_count = len(df)

    page = df.iloc[offset:offset + limit]

    records = page.to_dict(orient="records")

    cleaned_records = []

    for record in records:

        cleaned_record = {}

        for key, value in record.items():

            if pd.isna(value):
                cleaned_record[key] = None

            elif hasattr(value, "item"):
                cleaned_record[key] = value.item()

            else:
                cleaned_record[key] = value

        cleaned_records.append(cleaned_record)

    return {
        **pagination_response(
            total_count,
            limit,
            offset,
            cleaned_records,
        ),
        "data_source": "AI4I 2020 cleaned dataset",
    }


# ==================================================
# RANDOM FOREST + SHAP PREDICTION ENDPOINT
# ==================================================

@app.post("/api/predict")
def predict_failure(request: PredictionRequest):
    """
    Predict machine failure using the saved Random Forest model.

    Creates a maintenance notification when the AI identifies
    sufficient failure risk.

    SHAP explains model output, not real-world causation.
    """

    sensor_readings = {

        "Air temperature [K]":
            request.air_temperature,

        "Process temperature [K]":
            request.process_temperature,

        "Rotational speed [rpm]":
            request.rotational_speed,

        "Torque [Nm]":
            request.torque,

        "Tool wear [min]":
            request.tool_wear,
    }

    try:

        # Run existing Random Forest + SHAP prediction.
        result = predict_machine(sensor_readings)

        # Generate a notification when failure risk is detected.
        notification = create_notification(
            prediction_result=result,
            sensor_readings=sensor_readings,
            profile_id=request.profile_id,
            product_id=request.product_id,
        )

        # Include the notification in the prediction response.
        result["notification"] = notification

        return result

    except ValueError as exc:

        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(exc)}",
        ) from exc


# ==================================================
# NOTIFICATION LIST
# ==================================================

@app.get("/api/notifications")
def get_notifications(
    limit: int = Query(
        default=100,
        ge=1,
        le=500
    ),
    offset: int = Query(
        default=0,
        ge=0
    ),
    status: str | None = Query(
        default=None
    ),
):
    """
    Retrieve stored AI-generated maintenance notifications.
    """

    return list_notifications(
        limit=limit,
        offset=offset,
        status=status,
    )


# ==================================================
# ASSIGN NOTIFICATION TO TECHNICIAN
# ==================================================

@app.patch("/api/notifications/{notification_id}/assign")
def assign_technician(
    notification_id: int,
    request: AssignNotificationRequest,
):
    """
    Assign a maintenance notification to a team member.
    """

    notification = assign_notification(
        notification_id,
        request.assigned_to.strip(),
    )

    if notification is None:

        raise HTTPException(
            status_code=404,
            detail="Notification not found.",
        )

    return notification


# ==================================================
# ACKNOWLEDGE NOTIFICATION
# ==================================================

@app.post("/api/notifications/{notification_id}/acknowledge")
def acknowledge_alert(notification_id: int):
    """
    Mark a new notification as acknowledged.
    """

    notification = acknowledge_notification(
        notification_id
    )

    if notification is None:

        raise HTTPException(
            status_code=404,
            detail=(
                "Notification not found or already processed."
            ),
        )

    return notification


# ==================================================
# RESOLVE NOTIFICATION
# ==================================================

@app.post("/api/notifications/{notification_id}/resolve")
def resolve_alert(notification_id: int):
    """
    Mark an active notification as resolved.
    """

    notification = resolve_notification(
        notification_id
    )

    if notification is None:

        raise HTTPException(
            status_code=404,
            detail=(
                "Notification not found or already resolved."
            ),
        )

    return notification
