/**
 * history.js
 * Handles the history view: fetching the list of past generations,
 * showing detail on click, download and delete actions.
 */

const History = {
  _selectedId: null,

  init() {
    this._tbody = document.getElementById("history-tbody");
    this._table = document.getElementById("history-table");
    this._empty = document.getElementById("history-empty");
    this._detailPlaceholder = document.getElementById("history-detail-placeholder");
    this._detailContent = document.getElementById("history-detail-content");
    this._sourceCodeEl = document.getElementById("history-source-code");
    this._testCodeEl = document.getElementById("history-test-code");
    this._downloadBtn = document.getElementById("history-download-btn");
    this._deleteBtn = document.getElementById("history-delete-btn");

    this._downloadBtn.addEventListener("click", () => this._handleDownload());
    this._deleteBtn.addEventListener("click", () => this._handleDelete());

    this._seeEditorBtn = document.getElementById("history-see-editor-btn");
    this._seeEditorBtn.addEventListener("click", () => this._handleSeeInEditor());

    this._wireDivider();
  },

  // Called by the router every time the history view becomes active
  async load() {
    this._selectedId = null;
    this._showDetailPlaceholder();

    try {
      const items = await Api.getHistory();
      this._renderList(items);
    } catch (err) {
      window.App.setStatus(err.message || "Could not load history");
    }
  },

  // -------------------------------------------------------------------
  // List rendering
  // -------------------------------------------------------------------
  _renderList(items) {
    this._tbody.innerHTML = "";

    if (!items.length) {
      this._table.classList.add("hidden");
      this._empty.classList.remove("hidden");
      return;
    }

    this._table.classList.remove("hidden");
    this._empty.classList.add("hidden");

    for (const item of items) {
      const tr = document.createElement("tr");
      tr.className = "history-row";
      tr.dataset.id = item.id;

      const statusClass = item.status === "success" ? "success" : "error";
      const d = new Date(item.generated_at);
      const date = d.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "Europe/Paris"
      }) + "\u00A0\u00A0\u00A0\u00A0" + d.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris"
      });

      tr.innerHTML = `
        <td>${this._escape(item.language)}</td>
        <td>${this._escape(item.llm_provider)}</td>
        <td><span class="status-pill ${statusClass}">${item.status}</span></td>
        <td>${date}</td>
        <td>›</td>
      `;

      tr.addEventListener("click", () => this._selectEntry(item.id));
      this._tbody.appendChild(tr);
    }
  },

  // -------------------------------------------------------------------
  // Detail view
  // -------------------------------------------------------------------
  async _selectEntry(id) {
    this._selectedId = id;
    this._highlightSelectedRow(id);

    try {
      const detail = await Api.getHistoryDetail(id);
      this._renderDetail(detail);
    } catch (err) {
      window.App.setStatus(err.message || "Could not load details");
    }
  },

  _renderDetail(detail) {
    this._selectedLanguage = detail.language;
    this._detailPlaceholder.classList.add("hidden");
    this._detailContent.classList.remove("hidden");

    this._highlightCode(this._sourceCodeEl, detail.source_code, detail.language);

    if (detail.status === "success" && detail.test_code) {
      this._highlightCode(this._testCodeEl, detail.test_code, detail.language);
    } else {
      this._testCodeEl.innerHTML = "";
      this._testCodeEl.textContent = "(No tests — generation failed)";
      this._testCodeEl.className = "hljs";
    }

    requestAnimationFrame(() => {
      const divider = document.getElementById("detail-divider");
      if (divider) divider.dispatchEvent(new Event("check"));
    });

    const hasTest = detail.status === "success" && detail.test_code;
    this._downloadBtn.disabled = !hasTest;
    this._deleteBtn.disabled = false;
    this._seeEditorBtn.disabled = false;
  },

  _highlightSelectedRow(id) {
    this._tbody.querySelectorAll(".history-row").forEach((row) => {
      row.classList.toggle("selected", row.dataset.id === String(id));
    });
  },

  _showDetailPlaceholder() {
    this._detailPlaceholder.classList.remove("hidden");
    this._detailContent.classList.add("hidden");
    this._downloadBtn.disabled = true;
    this._deleteBtn.disabled = true;
    this._seeEditorBtn.disabled = false;
  },

  // -------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------
  async _handleDownload() {
    if (!this._selectedId) return;
    // Mirrors the backend's extension logic in history.py (download_test):
    // only "javascript" maps to .js, every other language falls back to .py.
    const ext = this._selectedLanguage === "javascript" ? "js" : "py";
    try {
      await Api.downloadTest(this._selectedId, `test_snippet_${this._selectedId}.${ext}`);
    } catch (err) {
      window.App.setStatus(err.message || "Download failed");
    }
  },

  async _handleDelete() {
    if (!this._selectedId) return;
    const confirmed = confirm("Delete this entry permanently?");
    if (!confirmed) return;

    try {
      await Api.deleteHistoryEntry(this._selectedId);
      window.App.setStatus("Entry deleted");
      await this.load();
    } catch (err) {
      window.App.setStatus(err.message || "Delete failed");
    }
  },

  _handleSeeInEditor() {
    if (!this._selectedId) return;
    sessionStorage.setItem("editor_prefill_code", this._sourceCodeEl.textContent);
    sessionStorage.setItem("editor_prefill_lang", this._selectedLanguage);
    sessionStorage.setItem("editor_prefill_tests", this._testCodeEl.textContent);
    window.App.navigate("editor");
  },

  // -------------------------------------------------------------------
  // Drag resize
  // -------------------------------------------------------------------
  _wireDivider() {
    const divider = document.getElementById("detail-divider");
    const container = document.getElementById("history-detail-content");
    const paneSource = document.getElementById("detail-pane-source");
    const paneTests = document.getElementById("detail-pane-tests");
    let dragging = false;
    let startY, startSourceH;

    const checkIfDragNeeded = () => {
      paneSource.style.flex = "";
      paneSource.style.height = "";
      paneTests.style.flex = "";
      paneTests.style.height = "";

      const wrapSource = paneSource.querySelector(".code-scroll-wrap");
      const wrapTests = paneTests.querySelector(".code-scroll-wrap");
      const labelSource = paneSource.querySelector(".detail-label");
      const labelTests = paneTests.querySelector(".detail-label");

      const naturalSource = labelSource.offsetHeight + wrapSource.scrollHeight + 14;
      const naturalTests = labelTests.offsetHeight + wrapTests.scrollHeight + 14;
      const containerH = container.clientHeight;
      const gap = 6;

      if (naturalSource + naturalTests + gap <= containerH) {
        paneSource.style.flex = "none";
        paneSource.style.height = "auto";
        paneTests.style.flex = "none";
        paneTests.style.height = "auto";
        divider.style.display = "none";
      } else {
        divider.style.display = "";
      }
    };

    divider.addEventListener("check", checkIfDragNeeded);

    divider.addEventListener("mousedown", (e) => {
      dragging = true;
      divider.classList.add("dragging");
      document.body.style.userSelect = "none";
      startY = e.clientY;
      startSourceH = paneSource.getBoundingClientRect().height;
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;

      const containerH = container.getBoundingClientRect().height;
      const gap = 6;
      const totalH = containerH - gap;
      const minH = totalH * 0.2;

      const delta = e.clientY - startY;
      let newSourceH = startSourceH + delta;
      newSourceH = Math.max(minH, Math.min(totalH - minH, newSourceH));

      paneSource.style.flex = "none";
      paneSource.style.height = newSourceH + "px";
      paneTests.style.flex = "none";
      paneTests.style.height = (totalH - newSourceH) + "px";
    });

    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      divider.classList.remove("dragging");
      document.body.style.userSelect = "";
    });
  },

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------
  _highlightCode(el, code, language) {
    const supported = ["python", "javascript"];
    const lang = supported.includes(language) ? language : undefined;
    const result = lang
      ? hljs.highlight(code, { language: lang })
      : hljs.highlightAuto(code);
    el.innerHTML = result.value;
    el.className = `hljs${result.language ? ` language-${result.language}` : ""}`;
  },

  _escape(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  },
};

if (typeof module !== "undefined") module.exports = { History };
