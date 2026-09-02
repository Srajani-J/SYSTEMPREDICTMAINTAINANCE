import ThreeDScene from "../components/ThreeDScene";

function Home() {
  const scrollToPlatform = () => {
    document
      .getElementById("platform")
      ?.scrollIntoView({
        behavior: "smooth",
      });
  };

  return (
    <div className="home">

      {/* ==========================================
          NAVBAR
      ========================================== */}

      <nav className="navbar">

        <div className="logo">
          SYSTEM<span>SMART</span>PREDICT
        </div>

        <div className="nav-links">
          <a href="#home">Home</a>

          <a href="#platform">Platform</a>

          <a href="#technology">Technology</a>

          <a href="#team">Team</a>
        </div>

        <button className="login-btn">
          Login
        </button>

      </nav>


      {/* ==========================================
          HERO SECTION
      ========================================== */}

      <section
        className="hero"
        id="home"
      >

        <div className="hero-content">

          <div className="small-title">
            INDUSTRIAL AI INTELLIGENCE
          </div>

          <h1>
            Predict.
            <br />

            Explain.
            <br />

            <span>Prevent.</span>
          </h1>

          <p className="description">
            Explainable AI-powered predictive maintenance
            and industrial decision support system.
          </p>

          <div className="buttons">

            <button
              className="primary-btn"
              onClick={scrollToPlatform}
            >
              Explore Platform
            </button>

            <button className="secondary-btn">
              Watch Demo
            </button>

          </div>

        </div>


        {/* 3D MACHINE */}

        <ThreeDScene />

      </section>


      {/* ==========================================
          PLATFORM SECTION
      ========================================== */}

      <section
        className="platform-section"
        id="platform"
      >

        <div className="section-label">
          SMART INDUSTRIAL PLATFORM
        </div>

        <h2>
          From Machine Data
          <span> to Smart Decisions.</span>
        </h2>

        <p className="platform-description">
          SystemSmartPredict continuously monitors industrial
          equipment, analyzes machine conditions, predicts
          possible failures, and helps teams prevent costly
          downtime.
        </p>


        {/* PLATFORM FLOW */}

        <div className="platform-flow">

          {/* CARD 1 */}

          <div className="platform-card">

            <div className="platform-icon">
              ◉
            </div>

            <div className="platform-step">
              01
            </div>

            <h3>
              Real-Time Monitoring
            </h3>

            <p>
              Collect machine sensor information such as
              temperature, vibration and motor health.
            </p>

            <div className="card-line"></div>

            <div className="card-status">
              ● SENSOR ACTIVE
            </div>

          </div>


          {/* CARD 2 */}

          <div className="platform-card">

            <div className="platform-icon">
              ◈
            </div>

            <div className="platform-step">
              02
            </div>

            <h3>
              AI Analysis
            </h3>

            <p>
              Analyze machine data and identify unusual
              patterns or changes in equipment behavior.
            </p>

            <div className="card-line"></div>

            <div className="card-status">
              ● AI ANALYZING
            </div>

          </div>


          {/* CARD 3 */}

          <div className="platform-card">

            <div className="platform-icon">
              ◇
            </div>

            <div className="platform-step">
              03
            </div>

            <h3>
              Failure Prediction
            </h3>

            <p>
              Predict potential equipment failures before
              they become serious maintenance problems.
            </p>

            <div className="card-line"></div>

            <div className="card-status">
              ● PREDICTION READY
            </div>

          </div>


          {/* CARD 4 */}

          <div className="platform-card">

            <div className="platform-icon">
              ✓
            </div>

            <div className="platform-step">
              04
            </div>

            <h3>
              Preventive Action
            </h3>

            <p>
              Provide maintenance alerts and decision support
              so teams can take action at the right time.
            </p>

            <div className="card-line"></div>

            <div className="card-status">
              ● SYSTEM PROTECTED
            </div>

          </div>

        </div>


        {/* PLATFORM BOTTOM PANEL */}

        <div className="platform-monitor">

          <div>

            <div className="monitor-label">
              CURRENT SYSTEM STATUS
            </div>

            <h3>
              Industrial Equipment
            </h3>

            <p>
              All monitored systems are operating normally.
            </p>

          </div>


          <div className="monitor-stats">

            <div className="monitor-stat">
              <strong>98%</strong>
              <span>Machine Health</span>
            </div>

            <div className="monitor-stat">
              <strong>72°C</strong>
              <span>Temperature</span>
            </div>

            <div className="monitor-stat">
              <strong>1.8</strong>
              <span>Vibration mm/s</span>
            </div>

            <div className="monitor-stat healthy">
              <strong>✓</strong>
              <span>System Healthy</span>
            </div>

          </div>

        </div>

      </section>


      {/* ==========================================
          TECHNOLOGY SECTION
      ========================================== */}

      <section
        className="technology-section"
        id="technology"
      >

        <div className="section-label">
          TECHNOLOGY
        </div>

        <h2>
          Intelligent Monitoring.
        </h2>

        <p>
          Sensor data + AI analysis + predictive intelligence
          working together to reduce unexpected machine failure.
        </p>

      </section>


      {/* ==========================================
          TEAM SECTION
      ========================================== */}

      <section
        className="team-section"
        id="team"
      >

        <div className="section-label">
          SYSTEMSMARTPREDICT
        </div>

        <h2>
          Built for Industrial Intelligence.
        </h2>

        <p>
          A smart platform designed to support predictive
          maintenance and industrial decision making.
        </p>

      </section>

    </div>
  );
}

export default Home;