import React, { useEffect, useState } from "react";

const API = "http://127.0.0.1:8000";

function Dashboard() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`${API}/api/ppe-status`);
        if (!response.ok) throw new Error("API connection failed");

        const data = await response.json();
        setStatus(data);
        setError("");
      } catch (err) {
        setError(err.message);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 1000);

    return () => clearInterval(interval);
  }, []);

  const items = ["helmet", "gloves", "mask", "vest", "goggles", "boots"];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0f172a",
      color: "white",
      padding: "30px",
      fontFamily: "Arial"
    }}>
      <h1>SmartPredict PPE Monitoring</h1>
      <p>AI-Based Workplace Safety Monitoring System</p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 2fr) minmax(250px, 1fr)",
        gap: "20px",
        marginTop: "25px"
      }}>
        <section style={{
          background: "#1e293b",
          padding: "20px",
          borderRadius: "12px"
        }}>
          <h2>Live Camera Monitoring</h2>
          <img
            src={`${API}/video`}
            alt="Live PPE Detection"
            style={{ width: "100%", borderRadius: "10px" }}
          />
          <p style={{ color: "#22c55e" }}>● Live Camera Feed</p>
        </section>

        <section style={{
          background: "#1e293b",
          padding: "20px",
          borderRadius: "12px"
        }}>
          <h2>PPE Status</h2>

          {error && <p style={{ color: "#f87171" }}>{error}</p>}

          {!status && !error && <p>Loading status...</p>}

          {status && (
            <>
              <p>Worker detected: {status.worker ? "Yes" : "No"}</p>

              {items.map((item) => (
                <div key={item} style={{
                  padding: "12px",
                  marginTop: "8px",
                  background: "#334155",
                  borderRadius: "8px"
                }}>
                  {item.toUpperCase()}: {status[item] || "UNKNOWN"}
                </div>
              ))}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default Dashboard;