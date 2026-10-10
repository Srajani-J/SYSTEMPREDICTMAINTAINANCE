
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();

    if (!email || !password) {
      setMessage("Please enter your email and password.");
      return;
    }

    // Save login status
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("userEmail", email);

    setMessage("Login successful!");

    setTimeout(() => {
      navigate("/profile");
    }, 500);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">

        <div className="auth-logo">
          SYSTEM<span>SMART</span>PREDICT
        </div>

        <h1>Welcome Back</h1>

        <p className="auth-subtitle">
          Sign in to access your industrial intelligence platform
        </p>

        <form onSubmit={handleLogin}>

          <div className="input-group">
            <label htmlFor="email">Email</label>

            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>

            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="auth-button">
            Login
          </button>

        </form>

        {message && (
          <p className="auth-message">
            {message}
          </p>
        )}

        <p className="auth-footer">
          Don't have an account?{" "}
          <Link to="/register" className="auth-link">
            Create Account
          </Link>
        </p>

      </div>
    </div>
  );
}

export default Login;

