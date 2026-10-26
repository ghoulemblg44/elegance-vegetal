const LAST_ORDER_KEY = "elegance-vegetal-last-order";
const CONFIRM_HASH = "#confirme";
const QUOTE_DEBOUNCE_MS = 120;
const METHOD_LABELS = { home: "Livraison à domicile", stop_desk: "Stop-Desk" };

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

const readFieldValue = (root, selector) => {
  const field = root.querySelector(selector);
  return field ? String(field.value || "").trim() : "";
};

/*
 * What the browser sends: who, where, how, and which products/quantities.
 * Prices, delivery fee and surcharge are computed by the server; `total` is
 * only the amount the customer was shown, so the server can refuse a mismatch.
 */
const buildOrderPayload = (customer, items, reference, quote) => {
  const wilaya = WILAYAS.find((entry) => entry.code === customer.wilayaCode);

  return {
    customer: {
      fullName: customer.fullName,
      phone: normalizePhone(customer.phone),
      wilaya: wilaya ? wilaya.name : "",
      wilayaCode: customer.wilayaCode,
      address: customer.address,
    },
    deliveryMethod: customer.deliveryMethod || "home",
    items: items.map((item) => ({ productId: item.id, quantity: item.quantity })),
    total: quote ? quote.total : undefined,
    paymentMethod: customer.paymentMethod || "cash_on_delivery",
    orderReference: reference,
  };
};

const apiBase = () => (typeof CUSTOMER_API_BASE !== "undefined" ? CUSTOMER_API_BASE : "");

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
  const methodFeeNodes = page.querySelectorAll("[data-delivery-fee]");
  const deliveryMessage = page.querySelector("[data-delivery-message]");
  const itemSurchargeRow = page.querySelector("[data-checkout-item-surcharge-row]");
  const surchargeRow = page.querySelector("[data-checkout-surcharge-row]");
  const weightNote = page.querySelector("[data-checkout-weight-note]");
  let confirming = false;
  let quote = null; // last server quote (authoritative prices)
  let quoteState = "idle"; // idle | loading | ready | error
  let quoteSeq = 0;
  let quoteTimer = null;
  let quoteAbort = null;

  const fillWilayas = () => {
    WILAYAS.forEach((wilaya) => {
      const option = document.createElement("option");
      option.value = wilaya.code;
      option.textContent = wilayaLabel(wilaya);
      select.append(option);
    });

    // Reuse the wilaya chosen on the cart page, if any.
    const savedWilaya = localStorage.getItem("elegance-vegetal-cart-wilaya") || "";
    if (savedWilaya && WILAYAS.some((wilaya) => wilaya.code === savedWilaya)) {
      selectWilaya(savedWilaya);
    }
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
    try {
      localStorage.setItem("elegance-vegetal-cart-wilaya", wilaya.code);
    } catch {
      /* ignore quota / private mode */
    }
    closeWilayaResults();
    setError("wilaya", "");
    requestQuote();
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

  const currentWilayaCode = () => (select.value && WILAYAS.some((w) => w.code === select.value) ? select.value : "");
  const currentMethod = () => form.querySelector("[name='deliveryMethod']:checked")?.value || "home";

  const quoteUsable = () => quoteState === "ready" && quote && quote.available;

  const updateSubmitState = () => {
    if (confirming) {
      return;
    }
    const blocked = quoteState === "loading" || quoteState === "error" || (quote && !quote.available && currentWilayaCode());
    confirmBtn.disabled = Boolean(blocked);
  };

  const renderSummary = (items) => {
    const lines =
      quote && quote.items && quote.items.length
        ? quote.items.map((line) => ({
            image: line.image,
            alt: line.name,
            name: line.name,
            quantity: line.quantity,
            price: line.unitPrice,
          }))
        : items;
    itemsList.innerHTML = lines.map(checkoutItemTemplate).join("");

    const subtotal = quote ? quote.subtotal : Cart.totalPrice(items);
    const deliveryLabel = page.querySelector("[data-checkout-delivery-label]");
    const deliveryValue = page.querySelector("[data-checkout-delivery]");
    const totalValue = page.querySelector("[data-checkout-total]");

    page.querySelector("[data-checkout-subtotal]").textContent = formatPrice(subtotal);
    deliveryLabel.textContent = METHOD_LABELS[currentMethod()] || "Livraison";
    if (itemSurchargeRow) {
      itemSurchargeRow.hidden = true;
    }
    surchargeRow.hidden = true;
    weightNote.hidden = true;
    deliveryMessage.hidden = true;
    deliveryMessage.textContent = "";

    if (quoteUsable()) {
      // Each row is additive: base wilaya fee + item surcharge + weight surcharge = delivery part of total.
      deliveryValue.textContent = formatPrice(quote.deliveryFee);
      totalValue.textContent = formatPrice(quote.total);
      if (itemSurchargeRow && Number(quote.itemSurcharge) > 0) {
        itemSurchargeRow.hidden = false;
        page.querySelector("[data-checkout-item-surcharge]").textContent = formatPrice(quote.itemSurcharge);
      }
      if (Number(quote.weightSurcharge) > 0) {
        surchargeRow.hidden = false;
        page.querySelector("[data-checkout-surcharge]").textContent = formatPrice(quote.weightSurcharge);
      }
      weightNote.hidden = !(quote.weight && quote.weight.complete === false);
    } else if (quoteState === "loading") {
      deliveryValue.textContent = "Calcul…";
      totalValue.textContent = formatPrice(subtotal);
    } else if (quoteState === "error") {
      deliveryValue.textContent = "—";
      totalValue.textContent = "—";
      deliveryMessage.hidden = false;
      deliveryMessage.textContent =
        "Impossible de calculer la livraison pour le moment. Vérifiez votre connexion, puis réessayez.";
    } else if (quote && !quote.available && currentWilayaCode()) {
      deliveryValue.textContent = "Indisponible";
      totalValue.textContent = "—";
      deliveryMessage.hidden = false;
      deliveryMessage.textContent = quote.message;
    } else {
      deliveryValue.textContent = "Selon la wilaya";
      totalValue.textContent = formatPrice(subtotal);
      deliveryMessage.hidden = false;
      deliveryMessage.textContent = "Choisissez votre wilaya pour afficher le prix de la livraison.";
    }

    // Base wilaya fee next to each mode; extras are listed separately in the summary.
    methodFeeNodes.forEach((node) => {
      const base = quote && quote.options ? quote.options[node.dataset.deliveryFee] : null;
      node.textContent = base == null || !Number.isFinite(Number(base)) ? "" : `· ${formatPrice(base)}`;
    });

    updateSubmitState();
  };

  const rerender = () => {
    const items = Cart.items();
    if (items.length) {
      renderSummary(items);
    }
  };

  /* Ask the server for the authoritative quote (debounced, stale replies dropped). */
  const requestQuote = () => {
    clearTimeout(quoteTimer);
    quoteTimer = setTimeout(async () => {
      const items = Cart.items();
      if (!items.length) {
        return;
      }
      const seq = ++quoteSeq;
      if (quoteAbort) {
        quoteAbort.abort();
      }
      quoteAbort = new AbortController();
      quoteState = "loading";
      rerender();

      try {
        const response = await fetch(`${apiBase()}/api/delivery/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          signal: quoteAbort.signal,
          body: JSON.stringify({
            items: items.map((item) => ({ productId: item.id, quantity: item.quantity })),
            wilayaCode: currentWilayaCode(),
            deliveryMethod: currentMethod(),
          }),
        });
        const payload = await response.json().catch(() => null);
        if (seq !== quoteSeq) {
          return;
        }
        if (!response.ok || !payload || !payload.data) {
          throw new Error((payload && payload.message) || "quote failed");
        }
        quote = payload.data;
        quoteState = "ready";
      } catch (error) {
        if (error.name === "AbortError" || seq !== quoteSeq) {
          return;
        }
        quote = null;
        quoteState = "error";
      }
      rerender();
    }, QUOTE_DEBOUNCE_MS);
  };

  const showSuccess = (order) => {
    empty.hidden = true;
    formWrap.hidden = true;
    success.hidden = false;
    page.querySelector("[data-order-ref]").textContent = order.orderReference;
    page.querySelector("[data-order-thanks]").textContent =
      `${order.customer.fullName}, votre commande est enregistrée. Nous vous contactons au ${order.customer.phone} pour ${
        order.deliveryMethod === "stop_desk" ? "le retrait en Stop-Desk" : "la livraison à domicile"
      }.`;
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
    page.querySelector("[data-success-subtotal]").textContent = formatPrice(order.subtotal);
    page.querySelector("[data-success-fee]").textContent = formatPrice(order.deliveryFee);
    const itemSurcharge = Number(order.itemSurcharge) || 0;
    const surcharge = Number(order.weightSurcharge) || 0;
    const itemSurchargeSuccess = page.querySelector("[data-success-item-surcharge-row]");
    if (itemSurchargeSuccess) {
      itemSurchargeSuccess.hidden = itemSurcharge <= 0;
      page.querySelector("[data-success-item-surcharge]").textContent = formatPrice(itemSurcharge);
    }
    page.querySelector("[data-success-surcharge-row]").hidden = surcharge <= 0;
    page.querySelector("[data-success-surcharge]").textContent = formatPrice(surcharge);
    page.querySelector("[data-success-total]").textContent = formatPrice(order.total);
    page.querySelector("[data-success-delivery]").textContent =
      `${METHOD_LABELS[order.deliveryMethod] || "Livraison à domicile"} · ${order.customer.wilaya} · Paiement à la livraison`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const collectCustomer = () => ({
    fullName: readFieldValue(form, "#fullName, [name='fullName']"),
    phone: readFieldValue(form, "#phone, [name='phone']"),
    wilayaCode: readFieldValue(form, "[data-wilaya-select], [name='wilaya']"),
    address: readFieldValue(form, "#address, [name='address']"),
    deliveryMethod: readFieldValue(form, "[name='deliveryMethod']:checked") || "home",
    paymentMethod: readFieldValue(form, "[name='paymentMethod']:checked") || "cash_on_delivery",
  });

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

    if (valid && quote && !quote.available) {
      banner.hidden = false;
      banner.textContent = quote.message || "La livraison n'est pas disponible pour cette wilaya.";
      return false;
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
      requestQuote();
    }
  });

  form.querySelectorAll("[name='deliveryMethod']").forEach((radio) => {
    radio.addEventListener("change", requestQuote);
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
      requestQuote();
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

    const order = buildOrderPayload(customer, items, generateOrderReference(), quoteUsable() ? quote : null);

    try {
      if (!quoteUsable()) {
        throw new Error("Le montant de la livraison n'a pas pu être calculé. Réessayez dans un instant.");
      }
      const response = await fetch(`${apiBase()}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(order),
      });
      const payload = await response.json().catch(() => null);

      if (response.status === 409 && payload && payload.code === "PRICE_MISMATCH" && payload.data) {
        // Prices changed since the page was loaded: show the new amounts, ask to confirm again.
        quote = payload.data;
        quoteState = "ready";
        rerender();
        throw new Error(payload.message);
      }
      if (!response.ok) {
        throw new Error((payload && payload.message) || "La commande n'a pas pu être enregistrée.");
      }

      const saved = payload.data; // the order exactly as stored by the server
      sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(saved));
      history.replaceState(null, "", CONFIRM_HASH);
      Cart.clear();
      showSuccess(saved);
    } catch (error) {
      banner.hidden = false;
      banner.textContent =
        error.message ||
        "Impossible d'enregistrer la commande. Vérifiez que l'API est démarrée, puis réessayez.";
    } finally {
      confirming = false;
      confirmBtn.removeAttribute("aria-busy");
      confirmBtn.textContent = "Confirmer la commande";
      updateSubmitState();
    }
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
