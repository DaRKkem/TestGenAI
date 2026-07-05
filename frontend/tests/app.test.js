/**
 * app.test.js
 * Unit tests for app.js — router, navbar, auth flow, status bar.
 * All external dependencies (Api, Auth, Editor, History) are mocked.
 */

// ---------------------------------------------------------------------------
// DOM setup — minimal HTML structure required by App
// ---------------------------------------------------------------------------
document.body.innerHTML = `
  <header id="navbar" class="hidden"></header>
  <div id="view-auth" class="view"></div>
  <div id="view-editor" class="view hidden"></div>
  <div id="view-history" class="view hidden"></div>
  <footer id="statusbar" class="hidden"></footer>
  <span id="status-msg"></span>
  <button id="logout-btn"></button>
  <div id="user-avatar"></div>
  <button class="tab-btn" data-route="editor"></button>
  <button class="tab-btn" data-route="history"></button>
`;

// ---------------------------------------------------------------------------
// Global mocks — objects app.js expects to find on window
// ---------------------------------------------------------------------------
global.Api = {
  isLoggedIn: jest.fn(),
  getEmail: jest.fn(),
  clearSession: jest.fn(),
};

global.Auth = { init: jest.fn() };
global.Editor = { init: jest.fn(), reset: jest.fn(), loadPrefill: jest.fn() };
global.History = { init: jest.fn(), load: jest.fn() };

// ---------------------------------------------------------------------------
// Load app.js after mocks are in place
// ---------------------------------------------------------------------------
require("../js/app.js");
beforeAll(() => {
  Api.isLoggedIn.mockReturnValue(false);
  App.init();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const getView = (name) => document.getElementById(`view-${name}`);
const isVisible = (el) => !el.classList.contains("hidden");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("App.setStatus", () => {
  test("updates the status bar message", () => {
    App.setStatus("Hello");
    expect(document.getElementById("status-msg").textContent).toBe("Hello");
  });

  test("does nothing if status-msg element is missing", () => {
    const el = document.getElementById("status-msg");
    el.remove();
    expect(() => App.setStatus("test")).not.toThrow();
    document.body.appendChild(Object.assign(document.createElement("span"), { id: "status-msg" }));
  });
});

describe("App.navigate — auth route", () => {
  beforeEach(() => {
    Api.isLoggedIn.mockReturnValue(false);
    App.navigate("auth");
  });

  test("shows the auth view", () => {
    expect(isVisible(getView("auth"))).toBe(true);
  });

  test("hides the editor view", () => {
    expect(isVisible(getView("editor"))).toBe(false);
  });

  test("hides the navbar", () => {
    expect(isVisible(document.getElementById("navbar"))).toBe(false);
  });

  test("hides the statusbar", () => {
    expect(isVisible(document.getElementById("statusbar"))).toBe(false);
  });
});

describe("App.navigate — editor route", () => {
  beforeEach(() => {
    Api.isLoggedIn.mockReturnValue(true);
    App.navigate("editor");
  });

  test("shows the editor view", () => {
    expect(isVisible(getView("editor"))).toBe(true);
  });

  test("hides the auth view", () => {
    expect(isVisible(getView("auth"))).toBe(false);
  });

  test("shows the navbar", () => {
    expect(isVisible(document.getElementById("navbar"))).toBe(true);
  });

  test("shows the statusbar", () => {
    expect(isVisible(document.getElementById("statusbar"))).toBe(true);
  });

  test("marks editor tab as active", () => {
    const editorTab = document.querySelector('.tab-btn[data-route="editor"]');
    expect(editorTab.classList.contains("active")).toBe(true);
  });

  test("calls Editor.loadPrefill", () => {
    expect(Editor.loadPrefill).toHaveBeenCalled();
  });

  test("sets status to Ready", () => {
    expect(document.getElementById("status-msg").textContent).toBe("Ready");
  });
});

describe("App.navigate — history route", () => {
  beforeEach(() => {
    App.navigate("history");
  });

  test("shows the history view", () => {
    expect(isVisible(getView("history"))).toBe(true);
  });

  test("calls History.load", () => {
    expect(History.load).toHaveBeenCalled();
  });

  test("marks history tab as active", () => {
    const historyTab = document.querySelector('.tab-btn[data-route="history"]');
    expect(historyTab.classList.contains("active")).toBe(true);
  });
});

describe("App.onAuthenticated", () => {
  test("sets avatar initials from email", () => {
    Api.getEmail.mockReturnValue("damien@example.com");
    App.onAuthenticated();
    expect(document.getElementById("user-avatar").textContent).toBe("DA");
  });

  test("falls back to -- if no email", () => {
    Api.getEmail.mockReturnValue("");
    App.onAuthenticated();
    expect(document.getElementById("user-avatar").textContent).toBe("--");
  });

  test("navigates to editor after auth", () => {
    Api.getEmail.mockReturnValue("test@test.com");
    App.onAuthenticated();
    expect(isVisible(getView("editor"))).toBe(true);
  });
});

describe("Logout button", () => {
  test("clears session and navigates to auth", () => {
    document.getElementById("logout-btn").click();
    expect(Api.clearSession).toHaveBeenCalled();
    expect(Editor.reset).toHaveBeenCalled();
    expect(isVisible(getView("auth"))).toBe(true);
  });
});