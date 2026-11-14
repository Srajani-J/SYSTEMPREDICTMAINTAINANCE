"""
Dataset access shared by the API and the routers.

The AI4I 2020 CSV is loaded once and cached. Records are shaped here so every
endpoint (health, machines, machine detail) returns the same object.
"""

from __future__ import annotations

from functools import lru_cache
import logging
from math import isfinite
from pathlib import Path
import re

import pandas as pd
from fastapi import HTTPException

logger = logging.getLogger("smartpredict.dataset")

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_FILE = BASE_DIR / "data archive" / "ai4i2020_cleaned.csv"

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


def load_dataset() -> pd.DataFrame:
    """Load and validate the cleaned dataset. Raises on missing data."""
    if not DATA_FILE.exists():
        raise FileNotFoundError(f"Dataset not found: {DATA_FILE}")

    frame = pd.read_csv(DATA_FILE)

    missing_columns = [
        column for column in REQUIRED_COLUMNS if column not in frame.columns
    ]

    if missing_columns:
        raise ValueError(f"Missing dataset columns: {missing_columns}")

    return frame


get_dataset = lru_cache(maxsize=1)(load_dataset)


def dataset_or_error() -> pd.DataFrame:
    """Return the dataset, translating load failures into a 503."""
    try:
        return get_dataset()
    except (FileNotFoundError, ValueError) as exc:
        logger.error("Dataset unavailable: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="The dataset is not available on the server.",
        ) from exc


def safe_float(value):
    """Convert a dataset value into a JSON-safe float."""
    number = float(value)

    if not isfinite(number):
        return None

    return round(number, 2)


def machine_id_for(record_id: int) -> str:
    """Canonical machine identifier, e.g. ``UDI-00001``."""
    return f"UDI-{int(record_id):05d}"


def parse_machine_id(value: str | int | None) -> int | None:
    """Accept ``UDI-00001`` or ``1`` and return the numeric record id."""
    if value is None:
        return None

    text = str(value).strip().upper()

    if text.startswith("UDI-"):
        text = text[4:]

    return int(text) if text.isdigit() else None


def machine_record(row: dict) -> dict:
    """Convert one plain dataset row into an API machine record."""
    record_id = int(row["UDI"])
    failure = int(row["Machine failure"])
    air_temperature_k = float(row["Air temperature [K]"])
    process_temperature_k = float(row["Process temperature [K]"])
    rpm = safe_float(row["Rotational speed [rpm]"])

    return {
        "record_id": record_id,
        "machine_id": machine_id_for(record_id),
        "product_id": str(row["Product ID"]),
        "product_type": str(row["Type"]),
        # No validated health score is available.
        "health": None,
        "status": "FAILURE_RECORDED" if failure == 1 else "NO_FAILURE_RECORDED",
        # Air temperature in Celsius and Kelvin.
        "temperature": round(air_temperature_k - 273.15, 2),
        "temperature_k": round(air_temperature_k, 2),
        # Process temperature in Celsius and Kelvin.
        "process_temperature": round(process_temperature_k - 273.15, 2),
        "process_temperature_k": round(process_temperature_k, 2),
        # Not available in the AI4I dataset.
        "vibration": None,
        "pressure": None,
        "speed": rpm,
        "rpm": rpm,
        "torque": safe_float(row["Torque [Nm]"]),
        "tool_wear": safe_float(row["Tool wear [min]"]),
        # Historical target, not a model prediction.
        "failure": failure,
    }


def machine_records(df, offset: int, limit: int) -> list[dict]:
    """
    Build machine records for one page.

    ``DataFrame.to_dict`` converts the whole slice at once; iterating with
    ``iterrows`` was roughly three times slower for the same data.
    """
    page = df.iloc[offset:offset + limit]

    return [machine_record(row) for row in page.to_dict(orient="records")]


def filter_machines(
    df,
    query: str | None = None,
    product_type: str | None = None,
    failure: int | None = None,
):
    """Server-side filtering so the browser never needs the whole dataset."""
    mask = pd.Series(True, index=df.index)

    if query and query.strip():
        pattern = re.escape(query.strip())
        # Match the "UDI-00001" form shown in the UI as well as raw numbers.
        padded_ids = df["UDI"].astype(int).map(machine_id_for)
        mask &= (
            padded_ids.str.contains(pattern, case=False, na=False)
            | df["Product ID"].astype(str).str.contains(pattern, case=False, na=False)
            | df["Type"].astype(str).str.contains(pattern, case=False, na=False)
        )

    if product_type and product_type.strip():
        mask &= df["Type"].astype(str).str.upper() == product_type.strip().upper()

    if failure is not None:
        mask &= df["Machine failure"].astype(int) == int(failure)

    return df[mask]


def find_machine(machine_id: str | int | None) -> dict | None:
    """Look up one machine record by id. Returns None when unknown."""
    record_id = parse_machine_id(machine_id)

    if record_id is None:
        return None

    frame = get_dataset()

    match = frame[frame["UDI"] == record_id]

    if match.empty:
        return None

    return machine_record(match.iloc[0].to_dict())


def machine_exists(machine_id: str | int | None) -> bool:
    record_id = parse_machine_id(machine_id)

    if record_id is None:
        return False

    frame = get_dataset()

    return bool((frame["UDI"] == record_id).any())


def total_machines() -> int:
    return len(get_dataset())


def historical_failure_count() -> int:
    frame = get_dataset()

    return int((frame["Machine failure"] == 1).sum())
