const formatAdminPrice = (price) =>
  `${Number(price).toLocaleString("fr-FR").replace(/\s/g, "\u00a0")}\u00a0DA`;

const formatAdminDate = (iso) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

const escapeAdminHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const readAdminName = () => AdminAuth.displayName();

const initAdminShell = () => {
  const page = document.querySelector("[data-admin-shell]");
  if (!page) {
    return;
  }

  const overlay = page.querySelector("[data-sidebar-overlay]");
  const sidebar = page.querySelector("[data-sidebar]");
  const openBtn = page.querySelector("[data-open-sidebar]");
  const nameEl = page.querySelector("[data-admin-name]");

  const setMenu = (open) => {
    sidebar.classList.toggle("is-open", open);
    overlay.hidden = !open;
    openBtn.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("is-locked", open);
  };

  openBtn.addEventListener("click", () => setMenu(true));
  page.querySelectorAll("[data-close-sidebar]").forEach((el) => {
    el.addEventListener("click", () => setMenu(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && sidebar.classList.contains("is-open")) {
      setMenu(false);
    }
  });

  page.querySelectorAll("[data-logout]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      AdminAuth.logout();
    });
  });

  if (nameEl) {
    nameEl.textContent = readAdminName();
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAdminShell);
} else {
  initAdminShell();
}
