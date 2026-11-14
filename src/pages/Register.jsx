import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import "./Login.css";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const { register } = useAuth();

  const handleRegister = async (event) => {
    event.preventDefault();

    setMessage("");

    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setMessage("Please fill in all fields.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      await register(name.trim(), email.trim(), password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setMessage(
        err.message || "Unable to create the account. Please try again."
      );
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

        <h1>Create Account</h1>

        <p className="auth-subtitle">
          Create your account to access the industrial intelligence platform
        </p>

        <form onSubmit={handleRegister}>

          <div className="input-group">
            <label htmlFor="name">Full Name</label>

            <input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Enter your full name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="register-email">Email</label>

            <input
              id="register-email"
              type="email"
              autoComplete="email"
              placeholder="Enter your email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="register-password">Password</label>

            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              placeholder="Create a password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              maxLength={72}
              required
            />

            <small className="auth-hint">
              At least 8 characters with an uppercase letter, a lowercase
              letter, a digit and a symbol.
            </small>
          </div>

          <div className="input-group">
            <label htmlFor="confirm-password">Confirm Password</label>

            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              maxLength={72}
              required
            />
          </div>

          <button
            type="submit"
            className="auth-button"
            disabled={submitting}
          >
            {submitting ? "Creating account..." : "Create Account"}
          </button>

        </form>

        {message && (
          <p className="auth-message" role="alert">
            {message}
          </p>
        )}

        <p className="auth-footer">
          Already have an account?{" "}
          <Link to="/login" className="auth-link">
            Login
          </Link>
        </p>

      </div>
    </div>
  );
}

export default Register;
