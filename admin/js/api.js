const ADMIN_IS_LOCAL = ["localhost", "127.0.0.1", "[::1]", ""].includes(window.location.hostname);
// Same-origin /api on Vercel; localhost backend when developing locally.
const ADMIN_API_BASE = ADMIN_IS_LOCAL ? "http://localhost:5000" : "";

const AdminApi = {
  base: ADMIN_API_BASE,

  url(path) {
    return `${this.base}${path}`;
  },

  async uploadImage(file) {
    const cloudName = String(CloudinaryConfig?.cloudName || "").trim();
    const uploadPreset = String(CloudinaryConfig?.uploadPreset || "").trim();

    if (!cloudName || !uploadPreset) {
      const error = new Error(
        "Le téléchargement d'image n'est pas configuré. Indiquez uniquement le cloud name Cloudinary dans admin/js/cloudinary-config.js."
      );
      error.status = 0;
      throw error;
    }

    const body = new FormData();
    body.append("file", file);
    body.append("upload_preset", uploadPreset);

    let response;
    try {
      response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body,
      });
    } catch {
      const error = new Error(
        "Impossible de télécharger l'image. Vérifiez votre connexion, puis réessayez."
      );
      error.status = 0;
      throw error;
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const imageUrl = payload && payload.secure_url;
    if (!response.ok || !imageUrl) {
      const detail = payload && payload.error && payload.error.message;
      const looksLikeMissingCloud =
        !detail || /unknown api key/i.test(detail) || /unknown cloud/i.test(detail);
      const error = new Error(
        looksLikeMissingCloud
          ? "Le cloud name Cloudinary est invalide. Vérifiez-le dans admin/js/cloudinary-config.js."
          : detail
      );
      error.status = response.status;
      throw error;
    }

    return imageUrl;
  },

  async request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    if (!headers.Authorization && typeof AdminAuth !== "undefined") {
      const token = AdminAuth.getToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    let response;
    try {
      response = await fetch(this.url(path), { ...options, headers });
    } catch {
      const error = new Error(
        ADMIN_IS_LOCAL
          ? "Impossible de joindre le serveur. Vérifiez que l'API est démarrée sur http://localhost:5000."
          : "Impossible de joindre l'API. Vérifiez le déploiement Vercel et les variables d'environnement."
      );
      error.status = 0;
      throw error;
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const error = new Error((payload && payload.message) || "La requête a échoué.");
      error.status = response.status;
      error.errors = payload && payload.errors;
      throw error;
    }

    return payload;
  },
};
