import { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import ThreeDScene from "../components/ThreeDScene";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const API_URL = "http://127.0.0.1:8000";

function Dashboard() {
  const [machines, setMachines] = useState([]);
  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  // Fetch machine data from the FastAPI backend.
  async function fetchMachineData() {
    try {
      const response = await fetch(`${API_URL}/api/health`);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data.machines)) {
        throw new Error("Invalid machine data received from API");
      }

      setMachines(data.machines);

      // Preserve the selected machine during automatic refresh.
      setSelectedMachineId((currentId) => {
        if (
          currentId &&
          data.machines.some(
            (machine) => machine.machine_id === currentId
          )
        ) {
          return currentId;
        }

        return data.machines[0]?.machine_id ?? "";
      });

      setLastUpdated(new Date().toLocaleTimeString());
      setError("");
    } catch (err) {
      console.error("SmartPredict API Error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the SmartPredict API"
      );
    } finally {
      setLoading(false);
    }
  }

  // Load data initially and refresh every 10 seconds.
  useEffect(() => {
    fetchMachineData();

    const intervalId = setInterval(() => {
      fetchMachineData();
    }, 10000);

    return () => clearInterval(intervalId);
  }, []);

  // Find the currently selected machine.
  const selectedMachine =
    machines.find(
      (machine) => machine.machine_id === selectedMachineId
    ) ?? machines[0] ?? null;

  // Determine the CSS class for a machine status.
  const getStatusClass = (status) => {
    if (status === "HEALTHY") return "healthy";
    if (status === "WARNING") return "warning";
    return "critical";
  };

  // Loading screen.
  if (loading) {
    return (
      <div className="dashboard-page">
        <h1>SmartPredict Dashboard</h1>
        <p>Loading machine data from SmartPredict API...</p>
      </div>
    );
  }

  // Connection error screen.
  if (error && machines.length === 0) {
    return (
      <div className="dashboard-page">
        <h1>SmartPredict Dashboard</h1>

        <div className="alert-box critical">
          <h3>Backend Connection Error</h3>

          <p>
            Unable to load machine data from the SmartPredict API.
          </p>

          <p>
            <strong>Error:</strong> {error}
          </p>

          <p>Make sure your FastAPI backend is running at:</p>

          <strong>http://127.0.0.1:8000</strong>

          <br />
          <br />

          <button onClick={fetchMachineData}>
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Prepare health chart data.
  const chartMachines = machines.slice(0, 10);

  const chartData = {
    labels: chartMachines.map((machine) => machine.machine_id),

    datasets: [
      {
        label: "Machine Health (%)",
        data: chartMachines.map((machine) => machine.health),
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 4,
        fill: false,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        title: {
          display: true,
          text: "Health (%)",
        },
      },
      x: {
        title: {
          display: true,
          text: "Machine ID",
        },
      },
    },
  };

  // Calculate system-wide statistics.
  const healthyCount = machines.filter(
    (machine) => machine.status === "HEALTHY"
  ).length;

  const warningCount = machines.filter(
    (machine) => machine.status === "WARNING"
  ).length;

  const criticalCount = machines.filter(
    (machine) => machine.status === "CRITICAL"
  ).length;

  return (
    <div className="dashboard-page">
      {/* HEADER */}
      <div className="dashboard-header">
        <div>
          <h1>SmartPredict Dashboard</h1>

          <p>
            Real-Time Predictive Maintenance Monitoring
          </p>

          <p>
            <strong>Backend:</strong>{" "}
            <span className="status healthy">
              Connected
            </span>
          </p>

          <p>
            <strong>API:</strong> /api/health
          </p>

          <p>
            <strong>Last Updated:</strong> {lastUpdated}
          </p>

          {error && (
            <p role="status">
              <strong>Refresh warning:</strong> {error}. Showing
              the most recently loaded data.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="machine-select">
            <strong>Select Machine:</strong>
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

          <button onClick={fetchMachineData}>
            Refresh Data
          </button>
        </div>
      </div>

      {/* SYSTEM OVERVIEW */}
      <section className="dashboard-section">
        <h2>System Overview</h2>

        <div className="dashboard-cards">
          <div className="dashboard-card">
            <h3>Total Machines</h3>
            <div className="dashboard-value">
              {machines.length}
            </div>
          </div>

          <div className="dashboard-card">
            <h3>Healthy Machines</h3>
            <div className="dashboard-value">
              {healthyCount}
            </div>
            <span className="status healthy">HEALTHY</span>
          </div>

          <div className="dashboard-card">
            <h3>Warning Machines</h3>
            <div className="dashboard-value">
              {warningCount}
            </div>
            <span className="status warning">WARNING</span>
          </div>

          <div className="dashboard-card">
            <h3>Critical Machines</h3>
            <div className="dashboard-value">
              {criticalCount}
            </div>
            <span className="status critical">CRITICAL</span>
          </div>
        </div>
      </section>

      {/* SELECTED MACHINE OVERVIEW */}
      {selectedMachine && (
        <section className="dashboard-section">
          <h2>Machine: {selectedMachine.machine_id}</h2>

          <div className="dashboard-cards">
            <div className="dashboard-card">
              <h3>Machine Health</h3>

              <div className="dashboard-value">
                {selectedMachine.health}%
              </div>

              <span
                className={`status ${getStatusClass(
                  selectedMachine.status
                )}`}
              >
                {selectedMachine.status}
              </span>
            </div>

            <div className="dashboard-card">
              <h3>Temperature</h3>

              <div className="dashboard-value">
                {selectedMachine.temperature} °C
              </div>
            </div>

            <div className="dashboard-card">
              <h3>Vibration</h3>

              <div className="dashboard-value">
                {selectedMachine.vibration} mm/s
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SENSOR MONITORING */}
      {selectedMachine && (
        <section className="dashboard-section">
          <h2>Sensor Monitoring</h2>

          <div className="sensor-grid">
            <div className="sensor-card">
              <h3>Temperature</h3>
              <div className="sensor-value">
                {selectedMachine.temperature} °C
              </div>
            </div>

            <div className="sensor-card">
              <h3>Vibration</h3>
              <div className="sensor-value">
                {selectedMachine.vibration} mm/s
              </div>
            </div>

            <div className="sensor-card">
              <h3>Pressure</h3>
              <div className="sensor-value">
                {selectedMachine.pressure}
              </div>
            </div>

            <div className="sensor-card">
              <h3>RPM</h3>
              <div className="sensor-value">
                {selectedMachine.rpm ?? selectedMachine.speed ?? "--"}
              </div>
            </div>

            <div className="sensor-card">
              <h3>Torque</h3>
              <div className="sensor-value">
                {selectedMachine.torque}
              </div>
            </div>

            <div className="sensor-card">
              <h3>Tool Wear</h3>
              <div className="sensor-value">
                {selectedMachine.tool_wear}
              </div>
            </div>

            <div className="sensor-card">
              <h3>Failure Prediction</h3>
              <div className="sensor-value">
                {selectedMachine.failure === 1 ? "YES" : "NO"}
              </div>
            </div>

            <div className="sensor-card">
              <h3>Status</h3>
              <div
                className={`status ${getStatusClass(
                  selectedMachine.status
                )}`}
              >
                {selectedMachine.status}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* MACHINE HEALTH CHART */}
      <section className="dashboard-section">
        <h2>Machine Health Overview</h2>

        <div className="chart-container">
          <Line data={chartData} options={chartOptions} />
        </div>
      </section>

      {/* MACHINE ALERT */}
      {selectedMachine && (
        <section className="dashboard-section">
          <h2>Machine Alert</h2>

          <div
            className={`alert-box ${getStatusClass(
              selectedMachine.status
            )}`}
          >
            <h3>
              {selectedMachine.status === "HEALTHY"
                ? "Machine Operating Normally"
                : selectedMachine.status === "WARNING"
                ? "Maintenance Attention Required"
                : "Critical Machine Condition"}
            </h3>

            <p>
              Machine <strong>{selectedMachine.machine_id}</strong>{" "}
              currently has a health score of{" "}
              <strong>{selectedMachine.health}%</strong>.
            </p>

            <p>
              Failure indicator:{" "}
              <strong>
                {selectedMachine.failure === 1 ? "YES" : "NO"}
              </strong>
            </p>
          </div>
        </section>
      )}

      {/* 3D MACHINE VISUALIZATION */}
      <section className="dashboard-section">
        <h2>
          3D Machine Visualization
          {selectedMachine
            ? ` — ${selectedMachine.machine_id}`
            : ""}
        </h2>

        <div className="machine-view">
          {/* Pass the selected API machine into the 3D component. */}
          <ThreeDScene machine={selectedMachine} />
        </div>
      </section>

      {/* MACHINE INFORMATION */}
      {selectedMachine && (
        <section className="dashboard-section">
          <h2>Machine Information</h2>

          <div className="machine-info">
            <p>
              <strong>Machine ID:</strong>{" "}
              {selectedMachine.machine_id}
            </p>

            <p>
              <strong>Health:</strong> {selectedMachine.health}%
            </p>

            <p>
              <strong>Status:</strong> {selectedMachine.status}
            </p>

            <p>
              <strong>Temperature:</strong>{" "}
              {selectedMachine.temperature} °C
            </p>

            <p>
              <strong>Vibration:</strong>{" "}
              {selectedMachine.vibration} mm/s
            </p>

            <p>
              <strong>Pressure:</strong>{" "}
              {selectedMachine.pressure}
            </p>

            <p>
              <strong>RPM:</strong>{" "}
              {selectedMachine.rpm ?? selectedMachine.speed ?? "--"}
            </p>

            <p>
              <strong>Torque:</strong> {selectedMachine.torque}
            </p>

            <p>
              <strong>Tool Wear:</strong>{" "}
              {selectedMachine.tool_wear}
            </p>

            <p>
              <strong>Failure:</strong>{" "}
              {selectedMachine.failure === 1 ? "YES" : "NO"}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

export default Dashboard;