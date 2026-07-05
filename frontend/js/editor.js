/**
 * editor.js
 * Handles the editor view: source code input, language selection,
 * file upload, test generation, and rendering of the generated output.
 */

const Editor = {
  _lastResult: null, // { test_code, llm_provider, language }

  init() {
    this._sourceInput = document.getElementById("source-code");
    this._sourceLineNumbers = document.getElementById("source-line-numbers");
    this._outputLineNumbers = document.getElementById("output-line-numbers");
    this._outputPre = document.getElementById("output-pre");
    this._outputCode = document.getElementById("output-code");
    this._placeholder = document.getElementById("output-placeholder");
    this._loading = document.getElementById("output-loading");
    this._providerBadge = document.getElementById("provider-badge");
    this._languageSelect = document.getElementById("language-select");
    this._copyBtn = document.getElementById("copy-btn");
    this._downloadBtn = document.getElementById("download-btn");
    this._generateBtn = document.getElementById("generate-btn");
    this._fileUpload = document.getElementById("file-upload");

    this._wireSourceLineNumbers();
    this._wireFileUpload();
    this._wireGenerate();
    this._wireCopyDownload();

    this._updateLineNumbers(this._sourceLineNumbers, "");
  },

  // -------------------------------------------------------------------
  // Pre-fill from history
  // -------------------------------------------------------------------
  loadPrefill() {
    const prefillCode = sessionStorage.getItem("editor_prefill_code");
    const prefillLang = sessionStorage.getItem("editor_prefill_lang");
    const prefillTests = sessionStorage.getItem("editor_prefill_tests");
    if (!prefillCode) return;

    this._sourceInput.value = prefillCode;
    this._updateLineNumbers(this._sourceLineNumbers, prefillCode);
    if (prefillLang) this._languageSelect.value = prefillLang;
    if (prefillTests && prefillTests !== "(No tests — generation failed)") {
      this._renderOutput(prefillTests, prefillLang || "python");
      this._copyBtn.disabled = false;
      this._downloadBtn.disabled = false;
    }

    sessionStorage.removeItem("editor_prefill_code");
    sessionStorage.removeItem("editor_prefill_lang");
    sessionStorage.removeItem("editor_prefill_tests");
  },

  // -------------------------------------------------------------------
  // Line numbers (source editor)
  // -------------------------------------------------------------------
  _wireSourceLineNumbers() {
    this._sourceInput.addEventListener("input", () => {
      this._updateLineNumbers(this._sourceLineNumbers, this._sourceInput.value);
    });
    this._sourceInput.addEventListener("scroll", () => {
      this._sourceLineNumbers.scrollTop = this._sourceInput.scrollTop;
    });
    this._sourceInput.addEventListener("input", () => {
      this._updateLineNumbers(this._sourceLineNumbers, this._sourceInput.value);
      this._autoDetectLanguage();
    });
  },

  _updateLineNumbers(el, text) {
    const lineCount = Math.max(1, text.split("\n").length);
    el.textContent = Array.from({ length: lineCount }, (_, i) => i + 1).join("\n");
  },

  // -------------------------------------------------------------------
  // Language detection
  // -------------------------------------------------------------------
  _autoDetectLanguage() {
    const code = this._sourceInput.value.trim();
    if (!code || code.length < 30) return; // too short to detect reliably

    // Pre-filter: Java signatures
    if (/\bSystem\.out\.println\b/.test(code) || /\bpublic\s+static\s+void\s+main\b/.test(code)) {
      this._languageSelect.value = "java";
      return;
    }
    // Pre-filter: C/C++ signatures
    if (/^\s*#include\s*[<"]/.test(code)) {
      this._languageSelect.value = "c";
      return;
    }
    // Pre-filter: C# signatures
    if (/\bConsole\.WriteLine\b/.test(code) || /\busing\s+System\b/.test(code) || /\bnamespace\s+\w+/.test(code)) {
      this._languageSelect.value = "csharp";
      return;
    }
    // Pre-filter: Go signatures
    if (/\bpackage\s+main\b/.test(code) || /\bfunc\s+\w+\s*\(/.test(code)) {
      this._languageSelect.value = "go";
      return;
    }
    // Pre-filter: Ruby signatures
    if (/\bend\b/.test(code) && /\bdef\s+\w+/.test(code)) {
      this._languageSelect.value = "ruby";
      return;
    }
    // Pre-filter: Rust signatures
    if (/\bfn\s+\w+\s*\(/.test(code) || /\blet\s+mut\b/.test(code) || /println!\s*\(/.test(code)) {
      this._languageSelect.value = "rust";
      return;
    }

    const result = hljs.highlightAuto(code, [
      "python", "javascript", "java", "c",
      "csharp", "go", "ruby", "rust"
    ]);

    const langMap = {
      python: "python",
      javascript: "javascript",
      typescript: "typescript",
      java: "java",
      c: "c",
      cpp: "cpp",
      csharp: "csharp",
      go: "go",
      ruby: "ruby",
      rust: "rust",
    };

    if (result.language && langMap[result.language]) {
      this._languageSelect.value = langMap[result.language];
    }
  },

  // -------------------------------------------------------------------
  // File upload
  // -------------------------------------------------------------------
  _wireFileUpload() {
    this._fileUpload.addEventListener("change", async () => {
      const file = this._fileUpload.files[0];
      if (!file) return;

      const text = await file.text();
      this._sourceInput.value = text;
      this._updateLineNumbers(this._sourceLineNumbers, text);

      // Best-effort: guess language from extension
      const ext = file.name.split(".").pop().toLowerCase();
      const extMap = { py: "python", js: "javascript", java: "java", c: "c", rb: "ruby", go: "go" };
      if (extMap[ext]) this._languageSelect.value = extMap[ext];

      this._fileUpload.value = "";
    });
  },

  // -------------------------------------------------------------------
  // Generation
  // -------------------------------------------------------------------
  _wireGenerate() {
    this._generateBtn.addEventListener("click", () => this._handleGenerate());
  },

  async _handleGenerate() {
    const sourceCode = this._sourceInput.value.trim();
    const language = this._languageSelect.value;

    if (!sourceCode) {
      window.App.setStatus("No code to analyze.");
      return;
    }

    this._setLoadingState(true);
    window.App.setStatus("Generating...");

    try {
      const result = await Api.generateTests(sourceCode, language);
      this._lastResult = { ...result, language };
      this._renderOutput(result.test_code, language);
      this._providerBadge.textContent = result.llm_provider;
      this._providerBadge.classList.remove("hidden");
      this._copyBtn.disabled = false;
      this._downloadBtn.disabled = false;
      window.App.setStatus("Tests generated successfully");
    } catch (err) {
      window.App.setStatus(err.message || "Generation failed");
    } finally {
      this._setLoadingState(false);
    }
  },

  _setLoadingState(isLoading) {
    this._generateBtn.disabled = isLoading;
    this._generateBtn.textContent = isLoading ? "Generating..." : "Generate tests";
    this._loading.classList.toggle("hidden", !isLoading);
    if (isLoading) this._placeholder.classList.add("hidden");
  },

  // -------------------------------------------------------------------
  // Output rendering (syntax highlighting + line numbers)
  // -------------------------------------------------------------------
  _renderOutput(testCode, language) {
    this._placeholder.classList.add("hidden");
    this._outputCode.removeAttribute("class");
    this._outputCode.removeAttribute("data-highlighted");
    this._outputCode.textContent = testCode;

    // Only python/javascript hljs language packs are loaded via CDN;
    // for other languages, let hljs auto-detect among the loaded ones.
    this._outputCode.className = ["python", "javascript"].includes(language)
      ? `hljs language-${language}`
      : "hljs";

    hljs.highlightElement(this._outputCode);
    this._updateLineNumbers(this._outputLineNumbers, testCode);

    this._outputPre.onscroll = () => {
      this._outputLineNumbers.scrollTop = this._outputPre.scrollTop;
    };
  },

  // -------------------------------------------------------------------
  // Copy / download
  // -------------------------------------------------------------------
  _wireCopyDownload() {
    this._copyBtn.addEventListener("click", async () => {
      if (!this._lastResult || this._copyBtn.dataset.copying) return;
      this._copyBtn.dataset.copying = "1";
      await navigator.clipboard.writeText(this._lastResult.test_code);
      this._copyBtn.textContent = "Copied!";
      setTimeout(() => {
        this._copyBtn.textContent = "Copy";
        delete this._copyBtn.dataset.copying;
      }, 1500);
    });

    this._downloadBtn.addEventListener("click", () => {
      if (!this._lastResult) return;
      const short = this._lastResult.snippet_id.slice(0, 6);
      const lang = this._lastResult.language;
      const filenameMap = {
        python:     () => `test_file_${short}.py`,
        javascript: () => `file_${short}.test.js`,
        typescript: () => `file_${short}.test.ts`,
        java:       () => `File_${short}Test.java`,
        go:         () => `file_${short}_test.go`,
        ruby:       () => `file_${short}_test.rb`,
        rust:       () => `file_${short}_test.rs`,
        c:          () => `file_${short}_test.c`,
        cpp:        () => `file_${short}_test.cpp`,
        csharp:     () => `File_${short}Test.cs`,
      };
      const filename = (filenameMap[lang] || filenameMap["python"])();
      const blob = new Blob([this._lastResult.test_code], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
  },

  // -------------------------------------------------------------------
  // Reset when leaving/entering the view
  // -------------------------------------------------------------------
  reset() {
    this._lastResult = null;
    this._sourceInput.value = "";
    this._updateLineNumbers(this._sourceLineNumbers, "");
    this._outputCode.textContent = "";
    this._outputLineNumbers.textContent = "";
    this._placeholder.classList.remove("hidden");
    this._providerBadge.classList.add("hidden");
    this._copyBtn.disabled = true;
    this._downloadBtn.disabled = true;
  },
};

if (typeof module !== "undefined") module.exports = { Editor };
