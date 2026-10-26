const escapeOrderHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const formatOrderDate = (iso) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

const orderDateKey = (iso) => {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

// Orders priced by the server carry a `delivery` snapshot; older ones keep "À confirmer".
const formatDeliveryFee = (order) =>
  order.delivery || Number(order.deliveryFee) > 0 ? formatAdminPrice(order.deliveryFee) : "À confirmer";

const formatWeightSurcharge = (order) =>
  order.weightSurcharge == null ? "Non renseigné" : formatAdminPrice(order.weightSurcharge);

const formatItemSurcharge = (order) =>
  order.itemSurcharge == null ? "Non renseigné" : formatAdminPrice(order.itemSurcharge);

const formatWeight = (order) => {
  const weight = order.delivery && order.delivery.weightKg;
  if (weight == null) {
    return "Non renseigné";
  }
  const text = `${Number(weight).toLocaleString("fr-FR")} kg`;
  return order.delivery.weightComplete === false ? `${text} (incomplet)` : text;
};

const weightWarning = (order) => {
  const delivery = order.delivery;
  if (!delivery || delivery.weightComplete !== false) {
    return "";
  }
  const names = (delivery.missingWeightProducts || []).map((product) => product.name).filter(Boolean).join(", ");
  return `<p class="form-banner">Poids non renseigné pour : ${escapeOrderHtml(names || "certains produits")}. Le supplément de poids est à vérifier manuellement.</p>`;
};

const totalQuantity = (order) => (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);

const customerOf = (order) =>
  order.customer || { fullName: "", phone: "", wilaya: "", address: "" };

const displayOrderValue = (value) => {
  const text = String(value || "").trim();
  return text || "Non renseigné";
};

const itemImageSrc = (item) => String(item && item.image ? item.image : "").trim();

const productSummary = (order) =>
  (order.items || [])
    .map((item) => {
      const src = itemImageSrc(item);
      const photo = src
        ? `<img class="order-thumb" src="${escapeOrderHtml(src)}" alt="${escapeOrderHtml(item.name || "")}" />`
        : `<span class="order-thumb order-thumb--empty" aria-hidden="true"></span>`;
      return `<span class="order-product">${photo}<span>${escapeOrderHtml(item.name || "Produit")}</span></span>`;
    })
    .join("");

const statusBadge = (statusId) => {
  const meta = OrderStore.getStatusMeta(statusId);
  return `<span class="status ${meta.className}">${escapeOrderHtml(meta.label)}</span>`;
};

const orderRowTemplate = (order) => {
  const customer = customerOf(order);
  return `
  <tr data-open-order="${escapeOrderHtml(order.id)}" tabindex="0">
    <td data-label="Référence commande"><strong>${escapeOrderHtml(order.orderReference)}</strong></td>
    <td data-label="Nom complet">${escapeOrderHtml(customer.fullName)}</td>
    <td data-label="Numéro de téléphone">${escapeOrderHtml(customer.phone)}</td>
    <td data-label="Wilaya">${escapeOrderHtml(customer.wilaya)}</td>
    <td data-label="Produits commandés"><div class="order-products">${productSummary(order)}</div></td>
    <td data-label="Quantité">${totalQuantity(order)}</td>
    <td data-label="Total (DA)">${formatAdminPrice(order.total)}</td>
    <td data-label="Méthode de paiement">${escapeOrderHtml(order.paymentLabel)}</td>
    <td data-label="Statut">${statusBadge(order.status)}</td>
    <td data-label="Date">${escapeOrderHtml(formatOrderDate(order.createdAt))}</td>
  </tr>
`;
};

const itemRowTemplate = (item) => {
  const src = itemImageSrc(item);
  const photo = src
    ? `<img class="order-item__photo" src="${escapeOrderHtml(src)}" alt="${escapeOrderHtml(item.name || "")}" />`
    : `<span class="order-item__photo order-item__photo--empty" aria-hidden="true"></span>`;
  return `
  <li class="order-item">
    ${photo}
    <div>
      <p class="order-item__name">${escapeOrderHtml(item.name)}</p>
      <p class="order-item__meta">Qté ${item.quantity} · ${formatAdminPrice(item.unitPrice)}</p>
    </div>
    <p class="order-item__sub">${formatAdminPrice(item.subtotal)}</p>
  </li>
`;
};

const initOrdersPage = async () => {
  const page = document.querySelector("[data-orders-page]");
  if (!page) {
    return;
  }

  const search = page.querySelector("[data-order-search]");
  const statusFilter = page.querySelector("[data-filter-status]");
  const wilayaFilter = page.querySelector("[data-filter-wilaya]");
  const dateFilter = page.querySelector("[data-filter-date]");
  const list = page.querySelector("[data-order-list]");
  const count = page.querySelector("[data-order-count]");
  const empty = page.querySelector("[data-order-empty]");
  const tableWrap = page.querySelector(".table-wrap");
  const dialog = page.querySelector("[data-order-dialog]");
  const details = page.querySelector("[data-order-details]");
  let activeId = null;

  const EMPTY_DEFAULT = "Aucune commande ne correspond à votre recherche.";

  const fillFilters = () => {
    if (!statusFilter.dataset.filled) {
      statusFilter.insertAdjacentHTML(
        "beforeend",
        OrderStore.statuses.map((status) => `<option value="${status.id}">${status.label}</option>`).join("")
      );
      statusFilter.dataset.filled = "true";
    }

    const selectedWilaya = wilayaFilter.value || "all";
    wilayaFilter.querySelectorAll("option:not([value='all'])").forEach((option) => option.remove());
    const wilayas = [...new Set(OrderStore.all().map((order) => customerOf(order).wilaya).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, "fr")
    );
    wilayaFilter.insertAdjacentHTML(
      "beforeend",
      wilayas.map((wilaya) => `<option value="${escapeOrderHtml(wilaya)}">${escapeOrderHtml(wilaya)}</option>`).join("")
    );
    wilayaFilter.value = [...wilayaFilter.options].some((option) => option.value === selectedWilaya)
      ? selectedWilaya
      : "all";
  };

  const matches = (order) => {
    const query = search.value.trim().toLowerCase().replace(/\s/g, "");
    const customer = customerOf(order);
    const haystack = `${order.orderReference} ${customer.fullName} ${customer.phone}`
      .toLowerCase()
      .replace(/\s/g, "");
    const queryOk = !query || haystack.includes(query);
    const statusOk = statusFilter.value === "all" || order.status === statusFilter.value;
    const wilayaOk = wilayaFilter.value === "all" || customer.wilaya === wilayaFilter.value;
    const dateOk = !dateFilter.value || orderDateKey(order.createdAt) === dateFilter.value;
    return queryOk && statusOk && wilayaOk && dateOk;
  };

  const render = () => {
    const visible = OrderStore.all().filter(matches);
    count.textContent = visible.length <= 1 ? `${visible.length} commande` : `${visible.length} commandes`;
    empty.hidden = visible.length > 0;
    tableWrap.hidden = visible.length === 0;
    list.innerHTML = visible.map(orderRowTemplate).join("");
  };

  const closeDetails = () => {
    dialog.hidden = true;
    activeId = null;
    document.body.classList.remove("is-locked");
  };

  const renderDetails = (order) => {
    const customer = customerOf(order);
    const next = OrderStore.nextStatuses(order.status);
    const actions = next
      .map(
        (status) =>
          `<button class="btn ${status.id === "annulee" ? "btn--danger" : ""}" type="button" data-set-status="${status.id}">${escapeOrderHtml(status.label)}</button>`
      )
      .join("");

    details.innerHTML = `
      <p class="eyebrow">Commande</p>
      <h2 id="order-detail-title">${escapeOrderHtml(displayOrderValue(order.orderReference))}</h2>
      <dl class="detail-list">
        <div><dt>Référence</dt><dd>${escapeOrderHtml(displayOrderValue(order.orderReference))}</dd></div>
        <div><dt>Nom complet</dt><dd>${escapeOrderHtml(displayOrderValue(customer.fullName))}</dd></div>
        <div><dt>Téléphone</dt><dd>${escapeOrderHtml(displayOrderValue(customer.phone))}</dd></div>
        <div><dt>Wilaya</dt><dd>${escapeOrderHtml(displayOrderValue(customer.wilaya))}</dd></div>
        <div><dt>Adresse</dt><dd>${escapeOrderHtml(displayOrderValue(customer.address))}</dd></div>
        <div><dt>Mode de livraison</dt><dd>${escapeOrderHtml(displayOrderValue(order.deliveryLabel))}</dd></div>
        <div><dt>Poids total</dt><dd>${escapeOrderHtml(formatWeight(order))}</dd></div>
        <div><dt>Date</dt><dd>${escapeOrderHtml(order.createdAt ? formatOrderDate(order.createdAt) : "Non renseigné")}</dd></div>
        <div><dt>Paiement</dt><dd>${escapeOrderHtml(displayOrderValue(order.paymentLabel))}</dd></div>
        <div><dt>Statut</dt><dd>${statusBadge(order.status)}</dd></div>
      </dl>
      <h3>Produits</h3>
      <ul class="order-items">${(order.items || []).map(itemRowTemplate).join("")}</ul>
      ${weightWarning(order)}
      <p class="checkout-row">Sous-total <span>${formatAdminPrice(order.subtotal)}</span></p>
      <p class="checkout-row">Livraison <span>${formatDeliveryFee(order)}</span></p>
      <p class="checkout-row">Articles supplémentaires <span>${formatItemSurcharge(order)}</span></p>
      <p class="checkout-row">Supplément poids <span>${formatWeightSurcharge(order)}</span></p>
      <p class="checkout-row checkout-row--total">Total <span>${formatAdminPrice(order.total)}</span></p>
      ${
        actions
          ? `<div class="status-actions"><p class="eyebrow">Mettre à jour</p><div class="dialog__actions status-actions__btns">${actions}</div></div>`
          : `<p class="empty-state">Aucun changement de statut disponible.</p>`
      }
    `;
  };

  const openDetails = (id) => {
    const order = OrderStore.get(id);
    if (!order) {
      return;
    }
    activeId = id;
    renderDetails(order);
    dialog.hidden = false;
    document.body.classList.add("is-locked");
    dialog.querySelector("[data-close-order]")?.focus();
  };

  const showLoadError = (message) => {
    empty.hidden = false;
    empty.textContent = message;
    tableWrap.hidden = true;
    count.textContent = "0 commande";
    list.innerHTML = "";
  };

  const loadOrders = async () => {
    try {
      await OrderStore.refresh();
      empty.textContent = EMPTY_DEFAULT;
      fillFilters();
      render();
    } catch (error) {
      showLoadError(error.message || "Impossible de charger les commandes.");
    }
  };

  await loadOrders();
  window.addEventListener("pageshow", () => {
    loadOrders();
  });

  search.addEventListener("input", render);
  statusFilter.addEventListener("change", render);
  wilayaFilter.addEventListener("change", render);
  dateFilter.addEventListener("change", render);

  const openFromRow = (event) => {
    const row = event.target.closest("[data-open-order]");
    if (row) {
      openDetails(row.dataset.openOrder);
    }
  };

  list.addEventListener("click", openFromRow);
  list.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    const row = event.target.closest("[data-open-order]");
    if (row && event.target === row) {
      event.preventDefault();
      openDetails(row.dataset.openOrder);
    }
  });

  details.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-set-status]");
    if (!button || !activeId) {
      return;
    }
    await OrderStore.updateStatus(activeId, button.dataset.setStatus);
    const updated = OrderStore.get(activeId);
    if (updated) {
      renderDetails(updated);
    }
    render();
  });

  page.querySelectorAll("[data-close-order]").forEach((el) => {
    el.addEventListener("click", closeDetails);
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeDetails();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dialog.hidden) {
      closeDetails();
      event.stopImmediatePropagation();
    }
  });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initOrdersPage);
} else {
  initOrdersPage();
}
