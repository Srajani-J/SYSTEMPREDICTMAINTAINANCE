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

## Running the full application (API + dashboard)

The research section above describes stage one. The working application is a
FastAPI backend plus a React dashboard, and every data endpoint requires a
signed-in user.

### 1. Configure secrets

```bash
cp .env.example .env
```

Set at least these values in `.env`:

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET_KEY` | Signs access tokens (32+ characters). |
| `CSRF_SECRET_KEY` | Must differ from `JWT_SECRET_KEY` (32+ characters). |
| `INITIAL_ADMIN_PASSWORD` | Password for the first Admin account (12+ characters with upper case, lower case, a digit and a symbol). |
| `INITIAL_ADMIN_EMAIL` | Email for that Admin (default `admin@smartpredict.io`). |

In development, missing secrets are replaced by ephemeral random values, so
sessions end whenever the server restarts. In production the API refuses to
start without strong secrets.

### 2. Start the API

```bash
python -m uvicorn backend.main:app --reload
```

On first start the API creates or migrates the SQLite schema and, when no user
exists yet, the Admin account from `INITIAL_ADMIN_PASSWORD`. The bootstrap only
runs for an empty users table; afterwards create privileged accounts with:

```bash
python -m backend.create_admin --email admin@example.com --name "Asha Rao"
```

### 3. Start the dashboard

```bash
npm install
npm run dev
```

Open http://localhost:5173 and sign in. Registration creates `Operator`
accounts; assigning a notification to a technician requires the `Admin` or
`Maintenance` role. Administrators manage roles and account status from the
**Account Management** panel on the Profile page.

The dashboard loads operating profiles one page at a time from
`GET /api/machines` (with server-side search), so it never downloads the whole
dataset.

### Authentication model

* Passwords are bcrypt hashes; sessions are JWTs carrying a `jti` and a token
  version.
* Every dataset, prediction and notification endpoint requires a bearer token.
* Signing out revokes the token server-side; changing a password invalidates
  every other session; deactivating an account blocks new requests.
* Login and registration are rate limited, and prediction inputs are bounded to
  physically plausible sensor ranges.
* The browser keeps the access token in `sessionStorage` (cleared when the tab
  closes). A production deployment should add an httpOnly refresh cookie.
