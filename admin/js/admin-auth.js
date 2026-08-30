const ADMIN_TOKEN_KEY = "elegance-vegetal-admin-token";
const ADMIN_KEY = "elegance-vegetal-admin";
const ADMIN_LOGIN_PAGE = "index.html";
const ADMIN_HOME_PAGE = "dashboard.html";

// Temporary frontend session for development only.
// Later this helper will store a backend JWT from POST /api/auth/login.

const createDemoToken = () => {
  const stamp = Date.now().toString(36);
  const noise = Math.random().toString(36).slice(2, 10);
  return `demo.${stamp}.${noise}`;
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
    return Boolean(this.getToken() && this.getAdmin());
  },

  startSession({ token, admin }) {
    // Later: persist the JWT returned by POST /api/auth/login
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    sessionStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
  },

  startDemoSession(email) {
    const local = email.split("@")[0] || "Atelier";
    this.startSession({
      token: createDemoToken(),
      admin: { email, fullName: local },
    });
  },

  clearSession() {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_KEY);
  },

  logout() {
    this.clearSession();
    window.location.replace(ADMIN_LOGIN_PAGE);
  },

  goHome() {
    window.location.replace(ADMIN_HOME_PAGE);
  },

  protectPage() {
    if (!this.isAuthenticated()) {
      document.documentElement.setAttribute("data-admin-locked", "");
      window.location.replace(ADMIN_LOGIN_PAGE);
      return false;
    }

    window.addEventListener("pageshow", () => {
      if (!this.isAuthenticated()) {
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
    return false;
  },
};

if (document.currentScript?.dataset.protect === "page") {
  AdminAuth.protectPage();
}

if (document.currentScript?.dataset.protect === "guest") {
  AdminAuth.redirectIfAuthenticated();
}
