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

  async function fetchMachineData() {
    try {
      setError("");

      const response = await fetch(`${API_URL}/api/health`);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();

      if (!data.machines || !Array.isArray(data.machines)) {
        throw new Error("Invalid machine data received from API");
      }

      setMachines(data.machines);

      if (data.machines.length > 0) {
        setSelectedMachineId((current) => {
          if (
            current &&
            data.machines.some(
              (machine) => machine.machine_id === current
            )
          ) {
            return current;
          }

          return data.machines[0].machine_id;
        });
      }

      setLastUpdated(new Date().toLocaleTimeString());
      setLoading(false);
    } catch (err) {
      console.error("SmartPredict API Error:", err);
      setError(err.message);
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMachineData();

    const interval = setInterval(() => {
      fetchMachineData();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="dashboard-page">
        <h1>SmartPredict Dashboard</h1>
        <p>Loading machine data from SmartPredict API...</p>
      </div>
    );
  }

  if (error) {
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

          <p>
            Make sure the FastAPI backend is running on:
          </p>

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

  const selectedMachine =
    machines.find(
      (machine) => machine.machine_id === selectedMachineId
    ) || machines[0];

  const getStatusClass = (status) => {
    if (status === "HEALTHY") return "healthy";
    if (status === "WARNING") return "warning";
    return "critical";
  };

  const chartMachines = machines.slice(0, 10);

  const chartData = {
    labels: chartMachines.map(
      (machine) => machine.machine_id
    ),

    datasets: [
      {
        label: "Machine Health",
        data: chartMachines.map(
          (machine) => machine.health
        ),
        tension: 0.3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,

    scales: {
      y: {
        min: 0,
        max: 100,
      },
    },
  };

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
            <strong>Last Updated:</strong>{" "}
            {lastUpdated}
          </p>
        </div>

        <div>
          <label>
            <strong>Select Machine:</strong>
          </label>

          <br />

          <select
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
        </div>
      </div>


      {/* OVERVIEW */}
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

            <span className="status healthy">
              HEALTHY
            </span>
          </div>

          <div className="dashboard-card">
            <h3>Warning / Critical</h3>

            <div className="dashboard-value">
              {warningCount + criticalCount}
            </div>

            <span className="status warning">
              NEED ATTENTION
            </span>
          </div>

        </div>
      </section>


      {/* SELECTED MACHINE */}
      {selectedMachine && (
        <section className="dashboard-section">

          <h2>
            Machine: {selectedMachine.machine_id}
          </h2>

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


      {/* SENSOR VALUES */}
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
                {selectedMachine.rpm}
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
                {selectedMachine.failure === 1
                  ? "YES"
                  : "NO"}
              </div>
            </div>

            <div className="sensor-card">
              <h3>Status</h3>

              <div className="sensor-value">
                {selectedMachine.status}
              </div>
            </div>

          </div>
        </section>
      )}


      {/* HEALTH CHART */}
      <section className="dashboard-section">

        <h2>Machine Health Overview</h2>

        <div className="chart-container">

          <Line
            data={chartData}
            options={chartOptions}
          />

        </div>

      </section>


      {/* ALERT */}
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
              Machine{" "}
              <strong>
                {selectedMachine.machine_id}
              </strong>{" "}
              currently has a health score of{" "}
              <strong>
                {selectedMachine.health}%
              </strong>.
            </p>

          </div>

        </section>
      )}


      {/* 3D MACHINE */}
      <section className="dashboard-section">

        <h2>3D Machine Visualization</h2>

        <div className="machine-view">
          <ThreeDScene />
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
              <strong>Health:</strong>{" "}
              {selectedMachine.health}%
            </p>

            <p>
              <strong>Status:</strong>{" "}
              {selectedMachine.status}
            </p>

            <p>
              <strong>Temperature:</strong>{" "}
              {selectedMachine.temperature} °C
            </p>

            <p>
              <strong>Vibration:</strong>{" "}
              {selectedMachine.vibration}
            </p>

            <p>
              <strong>Pressure:</strong>{" "}
              {selectedMachine.pressure}
            </p>

            <p>
              <strong>RPM:</strong>{" "}
              {selectedMachine.rpm}
            </p>

          </div>

        </section>
      )}

    </div>
  );
}

export default Dashboard;