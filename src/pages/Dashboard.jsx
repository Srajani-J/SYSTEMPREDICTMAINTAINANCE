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


 

 const MACHINE_API = "http://127.0.0.1:8000";
const PPE_API = "http://127.0.0.1:8001";
const PAGE_SIZE = 1000;

const EMPTY_INPUTS = {
  air_temperature: "",
  process_temperature: "",
  rotational_speed: "",
  torque: "",
  tool_wear: "",
};

const INITIAL_PPE_STATUS = {
  worker: false,
  helmet: "UNKNOWN",
  gloves: "UNKNOWN",
  mask: "UNKNOWN",
  vest: "UNKNOWN",
  goggles: "UNKNOWN",
  boots: "UNKNOWN",
  violations: [],
  message: "Waiting for detection",
};

function Dashboard() {
  // ------------------------------------------
  // MACHINE AND PREDICTIVE MAINTENANCE STATE
  // ------------------------------------------

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

  const [notificationRefreshKey, setNotificationRefreshKey] =
    useState(0);

  // ------------------------------------------
  // PPE MONITORING STATE
  // ------------------------------------------

  const [ppeStatus, setPpeStatus] = useState(INITIAL_PPE_STATUS);
  const [ppeError, setPpeError] = useState("");

  // ------------------------------------------
  // FETCH MACHINE DATA
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
        `${MACHINE_API}/api/health?limit=${PAGE_SIZE}&offset=0`
      );

      if (!firstResponse.ok) {
        throw new Error(`Backend error: ${firstResponse.status}`);
      }

      const firstPage = await firstResponse.json();

      if (!Array.isArray(firstPage.machines)) {
        throw new Error("Invalid operating profile response");
      }

      const total = Number(firstPage.total_count) || 0;
      const pageCount = Math.ceil(total / PAGE_SIZE);

      const remainingPages = await Promise.all(
        Array.from(
          { length: Math.max(0, pageCount - 1) },
          async (_, index) => {
            const offset = (index + 1) * PAGE_SIZE;

            const response = await fetch(
              `${MACHINE_API}/api/health?limit=${PAGE_SIZE}&offset=${offset}`
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

  // ------------------------------------------
  // FETCH PPE STATUS
  // ------------------------------------------

  useEffect(() => {
    let active = true;

    async function fetchPPEStatus() {
      try {
        const response = await fetch(
          `${PPE_API}/api/ppe-status`
        );

        if (!response.ok) {
          throw new Error(`PPE backend error: ${response.status}`);
        }

        const data = await response.json();

        if (active) {
          setPpeStatus({
            ...INITIAL_PPE_STATUS,
            ...data,
            violations: Array.isArray(data.violations)
              ? data.violations
              : [],
          });
          setPpeError("");
        }
      } catch (err) {
        if (active) {
          setPpeError(err.message || "Unable to connect to PPE backend");
        }
        console.error("PPE connection error:", err);
      }
    }

    fetchPPEStatus();

    const timer = setInterval(fetchPPEStatus, 1000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  // ------------------------------------------
  // INITIAL MACHINE DATA
  // ------------------------------------------

  useEffect(() => {
    fetchMachineData();
  }, []);

  // ------------------------------------------
  // SELECTED MACHINE
  // ------------------------------------------

  const selectedMachine = useMemo(
    () =>
      machines.find(
        (item) => item.machine_id === selectedMachineId
      ) ?? machines[0] ?? null,
    [machines, selectedMachineId]
  );

  // ------------------------------------------
  // SET PREDICTION INPUT DEFAULTS
  // ------------------------------------------

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
  // PREDICTION INPUT HANDLER
  // ------------------------------------------

  function handlePredictionInput(event) {
    const { name, value } = event.target;

    setPredictionInputs((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  // ------------------------------------------
  // RANDOM FOREST PREDICTION
  // ------------------------------------------

  async function handlePrediction(event) {
    event.preventDefault();

    setPrediction(null);
    setPredictionError("");

    const hasEmptyInput = Object.values(
      predictionInputs
    ).some((value) => value.trim() === "");

    const numericInputs = Object.fromEntries(
      Object.entries(predictionInputs).map(([key, value]) => [
        key,
        Number(value),
      ])
    );

    const hasInvalidInput = Object.values(
      numericInputs
    ).some((value) => !Number.isFinite(value));

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
      const response = await fetch(`${MACHINE_API}/api/predict`, {
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
  // LOADING SCREEN
  // ------------------------------------------

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-section">
          <h1>SmartPredict</h1>
          <p>Loading predictive maintenance data...</p>
        </div>
      </div>
    );
  }

  // ------------------------------------------
  // MACHINE STATUS
  // ------------------------------------------

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
          <p>
            Industrial Intelligence & Predictive Maintenance
          </p>

          <p>
            <strong>System Status:</strong>{" "}
            <span className="status healthy">CONNECTED</span>
          </p>

          <p>
            <strong>AI Engine:</strong>{" "}
            <span className="status healthy">READY</span>
          </p>

          <p>
            <strong>Last Sync:</strong> {lastUpdated || "--"}
          </p>

          {error && (
            <p role="status">
              <strong>Connection warning:</strong> {error}
            </p>
          )}
        </div>

        {machines.length > 0 && (
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
        )}
      </header>

      {/* =====================================
          PPE LIVE MONITORING
      ===================================== */}

      <section className="dashboard-section">
        <h2>Live PPE Safety Monitoring</h2>

        <p>
          Real-time worker and personal protective equipment
          detection using the trained AI model.
        </p>

        {ppeError && (
          <div className="alert-box critical" role="alert">
            <h3>PPE Connection Warning</h3>
            <p>{ppeError}</p>
          </div>
        )}

        <div className="machine-view">
          <img
            src={`${PPE_API}/video`}
            alt="Live PPE detection camera"
            style={{
              width: "100%",
              maxWidth: "900px",
              borderRadius: "12px",
              display: "block",
              margin: "auto",
              minHeight: "250px",
              objectFit: "contain",
              background: "#111827",
            }}
          />
        </div>

        <h3>Worker Safety Status</h3>

        <div className="dashboard-cards">
          <div className="dashboard-card">
            <h3>Worker Detection</h3>

            <div className="dashboard-value">
              {ppeStatus.worker ? "DETECTED" : "NOT DETECTED"}
            </div>

            <span
              className={`status ${
                ppeStatus.worker ? "healthy" : "critical"
              }`}
            >
              {ppeStatus.worker ? "WORKER FOUND" : "NO WORKER FOUND"}
            </span>
          </div>

          {[
            ["Helmet", ppeStatus.helmet],
            ["Gloves", ppeStatus.gloves],
            ["Mask", ppeStatus.mask],
            ["Safety Vest", ppeStatus.vest],
            ["Safety Glasses", ppeStatus.goggles],
            ["Safety Shoes", ppeStatus.boots],
          ].map(([name, value]) => (
            <div className="dashboard-card" key={name}>
              <h3>{name}</h3>

              <div className="dashboard-value">
                {value || "UNKNOWN"}
              </div>

              <span
                className={`status ${
                  value === "DETECTED"
                    ? "healthy"
                    : value === "NOT DETECTED"
                      ? "critical"
                      : ""
                }`}
              >
                {value || "UNKNOWN"}
              </span>
            </div>
          ))}
        </div>

        <h3>Safety Violations</h3>

        <div className="alert-box">
          {ppeStatus.violations?.length > 0 ? (
            ppeStatus.violations.map((item, index) => (
              <p key={index}>⚠ {item}</p>
            ))
          ) : (
            <p>
              No violations reported by the current detection model.
            </p>
          )}
        </div>

        <p>
          <strong>Detection Message:</strong>{" "}
          {ppeStatus.message || "Waiting for detection"}
        </p>
      </section>

      {/* =====================================
          NOTIFICATIONS
      ===================================== */}

      <NotificationPanel
        refreshKey={notificationRefreshKey}
      />

      {/* =====================================
          PREDICTIVE MAINTENANCE
      ===================================== */}

      {selectedMachine ? (
        <>
          {/* MACHINE OVERVIEW */}

          <section className="dashboard-section">
            <h2>Predictive Maintenance Overview</h2>

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
                  {selectedMachine.product_id ?? "--"}
                </div>

                <span className="status healthy">
                  TYPE {selectedMachine.product_type ?? "--"}
                </span>
              </div>

              <div className="dashboard-card">
                <h3>AI Prediction Engine</h3>

                <div className="dashboard-value">READY</div>

                <span className="status healthy">
                  RANDOM FOREST
                </span>
              </div>
            </div>
          </section>

          {/* OPERATING PARAMETERS */}

          <section className="dashboard-section">
            <h2>Operating Parameter Monitoring</h2>

            <p>
              Historical dataset readings for{" "}
              {selectedMachine.machine_id}.
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
                  {selectedMachine.rpm ??
                    selectedMachine.speed ??
                    "--"}
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

          {/* SPEED CHART */}

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

          {/* AI PREDICTION FORM */}

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
              <div
                className="alert-box critical"
                role="alert"
              >
                <h3>Prediction Error</h3>
                <p>{predictionError}</p>
              </div>
            )}

            {prediction && (
              <div
                className={`alert-box ${
                  Number(prediction.prediction) === 1
                    ? "critical"
                    : "healthy"
                }`}
              >
                <h3>AI Analysis Result</h3>

                <div className="dashboard-value">
                  {Number(prediction.prediction) === 1
                    ? "FAILURE PREDICTED"
                    : "NO FAILURE PREDICTED"}
                </div>

                {prediction.probability !== undefined && (
                  <p>
                    Failure Probability:{" "}
                    {typeof prediction.probability === "number"
                      ? `${(prediction.probability * 100).toFixed(2)}%`
                      : String(prediction.probability)}
                  </p>
                )}

                {prediction.message && (
                  <p>{prediction.message}</p>
                )}

                {prediction.shap_explanation && (
                  <div>
                    <h3>SHAP Explanation</h3>

                    <pre
                      style={{
                        whiteSpace: "pre-wrap",
                        overflowX: "auto",
                      }}
                    >
                      {typeof prediction.shap_explanation === "string"
                        ? prediction.shap_explanation
                        : JSON.stringify(
                            prediction.shap_explanation,
                            null,
                            2
                          )}
                    </pre>
                  </div>
                )}

                <details>
                  <summary>
                    View complete prediction response
                  </summary>

                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      overflowX: "auto",
                    }}
                  >
                    {JSON.stringify(prediction, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="dashboard-section">
          <h2>Predictive Maintenance</h2>

          <p>
            No machine operating profiles are available. Check
            the backend connection and dataset API.
          </p>

          {error && <p>{error}</p>}

          <button onClick={() => fetchMachineData()}>
            Retry Loading Machine Data
          </button>
        </section>
      )}
    </div>
  );
}

export default Dashboard;
          

