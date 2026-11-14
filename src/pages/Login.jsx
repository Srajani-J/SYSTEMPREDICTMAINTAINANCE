import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { roleHome } from "../auth/roles";
import "./Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const handleLogin = async (event) => {
    event.preventDefault();

    setMessage("");

    if (!email.trim() || !password) {
      setMessage("Please enter your email and password.");
      return;
    }

    setSubmitting(true);

    try {
      const signedIn = await login(email.trim(), password);

      // Each role lands on its own dashboard; /dashboard redirects otherwise.
      const destination = location.state?.from || roleHome(signedIn.role);
      navigate(destination, { replace: true });
    } catch (err) {
      setMessage(err.message || "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
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
              autoComplete="username"
              placeholder="Enter your email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>

            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="auth-button"
            disabled={submitting}
          >
            {submitting ? "Signing in..." : "Login"}
          </button>

        </form>

        {message && (
          <p className="auth-message" role="alert">
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
