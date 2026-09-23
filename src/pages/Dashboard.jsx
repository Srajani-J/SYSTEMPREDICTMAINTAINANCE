import ThreeDScene from "../components/ThreeDScene";

function Dashboard() {
  return (
    <div className="dashboard-page">

      <h1>Machine Dashboard</h1>

      <p className="dashboard-subtitle">
        Industrial machine health overview
      </p>

      {/* Machine Health Cards */}

      <div className="dashboard-cards">

        <div className="dashboard-card">
          <h3>Machine Health</h3>
          <div className="dashboard-value">98%</div>
          <span className="status healthy">
            Healthy
          </span>
        </div>

        <div className="dashboard-card">
          <h3>Temperature</h3>
          <div className="dashboard-value">72°C</div>
          <span className="status normal">
            Normal
          </span>
        </div>

        <div className="dashboard-card">
          <h3>Vibration</h3>
          <div className="dashboard-value">1.8 mm/s</div>
          <span className="status normal">
            Normal
          </span>
        </div>

        <div className="dashboard-card">
          <h3>System Status</h3>
          <div className="dashboard-value">✓</div>
          <span className="status healthy">
            Operating Normally
          </span>
        </div>

      </div>

      {/* 3D Machine */}

      <div className="dashboard-machine-section">

        <div className="dashboard-machine-info">

          <h2>3D Machine Visualization</h2>

          <p>
            Interactive industrial machine visualization
            with real-time style sensor indicators.
          </p>

          <div className="machine-status-box">
            <span className="status-dot"></span>

            <div>
              <strong>Machine Online</strong>
              <p>System operating normally</p>
            </div>
          </div>

        </div>

        <div className="dashboard-machine-view">
          <ThreeDScene />
        </div>

      </div>

      {/* Machine Information */}

      <div className="machine-summary">

        <h2>Machine Overview</h2>

        <div className="machine-info">

          <p>
            <strong>Machine ID:</strong> MCH-001
          </p>

          <p>
            <strong>Machine Type:</strong> Industrial Motor
          </p>

          <p>
            <strong>Status:</strong> Healthy
          </p>

          <p>
            <strong>Last Updated:</strong> Just Now
          </p>

        </div>

      </div>

    </div>
  );
}

export default Dashboard;