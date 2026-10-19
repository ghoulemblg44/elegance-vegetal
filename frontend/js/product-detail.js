const MAX_QTY = 12;

const relatedCard = (product) => `
  <article class="product-card">
    <a class="product-card__hit" href="#${escapeHtml(product.id)}">
      <div class="product-card__media">
        <img src="${product.image}" alt="${escapeHtml(product.alt)}" loading="lazy" />
        <span class="product-card__tag">${escapeHtml(product.category)}</span>
      </div>
      <div class="product-card__body">
        <h3>${escapeHtml(product.name)}</h3>
        <p class="product-card__price">${formatPrice(product.price)}</p>
        <p class="product-card__text">${escapeHtml(product.description)}</p>
      </div>
    </a>
    <div class="product-card__actions">
      <a class="btn btn--ghost" href="#${escapeHtml(product.id)}">Voir le produit</a>
      <button class="btn btn--line" type="button" data-add-cart data-product-id="${escapeHtml(product.id)}">Ajouter au panier</button>
    </div>
  </article>
`;

const initProductDetail = async () => {
  const view = document.querySelector("[data-product-view]");
  const missing = document.querySelector("[data-product-missing]");
  const related = document.querySelector("[data-related]");
  if (!view || !missing) {
    return;
  }

  if (typeof ProductCatalog !== "undefined") {
    await ProductCatalog.ready();
  }

  const image = view.querySelector("[data-detail-image]");
  const category = view.querySelector("[data-detail-category]");
  const name = view.querySelector("[data-detail-name]");
  const price = view.querySelector("[data-detail-price]");
  const status = view.querySelector("[data-detail-status]");
  const story = view.querySelector("[data-detail-story]");
  const qtyValue = view.querySelector("[data-qty-value]");
  const relatedGrid = document.querySelector("[data-related-grid]");

  const setQty = (value) => {
    const next = Math.min(MAX_QTY, Math.max(1, value));
    qtyValue.textContent = String(next);
  };

  const render = () => {
    const product = getProductById(getProductIdFromLocation());

    if (!product) {
      view.hidden = true;
      missing.hidden = false;
      related.hidden = true;
      document.title = "Produit introuvable — Elégance Végétal";
      return;
    }

    view.hidden = false;
    missing.hidden = true;
    related.hidden = false;

    image.src = product.image;
    image.alt = product.alt;
    category.textContent = product.category;
    name.textContent = product.name;
    price.textContent = formatPrice(product.price);
    status.textContent = product.availabilityLabel;
    status.dataset.availability = product.availability;
    story.textContent = product.story;
    setQty(1);
    view.querySelector("[data-add-cart]").dataset.productId = product.id;

    document.title = `${product.name} — Elégance Végétal`;

    const suggestions = getRelatedProducts(product, 4);
    relatedGrid.innerHTML = suggestions.map(relatedCard).join("");
    window.scrollTo(0, 0);
  };

  view.querySelector("[data-qty-minus]").addEventListener("click", () => {
    setQty(Number(qtyValue.textContent) - 1);
  });

  view.querySelector("[data-qty-plus]").addEventListener("click", () => {
    setQty(Number(qtyValue.textContent) + 1);
  });

  window.addEventListener("hashchange", render);
  render();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initProductDetail);
} else {
  initProductDetail();
}
