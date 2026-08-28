const cartLineTemplate = (item) => `
  <li class="cart-line">
    <a class="cart-line__media" href="produit.html#${escapeHtml(item.id)}">
      <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt)}" />
    </a>
    <div class="cart-line__info">
      <h2>
        <a href="produit.html#${escapeHtml(item.id)}">${escapeHtml(item.name)}</a>
      </h2>
      <p class="cart-line__unit">Prix unitaire : ${formatPrice(item.price)}</p>
      <div class="cart-line__tools">
        <div class="qty" role="group" aria-label="Quantité pour ${escapeHtml(item.name)}">
          <button type="button" data-cart-minus="${escapeHtml(item.id)}" aria-label="Diminuer" ${item.quantity <= 1 ? "disabled" : ""}>−</button>
          <span data-qty-value>${item.quantity}</span>
          <button type="button" data-cart-plus="${escapeHtml(item.id)}" aria-label="Augmenter" ${item.quantity >= 99 ? "disabled" : ""}>+</button>
        </div>
        <p class="cart-line__subtotal">Sous-total : ${formatPrice(item.price * item.quantity)}</p>
        <button class="cart-line__remove" type="button" data-cart-remove="${escapeHtml(item.id)}">Retirer</button>
      </div>
    </div>
  </li>
`;

const initCartPage = () => {
  const page = document.querySelector("[data-cart-page]");
  if (!page) {
    return;
  }

  const empty = page.querySelector("[data-cart-empty]");
  const filled = page.querySelector("[data-cart-filled]");
  const list = page.querySelector("[data-cart-list]");
  const total = page.querySelector("[data-cart-total]");

  const render = () => {
    const items = Cart.items();
    const isEmpty = items.length === 0;

    empty.hidden = !isEmpty;
    filled.hidden = isEmpty;

    if (isEmpty) {
      list.innerHTML = "";
      return;
    }

    list.innerHTML = items.map(cartLineTemplate).join("");
    total.textContent = formatPrice(Cart.totalPrice(items));
  };

  page.addEventListener("click", (event) => {
    const minus = event.target.closest("[data-cart-minus]");
    const plus = event.target.closest("[data-cart-plus]");
    const remove = event.target.closest("[data-cart-remove]");

    if (minus) {
      const item = Cart.items().find((line) => line.id === minus.dataset.cartMinus);
      if (item) {
        Cart.setQuantity(item.id, item.quantity - 1);
      }
    }

    if (plus) {
      const item = Cart.items().find((line) => line.id === plus.dataset.cartPlus);
      if (item) {
        Cart.setQuantity(item.id, item.quantity + 1);
      }
    }

    if (remove) {
      Cart.remove(remove.dataset.cartRemove);
    }
  });

  document.addEventListener("cart:updated", render);
  render();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCartPage);
} else {
  initCartPage();
}
