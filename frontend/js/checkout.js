const LAST_ORDER_KEY = "elegance-vegetal-last-order";
const CONFIRM_HASH = "#confirme";
const DELIVERY_FEE = 0;

const normalizeText = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const normalizePhone = (value) => value.replace(/[\s.\-()]/g, "");

const isAlgerianPhone = (value) =>
  /^(?:0\d{9}|\+213\d{9}|00213\d{9})$/.test(normalizePhone(value));

const generateOrderReference = () => {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const token = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  return `EV-${stamp}-${token}`;
};

const wilayaLabel = (wilaya) => `${wilaya.code} — ${wilaya.name}`;

const checkoutItemTemplate = (item) => `
  <li class="checkout-item">
    <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt)}" />
    <div>
      <p class="checkout-item__name">${escapeHtml(item.name)}</p>
      <p class="checkout-item__meta">Qté ${item.quantity} · ${formatPrice(item.price)}</p>
    </div>
    <p class="checkout-item__sub">${formatPrice(item.price * item.quantity)}</p>
  </li>
`;

const buildOrderPayload = (customer, items, reference) => {
  const subtotal = Cart.totalPrice(items);
  const wilaya = WILAYAS.find((entry) => entry.code === customer.wilayaCode);

  return {
    customer: {
      fullName: customer.fullName,
      phone: normalizePhone(customer.phone),
      wilaya: wilaya ? wilaya.name : "",
    },
    items: items.map((item) => ({
      productId: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      subtotal: item.price * item.quantity,
      image: item.image,
    })),
    subtotal,
    deliveryFee: DELIVERY_FEE,
    total: subtotal + DELIVERY_FEE,
    paymentMethod: "cash_on_delivery",
    orderReference: reference,
    status: "pending",
  };
};

const initCheckout = () => {
  const page = document.querySelector("[data-checkout-page]");
  if (!page) {
    return;
  }

  const empty = page.querySelector("[data-checkout-empty]");
  const formWrap = page.querySelector("[data-checkout-form-wrap]");
  const success = page.querySelector("[data-checkout-success]");
  const form = page.querySelector("[data-checkout-form]");
  const select = page.querySelector("[data-wilaya-select]");
  const search = page.querySelector("[data-wilaya-search]");
  const results = page.querySelector("[data-wilaya-results]");
  const banner = page.querySelector("[data-form-banner]");
  const confirmBtn = page.querySelector("[data-confirm-order]");
  const itemsList = page.querySelector("[data-checkout-items]");
  let confirming = false;

  const fillWilayas = () => {
    WILAYAS.forEach((wilaya) => {
      const option = document.createElement("option");
      option.value = wilaya.code;
      option.textContent = wilayaLabel(wilaya);
      select.append(option);
    });
  };

  const closeWilayaResults = () => {
    results.hidden = true;
    results.innerHTML = "";
  };

  const selectWilaya = (code) => {
    const wilaya = WILAYAS.find((entry) => entry.code === code);
    if (!wilaya) {
      return;
    }
    select.value = wilaya.code;
    search.value = wilayaLabel(wilaya);
    closeWilayaResults();
    setError("wilaya", "");
  };

  const renderWilayaResults = () => {
    const query = normalizeText(search.value);
    if (!query) {
      closeWilayaResults();
      return;
    }

    const matches = WILAYAS.filter((wilaya) =>
      normalizeText(`${wilaya.code} ${wilaya.name}`).includes(query)
    );

    if (!matches.length) {
      results.innerHTML = `<li class="wilaya-results__empty">Aucune wilaya ne correspond.</li>`;
      results.hidden = false;
      return;
    }

    results.innerHTML = matches
      .map(
        (wilaya) => `
          <li>
            <button type="button" role="option" data-wilaya-code="${wilaya.code}">
              ${escapeHtml(wilayaLabel(wilaya))}
            </button>
          </li>
        `
      )
      .join("");
    results.hidden = false;
  };

  const setError = (name, message) => {
    const field = name === "wilaya" ? select : form.querySelector(`[name="${name}"]`);
    const error = form.querySelector(`[data-error="${name}"]`);
    if (field) {
      field.classList.toggle("is-invalid", Boolean(message));
      field.setAttribute("aria-invalid", message ? "true" : "false");
    }
    if (name === "wilaya") {
      search.classList.toggle("is-invalid", Boolean(message));
    }
    if (error) {
      error.hidden = !message;
      error.textContent = message || "";
    }
  };

  const clearErrors = () => {
    ["fullName", "phone", "wilaya"].forEach((name) => setError(name, ""));
    banner.hidden = true;
    banner.textContent = "";
  };

  const renderSummary = (items) => {
    itemsList.innerHTML = items.map(checkoutItemTemplate).join("");
    page.querySelector("[data-checkout-subtotal]").textContent = formatPrice(Cart.totalPrice(items));
    page.querySelector("[data-checkout-total]").textContent = formatPrice(Cart.totalPrice(items) + DELIVERY_FEE);
  };

  const showSuccess = (order) => {
    empty.hidden = true;
    formWrap.hidden = true;
    success.hidden = false;
    page.querySelector("[data-order-ref]").textContent = order.orderReference;
    page.querySelector("[data-order-thanks]").textContent =
      `${order.customer.fullName}, votre commande est enregistrée. Nous vous contactons au ${order.customer.phone} pour la livraison à domicile.`;
    page.querySelector("[data-success-items]").innerHTML = order.items
      .map((item) =>
        checkoutItemTemplate({
          image: item.image,
          alt: item.name,
          name: item.name,
          quantity: item.quantity,
          price: item.unitPrice,
        })
      )
      .join("");
    page.querySelector("[data-success-total]").textContent = formatPrice(order.total);
    page.querySelector("[data-success-delivery]").textContent =
      `Livraison à domicile · ${order.customer.wilaya} · Paiement à la livraison`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const collectCustomer = () => {
    const data = new FormData(form);
    return {
      fullName: String(data.get("fullName") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      wilayaCode: String(data.get("wilaya") || "").trim(),
    };
  };

  const validate = (customer, items) => {
    clearErrors();
    let valid = true;

    if (!items.length) {
      banner.hidden = false;
      banner.textContent = "Votre panier est vide. Impossible de confirmer la commande.";
      return false;
    }

    if (customer.fullName.length < 3) {
      setError("fullName", "Indiquez votre nom complet.");
      valid = false;
    }
    if (!isAlgerianPhone(customer.phone)) {
      setError("phone", "Entrez un numéro algérien valide, ex. 0551234567 ou +213551234567.");
      valid = false;
    }
    if (!customer.wilayaCode || !WILAYAS.some((wilaya) => wilaya.code === customer.wilayaCode)) {
      setError("wilaya", "Choisissez une wilaya dans la liste des 58 wilayas.");
      valid = false;
    }

    if (!valid) {
      banner.hidden = false;
      banner.textContent = "Veuillez corriger les champs indiqués avant de confirmer.";
    }

    return valid;
  };

  fillWilayas();

  search.addEventListener("input", renderWilayaResults);
  search.addEventListener("focus", renderWilayaResults);
  search.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    const first = results.querySelector("[data-wilaya-code]");
    if (first) {
      selectWilaya(first.dataset.wilayaCode);
    }
  });

  results.addEventListener("click", (event) => {
    const button = event.target.closest("[data-wilaya-code]");
    if (button) {
      selectWilaya(button.dataset.wilayaCode);
    }
  });

  select.addEventListener("change", () => {
    if (select.value) {
      selectWilaya(select.value);
    } else {
      search.value = "";
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".wilaya-picker")) {
      closeWilayaResults();
    }
  });

  const paint = () => {
    if (confirming) {
      return;
    }

    if (location.hash === CONFIRM_HASH) {
      const saved = sessionStorage.getItem(LAST_ORDER_KEY);
      if (saved) {
        try {
          showSuccess(JSON.parse(saved));
          return;
        } catch {
          sessionStorage.removeItem(LAST_ORDER_KEY);
        }
      }
    }

    const items = Cart.items();
    empty.hidden = items.length > 0;
    formWrap.hidden = items.length === 0;
    success.hidden = true;
    if (items.length) {
      renderSummary(items);
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const items = Cart.items();
    const customer = collectCustomer();

    if (!validate(customer, items)) {
      form.querySelector(".is-invalid")?.focus();
      return;
    }

    confirming = true;
    confirmBtn.disabled = true;
    confirmBtn.setAttribute("aria-busy", "true");
    confirmBtn.textContent = "Confirmation…";

    const order = buildOrderPayload(customer, items, generateOrderReference());

    await new Promise((resolve) => setTimeout(resolve, 900));

    sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
    history.replaceState(null, "", CONFIRM_HASH);
    Cart.clear();
    showSuccess(order);
    confirming = false;

    confirmBtn.disabled = false;
    confirmBtn.removeAttribute("aria-busy");
    confirmBtn.textContent = "Confirmer la commande";
  });

  document.addEventListener("cart:updated", () => {
    if (!confirming && success.hidden) {
      paint();
    }
  });

  paint();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCheckout);
} else {
  initCheckout();
}
