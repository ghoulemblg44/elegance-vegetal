const PENDING_ORDER_STATUSES = ["nouvelle", "confirmee"];

// Dashboard figures come from ProductStore + OrderStore for now.
// Later: GET /api/products, GET /api/orders, or a dedicated stats endpoint.

const AdminInsights = {
  stats() {
    const products = ProductStore.all();
    const orders = OrderStore.all();
    const delivered = orders.filter((order) => order.status === "livree");

    return {
      products: products.length,
      inStock: products.filter((product) => Number(product.stock) > 0).length,
      orders: orders.length,
      delivered: delivered.length,
      pending: orders.filter((order) => PENDING_ORDER_STATUSES.includes(order.status)).length,
      revenue: delivered.reduce((sum, order) => sum + Number(order.total), 0),
    };
  },

  lowStock() {
    return ProductStore.all()
      .filter((product) => Number(product.stock) <= ProductStore.lowStockThreshold)
      .sort((a, b) => Number(a.stock) - Number(b.stock));
  },

  recentOrders(limit = 6) {
    return OrderStore.all().slice(0, limit);
  },
};

const dashOrderRowTemplate = (order) => {
  const meta = OrderStore.getStatusMeta(order.status);
  return `
    <tr>
      <td data-label="Référence"><strong>${escapeAdminHtml(order.orderReference)}</strong></td>
      <td data-label="Téléphone">${escapeAdminHtml(order.customer.phone)}</td>
      <td data-label="Wilaya">${escapeAdminHtml(order.customer.wilaya)}</td>
      <td data-label="Total">${formatAdminPrice(order.total)}</td>
      <td data-label="Statut"><span class="status ${meta.className}">${escapeAdminHtml(meta.label)}</span></td>
      <td data-label="Date">${escapeAdminHtml(formatAdminDate(order.createdAt))}</td>
    </tr>
  `;
};

const dashStockItemTemplate = (item) => `
  <li class="stock-item">
    <div>
      <p class="stock-item__name">${escapeAdminHtml(item.name)}</p>
      <p class="stock-item__meta">${escapeAdminHtml(item.category)}</p>
    </div>
    <span class="status status--low">${Number(item.stock)} en stock</span>
  </li>
`;

const dashActivityTemplate = (order) => {
  const meta = OrderStore.getStatusMeta(order.status);
  return `
    <li class="activity-item">
      <div>
        <p class="activity-item__title">${escapeAdminHtml(order.orderReference)}</p>
        <p class="activity-item__meta">${escapeAdminHtml([order.customer.fullName, order.customer.phone, order.customer.wilaya].filter(Boolean).join(" · "))}</p>
      </div>
      <div class="activity-item__aside">
        <span class="status ${meta.className}">${escapeAdminHtml(meta.label)}</span>
        <small>${escapeAdminHtml(formatAdminDate(order.createdAt))}</small>
      </div>
    </li>
  `;
};

const initDashboard = async () => {
  const page = document.querySelector("[data-dashboard]");
  if (!page) {
    return;
  }

  let productsReady = false;
  try {
    await ProductStore.refresh();
    productsReady = true;
  } catch {
    productsReady = false;
  }

  try {
    await OrderStore.refresh();
  } catch {
    /* Keep dashboard stats at zero orders if MongoDB cannot be reached. */
  }

  const stats = AdminInsights.stats();
  if (productsReady) {
    page.querySelector("[data-stat-products]").textContent = String(stats.products);
    page.querySelector("[data-stat-stock]").textContent = String(stats.inStock);
  }
  page.querySelector("[data-stat-orders]").textContent = String(stats.orders);
  page.querySelector("[data-stat-delivered]").textContent = String(stats.delivered);
  page.querySelector("[data-stat-pending]").textContent = String(stats.pending);
  page.querySelector("[data-stat-revenue]").textContent = formatAdminPrice(stats.revenue);

  const recent = AdminInsights.recentOrders();
  const recentWrap = page.querySelector("[data-recent-wrap]");
  const ordersEmpty = page.querySelector("[data-orders-empty]");
  const activityEmpty = page.querySelector("[data-activity-empty]");
  page.querySelector("[data-orders-body]").innerHTML = recent.map(dashOrderRowTemplate).join("");
  page.querySelector("[data-activity]").innerHTML = recent.map(dashActivityTemplate).join("");
  recentWrap.hidden = recent.length === 0;
  ordersEmpty.hidden = recent.length > 0;
  activityEmpty.hidden = recent.length > 0;
  page.querySelector("[data-activity]").hidden = recent.length === 0;

  const stockList = page.querySelector("[data-low-stock]");
  const stockEmpty = page.querySelector("[data-low-stock-empty]");
  if (productsReady) {
    const lowStock = AdminInsights.lowStock();
    stockList.innerHTML = lowStock.map(dashStockItemTemplate).join("");
    stockEmpty.hidden = lowStock.length > 0;
    stockList.hidden = lowStock.length === 0;
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDashboard);
} else {
  initDashboard();
}
