/**
 * auth.test.js
 * Unit tests for auth.js — tab switching, form submission, error display.
 * Api and App are mocked globally.
 */

// ---------------------------------------------------------------------------
// DOM setup
// ---------------------------------------------------------------------------
document.body.innerHTML = `
  <div id="auth-error" class="hidden"></div>

  <button class="segmented-btn" data-tab="login">Sign in</button>
  <button class="segmented-btn" data-tab="register">Sign up</button>

  <form id="login-form" class="auth-form">
    <input class="field-input" id="login-email" type="email" />
    <input class="field-input" id="login-password" type="password" />
    <button type="submit" id="login-submit">Sign in</button>
  </form>

  <form id="register-form" class="hidden auth-form">
    <input class="field-input" id="register-email" type="email" />
    <input class="field-input" id="register-password" type="password" />
    <input class="field-input" id="register-password-confirm" type="password" />
    <button type="submit" id="register-submit">Create account</button>
  </form>

  <span id="switch-to-register-wrap"><a href="#" id="switch-to-register">Create one</a></span>
  <span id="switch-to-login-wrap" class="hidden"><a href="#" id="switch-to-login">Sign in</a></span>
`;

// ---------------------------------------------------------------------------
// Global mocks
// ---------------------------------------------------------------------------
global.Api = {
  login: jest.fn(),
  register: jest.fn(),
};

global.App = {
  onAuthenticated: jest.fn(),
};

// ---------------------------------------------------------------------------
// Load auth.js
// ---------------------------------------------------------------------------
const { Auth } = require("../js/auth.js");
global.Auth = Auth;

beforeAll(() => {
  Auth.init();
});

beforeEach(() => {
  jest.clearAllMocks();
  document.getElementById("auth-error").textContent = "";
  document.getElementById("auth-error").classList.add("hidden");
});

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------
describe("Auth — tab switching", () => {
  test("clicking register tab shows register form", () => {
    document.querySelector('.segmented-btn[data-tab="register"]').click();
    expect(document.getElementById("register-form").classList.contains("hidden")).toBe(false);
    expect(document.getElementById("login-form").classList.contains("hidden")).toBe(true);
  });

  test("clicking login tab shows login form", () => {
    document.querySelector('.segmented-btn[data-tab="register"]').click();
    document.querySelector('.segmented-btn[data-tab="login"]').click();
    expect(document.getElementById("login-form").classList.contains("hidden")).toBe(false);
    expect(document.getElementById("register-form").classList.contains("hidden")).toBe(true);
  });

  test("switch-to-register link shows register form", () => {
    document.getElementById("switch-to-register").click();
    expect(document.getElementById("register-form").classList.contains("hidden")).toBe(false);
  });

  test("switch-to-login link shows login form", () => {
    document.getElementById("switch-to-login").click();
    expect(document.getElementById("login-form").classList.contains("hidden")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Error display
// ---------------------------------------------------------------------------
describe("Auth — error display", () => {
  test("_showError displays message and removes hidden class", () => {
    Auth._showError("Something went wrong");
    const el = document.getElementById("auth-error");
    expect(el.textContent).toBe("Something went wrong");
    expect(el.classList.contains("hidden")).toBe(false);
  });

  test("_clearError empties message and adds hidden class", () => {
    Auth._showError("error");
    Auth._clearError();
    const el = document.getElementById("auth-error");
    expect(el.textContent).toBe("");
    expect(el.classList.contains("hidden")).toBe(true);
  });

  test("typing in a field clears the error", () => {
    Auth._showError("error");
    const input = document.getElementById("login-email");
    input.dispatchEvent(new Event("input"));
    expect(document.getElementById("auth-error").classList.contains("hidden")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Login form
// ---------------------------------------------------------------------------
describe("Auth — login", () => {
  test("successful login calls Api.login and App.onAuthenticated", async () => {
    Api.login.mockResolvedValue({ access_token: "tok" });
    document.getElementById("login-email").value = "test@test.com";
    document.getElementById("login-password").value = "Password1!";
    document.getElementById("login-form").dispatchEvent(new Event("submit"));
    await Promise.resolve();
    await Promise.resolve();
    expect(Api.login).toHaveBeenCalledWith("test@test.com", "Password1!");
    expect(App.onAuthenticated).toHaveBeenCalled();
  });

  test("failed login shows error message", async () => {
    Api.login.mockRejectedValue(new Error("Invalid credentials."));
    document.getElementById("login-email").value = "wrong@test.com";
    document.getElementById("login-password").value = "wrongpass";
    document.getElementById("login-form").dispatchEvent(new Event("submit"));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.getElementById("auth-error").textContent).toBe("Invalid credentials.");
  });
});

// ---------------------------------------------------------------------------
// Register form
// ---------------------------------------------------------------------------
describe("Auth — register", () => {
  test("mismatched passwords shows error without calling Api", () => {
    document.getElementById("register-email").value = "test@test.com";
    document.getElementById("register-password").value = "Password1!";
    document.getElementById("register-password-confirm").value = "Different1!";
    document.getElementById("register-form").dispatchEvent(new Event("submit"));
    expect(document.getElementById("auth-error").textContent).toBe("Passwords do not match.");
    expect(Api.register).not.toHaveBeenCalled();
  });

  test("successful register calls Api.register, Api.login, App.onAuthenticated", async () => {
    Api.register.mockResolvedValue({});
    Api.login.mockResolvedValue({ access_token: "tok" });
    document.getElementById("register-email").value = "new@test.com";
    document.getElementById("register-password").value = "Password1!";
    document.getElementById("register-password-confirm").value = "Password1!";
    document.getElementById("register-form").dispatchEvent(new Event("submit"));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(Api.register).toHaveBeenCalledWith("new@test.com", "Password1!");
    expect(Api.login).toHaveBeenCalledWith("new@test.com", "Password1!");
    expect(App.onAuthenticated).toHaveBeenCalled();
  });

  test("failed register shows error message", async () => {
    Api.register.mockRejectedValue(new Error("Email already registered"));
    document.getElementById("register-email").value = "existing@test.com";
    document.getElementById("register-password").value = "Password1!";
    document.getElementById("register-password-confirm").value = "Password1!";
    document.getElementById("register-form").dispatchEvent(new Event("submit"));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.getElementById("auth-error").textContent).toBe("Email already registered");
  });
});