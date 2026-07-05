/**
 * editor.test.js
 * Unit tests for editor.js — line numbers, file upload, generation, copy/download, reset.
 * Api and hljs are mocked globally.
 */

// ---------------------------------------------------------------------------
// DOM setup
// ---------------------------------------------------------------------------
document.body.innerHTML = `
  <textarea id="source-code"></textarea>
  <div id="source-line-numbers"></div>
  <div id="output-line-numbers"></div>
  <pre id="output-pre"><code id="output-code" class="hljs"></code></pre>
  <div id="output-placeholder"></div>
  <div id="output-loading" class="hidden"></div>
  <span id="provider-badge" class="hidden"></span>
  <select id="language-select">
    <option value="python">Python</option>
    <option value="javascript">JavaScript</option>
    <option value="java">Java</option>
    <option value="c">C</option>
    <option value="go">Go</option>
    <option value="ruby">Ruby</option>
  </select>
  <button id="copy-btn" disabled>Copy</button>
  <button id="download-btn" disabled>Download</button>
  <button id="generate-btn">Generate tests</button>
  <input type="file" id="file-upload" />
`;

// ---------------------------------------------------------------------------
// Global mocks
// ---------------------------------------------------------------------------
global.hljs = {
  highlightElement: jest.fn(),
  highlightAuto: jest.fn().mockReturnValue({ value: "<highlighted>", language: "python" }),
  highlight: jest.fn().mockReturnValue({ value: "<highlighted>", language: "python" }),
};

global.Api = {
  generateTests: jest.fn(),
};

global.App = {
  setStatus: jest.fn(),
  navigate: jest.fn(),
};

// ---------------------------------------------------------------------------
// Load editor.js
// ---------------------------------------------------------------------------
const { Editor } = require("../js/editor.js");
global.Editor = Editor;

beforeAll(() => {
  Editor.init();
});

beforeEach(() => {
  jest.clearAllMocks();
  document.getElementById("source-code").value = "";
  document.getElementById("source-line-numbers").textContent = "";
  document.getElementById("output-code").textContent = "";
  document.getElementById("output-line-numbers").textContent = "";
  document.getElementById("output-placeholder").classList.remove("hidden");
  document.getElementById("output-loading").classList.add("hidden");
  document.getElementById("provider-badge").classList.add("hidden");
  document.getElementById("copy-btn").disabled = true;
  document.getElementById("download-btn").disabled = true;
  document.getElementById("generate-btn").disabled = false;
  document.getElementById("generate-btn").textContent = "Generate tests";
  Editor._lastResult = null;
});

// ---------------------------------------------------------------------------
// Line numbers
// ---------------------------------------------------------------------------
describe("Editor — line numbers", () => {
  test("shows 1 line number on empty input", () => {
    const el = document.getElementById("source-line-numbers");
    Editor._updateLineNumbers(el, "");
    expect(el.textContent).toBe("1");
  });

  test("shows correct count for multiline input", () => {
    const el = document.getElementById("source-line-numbers");
    Editor._updateLineNumbers(el, "line1\nline2\nline3");
    expect(el.textContent).toBe("1\n2\n3");
  });

  test("updates line numbers on textarea input event", () => {
    const textarea = document.getElementById("source-code");
    textarea.value = "a\nb\nc\nd";
    textarea.dispatchEvent(new Event("input"));
    expect(document.getElementById("source-line-numbers").textContent).toBe("1\n2\n3\n4");
  });
});

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------
describe("Editor — generation", () => {
  test("shows error status if source code is empty", async () => {
    document.getElementById("source-code").value = "";
    document.getElementById("generate-btn").click();
    await Promise.resolve();
    expect(App.setStatus).toHaveBeenCalledWith("No code to analyze.");
  });

  test("calls Api.generateTests with correct args", async () => {
    Api.generateTests.mockResolvedValue({
      test_code: "def test_foo(): pass",
      snippet_id: "abc",
      llm_provider: "mistral",
    });
    document.getElementById("source-code").value = "def foo(): pass";
    document.getElementById("language-select").value = "python";
    document.getElementById("generate-btn").click();
    await Promise.resolve();
    await Promise.resolve();
    expect(Api.generateTests).toHaveBeenCalledWith("def foo(): pass", "python");
  });

  test("enables copy and download buttons after successful generation", async () => {
    Api.generateTests.mockResolvedValue({
      test_code: "def test_foo(): pass",
      snippet_id: "abc",
      llm_provider: "mistral",
    });
    document.getElementById("source-code").value = "def foo(): pass";
    document.getElementById("generate-btn").click();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.getElementById("copy-btn").disabled).toBe(false);
    expect(document.getElementById("download-btn").disabled).toBe(false);
  });

  test("shows provider badge after successful generation", async () => {
    Api.generateTests.mockResolvedValue({
      test_code: "def test_foo(): pass",
      snippet_id: "abc",
      llm_provider: "groq",
    });
    document.getElementById("source-code").value = "def foo(): pass";
    document.getElementById("generate-btn").click();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.getElementById("provider-badge").textContent).toBe("groq");
    expect(document.getElementById("provider-badge").classList.contains("hidden")).toBe(false);
  });

  test("sets error status on failed generation", async () => {
    Api.generateTests.mockRejectedValue(new Error("LLM unavailable"));
    document.getElementById("source-code").value = "def foo(): pass";
    document.getElementById("generate-btn").click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(App.setStatus).toHaveBeenCalledWith("LLM unavailable");
  });

  test("re-enables generate button after generation", async () => {
    Api.generateTests.mockResolvedValue({
      test_code: "def test_foo(): pass",
      snippet_id: "abc",
      llm_provider: "mistral",
    });
    document.getElementById("source-code").value = "def foo(): pass";
    document.getElementById("generate-btn").click();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.getElementById("generate-btn").disabled).toBe(false);
    expect(document.getElementById("generate-btn").textContent).toBe("Generate tests");
  });
});

// ---------------------------------------------------------------------------
// Prefill from history
// ---------------------------------------------------------------------------
describe("Editor — loadPrefill", () => {
  test("does nothing if no sessionStorage data", () => {
    sessionStorage.clear();
    Editor.loadPrefill();
    expect(document.getElementById("source-code").value).toBe("");
  });

  test("fills source code and language from sessionStorage", () => {
    sessionStorage.setItem("editor_prefill_code", "def foo(): pass");
    sessionStorage.setItem("editor_prefill_lang", "python");
    sessionStorage.removeItem("editor_prefill_tests");
    Editor.loadPrefill();
    expect(document.getElementById("source-code").value).toBe("def foo(): pass");
    expect(document.getElementById("language-select").value).toBe("python");
  });

  test("clears sessionStorage after loading", () => {
    sessionStorage.setItem("editor_prefill_code", "def foo(): pass");
    sessionStorage.setItem("editor_prefill_lang", "python");
    Editor.loadPrefill();
    expect(sessionStorage.getItem("editor_prefill_code")).toBeNull();
    expect(sessionStorage.getItem("editor_prefill_lang")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------
describe("Editor — reset", () => {
  test("clears source code", () => {
    document.getElementById("source-code").value = "some code";
    Editor.reset();
    expect(document.getElementById("source-code").value).toBe("");
  });

  test("hides provider badge", () => {
    document.getElementById("provider-badge").classList.remove("hidden");
    Editor.reset();
    expect(document.getElementById("provider-badge").classList.contains("hidden")).toBe(true);
  });

  test("disables copy and download buttons", () => {
    document.getElementById("copy-btn").disabled = false;
    document.getElementById("download-btn").disabled = false;
    Editor.reset();
    expect(document.getElementById("copy-btn").disabled).toBe(true);
    expect(document.getElementById("download-btn").disabled).toBe(true);
  });

  test("sets _lastResult to null", () => {
    Editor._lastResult = { test_code: "something" };
    Editor.reset();
    expect(Editor._lastResult).toBeNull();
  });
});