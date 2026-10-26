const SLUG_TO_CATEGORY = {
  tous: "tous",
  bouquets: "Bouquets",
  roses: "Roses",
  plantes: "Plantes",
  "fleurs-sechees": "Fleurs séchées",
  compositions: "Compositions",
  cadeaux: "Cadeaux",
};

const CATEGORY_TO_SLUG = {
  tous: "tous",
  Bouquets: "bouquets",
  Roses: "roses",
  Plantes: "plantes",
  "Fleurs séchées": "fleurs-sechees",
  Compositions: "compositions",
  Cadeaux: "cadeaux",
};

const normalize = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const getQueryParam = (name) => {
  const fromSearch = new URLSearchParams(window.location.search).get(name);
  if (fromSearch) {
    return fromSearch.trim();
  }

  const match = window.location.href.match(new RegExp(`[?&]${name}=([^&#]*)`, "i"));
  return match ? decodeURIComponent(match[1]).trim() : "";
};

const parseHash = () => {
  const raw = decodeURIComponent(window.location.hash.replace(/^#/, "")).trim();
  if (!raw) {
    return { slug: "", query: "" };
  }
  if (raw.startsWith("q=")) {
    return { slug: "", query: raw.slice(2) };
  }
  return { slug: raw.toLowerCase(), query: "" };
};

const initCatalog = async () => {
  const catalog = document.querySelector("[data-catalog]");
  if (!catalog) {
    return;
  }

  if (typeof ProductCatalog !== "undefined") {
    await ProductCatalog.ready();
  }

  const grid = catalog.querySelector("[data-product-grid]");
  const count = catalog.querySelector("[data-catalog-count]");
  const empty = catalog.querySelector("[data-empty]");
  const searchField = catalog.querySelector("[data-catalog-search]");
  const chips = [...catalog.querySelectorAll("[data-filter]")];
  const hash = parseHash();
  const slug = (getQueryParam("categorie") || hash.slug).toLowerCase();

  let activeCategory = SLUG_TO_CATEGORY[slug] || "tous";
  let searchQuery = getQueryParam("q") || hash.query;

  searchField.value = searchQuery;

  const matches = (product) => {
    const categoryOk = activeCategory === "tous" || product.category === activeCategory;
    const query = normalize(searchQuery);
    const searchOk =
      !query ||
      [product.name, product.category, product.description].some((field) =>
        normalize(field).includes(query)
      );
    return categoryOk && searchOk;
  };

  const updateUrl = () => {
    const next = new URLSearchParams();
    if (activeCategory !== "tous") {
      next.set("categorie", CATEGORY_TO_SLUG[activeCategory]);
    }
    if (searchQuery.trim()) {
      next.set("q", searchQuery.trim());
    }
    const query = next.toString();
    const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState({}, "", url);
  };

  const render = () => {
    const visible = PRODUCTS.filter(matches);

    chips.forEach((chip) => {
      const selected = chip.dataset.filter === activeCategory;
      chip.classList.toggle("is-active", selected);
      chip.setAttribute("aria-pressed", String(selected));
    });

    count.textContent =
      visible.length <= 1 ? `${visible.length} création` : `${visible.length} créations`;

    empty.hidden = visible.length > 0;
    grid.hidden = visible.length === 0;
    grid.innerHTML = visible
      .map(
        (product) => `
          <article class="product-card">
            <a class="product-card__hit" href="produit.html#${escapeHtml(product.id)}">
              <div class="product-card__media">
                <img src="${product.image}" alt="${escapeHtml(product.alt)}" loading="lazy" />
                <span class="product-card__tag">${escapeHtml(product.category)}</span>
              </div>
              <div class="product-card__body">
                <h3>${escapeHtml(product.name)}</h3>
                <p class="product-card__price">${formatProductPriceHtml(product)}</p>
                <p class="product-card__text">${escapeHtml(product.description)}</p>
              </div>
            </a>
            <div class="product-card__actions">
              <a class="btn btn--ghost" href="produit.html#${escapeHtml(product.id)}">Voir le produit</a>
              <button class="btn btn--line" type="button" data-add-cart data-product-id="${escapeHtml(product.id)}">Ajouter au panier</button>
            </div>
          </article>
        `
      )
      .join("");
  };

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      activeCategory = chip.dataset.filter;
      updateUrl();
      render();
    });
  });

  searchField.addEventListener("input", () => {
    searchQuery = searchField.value;
    updateUrl();
    render();
  });

  window.addEventListener("catalog-search", (event) => {
    searchQuery = event.detail.query || "";
    searchField.value = searchQuery;
    updateUrl();
    render();
  });

  window.addEventListener("hashchange", () => {
    const next = parseHash();
    if (next.query) {
      searchQuery = next.query;
      searchField.value = searchQuery;
    } else if (next.slug && SLUG_TO_CATEGORY[next.slug]) {
      activeCategory = SLUG_TO_CATEGORY[next.slug];
    }
    render();
  });

  render();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCatalog);
} else {
  initCatalog();
}
