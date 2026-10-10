
import { Link } from "react-router-dom";
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
    <div className="home" id="home">

      {/* ================= NAVBAR ================= */}
      <nav className="navbar">

        {/* LOGO */}
        <div className="logo">
          SYSTEM<span>SMART</span>PREDICT
        </div>

        {/* NAVIGATION LINKS */}
        <div className="nav-links">
          <a href="#home">Home</a>

          <a href="#platform">
            Platform
          </a>

          <a href="#technology">
            Technology
          </a>

          <a href="#team">
            Team
          </a>
        </div>

        {/* AUTHENTICATION BUTTONS */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <Link
            to="/login"
            className="login-btn"
            style={{
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Login
          </Link>

          <Link
            to="/register"
            className="login-btn"
            style={{
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Register
          </Link>
        </div>

      </nav>

      {/* ================= HERO SECTION ================= */}
      <section className="hero">

        <div className="hero-content">

          <div className="hero-label">
            INDUSTRIAL AI INTELLIGENCE
          </div>

          <h1>
            Predict.
            <br />
            <span>Explain.</span>
            <br />
            Prevent.
          </h1>

          <p>
            Transform industrial operations with AI-powered
            predictive maintenance, real-time monitoring,
            and intelligent decision support.
          </p>

          <div className="hero-buttons">

            <button
              className="primary-btn"
              onClick={scrollToPlatform}
            >
              Explore Platform
            </button>

            <Link
              to="/login"
              className="secondary-btn"
              style={{
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              Get Started
            </Link>

          </div>

        </div>

        {/* 3D MACHINE */}
        <div className="hero-3d">
          <ThreeDScene />
        </div>

      </section>

      {/* ================= PLATFORM SECTION ================= */}
      <section
        id="platform"
        className="platform-section"
      >

        <div className="section-heading">

          <div className="hero-label">
            SMART INDUSTRIAL PLATFORM
          </div>

          <h2>
            Intelligence for
            <span> Every Machine</span>
          </h2>

          <p>
            Monitor equipment, detect anomalies, predict failures,
            and make data-driven maintenance decisions.
          </p>

        </div>

        <div className="platform-grid">

          <div className="platform-card">
            <div className="card-icon">
              ◉
            </div>

            <h3>
              Real-Time Monitoring
            </h3>

            <p>
              Continuously monitor critical machine
              parameters and equipment health.
            </p>
          </div>

          <div className="platform-card">
            <div className="card-icon">
              ◈
            </div>

            <h3>
              Predictive Maintenance
            </h3>

            <p>
              Detect early warning signs and predict
              potential equipment failures.
            </p>
          </div>

          <div className="platform-card">
            <div className="card-icon">
              ◇
            </div>

            <h3>
              AI Decision Support
            </h3>

            <p>
              Convert industrial data into actionable
              maintenance recommendations.
            </p>
          </div>

        </div>

      </section>

      {/* ================= TECHNOLOGY SECTION ================= */}
      <section
        id="technology"
        className="technology-section"
      >

        <div className="section-heading">

          <div className="hero-label">
            ADVANCED TECHNOLOGY
          </div>

          <h2>
            Powered by
            <span> Industrial AI</span>
          </h2>

          <p>
            SystemSmartPredict combines machine learning,
            sensor analytics, predictive models, and
            intelligent visualization.
          </p>

        </div>

        <div className="technology-grid">

          <div className="technology-card">
            <h3>
              Machine Learning
            </h3>

            <p>
              AI models analyze machine behavior and
              identify patterns associated with failures.
            </p>
          </div>

          <div className="technology-card">
            <h3>
              Sensor Analytics
            </h3>

            <p>
              Temperature, vibration, pressure, RPM,
              torque, and tool-wear data are continuously analyzed.
            </p>
          </div>

          <div className="technology-card">
            <h3>
              Intelligent Predictions
            </h3>

            <p>
              Predict machine health and provide
              early warnings before critical failures occur.
            </p>
          </div>

        </div>

      </section>

      {/* ================= TEAM SECTION ================= */}
      <section
        id="team"
        className="team-section"
      >

        <div className="section-heading">

          <div className="hero-label">
            OUR TEAM
          </div>

          <h2>
            Building the
            <span> Future of Maintenance</span>
          </h2>

          <p>
            A collaborative engineering team developing
            an intelligent industrial predictive maintenance platform.
          </p>

        </div>

        <div className="team-grid">

          <div className="team-card">
            <div className="team-number">
              01
            </div>

            <h3>
              Frontend & 3D Interface
            </h3>

            <p>
              Interactive industrial interface,
              3D visualization, and platform experience.
            </p>
          </div>

          <div className="team-card">
            <div className="team-number">
              02
            </div>

            <h3>
              Authentication
            </h3>

            <p>
              Login, registration, profile management,
              and protected application routes.
            </p>
          </div>

          <div className="team-card">
            <div className="team-number">
              03
            </div>

            <h3>
              Dashboard & Monitoring
            </h3>

            <p>
              Machine health monitoring, sensor analytics,
              and real-time dashboard functionality.
            </p>
          </div>

          <div className="team-card">
            <div className="team-number">
              04
            </div>

            <h3>
              Analytics & Prediction
            </h3>

            <p>
              Predictive analytics, machine learning,
              and intelligent failure prediction.
            </p>
          </div>

        </div>

      </section>

      {/* ================= FOOTER ================= */}
      <footer className="footer">

        <div className="logo">
          SYSTEM<span>SMART</span>PREDICT
        </div>

        <p>
          Intelligent Predictive Maintenance Platform
        </p>

        <div className="footer-auth">

          <Link to="/login">
            Login
          </Link>

          <Link to="/register">
            Create Account
          </Link>

        </div>

      </footer>

    </div>
  );
}

export default Home;

