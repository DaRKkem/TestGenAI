/**
 * api.js
 * Thin wrapper around fetch() for all TestGen AI backend calls.
 * Handles JWT storage and auth headers.
 */

// Change this if the backend runs on a different host/port.
const API_BASE = "http://127.0.0.1:8000";

const TOKEN_KEY = "testgenai_token";
const EMAIL_KEY = "testgenai_email";

const Api = {
  // -------------------------------------------------------------------
  // Token helpers
  // -------------------------------------------------------------------
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  setSession(token, email) {
    localStorage.setItem(TOKEN_KEY, token);
    if (email) localStorage.setItem(EMAIL_KEY, email);
  },

  getEmail() {
    return localStorage.getItem(EMAIL_KEY);
  },

  clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  // -------------------------------------------------------------------
  // Low-level request helper
  // -------------------------------------------------------------------
  async _request(path, { method = "GET", body, isForm = false, auth = true } = {}) {
    const headers = {};
    if (!isForm) headers["Content-Type"] = "application/json";
    if (auth) {
      const token = this.getToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401) {
      // Token invalid/expired — force back to login
      if (!path.startsWith("/auth/")) {
        this.clearSession();
        if (window.App) window.App.navigate("auth");
        throw new Error("Session expired, please sign in again.");
      }
      // Let auth routes throw their own error message from the response body
      const data = await response.json();
      throw new Error(typeof data.detail === "string" ? data.detail : "Invalid credentials.");
    }

    if (!response.ok) {
      let detail = `Error ${response.status}`;
      try {
        const data = await response.json();
        if (Array.isArray(data.detail)) {
          // Pydantic validation errors (422): a list of { msg, loc, type, ... }
          detail = data.detail.map((e) => e.msg.replace(/^Value error,\s*/, ""))
        } else if (typeof data.detail === "string") {
          detail = data.detail;
        }
      } catch (_) {
        /* response had no JSON body */
      }
      throw new Error(detail);
    }

    if (response.status === 204) return null;
    return response.json();
  },

  // -------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------
  register(email, password) {
    return this._request("/auth/register", {
      method: "POST",
      auth: false,
      body: { email, password },
    });
  },

  async login(email, password) {
    // FastAPI's OAuth2PasswordRequestForm expects form-urlencoded data
    // with the field named "username" (we treat it as the email).
    const form = new URLSearchParams();
    form.set("username", email);
    form.set("password", password);

    const data = await this._request("/auth/login", {
      method: "POST",
      auth: false,
      isForm: true,
      body: form,
    });

    this.setSession(data.access_token, email);
    return data;
  },

  // -------------------------------------------------------------------
  // Generation
  // -------------------------------------------------------------------
  generateTests(sourceCode, language, llm = "mistral") {
    return this._request("/generate", {
      method: "POST",
      body: { source_code: sourceCode, language, llm },
    });
  },

  // -------------------------------------------------------------------
  // History
  // -------------------------------------------------------------------
  getHistory() {
    return this._request("/history");
  },

  getHistoryDetail(id) {
    return this._request(`/history/${id}`);
  },

  deleteHistoryEntry(id) {
    return this._request(`/history/${id}`, { method: "DELETE" });
  },

  // Downloads need a Blob since the Authorization header can't be set
  // on a plain <a href> link.
  async downloadTest(id, filename) {
    const token = this.getToken();
    const response = await fetch(`${API_BASE}/history/download/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Download failed.");

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || `test_${id}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
