
import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import ThreeDScene from "../components/ThreeDScene";
import NotificationPanel from "../components/NotificationPanel";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const PAGE_SIZE = 1000;

const EMPTY_INPUTS = {
  air_temperature: "",
  process_temperature: "",
  rotational_speed: "",
  torque: "",
  tool_wear: "",
};

function Dashboard() {
  const [machines, setMachines] = useState([]);
  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const [predictionInputs, setPredictionInputs] =
    useState(EMPTY_INPUTS);

  const [prediction, setPrediction] = useState(null);
  const [predictionLoading, setPredictionLoading] =
    useState(false);
  const [predictionError, setPredictionError] = useState("");

  // Refresh notification panel after a new prediction.
  const [notificationRefreshKey, setNotificationRefreshKey] =
    useState(0);

  // ------------------------------------------
  // LOAD OPERATING PROFILE DATA
  // ------------------------------------------

  async function fetchMachineData(isRefresh = false) {
    try {
      setError("");

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const firstResponse = await fetch(
        `${API_URL}/api/health?limit=${PAGE_SIZE}&offset=0`
      );

      if (!firstResponse.ok) {
        throw new Error(`Backend error: ${firstResponse.status}`);
      }

      const firstPage = await firstResponse.json();

      if (!Array.isArray(firstPage.machines)) {
        throw new Error("Invalid operating profile response");
      }

      const total = firstPage.total_count;
      const pageCount = Math.ceil(total / PAGE_SIZE);

      const remainingPages = await Promise.all(
        Array.from(
          { length: Math.max(0, pageCount - 1) },
          async (_, index) => {
            const offset = (index + 1) * PAGE_SIZE;

            const response = await fetch(
              `${API_URL}/api/health?limit=${PAGE_SIZE}&offset=${offset}`
            );

            if (!response.ok) {
              throw new Error(
                "Unable to retrieve operating profile information"
              );
            }

            const data = await response.json();

            if (!Array.isArray(data.machines)) {
              throw new Error("Invalid operating profile response");
            }

            return data.machines;
          }
        )
      );

      const allMachines = [
        ...firstPage.machines,
        ...remainingPages.flat(),
      ];

      setMachines(allMachines);

      setSelectedMachineId((current) => {
        if (
          current &&
          allMachines.some((item) => item.machine_id === current)
        ) {
          return current;
        }

        return allMachines[0]?.machine_id ?? "";
      });

      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Dashboard connection error:", err);
      setError(err.message || "Unable to connect to backend");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchMachineData();
  }, []);

  // ------------------------------------------
  // SELECTED OPERATING PROFILE
  // ------------------------------------------

  const selectedMachine = useMemo(
    () =>
      machines.find(
        (item) => item.machine_id === selectedMachineId
      ) ?? machines[0] ?? null,
    [machines, selectedMachineId]
  );

  // Set prediction defaults from the selected dataset profile.
  useEffect(() => {
    if (!selectedMachine) return;

    setPredictionInputs({
      air_temperature: String(
        selectedMachine.temperature_k ?? ""
      ),
      process_temperature: String(
        selectedMachine.process_temperature_k ?? ""
      ),
      rotational_speed: String(
        selectedMachine.rpm ?? selectedMachine.speed ?? ""
      ),
      torque: String(selectedMachine.torque ?? ""),
      tool_wear: String(selectedMachine.tool_wear ?? ""),
    });

    setPrediction(null);
    setPredictionError("");
  }, [selectedMachine]);

  // ------------------------------------------
  // OPERATING SPEED CHART
  // ------------------------------------------

  const chartRecords = useMemo(
    () => machines.slice(0, 20),
    [machines]
  );

  const chartData = {
    labels: chartRecords.map((item) => item.machine_id),
    datasets: [
      {
        label: "Rotational Speed",
        data: chartRecords.map(
          (item) => item.rpm ?? item.speed ?? null
        ),
        borderColor: "#16c8ff",
        backgroundColor: "rgba(22, 200, 255, 0.12)",
        pointBackgroundColor: "#16c8ff",
        pointBorderColor: "#ffffff",
        pointRadius: 3,
        pointHoverRadius: 6,
        borderWidth: 2,
        tension: 0.38,
        fill: true,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "#d8e7f5",
        },
      },
      tooltip: {
        mode: "index",
        intersect: false,
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#91a9c0",
          maxRotation: 45,
          minRotation: 0,
        },
        grid: {
          color: "rgba(150, 190, 220, 0.08)",
        },
        title: {
          display: true,
          text: "Operating Profile",
          color: "#a9bfd2",
        },
      },
      y: {
        ticks: {
          color: "#91a9c0",
        },
        grid: {
          color: "rgba(150, 190, 220, 0.08)",
        },
        title: {
          display: true,
          text: "RPM",
          color: "#a9bfd2",
        },
      },
    },
  };

  // ------------------------------------------
  // PREDICTION INPUTS
  // ------------------------------------------

  function handlePredictionInput(event) {
    const { name, value } = event.target;

    setPredictionInputs((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  // ------------------------------------------
  // RANDOM FOREST + SHAP + NOTIFICATIONS
  // ------------------------------------------

  async function handlePrediction(event) {
    event.preventDefault();

    setPrediction(null);
    setPredictionError("");

    const numericInputs = Object.fromEntries(
      Object.entries(predictionInputs).map(([key, value]) => [
        key,
        Number(value),
      ])
    );

    const hasEmptyInput = Object.values(predictionInputs).some(
      (value) => value.trim() === ""
    );

    const hasInvalidInput = Object.values(numericInputs).some(
      (value) => !Number.isFinite(value)
    );

    if (hasEmptyInput || hasInvalidInput) {
      setPredictionError(
        "Please enter valid values for all five operating parameters."
      );
      return;
    }

    if (
      numericInputs.air_temperature <= 0 ||
      numericInputs.process_temperature <= 0 ||
      numericInputs.rotational_speed <= 0 ||
      numericInputs.torque < 0 ||
      numericInputs.tool_wear < 0
    ) {
      setPredictionError(
        "Enter positive temperatures and RPM, and non-negative torque and tool wear."
      );
      return;
    }

    setPredictionLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...numericInputs,
          profile_id: selectedMachine?.machine_id,
          product_id: selectedMachine?.product_id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Prediction failed"
        );
      }

      setPrediction(data);

      // Reload notifications after prediction.
      setNotificationRefreshKey((previous) => previous + 1);
    } catch (err) {
      console.error("Prediction error:", err);
      setPredictionError(
        err.message || "Unable to generate prediction"
      );
    } finally {
      setPredictionLoading(false);
    }
  }

  // ------------------------------------------
  // LOADING
  // ------------------------------------------

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-section">
          <h1>SmartPredict</h1>
          <p>Initializing operating profile monitoring...</p>
        </div>
      </div>
    );
  }

  // ------------------------------------------
  // CONNECTION ERROR
  // ------------------------------------------

  if (error && machines.length === 0) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-section">
          <h1>SmartPredict</h1>

          <div className="alert-box critical">
            <h3>Backend Connection Error</h3>
            <p>{error}</p>

            <button onClick={() => fetchMachineData()}>
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  const failureRecorded = selectedMachine?.failure === 1;

  const machineCondition = !selectedMachine
    ? "UNAVAILABLE"
    : failureRecorded
      ? "ATTENTION REQUIRED"
      : "NO FAILURE RECORDED";

  // ------------------------------------------
  // MAIN DASHBOARD
  // ------------------------------------------

  return (
    <div className="dashboard-page">

      {/* HEADER */}

      <header className="dashboard-header">
        <div>
          <h1>SmartPredict</h1>
          <p>Industrial Intelligence & Predictive Maintenance</p>

          <p>
            <strong>System Status:</strong>{" "}
            <span className="status healthy">CONNECTED</span>
          </p>

          <p>
            <strong>AI Engine:</strong>{" "}
            <span className="status healthy">READY</span>
          </p>

          <p>
            <strong>Last Sync:</strong>{" "}
            {lastUpdated || "--"}
          </p>

          {error && (
            <p role="status">
              <strong>Connection warning:</strong> {error}
            </p>
          )}
        </div>

        <div className="machine-selector">
          <label htmlFor="machine-select">
            <strong>Select Operating Profile</strong>
          </label>

          <br />

          <select
            id="machine-select"
            value={selectedMachineId}
            onChange={(event) =>
              setSelectedMachineId(event.target.value)
            }
          >
            {machines.map((machine) => (
              <option
                key={machine.machine_id}
                value={machine.machine_id}
              >
                {machine.machine_id}
              </option>
            ))}
          </select>

          <br />
          <br />

          <button
            onClick={() => fetchMachineData(true)}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh Monitoring"}
          </button>
        </div>
      </header>

      {/* NOTIFICATION PANEL */}

      <NotificationPanel refreshKey={notificationRefreshKey} />

      {/* DASHBOARD CONTENT */}

      {selectedMachine && (
        <>
          {/* TOP STATUS */}

          <section className="dashboard-section">
            <div className="dashboard-cards">

              <div className="dashboard-card">
                <h3>Selected Operating Profile</h3>
                <div className="dashboard-value">
                  {selectedMachine.machine_id}
                </div>
                <span className="status healthy">
                  PROFILE ACTIVE
                </span>
              </div>

              <div className="dashboard-card">
                <h3>Historical Condition</h3>
                <div className="dashboard-value">
                  {failureRecorded ? "ATTENTION" : "NORMAL"}
                </div>
                <span
                  className={`status ${
                    failureRecorded ? "critical" : "healthy"
                  }`}
                >
                  {machineCondition}
                </span>
              </div>

              <div className="dashboard-card">
                <h3>Product ID</h3>
                <div className="dashboard-value">
                  {selectedMachine.product_id}
                </div>
                <span className="status healthy">
                  TYPE {selectedMachine.product_type}
                </span>
              </div>

              <div className="dashboard-card">
                <h3>AI Prediction Engine</h3>
                <div className="dashboard-value">
                  READY
                </div>
                <span className="status healthy">
                  RANDOM FOREST
                </span>
              </div>

            </div>
          </section>

          {/* SENSOR MONITORING */}

          <section className="dashboard-section">
            <h2>Operating Parameter Monitoring</h2>

            <p>
              Historical dataset readings for{" "}
              {selectedMachine.machine_id}
            </p>

            <div className="sensor-grid">

              <div className="sensor-card">
                <h3>Air Temperature</h3>
                <div className="sensor-value">
                  {selectedMachine.temperature ?? "--"} °C
                </div>
                <p>
                  {selectedMachine.temperature_k ?? "--"} K
                </p>
              </div>

              <div className="sensor-card">
                <h3>Process Temperature</h3>
                <div className="sensor-value">
                  {selectedMachine.process_temperature ?? "--"} °C
                </div>
                <p>
                  {selectedMachine.process_temperature_k ?? "--"} K
                </p>
              </div>

              <div className="sensor-card">
                <h3>Rotational Speed</h3>
                <div className="sensor-value">
                  {selectedMachine.rpm ?? selectedMachine.speed ?? "--"}
                </div>
                <p>RPM</p>
              </div>

              <div className="sensor-card">
                <h3>Torque</h3>
                <div className="sensor-value">
                  {selectedMachine.torque ?? "--"}
                </div>
                <p>Nm</p>
              </div>

              <div className="sensor-card">
                <h3>Tool Wear</h3>
                <div className="sensor-value">
                  {selectedMachine.tool_wear ?? "--"}
                </div>
                <p>Minutes</p>
              </div>

            </div>
          </section>

          {/* 3D MACHINE */}

          <section className="dashboard-section">
            <h2>3D Industrial Machine Visualization</h2>
            <p>
              Interactive machine model —{" "}
              {selectedMachine.machine_id}
            </p>

            <div className="machine-view">
              <ThreeDScene machine={selectedMachine} />
            </div>
          </section>

          {/* TREND CHART */}

          <section className="dashboard-section">
            <h2>Operating Speed Analysis</h2>

            <p>
              Rotational speed across the first 20 historical
              operating records.
            </p>

            <div className="chart-container">
              <Line data={chartData} options={chartOptions} />
            </div>
          </section>

          {/* AI PREDICTION */}

          <section className="dashboard-section">
            <h2>AI Predictive Analysis</h2>

            <p>
              Analyze operating parameters using the Random Forest
              model and SHAP explainability.
            </p>

            <form
              onSubmit={handlePrediction}
              className="prediction-form"
            >
              <div className="sensor-grid">

                <div className="sensor-card">
                  <label htmlFor="air-temperature">
                    Air Temperature (K)
                  </label>
                  <input
                    id="air-temperature"
                    type="number"
                    step="any"
                    name="air_temperature"
                    value={predictionInputs.air_temperature}
                    onChange={handlePredictionInput}
                    required
                  />
                </div>

                <div className="sensor-card">
                  <label htmlFor="process-temperature">
                    Process Temperature (K)
                  </label>
                  <input
                    id="process-temperature"
                    type="number"
                    step="any"
                    name="process_temperature"
                    value={predictionInputs.process_temperature}
                    onChange={handlePredictionInput}
                    required
                  />
                </div>

                <div className="sensor-card">
                  <label htmlFor="rotational-speed">
                    Rotational Speed (RPM)
                  </label>
                  <input
                    id="rotational-speed"
                    type="number"
                    step="any"
                    name="rotational_speed"
                    value={predictionInputs.rotational_speed}
                    onChange={handlePredictionInput}
                    required
                  />
                </div>

                <div className="sensor-card">
                  <label htmlFor="torque">
                    Torque (Nm)
                  </label>
                  <input
                    id="torque"
                    type="number"
                    step="any"
                    name="torque"
                    value={predictionInputs.torque}
                    onChange={handlePredictionInput}
                    required
                  />
                </div>

                <div className="sensor-card">
                  <label htmlFor="tool-wear">
                    Tool Wear (Minutes)
                  </label>
                  <input
                    id="tool-wear"
                    type="number"
                    step="any"
                    name="tool_wear"
                    value={predictionInputs.tool_wear}
                    onChange={handlePredictionInput}
                    required
                  />
                </div>

              </div>

              <br />

              <button
                type="submit"
                disabled={predictionLoading}
              >
                {predictionLoading
                  ? "Analyzing Operating Profile..."
                  : "Analyze Operating Profile"}
              </button>
            </form>

            {predictionError && (
              <div className="alert-box critical" role="alert">
                <h3>Prediction Error</h3>
                <p>{predictionError}</p>
              </div>
            )}

            {prediction && (
              <div
                className={`alert-box ${
                  prediction.prediction === 1
                    ? "critical"
                    : "healthy"
                }`}
              >
                <h3>AI Analysis Result</h3>

                <div className="dashboard-cards">

                  <div className="dashboard-card">
                    <h3>Predicted Condition</h3>
                    <div className="dashboard-value">
                      {prediction.prediction === 1
                        ? "FAILURE RISK"
                        : "NORMAL"}
                    </div>
                    <span
                      className={`status ${
                        prediction.prediction === 1
                          ? "critical"
                          : "healthy"
                      }`}
                    >
                      {prediction.status}
                    </span>
                  </div>

                  <div className="dashboard-card">
                    <h3>Failure Probability</h3>
                    <div className="dashboard-value">
                      {(
                        Number(prediction.failure_probability) * 100
                      ).toFixed(2)}%
                    </div>
                  </div>

                  <div className="dashboard-card">
                    <h3>AI Model</h3>
                    <div className="dashboard-value">
                      Random Forest
                    </div>
                  </div>

                </div>

                <h3>SHAP Explainability</h3>
                <p>
                  Factors contributing to this model prediction:
                </p>

                {Array.isArray(prediction.explanations) &&
                  prediction.explanations.map((item) => (
                    <div
                      className="sensor-card"
                      key={item.sensor}
                      style={{ marginBottom: "10px" }}
                    >
                      <strong>{item.sensor}</strong>
                      <p>
                        SHAP Value: {item.shap_value}
                      </p>
                      <p>
                        Contribution: {item.direction}
                      </p>
                    </div>
                  ))}

                <p>
                  <strong>Model note:</strong> {prediction.note}
                </p>

                {prediction.notification && (
                  <p>
                    <strong>Maintenance alert:</strong>{" "}
                    Notification #{prediction.notification.id} was created.
                    View it in the Maintenance Notifications section above.
                  </p>
                )}
              </div>
            )}
          </section>

          {/* CONDITION SUMMARY */}

          <section className="dashboard-section">
            <h2>Operating Profile Summary</h2>

            <div
              className={`alert-box ${
                failureRecorded ? "critical" : "healthy"
              }`}
            >
              <h3>
                {failureRecorded
                  ? "Historical Failure Recorded"
                  : "No Historical Failure Recorded"}
              </h3>

              <p>
                <strong>Operating profile:</strong>{" "}
                {selectedMachine.machine_id}
              </p>

              <p>
                <strong>Product:</strong>{" "}
                {selectedMachine.product_id}
              </p>

              <p>
                <strong>Historical dataset label:</strong>{" "}
                {machineCondition}
              </p>

              <p>
                <strong>AI prediction:</strong>{" "}
                {prediction
                  ? prediction.prediction === 1
                    ? "Failure risk predicted"
                    : "No failure predicted"
                  : "Run AI analysis to evaluate this profile"}
              </p>

              <p>
                The historical condition reflects the dataset's
                recorded failure label. The AI prediction is a
                separate model result calculated from the five
                operating parameters.
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default Dashboard;
