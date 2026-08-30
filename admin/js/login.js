const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const initLogin = () => {
  const form = document.querySelector("[data-login-form]");
  if (!form) {
    return;
  }

  if (AdminAuth.redirectIfAuthenticated()) {
    return;
  }

  const banner = document.querySelector("[data-form-banner]");
  const submit = document.querySelector("[data-login-submit]");
  const toggle = document.querySelector("[data-toggle-password]");
  const passwordInput = document.getElementById("password");

  const setError = (name, message) => {
    const field = form.querySelector(`[name="${name}"]`);
    const error = form.querySelector(`[data-error="${name}"]`);
    if (field) {
      field.classList.toggle("is-invalid", Boolean(message));
      field.setAttribute("aria-invalid", message ? "true" : "false");
    }
    if (error) {
      error.hidden = !message;
      error.textContent = message || "";
    }
  };

  const clearErrors = () => {
    ["email", "password"].forEach((name) => setError(name, ""));
    banner.hidden = true;
    banner.textContent = "";
  };

  const showBanner = (message) => {
    banner.hidden = false;
    banner.textContent = message;
  };

  const validate = (email, password) => {
    clearErrors();
    let valid = true;

    if (!isEmail(email)) {
      setError("email", "Indiquez une adresse email valide.");
      valid = false;
    }
    if (password.length < 8) {
      setError("password", "Le mot de passe doit contenir au moins 8 caractères.");
      valid = false;
    }

    if (!valid) {
      showBanner("Veuillez corriger les champs indiqués.");
    }

    return valid;
  };

  toggle.addEventListener("click", () => {
    const hidden = passwordInput.type === "password";
    passwordInput.type = hidden ? "text" : "password";
    toggle.setAttribute("aria-pressed", String(hidden));
    toggle.setAttribute("aria-label", hidden ? "Masquer le mot de passe" : "Afficher le mot de passe");
    toggle.querySelector(".icon-eye").hidden = hidden;
    toggle.querySelector(".icon-eye-off").hidden = !hidden;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = String(new FormData(form).get("email") || "").trim();
    const password = String(new FormData(form).get("password") || "");

    if (!validate(email, password)) {
      form.querySelector(".is-invalid")?.focus();
      return;
    }

    submit.disabled = true;
    submit.setAttribute("aria-busy", "true");
    submit.textContent = "Connexion…";

    try {
      // Temporary frontend session only. Later: POST /api/auth/login and store the JWT.
      await new Promise((resolve) => window.setTimeout(resolve, 280));
      AdminAuth.startDemoSession(email);
      AdminAuth.goHome();
    } catch {
      showBanner("La connexion a échoué. Réessayez dans un instant.");
      submit.disabled = false;
      submit.removeAttribute("aria-busy");
      submit.textContent = "Se connecter";
    }
  });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLogin);
} else {
  initLogin();
}
