/**
 * auth.js
 * Handles the login/register forms on the auth view:
 * tab switching, validation, submission, error display.
 */

const Auth = {
  init() {
    this._wireTabSwitch();
    this._wireForms();
    this._wireEyeBtns();
  },

  // -------------------------------------------------------------------
  // Sign in / Sign up tab toggle
  // -------------------------------------------------------------------
  _wireTabSwitch() {
    const loginTab = document.querySelector('.segmented-btn[data-tab="login"]');
    const registerTab = document.querySelector('.segmented-btn[data-tab="register"]');
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const switchToRegister = document.getElementById("switch-to-register");
    const switchToLogin = document.getElementById("switch-to-login");

    const showLogin = () => {
      loginTab.classList.add("active");
      registerTab.classList.remove("active");
      loginForm.classList.remove("hidden");
      registerForm.classList.add("hidden");
      document.getElementById("switch-to-register-wrap").classList.remove("hidden");
      document.getElementById("switch-to-login-wrap").classList.add("hidden");
      this._clearError();
    };

    const showRegister = () => {
      registerTab.classList.add("active");
      loginTab.classList.remove("active");
      registerForm.classList.remove("hidden");
      loginForm.classList.add("hidden");
      document.getElementById("switch-to-login-wrap").classList.remove("hidden");
      document.getElementById("switch-to-register-wrap").classList.add("hidden");
      this._clearError();
    };

    loginTab.addEventListener("click", showLogin);
    registerTab.addEventListener("click", showRegister);
    switchToRegister.addEventListener("click", (e) => {
      e.preventDefault();
      showRegister();
    });
    switchToLogin.addEventListener("click", (e) => {
      e.preventDefault();
      showLogin();
    });
  },

  // -------------------------------------------------------------------
  // Form submission
  // -------------------------------------------------------------------
  _wireForms() {
    document.getElementById("login-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this._handleLogin();
    });

    document.getElementById("register-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this._handleRegister();
    });

    // Clear any leftover error banner as soon as the user edits a field
    document.querySelectorAll(".auth-form .field-input").forEach((input) => {
      input.addEventListener("input", () => this._clearError());
    });
  },

  async _handleLogin() {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const btn = document.getElementById("login-submit");

    this._clearError();
    this._setLoading(btn, true, "Signing in...");

    try {
      await Api.login(email, password);
      window.App.onAuthenticated();
    } catch (err) {
      this._showError(err.message || "Invalid credentials.");
    } finally {
      this._setLoading(btn, false, "Sign in");
    }
  },

  async _handleRegister() {
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;
    const confirm = document.getElementById("register-password-confirm").value;
    const btn = document.getElementById("register-submit");

    this._clearError();

    if (password !== confirm) {
      this._showError("Passwords do not match.");
      return;
    }

    this._setLoading(btn, true, "Creating...");

    try {
      await Api.register(email, password);
      // Auto-login right after a successful registration
      await Api.login(email, password);
      window.App.onAuthenticated();
    } catch (err) {
      this._showError(err.message || "Registration failed.");
    } finally {
      this._setLoading(btn, false, "Create account");
    }
  },

  _wireEyeBtns() {
    document.querySelectorAll(".eye-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const input = document.getElementById(btn.dataset.target);
        const icon = btn.querySelector(".eye-icon");
        input.type = input.type === "password" ? "text" : "password";
        icon.src = input.type === "password" ? "assets/hide.png" : "assets/show.png";
      });
    });
  },

  // -------------------------------------------------------------------
  // UI helpers
  // -------------------------------------------------------------------
  _showError(msg) {
    const el = document.getElementById("auth-error");
    el.textContent = msg;
    el.classList.remove("hidden");
  },

  _clearError() {
    const el = document.getElementById("auth-error");
    el.textContent = "";
    el.classList.add("hidden");
  },

  _setLoading(btn, isLoading, label) {
    btn.disabled = isLoading;
    btn.textContent = label;
  },
};

if (typeof module !== "undefined") module.exports = { Auth };
