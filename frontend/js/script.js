document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  const initFeaturedProducts = async () => {
    const grid = document.querySelector("[data-featured-grid]");
    if (!grid || typeof getProductById !== "function") {
      return;
    }

    if (typeof ProductCatalog !== "undefined") {
      await ProductCatalog.ready();
    }

    const featuredIds = [
      "eternel",
      "damas",
      "monstera",
      "champetre",
      "neige",
      "luna",
      "orchidee",
      "valentine",
    ];

    grid.innerHTML = featuredIds
      .map((id) => getProductById(id))
      .filter(Boolean)
      .map(
        (product) => `
          <article class="product-card">
            <a class="product-card__hit" href="pages/produit.html#${escapeHtml(product.id)}">
              <div class="product-card__media">
                <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.alt)}" loading="lazy" />
                <span class="product-card__tag">${escapeHtml(product.category)}</span>
              </div>
              <div class="product-card__body">
                <h3>${escapeHtml(product.name)}</h3>
                <p class="product-card__price">${formatPrice(product.price)}</p>
                <p class="product-card__text">${escapeHtml(product.description)}</p>
              </div>
            </a>
            <div class="product-card__actions">
              <a class="btn btn--ghost" href="pages/produit.html#${escapeHtml(product.id)}">Voir le produit</a>
              <button class="btn btn--line" type="button" data-add-cart data-product-id="${escapeHtml(product.id)}">Ajouter au panier</button>
            </div>
          </article>
        `
      )
      .join("");
  };

  initFeaturedProducts();
  const drawer = document.getElementById("menu-mobile");
  const overlay = document.querySelector(".drawer-overlay");
  const menuButton = document.querySelector("[data-open-menu]");
  const searchOverlay = document.getElementById("recherche");
  const searchInput = document.getElementById("search-input");
  const toast = document.querySelector("[data-toast]");

  let toastTimer;

  const setMenuState = (open) => {
    drawer.classList.toggle("is-open", open);
    drawer.setAttribute("aria-hidden", String(!open));
    overlay.hidden = !open;
    menuButton.setAttribute("aria-expanded", String(open));
    body.classList.toggle("is-locked", open || !searchOverlay.hidden);
  };

  const setSearchState = (open) => {
    searchOverlay.hidden = !open;
    body.classList.toggle("is-locked", open || drawer.classList.contains("is-open"));
    if (open) {
      searchInput.focus();
    }
  };

  const updateCart = () => {
    if (typeof Cart !== "undefined") {
      Cart.syncBadge();
    }
  };

  const showToast = (message) => {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 1800);
  };

  menuButton.addEventListener("click", () => setMenuState(true));
  document.querySelectorAll("[data-close-menu]").forEach((el) => {
    el.addEventListener("click", () => setMenuState(false));
  });

  drawer.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMenuState(false));
  });

  document.querySelector("[data-open-search]").addEventListener("click", () => {
    setMenuState(false);
    setSearchState(true);
  });

  document.querySelector("[data-close-search]").addEventListener("click", () => {
    setSearchState(false);
  });

  searchOverlay.addEventListener("click", (event) => {
    if (event.target === searchOverlay) {
      setSearchState(false);
    }
  });

  document.querySelector("[data-search-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    const query = searchInput.value.trim();
    setSearchState(false);

    if (document.querySelector("[data-catalog]")) {
      window.dispatchEvent(new CustomEvent("catalog-search", { detail: { query } }));
      return;
    }

    const catalogPage =
      event.currentTarget.getAttribute("data-catalog-url") || "pages/produits.html";
    window.location.href = query
      ? `${catalogPage}#q=${encodeURIComponent(query)}`
      : catalogPage;
  });

  document.body.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-cart]");
    if (!button) {
      return;
    }

    const qtyEl = button.closest("[data-product-buy]")?.querySelector("[data-qty-value]");
    const amount = qtyEl ? Math.max(1, parseInt(qtyEl.textContent, 10) || 1) : 1;

    const productId =
      button.dataset.productId ||
      button.closest("[data-product-id]")?.dataset.productId ||
      (typeof getProductIdFromLocation === "function" ? getProductIdFromLocation() : "");

    if (!productId || typeof Cart === "undefined" || !Cart.add(productId, amount)) {
      return;
    }

    updateCart();
    button.classList.add("is-added");
    button.textContent = "Ajouté";
    showToast("Ajouté au panier");
    setTimeout(() => {
      button.classList.remove("is-added");
      button.textContent = "Ajouter au panier";
    }, 1200);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMenuState(false);
      setSearchState(false);
    }
  });
});
