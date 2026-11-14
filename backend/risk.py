"""
Risk classification shared by every dashboard and the API.

The bands line up with the notification rules that already existed: an alert is
raised from 0.50 and is CRITICAL from 0.80, so "high" and "critical" here mean
exactly what the notification severity already meant.

    low       probability < 0.30
    medium    0.30 <= probability < 0.50
    high      0.50 <= probability < 0.80   (WARNING alerts)
    critical  probability >= 0.80          (CRITICAL alerts)
"""

RISK_LEVELS = ("low", "medium", "high", "critical")

RISK_BANDS = (
    {"level": "low", "minimum": 0.0, "label": "Low"},
    {"level": "medium", "minimum": 0.30, "label": "Medium"},
    {"level": "high", "minimum": 0.50, "label": "High"},
    {"level": "critical", "minimum": 0.80, "label": "Critical"},
)

RISK_LABELS = {
    "low": "Low",
    "medium": "Medium",
    "high": "High",
    "critical": "Critical",
}


def risk_level(probability: float) -> str:
    """Map a failure probability to a risk band."""
    try:
        value = float(probability)
    except (TypeError, ValueError):
        value = 0.0

    if value < 0.30:
        return "low"

    if value < 0.50:
        return "medium"

    if value < 0.80:
        return "high"

    return "critical"
