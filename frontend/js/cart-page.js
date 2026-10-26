const CART_WILAYA_KEY = "elegance-vegetal-cart-wilaya";

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
  const subtotalEl = page.querySelector("[data-cart-subtotal]");
  const totalEl = page.querySelector("[data-cart-total]");
  const deliveryEl = page.querySelector("[data-cart-delivery]");
  const deliveryNote = page.querySelector("[data-cart-delivery-note]");
  const wilayaSelect = page.querySelector("[data-cart-wilaya]");

  let tariffs = null; // { extraItemFee, byCode: Map }

  const apiBase = () => (typeof CUSTOMER_API_BASE !== "undefined" ? CUSTOMER_API_BASE : "");

  const fillWilayas = () => {
    if (!wilayaSelect || typeof WILAYAS === "undefined") {
      return;
    }
    const saved = localStorage.getItem(CART_WILAYA_KEY) || "";
    WILAYAS.forEach((wilaya) => {
      const option = document.createElement("option");
      option.value = wilaya.code;
      option.textContent = `${wilaya.code} — ${wilaya.name}`;
      wilayaSelect.append(option);
    });
    if (saved && WILAYAS.some((wilaya) => wilaya.code === saved)) {
      wilayaSelect.value = saved;
    }
  };

  const loadTariffs = async () => {
    try {
      const response = await fetch(`${apiBase()}/api/delivery/tariffs`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || !payload.data) {
        throw new Error("tariffs unavailable");
      }
      const byCode = new Map();
      (payload.data.wilayas || []).forEach((row) => {
        byCode.set(row.code, row);
      });
      tariffs = {
        extraItemFee: Number(payload.data.extraItemFee) || 250,
        byCode,
      };
    } catch {
      tariffs = null;
    }
  };

  const estimateDelivery = (items) => {
    const code = wilayaSelect ? wilayaSelect.value : "";
    if (!code || !tariffs) {
      return { available: false, fee: null, message: "Choisissez votre wilaya pour voir le prix." };
    }
    const row = tariffs.byCode.get(code);
    if (!row || !row.available || row.home == null) {
      return {
        available: false,
        fee: null,
        message: "Livraison non disponible pour cette wilaya.",
      };
    }
    const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const itemSurcharge = Math.max(0, quantity - 1) * tariffs.extraItemFee;
    return {
      available: true,
      fee: Number(row.home) + itemSurcharge,
      base: Number(row.home),
      itemSurcharge,
      stopDesk: row.stopDesk == null ? null : Number(row.stopDesk) + itemSurcharge,
    };
  };

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
    const subtotal = Cart.totalPrice(items);
    if (subtotalEl) {
      subtotalEl.textContent = formatPrice(subtotal);
    }

    const estimate = estimateDelivery(items);
    if (deliveryEl) {
      deliveryEl.textContent = estimate.available ? formatPrice(estimate.fee) : "Selon la wilaya";
    }
    if (deliveryNote) {
      if (estimate.available && estimate.itemSurcharge > 0) {
        deliveryNote.hidden = false;
        deliveryNote.textContent = `Dont ${formatPrice(estimate.itemSurcharge)} pour articles supplémentaires. Stop-Desk : ${formatPrice(estimate.stopDesk)}.`;
      } else if (estimate.available && estimate.stopDesk != null) {
        deliveryNote.hidden = false;
        deliveryNote.textContent = `Stop-Desk : ${formatPrice(estimate.stopDesk)}.`;
      } else if (!estimate.available && estimate.message) {
        deliveryNote.hidden = false;
        deliveryNote.textContent = estimate.message;
      } else {
        deliveryNote.hidden = true;
        deliveryNote.textContent = "";
      }
    }

    const total = estimate.available ? subtotal + estimate.fee : subtotal;
    totalEl.textContent = formatPrice(total);
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

  if (wilayaSelect) {
    wilayaSelect.addEventListener("change", () => {
      if (wilayaSelect.value) {
        localStorage.setItem(CART_WILAYA_KEY, wilayaSelect.value);
      } else {
        localStorage.removeItem(CART_WILAYA_KEY);
      }
      render();
    });
  }

  document.addEventListener("cart:updated", render);
  fillWilayas();
  loadTariffs().then(render);
  render();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCartPage);
} else {
  initCartPage();
}
