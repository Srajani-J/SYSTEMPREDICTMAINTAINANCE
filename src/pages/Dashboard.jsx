
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
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
const ThreeDScene = lazy(() => import("../components/ThreeDScene"));
import NotificationPanel from "../components/NotificationPanel";
import SceneErrorBoundary from "../components/SceneErrorBoundary";
import { ApiError, apiRequest } from "../api/client";
import { useAuth } from "../auth/AuthContext";

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

const MACHINE_PAGE_SIZE = 50;

const EMPTY_INPUTS = {
  air_temperature: "",
  process_temperature: "",
  rotational_speed: "",
  torque: "",
  tool_wear: "",
};

function Dashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [machines, setMachines] = useState([]);
  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
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

  const fetchMachineData = useCallback(
    async ({ pageOffset = 0, search = "", isRefresh = false } = {}) => {
      try {
        setError("");

        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const params = new URLSearchParams({
          limit: String(MACHINE_PAGE_SIZE),
          offset: String(pageOffset),
        });

        if (search) {
          params.set("q", search);
        }

        const data = await apiRequest(`/api/machines?${params.toString()}`);

        if (!Array.isArray(data.machines)) {
          throw new Error("Invalid operating profile response");
        }

        setMachines(data.machines);
        setTotalCount(data.total_count ?? data.machines.length);

        setSelectedMachineId((current) => {
          if (
            current &&
            data.machines.some((item) => item.machine_id === current)
          ) {
            return current;
          }

          return data.machines[0]?.machine_id ?? "";
        });

        setLastUpdated(new Date().toLocaleTimeString());
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          await logout();
          navigate("/login", { replace: true });
          return;
        }

        console.error("Dashboard connection error:", err);
        setError(err.message || "Unable to connect to backend");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [logout, navigate]
  );

  // Debounce the search box so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOffset(0);
      setAppliedQuery(query.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [query]);

  // One page at a time: the browser never downloads the whole dataset.
  useEffect(() => {
    fetchMachineData({ pageOffset: offset, search: appliedQuery });
  }, [fetchMachineData, offset, appliedQuery]);

  const pageEnd = Math.min(offset + MACHINE_PAGE_SIZE, totalCount);
  const canGoPrevious = offset > 0;
  const canGoNext = offset + MACHINE_PAGE_SIZE < totalCount;

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
      const data = await apiRequest("/api/predict", {
        method: "POST",
        body: {
          ...numericInputs,
          profile_id: selectedMachine?.machine_id,
          product_id: selectedMachine?.product_id,
        },
      });

      setPrediction(data);

      // Reload notifications after prediction.
      setNotificationRefreshKey((previous) => previous + 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await logout();
        navigate("/login", { replace: true });
        return;
      }

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

  if (loading && machines.length === 0) {
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

            <button
              onClick={() =>
                fetchMachineData({ pageOffset: offset, search: appliedQuery })
              }
            >
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
          <label htmlFor="machine-search">
            <strong>Find operating profile</strong>
          </label>

          <br />

          <input
            id="machine-search"
            type="search"
            placeholder="Search UDI, product ID or type"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={{
              padding: "9px 10px",
              borderRadius: "7px",
              minWidth: "240px",
            }}
          />

          <br />
          <br />

          <label htmlFor="machine-select">
            <strong>Select operating profile</strong>
          </label>

          <br />

          <select
            id="machine-select"
            value={selectedMachineId}
            onChange={(event) => setSelectedMachineId(event.target.value)}
            disabled={machines.length === 0}
          >
            {machines.map((machine) => (
              <option key={machine.machine_id} value={machine.machine_id}>
                {machine.machine_id} · {machine.product_id}
                {machine.failure === 1 ? " · failure recorded" : ""}
              </option>
            ))}
          </select>

          <div
            style={{
              display: "flex",
              gap: "8px",
              marginTop: "10px",
            }}
          >
            <button
              type="button"
              onClick={() =>
                setOffset(Math.max(0, offset - MACHINE_PAGE_SIZE))
              }
              disabled={!canGoPrevious || refreshing}
            >
              Previous
            </button>

            <button
              type="button"
              onClick={() => setOffset(offset + MACHINE_PAGE_SIZE)}
              disabled={!canGoNext || refreshing}
            >
              Next
            </button>
          </div>

          <p style={{ marginTop: "8px", opacity: 0.75, fontSize: "13px" }}>
            Showing {totalCount === 0 ? 0 : offset + 1}-{pageEnd} of{" "}
            {totalCount}
            {appliedQuery ? ` matching "${appliedQuery}"` : ""}
          </p>

          <button
            type="button"
            onClick={() =>
              fetchMachineData({
                pageOffset: offset,
                search: appliedQuery,
                isRefresh: true,
              })
            }
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
              <SceneErrorBoundary>
                <Suspense fallback={<p>Loading 3D machine model...</p>}>
                  <ThreeDScene machine={selectedMachine} />
                </Suspense>
              </SceneErrorBoundary>
            </div>
          </section>

          {/* TREND CHART */}

          <section className="dashboard-section">
            <h2>Operating Speed Analysis</h2>

            <p>
              Rotational speed across the first 20 records on this
              page.
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
