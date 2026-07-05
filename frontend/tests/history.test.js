/**
 * history.test.js
 * Unit tests for history.js — list rendering, detail view, actions.
 * Drag resize is excluded (not testable in jsdom).
 */

// ---------------------------------------------------------------------------
// DOM setup
// ---------------------------------------------------------------------------
document.body.innerHTML = `
  <table id="history-table" class="hidden">
    <tbody id="history-tbody"></tbody>
  </table>
  <div id="history-empty" class="hidden"></div>
  <div id="history-detail-placeholder"></div>
  <div id="history-detail-content" class="hidden">
    <div id="detail-pane-source">
      <p class="detail-label"></p>
      <div class="code-scroll-wrap"><code id="history-source-code"></code></div>
    </div>
    <div id="detail-divider"></div>
    <div id="detail-pane-tests">
      <p class="detail-label"></p>
      <div class="code-scroll-wrap"><code id="history-test-code"></code></div>
    </div>
  </div>
  <button id="history-download-btn" disabled>Download</button>
  <button id="history-delete-btn" disabled>Delete</button>
  <button id="history-see-editor-btn" disabled>See in editor</button>
`;

// ---------------------------------------------------------------------------
// Global mocks
// ---------------------------------------------------------------------------
global.hljs = {
  highlight: jest.fn().mockReturnValue({ value: "<highlighted>", language: "python" }),
  highlightAuto: jest.fn().mockReturnValue({ value: "<highlighted>", language: "python" }),
};

global.Api = {
  getHistory: jest.fn(),
  getHistoryDetail: jest.fn(),
  downloadTest: jest.fn(),
  deleteHistoryEntry: jest.fn(),
};

global.App = {
  setStatus: jest.fn(),
  navigate: jest.fn(),
};

global.confirm = jest.fn();

// ---------------------------------------------------------------------------
// Load history.js
// ---------------------------------------------------------------------------
const { History } = require("../js/history.js");
global.History = History;

beforeAll(() => {
  History.init();
});

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  History._selectedId = null;
  History._selectedLanguage = undefined;
  document.getElementById("history-tbody").innerHTML = "";
  document.getElementById("history-table").classList.add("hidden");
  document.getElementById("history-empty").classList.add("hidden");
  document.getElementById("history-detail-placeholder").classList.remove("hidden");
  document.getElementById("history-detail-content").classList.add("hidden");
  document.getElementById("history-download-btn").disabled = true;
  document.getElementById("history-delete-btn").disabled = true;
  document.getElementById("history-see-editor-btn").disabled = true;
});

// ---------------------------------------------------------------------------
// List rendering
// ---------------------------------------------------------------------------
describe("History — list rendering", () => {
  test("shows empty state when no items", async () => {
    Api.getHistory.mockResolvedValue([]);
    await History.load();
    expect(document.getElementById("history-empty").classList.contains("hidden")).toBe(false);
    expect(document.getElementById("history-table").classList.contains("hidden")).toBe(true);
  });

  test("shows table when items exist", async () => {
    Api.getHistory.mockResolvedValue([
      { id: "1", language: "python", llm_provider: "mistral", status: "success", generated_at: new Date().toISOString() }
    ]);
    await History.load();
    expect(document.getElementById("history-table").classList.contains("hidden")).toBe(false);
    expect(document.getElementById("history-empty").classList.contains("hidden")).toBe(true);
  });

  test("renders correct number of rows", async () => {
    Api.getHistory.mockResolvedValue([
      { id: "1", language: "python", llm_provider: "mistral", status: "success", generated_at: new Date().toISOString() },
      { id: "2", language: "javascript", llm_provider: "groq", status: "error", generated_at: new Date().toISOString() },
    ]);
    await History.load();
    const rows = document.querySelectorAll(".history-row");
    expect(rows).toHaveLength(2);
  });

  test("row contains correct language", async () => {
    Api.getHistory.mockResolvedValue([
      { id: "1", language: "python", llm_provider: "mistral", status: "success", generated_at: new Date().toISOString() }
    ]);
    await History.load();
    const row = document.querySelector(".history-row");
    expect(row.innerHTML).toContain("python");
  });

  test("sets error status when getHistory fails", async () => {
    Api.getHistory.mockRejectedValue(new Error("Network error"));
    await History.load();
    expect(App.setStatus).toHaveBeenCalledWith("Network error");
  });
});

// ---------------------------------------------------------------------------
// Detail view
// ---------------------------------------------------------------------------
describe("History — detail view", () => {
  test("shows detail content on successful entry selection", async () => {
    Api.getHistoryDetail.mockResolvedValue({
      id: "1",
      language: "python",
      source_code: "def foo(): pass",
      test_code: "def test_foo(): pass",
      status: "success",
    });
    await History._selectEntry("1");
    expect(document.getElementById("history-detail-content").classList.contains("hidden")).toBe(false);
    expect(document.getElementById("history-detail-placeholder").classList.contains("hidden")).toBe(true);
  });

  test("enables download and delete buttons on success entry", async () => {
    Api.getHistoryDetail.mockResolvedValue({
      id: "1",
      language: "python",
      source_code: "def foo(): pass",
      test_code: "def test_foo(): pass",
      status: "success",
    });
    await History._selectEntry("1");
    expect(document.getElementById("history-download-btn").disabled).toBe(false);
    expect(document.getElementById("history-delete-btn").disabled).toBe(false);
  });

  test("disables download button on failed generation", async () => {
    Api.getHistoryDetail.mockResolvedValue({
      id: "1",
      language: "python",
      source_code: "def foo(): pass",
      test_code: null,
      status: "error",
    });
    await History._selectEntry("1");
    expect(document.getElementById("history-download-btn").disabled).toBe(true);
  });

  test("shows fallback text when generation failed", async () => {
    Api.getHistoryDetail.mockResolvedValue({
      id: "1",
      language: "python",
      source_code: "def foo(): pass",
      test_code: null,
      status: "error",
    });
    await History._selectEntry("1");
    expect(document.getElementById("history-test-code").textContent).toBe("(No tests — generation failed)");
  });

  test("sets error status when getHistoryDetail fails", async () => {
    Api.getHistoryDetail.mockRejectedValue(new Error("Not found"));
    await History._selectEntry("999");
    expect(App.setStatus).toHaveBeenCalledWith("Not found");
  });

  test("highlights selected row", async () => {
    Api.getHistory.mockResolvedValue([
      { id: "1", language: "python", llm_provider: "mistral", status: "success", generated_at: new Date().toISOString() },
    ]);
    await History.load();
    Api.getHistoryDetail.mockResolvedValue({
      id: "1", language: "python", source_code: "def foo(): pass", test_code: "def test_foo(): pass", status: "success",
    });
    await History._selectEntry("1");
    const row = document.querySelector('.history-row[data-id="1"]');
    expect(row.classList.contains("selected")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
describe("History — delete", () => {
  test("does nothing if no entry selected", async () => {
    History._selectedId = null;
    await History._handleDelete();
    expect(Api.deleteHistoryEntry).not.toHaveBeenCalled();
  });

  test("does nothing if user cancels confirm", async () => {
    History._selectedId = "1";
    global.confirm.mockReturnValue(false);
    await History._handleDelete();
    expect(Api.deleteHistoryEntry).not.toHaveBeenCalled();
  });

  test("calls deleteHistoryEntry and reloads on confirm", async () => {
    History._selectedId = "1";
    global.confirm.mockReturnValue(true);
    Api.deleteHistoryEntry.mockResolvedValue(null);
    Api.getHistory.mockResolvedValue([]);
    await History._handleDelete();
    expect(Api.deleteHistoryEntry).toHaveBeenCalledWith("1");
    expect(App.setStatus).toHaveBeenCalledWith("Entry deleted");
  });

  test("shows error status on delete failure", async () => {
    History._selectedId = "1";
    global.confirm.mockReturnValue(true);
    Api.deleteHistoryEntry.mockRejectedValue(new Error("Delete failed"));
    await History._handleDelete();
    expect(App.setStatus).toHaveBeenCalledWith("Delete failed");
  });
});

describe("History — download", () => {
  test("does nothing if no entry selected", async () => {
    History._selectedId = null;
    await History._handleDownload();
    expect(Api.downloadTest).not.toHaveBeenCalled();
  });

  test("calls downloadTest with .py for python", async () => {
    History._selectedId = "1";
    History._selectedLanguage = "python";
    Api.downloadTest.mockResolvedValue(null);
    await History._handleDownload();
    expect(Api.downloadTest).toHaveBeenCalledWith("1", "test_snippet_1.py");
  });

  test("calls downloadTest with .js for javascript", async () => {
    History._selectedId = "2";
    History._selectedLanguage = "javascript";
    Api.downloadTest.mockResolvedValue(null);
    await History._handleDownload();
    expect(Api.downloadTest).toHaveBeenCalledWith("2", "test_snippet_2.js");
  });
});

describe("History — see in editor", () => {
  test("does nothing if no entry selected", () => {
    History._selectedId = null;
    History._handleSeeInEditor();
    expect(App.navigate).not.toHaveBeenCalled();
  });

  test("stores prefill data in sessionStorage and navigates", () => {
    History._selectedId = "1";
    History._selectedLanguage = "python";
    document.getElementById("history-source-code").textContent = "def foo(): pass";
    document.getElementById("history-test-code").textContent = "def test_foo(): pass";
    History._handleSeeInEditor();
    expect(sessionStorage.getItem("editor_prefill_code")).toBe("def foo(): pass");
    expect(sessionStorage.getItem("editor_prefill_lang")).toBe("python");
    expect(App.navigate).toHaveBeenCalledWith("editor");
  });
});