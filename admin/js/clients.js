const clientRowTemplate = (customer) => `
  <tr data-open-customer="${escapeAdminHtml(customer.id)}" tabindex="0">
    <td data-label="Numéro de téléphone"><strong>${escapeAdminHtml(customer.phone)}</strong></td>
    <td data-label="Wilaya">${escapeAdminHtml(customer.wilaya)}</td>
    <td data-label="Nombre de commandes">${customer.orderCount}</td>
    <td data-label="Total dépensé">${formatAdminPrice(customer.totalSpent)}</td>
    <td data-label="Dernière commande">${escapeAdminHtml(formatAdminDate(customer.lastOrderAt))}</td>
    <td data-label="Statut"><span class="status ${customer.statusClass}">${escapeAdminHtml(customer.statusLabel)}</span></td>
  </tr>
`;

const clientOrderTemplate = (order) => {
  const meta = OrderStore.getStatusMeta(order.status);
  return `
    <li class="order-item">
      <div>
        <p class="order-item__name">${escapeAdminHtml(order.orderReference)}</p>
        <p class="order-item__meta">${escapeAdminHtml(formatAdminDate(order.createdAt))}</p>
      </div>
      <div class="order-item__aside">
        <span class="status ${meta.className}">${escapeAdminHtml(meta.label)}</span>
        <p class="order-item__sub">${formatAdminPrice(order.total)}</p>
      </div>
    </li>
  `;
};

const initClientsPage = async () => {
  const page = document.querySelector("[data-clients-page]");
  if (!page) {
    return;
  }

  const search = page.querySelector("[data-client-search]");
  const wilayaFilter = page.querySelector("[data-filter-wilaya]");
  const ordersFilter = page.querySelector("[data-filter-orders]");
  const statusFilter = page.querySelector("[data-filter-status]");
  const list = page.querySelector("[data-client-list]");
  const count = page.querySelector("[data-client-count]");
  const empty = page.querySelector("[data-client-empty]");
  const tableWrap = page.querySelector(".table-wrap");
  const dialog = page.querySelector("[data-client-dialog]");
  const details = page.querySelector("[data-client-details]");

  const fillFilters = () => {
    statusFilter.insertAdjacentHTML(
      "beforeend",
      CustomerStore.statuses.map((status) => `<option value="${status.id}">${status.label}</option>`).join("")
    );

    const wilayas = [...new Set(CustomerStore.all().map((customer) => customer.wilaya))].sort((a, b) =>
      a.localeCompare(b, "fr")
    );
    wilayaFilter.insertAdjacentHTML(
      "beforeend",
      wilayas.map((wilaya) => `<option value="${escapeAdminHtml(wilaya)}">${escapeAdminHtml(wilaya)}</option>`).join("")
    );
  };

  const matches = (customer) => {
    const query = search.value.trim().toLowerCase().replace(/\s/g, "");
    const phoneOk =
      !query ||
      `${customer.fullName} ${customer.phone}`.toLowerCase().replace(/\s/g, "").includes(query);
    const wilayaOk = wilayaFilter.value === "all" || customer.wilaya === wilayaFilter.value;
    const statusOk = statusFilter.value === "all" || customer.status === statusFilter.value;
    const ordersOk =
      ordersFilter.value === "all" ||
      (ordersFilter.value === "1" && customer.orderCount === 1) ||
      (ordersFilter.value === "2plus" && customer.orderCount >= 2);
    return phoneOk && wilayaOk && statusOk && ordersOk;
  };

  const render = () => {
    const visible = CustomerStore.all().filter(matches);
    count.textContent = visible.length <= 1 ? `${visible.length} client` : `${visible.length} clients`;
    empty.hidden = visible.length > 0;
    tableWrap.hidden = visible.length === 0;
    list.innerHTML = visible.map(clientRowTemplate).join("");
  };

  const closeDetails = () => {
    dialog.hidden = true;
    document.body.classList.remove("is-locked");
  };

  const openDetails = (id) => {
    const customer = CustomerStore.get(id);
    if (!customer) {
      return;
    }

    details.innerHTML = `
      <p class="eyebrow">Client</p>
      <h2 id="client-detail-title">${escapeAdminHtml(customer.fullName || customer.phone)}</h2>
      <dl class="detail-list">
        <div><dt>Nom complet</dt><dd>${escapeAdminHtml(customer.fullName || "—")}</dd></div>
        <div><dt>Téléphone</dt><dd>${escapeAdminHtml(customer.phone)}</dd></div>
        <div><dt>Wilaya</dt><dd>${escapeAdminHtml(customer.wilaya)}</dd></div>
        <div><dt>Commandes</dt><dd>${customer.orderCount}</dd></div>
        <div><dt>Total dépensé</dt><dd>${formatAdminPrice(customer.totalSpent)}</dd></div>
        <div><dt>Statut</dt><dd><span class="status ${customer.statusClass}">${escapeAdminHtml(customer.statusLabel)}</span></dd></div>
      </dl>
      <h3>Commandes</h3>
      <ul class="order-items">${customer.orders.map(clientOrderTemplate).join("")}</ul>
    `;
    dialog.hidden = false;
    document.body.classList.add("is-locked");
    dialog.querySelector("[data-close-client]")?.focus();
  };

  try {
    await OrderStore.refresh();
  } catch {
    /* MongoDB is the only source; render an empty list if the API is unavailable. */
  }
  fillFilters();
  render();

  search.addEventListener("input", render);
  wilayaFilter.addEventListener("change", render);
  ordersFilter.addEventListener("change", render);
  statusFilter.addEventListener("change", render);

  list.addEventListener("click", (event) => {
    const row = event.target.closest("[data-open-customer]");
    if (row) {
      openDetails(row.dataset.openCustomer);
    }
  });

  list.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    const row = event.target.closest("[data-open-customer]");
    if (row && event.target === row) {
      event.preventDefault();
      openDetails(row.dataset.openCustomer);
    }
  });

  page.querySelectorAll("[data-close-client]").forEach((el) => {
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
  document.addEventListener("DOMContentLoaded", initClientsPage);
} else {
  initClientsPage();
}
