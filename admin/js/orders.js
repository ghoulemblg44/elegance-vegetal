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

const formatDeliveryFee = (fee) => (Number(fee) > 0 ? formatAdminPrice(fee) : "À confirmer");

const totalQuantity = (order) => order.items.reduce((sum, item) => sum + item.quantity, 0);

const productSummary = (order) => order.items.map((item) => item.name).join(", ");

const statusBadge = (statusId) => {
  const meta = OrderStore.getStatusMeta(statusId);
  return `<span class="status ${meta.className}">${escapeOrderHtml(meta.label)}</span>`;
};

const orderRowTemplate = (order) => `
  <tr data-open-order="${escapeOrderHtml(order.id)}" tabindex="0">
    <td data-label="Référence commande"><strong>${escapeOrderHtml(order.orderReference)}</strong></td>
    <td data-label="Numéro de téléphone">${escapeOrderHtml(order.customer.phone)}</td>
    <td data-label="Wilaya">${escapeOrderHtml(order.customer.wilaya)}</td>
    <td data-label="Produits commandés">${escapeOrderHtml(productSummary(order))}</td>
    <td data-label="Quantité">${totalQuantity(order)}</td>
    <td data-label="Total (DA)">${formatAdminPrice(order.total)}</td>
    <td data-label="Méthode de paiement">${escapeOrderHtml(order.paymentLabel)}</td>
    <td data-label="Statut">${statusBadge(order.status)}</td>
    <td data-label="Date">${escapeOrderHtml(formatOrderDate(order.createdAt))}</td>
  </tr>
`;

const itemRowTemplate = (item) => `
  <li class="order-item">
    <div>
      <p class="order-item__name">${escapeOrderHtml(item.name)}</p>
      <p class="order-item__meta">Qté ${item.quantity} · ${formatAdminPrice(item.unitPrice)}</p>
    </div>
    <p class="order-item__sub">${formatAdminPrice(item.subtotal)}</p>
  </li>
`;

const initOrdersPage = () => {
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

  const fillFilters = () => {
    statusFilter.insertAdjacentHTML(
      "beforeend",
      OrderStore.statuses.map((status) => `<option value="${status.id}">${status.label}</option>`).join("")
    );

    const wilayas = [...new Set(OrderStore.all().map((order) => order.customer.wilaya))].sort((a, b) =>
      a.localeCompare(b, "fr")
    );
    wilayaFilter.insertAdjacentHTML(
      "beforeend",
      wilayas.map((wilaya) => `<option value="${escapeOrderHtml(wilaya)}">${escapeOrderHtml(wilaya)}</option>`).join("")
    );
  };

  const matches = (order) => {
    const query = search.value.trim().toLowerCase().replace(/\s/g, "");
    const haystack = `${order.orderReference} ${order.customer.phone}`.toLowerCase().replace(/\s/g, "");
    const queryOk = !query || haystack.includes(query);
    const statusOk = statusFilter.value === "all" || order.status === statusFilter.value;
    const wilayaOk = wilayaFilter.value === "all" || order.customer.wilaya === wilayaFilter.value;
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
    const next = OrderStore.nextStatuses(order.status);
    const actions = next
      .map(
        (status) =>
          `<button class="btn ${status.id === "annulee" ? "btn--danger" : ""}" type="button" data-set-status="${status.id}">${escapeOrderHtml(status.label)}</button>`
      )
      .join("");

    details.innerHTML = `
      <p class="eyebrow">Commande</p>
      <h2 id="order-detail-title">${escapeOrderHtml(order.orderReference)}</h2>
      <dl class="detail-list">
        <div><dt>Téléphone</dt><dd>${escapeOrderHtml(order.customer.phone)}</dd></div>
        <div><dt>Wilaya</dt><dd>${escapeOrderHtml(order.customer.wilaya)}</dd></div>
        <div><dt>Date</dt><dd>${escapeOrderHtml(formatOrderDate(order.createdAt))}</dd></div>
        <div><dt>Paiement</dt><dd>${escapeOrderHtml(order.paymentLabel)}</dd></div>
        <div><dt>Statut</dt><dd>${statusBadge(order.status)}</dd></div>
      </dl>
      <h3>Produits</h3>
      <ul class="order-items">${order.items.map(itemRowTemplate).join("")}</ul>
      <p class="checkout-row">Sous-total <span>${formatAdminPrice(order.subtotal)}</span></p>
      <p class="checkout-row">Livraison <span>${formatDeliveryFee(order.deliveryFee)}</span></p>
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

  fillFilters();
  render();

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

  details.addEventListener("click", (event) => {
    const button = event.target.closest("[data-set-status]");
    if (!button || !activeId) {
      return;
    }
    OrderStore.updateStatus(activeId, button.dataset.setStatus);
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
