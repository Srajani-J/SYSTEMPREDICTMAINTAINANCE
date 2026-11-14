"""
SmartPredict API.

Layers
------
* ``create_app`` builds the application: configuration, CORS, lifespan and
  routers.
* Every dataset, prediction and notification endpoint requires a valid bearer
  token; mutating notification endpoints are role-gated.
* Errors are logged with a reference id and returned as generic messages so
  internals (SQL, stack traces, file paths) never reach the client.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
import logging
import uuid

import pandas as pd
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend import settings
from backend.access import machine_scope, sees_all_machines
from backend.analytics import database_overview, work_order_stats
from backend.assignments_service import list_assignments
from backend.auth_service import bootstrap_admin
from backend.database import init_db
from backend.dataset import (
    DATA_FILE,
    dataset_or_error,
    filter_machines,
    find_machine,
    historical_failure_count,
    machine_id_for,
    machine_records,
    parse_machine_id,
    total_machines,
)
from backend.deps import get_current_user, require_roles
from backend.notification_service import (
    acknowledge_notification,
    assign_notification,
    count_notifications,
    create_notification,
    list_notifications,
    resolve_notification,
)
from backend.predictions_service import (
    latest_for_machine,
    list_predictions,
    record_prediction,
)
from backend.ratelimit import enforce
from backend.risk import RISK_BANDS, RISK_LEVELS, risk_level
from backend.routers.admin import admin_router, router as admin_users_router
from backend.routers.auth import router as auth_router
from ml_model.predictor import predict_machine

logger = logging.getLogger("smartpredict.api")

APP_VERSION = "2.3.0"

# ==================================================
# APPLICATION LIFECYCLE
# ==================================================

@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Prepare the database and bootstrap the first administrator."""
    init_db()

    try:
        admin = bootstrap_admin()
    except (ValueError, RuntimeError) as exc:
        # In production a missing bootstrap password is fatal; in development
        # the API still starts so the rest of the project can be exercised.
        if settings.IS_PRODUCTION:
            raise
        logger.warning("Administrator bootstrap skipped: %s", exc)
    else:
        if admin is not None:
            logger.warning(
                "Bootstrapped administrator account %s (must change password "
                "on first sign-in).",
                admin["email"],
            )

    if not DATA_FILE.exists():
        logger.error("Dataset not found at %s; dataset endpoints will fail.", DATA_FILE)

    logger.info(
        "SmartPredict %s started (environment=%s, database=%s).",
        APP_VERSION,
        settings.ENVIRONMENT,
        settings.database_path(),
    )

    yield


# ==================================================
# ROUTES
# ==================================================

api = APIRouter()


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
    """
    Sensor readings for one prediction.

    Bounds are physical plausibility limits, deliberately wider than the AI4I
    training range (air 295-305 K, process 306-314 K, RPM 1168-2886, torque
    3.8-76.6 Nm, tool wear 0-253 min) so the API rejects impossible telemetry
    while still accepting unusual-but-real readings.
    """

    air_temperature: float = Field(
        ge=233.15,
        le=473.15,
        allow_inf_nan=False,
        description="Air temperature in Kelvin (-40 C to 200 C).",
    )

    process_temperature: float = Field(
        ge=233.15,
        le=523.15,
        allow_inf_nan=False,
        description="Process temperature in Kelvin (-40 C to 250 C).",
    )

    rotational_speed: float = Field(
        ge=0,
        le=30000,
        allow_inf_nan=False,
        description="Rotational speed in RPM.",
    )

    torque: float = Field(
        ge=0,
        le=1000,
        allow_inf_nan=False,
        description="Torque in Newton-metres.",
    )

    tool_wear: float = Field(
        ge=0,
        le=10000,
        allow_inf_nan=False,
        description="Tool wear in minutes.",
    )

    # Optional profile details for notifications.
    profile_id: str | None = Field(default=None, max_length=64)
    product_id: str | None = Field(default=None, max_length=64)


class AssignNotificationRequest(BaseModel):
    assigned_to: str = Field(min_length=2, max_length=120)


# ==================================================
# ROOT & STATUS (public, used by uptime checks)
# ==================================================

@api.get("/")
def root():
    return {
        "message": "SmartPredict API is running",
        "project": "SmartPredict",
        "version": APP_VERSION,
        "notification_system": "enabled",
    }


@api.get("/api/status")
def api_status():
    return {
        "status": "online",
        "project": "SmartPredict",
        "version": APP_VERSION,
        "message": "SmartPredict API is working successfully",
        "notification_system": "enabled",
    }


# ==================================================
# MACHINE HEALTH / DASHBOARD RECORDS
# ==================================================

@api.get("/api/health")
def get_machine_health(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    _user: dict = Depends(get_current_user),
):
    """
    Return paginated historical AI4I dataset records.

    These are historical records, not live telemetry. No validated health
    score exists, and vibration/pressure are not part of the dataset.
    """

    df = dataset_or_error()

    records = machine_records(df, offset, limit)

    return {
        "total_count": len(df),
        "count": len(records),
        "limit": limit,
        "offset": offset,
        "machines": records,
        "data_source": "AI4I 2020 cleaned dataset",
        "record_type": "historical_dataset_records",
        "health_score_available": False,
    }


@api.get("/api/machines")
def list_machines(
    q: str | None = Query(
        default=None,
        max_length=64,
        description="Search by record id, product id or product type.",
    ),
    product_type: str | None = Query(default=None, max_length=1),
    failure: int | None = Query(default=None, ge=0, le=1),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _user: dict = Depends(get_current_user),
):
    """
    Search and page the historical operating profiles.

    The dashboard uses this to fill its profile selector, so the browser never
    downloads the complete dataset to show a handful of machines.
    """

    df = dataset_or_error()

    filtered = filter_machines(
        df,
        query=q,
        product_type=product_type,
        failure=failure,
    )

    records = machine_records(filtered, offset, limit)

    return {
        "total_count": len(filtered),
        "count": len(records),
        "limit": limit,
        "offset": offset,
        "machines": records,
        "data_source": "AI4I 2020 cleaned dataset",
        "record_type": "historical_dataset_records",
        "health_score_available": False,
    }


# ==================================================
# SENSOR DATA ENDPOINT
# ==================================================

@api.get("/api/sensors")
def get_sensors(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    _user: dict = Depends(get_current_user),
):
    """Return paginated original AI4I dataset records."""

    df = dataset_or_error()

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
        **pagination_response(total_count, limit, offset, cleaned_records),
        "data_source": "AI4I 2020 cleaned dataset",
    }


# ==================================================
# RANDOM FOREST + SHAP PREDICTION ENDPOINT
# ==================================================

@api.post("/api/predict")
def predict_failure(
    request: Request,
    payload: PredictionRequest,
    user: dict = Depends(get_current_user),
):
    """
    Predict machine failure with the saved Random Forest model and explain the
    result with SHAP.

    A maintenance notification is stored when the model reports meaningful
    risk. SHAP explains model output, not real-world causation.
    """

    enforce(
        request,
        "predict",
        settings.RATE_LIMIT_PREDICT,
        settings.RATE_LIMIT_WINDOW_SECONDS,
        subject=str(user["id"]),
    )

    sensor_readings = {
        "Air temperature [K]": payload.air_temperature,
        "Process temperature [K]": payload.process_temperature,
        "Rotational speed [rpm]": payload.rotational_speed,
        "Torque [Nm]": payload.torque,
        "Tool wear [min]": payload.tool_wear,
    }

    try:
        result = predict_machine(sensor_readings)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc
    except Exception as exc:  # model/runtime failure
        reference = uuid.uuid4().hex[:12]
        logger.exception("Prediction failed (reference=%s)", reference)
        raise HTTPException(
            status_code=500,
            detail=(
                "The prediction engine could not complete this request. "
                f"Reference: {reference}"
            ),
        ) from exc

    result["risk_level"] = risk_level(result["failure_probability"])

    record_id = parse_machine_id(payload.profile_id)
    machine_id = machine_id_for(record_id) if record_id is not None else None

    try:
        stored_prediction = record_prediction(
            result=result,
            sensor_readings=sensor_readings,
            machine_id=machine_id,
            user_id=user["id"],
        )
    except Exception as exc:  # storage failure
        reference = uuid.uuid4().hex[:12]
        logger.exception(
            "Prediction history could not be stored for user %s (reference=%s)",
            user["email"],
            reference,
        )
        raise HTTPException(
            status_code=500,
            detail=(
                "The prediction could not be recorded. "
                f"Reference: {reference}"
            ),
        ) from exc

    result["prediction_id"] = stored_prediction["id"]
    result["machine_id"] = machine_id

    try:
        notification = create_notification(
            prediction_result=result,
            sensor_readings=sensor_readings,
            profile_id=payload.profile_id,
            product_id=payload.product_id,
        )
    except Exception as exc:  # storage failure
        reference = uuid.uuid4().hex[:12]
        logger.exception(
            "Notification could not be stored for user %s (reference=%s)",
            user["email"],
            reference,
        )
        raise HTTPException(
            status_code=500,
            detail=(
                "The prediction succeeded but the maintenance alert could not "
                f"be stored. Reference: {reference}"
            ),
        ) from exc

    result["notification"] = notification

    return result


# ==================================================
# NOTIFICATION LIST
# ==================================================

@api.get("/api/notifications")
def get_notifications(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    status: str | None = Query(default=None, max_length=20),
    _user: dict = Depends(get_current_user),
):
    """Retrieve stored AI-generated maintenance notifications."""

    notifications = list_notifications(limit=limit, offset=offset, status=status)

    return {
        "total_count": count_notifications(status=status),
        "count": len(notifications),
        "limit": limit,
        "offset": offset,
        "notifications": notifications,
    }


# ==================================================
# ASSIGN NOTIFICATION TO TECHNICIAN
# ==================================================

@api.patch("/api/notifications/{notification_id}/assign")
def assign_technician(
    notification_id: int,
    request: AssignNotificationRequest,
    _user: dict = Depends(require_roles("Admin", "Maintenance")),
):
    """Assign a maintenance notification to a team member."""

    notification = assign_notification(notification_id, request.assigned_to.strip())

    if notification is None:
        raise HTTPException(
            status_code=404,
            detail="Notification not found.",
        )

    return notification


# ==================================================
# ACKNOWLEDGE NOTIFICATION
# ==================================================

@api.post("/api/notifications/{notification_id}/acknowledge")
def acknowledge_alert(
    notification_id: int,
    _user: dict = Depends(get_current_user),
):
    """Mark a new notification as acknowledged."""

    notification = acknowledge_notification(notification_id)

    if notification is None:
        raise HTTPException(
            status_code=404,
            detail="Notification not found or already processed.",
        )

    return notification


# ==================================================
# RESOLVE NOTIFICATION
# ==================================================

@api.post("/api/notifications/{notification_id}/resolve")
def resolve_alert(
    notification_id: int,
    _user: dict = Depends(get_current_user),
):
    """Mark an active notification as resolved."""

    notification = resolve_notification(notification_id)

    if notification is None:
        raise HTTPException(
            status_code=404,
            detail="Notification not found or already resolved.",
        )

    return notification


# ==================================================
# ADMIN OVERVIEW
# ==================================================

@api.get("/api/admin/overview")
def admin_overview(_admin: dict = Depends(require_roles("Admin"))):
    """
    Real, database-backed statistics for the Admin dashboard.

    Machine totals come from the historical dataset; risk bands come from
    stored predictions. Nothing here is sampled or hardcoded.
    """
    totals = database_overview()

    machines_total = total_machines()
    failures = historical_failure_count()

    return {
        "machines": {
            "total": machines_total,
            "historical_failures": failures,
            "no_failure_recorded": machines_total - failures,
            "assigned": totals["assignments_total"],
            "with_predictions": totals["predictions"]["machines_with_predictions"],
        },
        "users": totals["users"],
        "notifications": totals["notifications"],
        "predictions": totals["predictions"],
        "work_orders": totals["work_orders"],
        "issues": totals["issues"],
        "recent_activity": totals["recent_activity"],
        "risk_bands": list(RISK_BANDS),
        "data_source": "AI4I 2020 cleaned dataset",
        "record_type": "historical_dataset_records",
        "note": (
            "Machine totals and failure counts are historical dataset records. "
            "Risk bands come from stored model predictions, not live sensors."
        ),
    }


# ==================================================
# MACHINE DETAIL
# ==================================================

@api.get("/api/machines/{machine_id}")
def get_machine_detail(machine_id: str, user: dict = Depends(get_current_user)):
    """
    One machine with its latest prediction, assignments and open work.

    Admins and Supervisors may open any machine; Engineers and Operators only
    machines assigned to them.
    """
    dataset_or_error()

    record = find_machine(machine_id)

    if record is None:
        raise HTTPException(status_code=404, detail="Machine not found.")

    if not sees_all_machines(user):
        scope = machine_scope(user) or set()

        if record["machine_id"] not in scope:
            raise HTTPException(
                status_code=403,
                detail="This machine is not assigned to you.",
            )

    predictions, prediction_total = list_predictions(
        limit=5,
        offset=0,
        machine_id=record["machine_id"],
    )

    return {
        "machine": record,
        "latest_prediction": latest_for_machine(record["machine_id"]),
        "recent_predictions": predictions,
        "prediction_total": prediction_total,
        "assignments": list_assignments(machine_id=record["machine_id"]),
        "work_orders": work_order_stats(record["machine_id"]),
        "record_type": "historical_dataset_record",
    }


# ==================================================
# PREDICTION HISTORY
# ==================================================

@api.get("/api/predictions")
def get_predictions(
    machine_id: str | None = Query(default=None, max_length=32),
    risk: str | None = Query(default=None, max_length=12),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: dict = Depends(get_current_user),
):
    """
    Prediction history, newest first.

    Admins and Supervisors see every prediction; Engineers and Operators see
    only predictions for their assigned machines.
    """
    if risk is not None and risk.lower() not in RISK_LEVELS:
        raise HTTPException(
            status_code=422,
            detail=f"risk must be one of {', '.join(RISK_LEVELS)}",
        )

    predictions, total = list_predictions(
        limit=limit,
        offset=offset,
        machine_id=machine_id,
        level=risk,
        machine_ids=machine_scope(user),
    )

    return {
        "total_count": total,
        "count": len(predictions),
        "limit": limit,
        "offset": offset,
        "predictions": predictions,
    }


# ==================================================
# APPLICATION FACTORY
# ==================================================

def create_app() -> FastAPI:
    application = FastAPI(
        title="SmartPredict API",
        description=(
            "Predictive maintenance API using the AI4I dataset, Random Forest, "
            "SHAP explainability, JWT authentication and maintenance "
            "notifications."
        ),
        version=APP_VERSION,
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        # Tokens travel in the Authorization header, not cookies, so
        # credentialed CORS requests are unnecessary.
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(auth_router)
    application.include_router(admin_users_router)
    application.include_router(admin_router)
    application.include_router(api)

    return application


app = create_app()
