const ADMIN_TOKEN_KEY = "elegance-vegetal-admin-token";
const ADMIN_KEY = "elegance-vegetal-admin";
const ADMIN_LOGIN_PAGE = "index.html";
const ADMIN_HOME_PAGE = "dashboard.html";

const isJwtShape = (token) => {
  const parts = String(token || "").split(".");
  return parts.length === 3 && parts.every(Boolean) && !token.startsWith("demo.");
};

const AdminAuth = {
  tokenKey: ADMIN_TOKEN_KEY,
  adminKey: ADMIN_KEY,

  getToken() {
    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    return typeof token === "string" ? token.trim() : "";
  },

  getAdmin() {
    try {
      const stored = JSON.parse(sessionStorage.getItem(ADMIN_KEY));
      if (stored && typeof stored.email === "string" && stored.email.trim()) {
        return stored;
      }
    } catch {
      /* invalid payload */
    }
    return null;
  },

  displayName() {
    const admin = this.getAdmin();
    return admin?.fullName || admin?.email || "Atelier";
  },

  isAuthenticated() {
    return Boolean(isJwtShape(this.getToken()) && this.getAdmin());
  },

  startSession({ token, admin }) {
    if (!isJwtShape(token) || !admin || !admin.email) {
      throw new Error("Invalid authentication session.");
    }
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    sessionStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
  },

  clearSession() {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_KEY);
  },

  logout() {
    const token = this.getToken();
    this.clearSession();

    if (typeof AdminApi !== "undefined" && token) {
      AdminApi.request("/api/auth/logout", { method: "POST" }).catch(() => {
        /* Stateless JWT: local session is already cleared. */
      });
    }

    window.location.replace(ADMIN_LOGIN_PAGE);
  },

  goHome() {
    window.location.replace(ADMIN_HOME_PAGE);
  },

  protectPage() {
    if (!this.isAuthenticated()) {
      this.clearSession();
      document.documentElement.setAttribute("data-admin-locked", "");
      window.location.replace(ADMIN_LOGIN_PAGE);
      return false;
    }

    window.addEventListener("pageshow", () => {
      if (!this.isAuthenticated()) {
        this.clearSession();
        document.documentElement.setAttribute("data-admin-locked", "");
        window.location.replace(ADMIN_LOGIN_PAGE);
      }
    });

    return true;
  },

  redirectIfAuthenticated() {
    if (this.isAuthenticated()) {
      window.location.replace(ADMIN_HOME_PAGE);
      return true;
    }
    this.clearSession();
    return false;
  },
};

if (document.currentScript?.dataset.protect === "page") {
  AdminAuth.protectPage();
}

if (document.currentScript?.dataset.protect === "guest") {
  AdminAuth.redirectIfAuthenticated();
}
