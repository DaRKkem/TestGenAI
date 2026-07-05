/**
 * api.test.js
 * Unit tests for api.js — token helpers, request logic, auth, generation, history.
 * fetch is mocked globally via jest.spyOn.
 */

// ---------------------------------------------------------------------------
// Mock fetch globally before loading api.js
// ---------------------------------------------------------------------------
global.fetch = jest.fn();

// Mock App.navigate (called on 401)
global.App = { navigate: jest.fn() };

// ---------------------------------------------------------------------------
// Load api.js
// ---------------------------------------------------------------------------
const { Api } = require("../js/api.js");
global.Api = Api;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const mockResponse = (status, body = {}) => {
  return Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
    blob: () => Promise.resolve(new Blob([JSON.stringify(body)])),
  });
};

// ---------------------------------------------------------------------------
// Reset between tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------
describe("Api — token helpers", () => {
  test("getToken returns null when nothing stored", () => {
    expect(Api.getToken()).toBeNull();
  });

  test("setSession stores token and email", () => {
    Api.setSession("mytoken", "test@test.com");
    expect(Api.getToken()).toBe("mytoken");
    expect(Api.getEmail()).toBe("test@test.com");
  });

  test("clearSession removes token and email", () => {
    Api.setSession("mytoken", "test@test.com");
    Api.clearSession();
    expect(Api.getToken()).toBeNull();
    expect(Api.getEmail()).toBeNull();
  });

  test("isLoggedIn returns false when no token", () => {
    expect(Api.isLoggedIn()).toBe(false);
  });

  test("isLoggedIn returns false and clears session for malformed token", () => {
    localStorage.setItem("testgenai_token", "notavalidjwt");
    expect(Api.isLoggedIn()).toBe(false);
    expect(Api.getToken()).toBeNull();
  });

  test("isLoggedIn returns false and clears session for expired token", () => {
    // Build a JWT with exp in the past
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(JSON.stringify({ sub: "1", exp: Math.floor(Date.now() / 1000) - 60 }));
    const token = `${header}.${payload}.fakesig`;
    localStorage.setItem("testgenai_token", token);
    expect(Api.isLoggedIn()).toBe(false);
    expect(Api.getToken()).toBeNull();
  });

  test("isLoggedIn returns true for valid non-expired token", () => {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(JSON.stringify({ sub: "1", exp: Math.floor(Date.now() / 1000) + 3600 }));
    const token = `${header}.${payload}.fakesig`;
    localStorage.setItem("testgenai_token", token);
    expect(Api.isLoggedIn()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Auth — register
// ---------------------------------------------------------------------------
describe("Api.register", () => {
  test("sends POST /auth/register with email and password", async () => {
    global.fetch.mockReturnValue(mockResponse(201, { id: "1", email: "test@test.com" }));
    await Api.register("test@test.com", "Password1!");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/register"),
      expect.objectContaining({ method: "POST" })
    );
  });

  test("returns user data on success", async () => {
    global.fetch.mockReturnValue(mockResponse(201, { id: "1", email: "test@test.com" }));
    const result = await Api.register("test@test.com", "Password1!");
    expect(result.email).toBe("test@test.com");
  });
});

// ---------------------------------------------------------------------------
// Auth — login
// ---------------------------------------------------------------------------
describe("Api.login", () => {
  test("sends POST /auth/login as form-urlencoded", async () => {
    global.fetch.mockReturnValue(mockResponse(200, { access_token: "tok123", token_type: "bearer" }));
    await Api.login("test@test.com", "Password1!");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login"),
      expect.objectContaining({ method: "POST" })
    );
  });

  test("stores token in localStorage after login", async () => {
    global.fetch.mockReturnValue(mockResponse(200, { access_token: "tok123", token_type: "bearer" }));
    await Api.login("test@test.com", "Password1!");
    expect(Api.getToken()).toBe("tok123");
  });
});

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------
describe("Api.generateTests", () => {
  test("sends POST /generate with source_code, language, llm", async () => {
    global.fetch.mockReturnValue(mockResponse(200, {
      test_code: "def test_foo(): pass",
      snippet_id: "abc",
      llm_provider: "mistral",
      status: "success"
    }));
    await Api.generateTests("def foo(): pass", "python", "mistral");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/generate"),
      expect.objectContaining({ method: "POST" })
    );
  });

  test("returns test_code and llm_provider", async () => {
    global.fetch.mockReturnValue(mockResponse(200, {
      test_code: "def test_foo(): pass",
      snippet_id: "abc",
      llm_provider: "groq",
      status: "success"
    }));
    const result = await Api.generateTests("def foo(): pass", "python");
    expect(result.test_code).toBe("def test_foo(): pass");
    expect(result.llm_provider).toBe("groq");
  });
});

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------
describe("Api.getHistory", () => {
  test("sends GET /history", async () => {
    global.fetch.mockReturnValue(mockResponse(200, []));
    await Api.getHistory();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/history"),
      expect.objectContaining({ method: "GET" })
    );
  });

  test("returns list of history items", async () => {
    const items = [{ id: "1", language: "python", status: "success" }];
    global.fetch.mockReturnValue(mockResponse(200, items));
    const result = await Api.getHistory();
    expect(result).toHaveLength(1);
    expect(result[0].language).toBe("python");
  });
});

describe("Api.getHistoryDetail", () => {
  test("sends GET /history/:id", async () => {
    global.fetch.mockReturnValue(mockResponse(200, { id: "1", source_code: "def foo(): pass" }));
    await Api.getHistoryDetail("1");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/history/1"),
      expect.objectContaining({ method: "GET" })
    );
  });
});

describe("Api.deleteHistoryEntry", () => {
  test("sends DELETE /history/:id", async () => {
    global.fetch.mockReturnValue(mockResponse(204));
    await Api.deleteHistoryEntry("1");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/history/1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  test("returns null on 204", async () => {
    global.fetch.mockReturnValue(mockResponse(204));
    const result = await Api.deleteHistoryEntry("1");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe("Api — error handling", () => {
  test("throws on 401 for non-auth routes and clears session", async () => {
    Api.setSession("expiredtoken", "test@test.com");
    global.fetch.mockReturnValue(mockResponse(401, { detail: "Invalid token" }));
    await expect(Api.getHistory()).rejects.toThrow("Session expired");
    expect(Api.getToken()).toBeNull();
  });

  test("throws with detail message on non-ok response", async () => {
    global.fetch.mockReturnValue(mockResponse(404, { detail: "Not found" }));
    await expect(Api.getHistoryDetail("999")).rejects.toThrow("Not found");
  });
});