
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Login.css";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");

  const navigate = useNavigate();

  const handleRegister = (e) => {
    e.preventDefault();

    // Check empty fields
    if (!name || !email || !password || !confirmPassword) {
      setMessage("Please fill in all fields.");
      return;
    }

    // Check password match
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    // Save user information
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("userName", name);
    localStorage.setItem("userEmail", email);

    setMessage("Account created successfully!");

    // Go to profile
    setTimeout(() => {
      navigate("/profile");
    }, 500);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">

        {/* Logo */}
        <div className="auth-logo">
          SYSTEM<span>SMART</span>PREDICT
        </div>

        {/* Heading */}
        <h1>Create Account</h1>

        <p className="auth-subtitle">
          Create your account to access the industrial intelligence platform
        </p>

        {/* Register Form */}
        <form onSubmit={handleRegister}>

          {/* Full Name */}
          <div className="input-group">
            <label htmlFor="name">Full Name</label>

            <input
              id="name"
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Email */}
          <div className="input-group">
            <label htmlFor="register-email">Email</label>

            <input
              id="register-email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Password */}
          <div className="input-group">
            <label htmlFor="register-password">Password</label>

            <input
              id="register-password"
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {/* Confirm Password */}
          <div className="input-group">
            <label htmlFor="confirm-password">Confirm Password</label>

            <input
              id="confirm-password"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {/* Create Account Button */}
          <button type="submit" className="auth-button">
            Create Account
          </button>

        </form>

        {/* Message */}
        {message && (
          <p className="auth-message">
            {message}
          </p>
        )}

        {/* Login Link */}
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

