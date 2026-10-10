from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from pathlib import Path

app = FastAPI(
    title="SmartPredict API",
    version="1.0.0"
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

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = BASE_DIR / "sample_machine_data.csv"


def load_dataset():
    if not DATA_FILE.exists():
        raise FileNotFoundError(
            f"Dataset not found: {DATA_FILE}"
        )

    return pd.read_csv(DATA_FILE)


def calculate_health(row):

    health = 100.0

    temperature = float(row["temperature"])
    vibration = float(row["vibration"])
    pressure = float(row["pressure"])
    speed = float(row["speed"])
    torque = float(row["torque"])
    tool_wear = float(row["tool_wear"])
    failure = int(row["failure"])

    if temperature > 90:
        health -= 25
    elif temperature > 80:
        health -= 15
    elif temperature > 75:
        health -= 5

    if vibration > 7:
        health -= 25
    elif vibration > 5:
        health -= 15
    elif vibration > 4:
        health -= 5

    if pressure > 115:
        health -= 15
    elif pressure > 110:
        health -= 10
    elif pressure > 105:
        health -= 5

    if speed < 1400:
        health -= 10
    elif speed < 1450:
        health -= 5

    if torque > 60:
        health -= 10
    elif torque > 55:
        health -= 5

    if tool_wear > 85:
        health -= 15
    elif tool_wear > 70:
        health -= 10
    elif tool_wear > 60:
        health -= 5

    if failure == 1:
        health -= 30

    health = max(0, min(100, health))

    if health >= 70:
        status = "HEALTHY"
    elif health >= 40:
        status = "WARNING"
    else:
        status = "CRITICAL"

    return round(health, 1), status


@app.get("/")
def root():

    return {
        "message": "SmartPredict API is running",
        "version": "1.0.0"
    }


@app.get("/api/status")
def api_status():

    return {
        "status": "online",
        "project": "SmartPredict",
        "version": "1.0.0",
        "message": "SmartPredict API is working successfully"
    }


@app.get("/api/sensors")
def get_sensors():

    df = load_dataset()

    records = df.to_dict(orient="records")

    return {
        "count": len(records),
        "data": records
    }


@app.get("/api/health")
def get_machine_health():

    df = load_dataset()

    machines = []

    for _, row in df.iterrows():

        health, status = calculate_health(row)

        machine = {
            "machine_id": str(row["machine_id"]),
            "health": health,
            "status": status,

            "temperature": round(
                float(row["temperature"]), 2
            ),

            "vibration": round(
                float(row["vibration"]), 2
            ),

            "pressure": round(
                float(row["pressure"]), 2
            ),

            "speed": round(
                float(row["speed"]), 2
            ),

            "rpm": round(
                float(row["speed"]), 2
            ),

            "torque": round(
                float(row["torque"]), 2
            ),

            "tool_wear": round(
                float(row["tool_wear"]), 2
            ),

            "failure": int(row["failure"])
        }

        machines.append(machine)

    return {
        "count": len(machines),
        "machines": machines
    }