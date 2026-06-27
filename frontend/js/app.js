/**
 * app.js
 * Application bootstrap: routing between the 3 views,
 * navbar wiring, status bar, and auth-gated navigation.
 */

const App = {
  _routes: ["editor", "history"], // routes available once logged in

  init() {
    Auth.init();
    Editor.init();
    History.init();

    this._navbar = document.getElementById("navbar");
    this._statusbar = document.getElementById("statusbar");
    this._avatar = document.getElementById("user-avatar");

    this._wireNavbar();
    this._wireLogout();
    window.addEventListener("hashchange", () => this._handleHashChange());

    // Entry point: go straight to the editor if a valid session exists,
    // otherwise show the auth view.
    if (Api.isLoggedIn()) {
      const currentRoute = location.hash.replace("#/", "");
      this.navigate(this._routes.includes(currentRoute) ? currentRoute : "editor");
    } else {
      this.navigate("auth");
    }

      document.body.style.visibility = "visible";
  },

  // -------------------------------------------------------------------
  // Navbar
  // -------------------------------------------------------------------
  _wireNavbar() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.navigate(btn.dataset.route));
    });
  },

  _wireLogout() {
    document.getElementById("logout-btn").addEventListener("click", () => {
      Api.clearSession();
      Editor.reset();
      this.navigate("auth");
    });
  },

  _handleHashChange() {
    const route = location.hash.replace("#/", "") || "editor";
    if (Api.isLoggedIn() && this._routes.includes(route)) {
      this.navigate(route, /* skipHashUpdate */ true);
    }
  },

  // -------------------------------------------------------------------
  // Auth transition
  // -------------------------------------------------------------------
  onAuthenticated() {
    const email = Api.getEmail() || "";
    this._avatar.textContent = email.slice(0, 2).toUpperCase() || "--";

    this.navigate("editor");
  },

  // -------------------------------------------------------------------
  // Router
  // -------------------------------------------------------------------
  navigate(route, skipHashUpdate = false) {
    const isAuthRoute = route === "auth";

    document.querySelectorAll(".view").forEach((view) => view.classList.add("hidden"));
    document.getElementById(`view-${route}`).classList.remove("hidden");

    this._navbar.classList.toggle("hidden", isAuthRoute);
    this._statusbar.classList.toggle("hidden", isAuthRoute);

    if (!isAuthRoute) {
      document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.route === route);
      });
      if (!skipHashUpdate) location.hash = `#/${route}`;
    }

    if (route === "history") {
      History.load();
    }

    this.setStatus("Ready");
  },

  // -------------------------------------------------------------------
  // Status bar
  // -------------------------------------------------------------------
  setStatus(message) {
    const el = document.getElementById("status-msg");
    if (el) el.textContent = message;
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());
window.App = App; // exposed so api.js can force a redirect to auth on 401
