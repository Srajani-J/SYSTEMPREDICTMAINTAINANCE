// Shared HTTP client for the SmartPredict API.
//
// The access token is kept in sessionStorage: it survives a page reload within
// the tab but is cleared when the tab closes. A production deployment should
// move to short-lived access tokens plus an httpOnly refresh cookie, which is
// why no long-lived credential is written to localStorage.

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const TOKEN_KEY = "smartpredict.accessToken";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setToken(token) {
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Storage can be unavailable (private mode); the in-memory user state
    // still works until reload.
  }
}

function describeError(status, data) {
  const detail = data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => item?.msg)
      .filter((item) => typeof item === "string");

    if (messages.length > 0) {
      return messages.join(" ");
    }
  }

  return `Request failed (${status})`;
}

export async function apiRequest(path, options = {}) {
  const { method = "GET", body, auth = true, signal } = options;

  const headers = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = getToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  const raw = await response.text();
  let data = null;

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }

  if (!response.ok) {
    throw new ApiError(describeError(response.status, data), response.status);
  }

  return data;
}

export { API_URL };
