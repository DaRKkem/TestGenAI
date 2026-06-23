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
      const date = new Date(item.generated_at).toLocaleString("en-US", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
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

    this._sourceCodeEl.textContent = detail.source_code;
    this._sourceCodeEl.className = ["python", "javascript"].includes(detail.language)
      ? `hljs language-${detail.language}`
      : "hljs";
    hljs.highlightElement(this._sourceCodeEl);

    this._testCodeEl.textContent = detail.test_code || "(No tests — generation failed)";
    this._testCodeEl.className = ["python", "javascript"].includes(detail.language)
      ? `hljs language-${detail.language}`
      : "hljs";
    hljs.highlightElement(this._testCodeEl);

    const hasTest = detail.status === "success" && detail.test_code;
    this._downloadBtn.disabled = !hasTest;
    this._deleteBtn.disabled = false;
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

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------
  _escape(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  },
};
