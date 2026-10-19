const ORDER_STATUSES = [
  { id: "nouvelle", label: "Nouvelle", className: "status--nouvelle" },
  { id: "confirmee", label: "Confirmée", className: "status--received" },
  { id: "preparation", label: "En préparation", className: "status--preparing" },
  { id: "expediee", label: "Expédiée", className: "status--shipping" },
  { id: "livree", label: "Livrée", className: "status--delivered" },
  { id: "annulee", label: "Annulée", className: "status--cancelled" },
];

const ORDER_FLOW = {
  nouvelle: ["confirmee", "annulee"],
  confirmee: ["preparation", "annulee"],
  preparation: ["expediee", "annulee"],
  expediee: ["livree"],
  livree: [],
  annulee: [],
};

const PAYMENT_LABELS = {
  cash_on_delivery: "Paiement à la livraison",
};

const DELIVERY_LABELS = {
  home: "Livraison à domicile",
  stop_desk: "Stop-Desk (retrait au bureau)",
};

let orderCache = [];

const normalizeCustomer = (customer = {}) => ({
  fullName: String(customer.fullName || "").trim(),
  phone: String(customer.phone || "").trim(),
  wilaya: String(customer.wilaya || "").trim(),
  address: String(customer.address || customer.adresse || "").trim(),
  wilayaCode: String(customer.wilayaCode || "").trim(),
});

const fromApiOrder = (order) => {
  const paymentMethod = order.paymentMethod || "cash_on_delivery";
  const deliveryMethod = order.deliveryMethod || "home";
  return {
    id: String(order._id || order.id || ""),
    orderReference: order.orderReference,
    customer: normalizeCustomer(order.customer),
    items: (order.items || []).map((item) => ({ ...item })),
    subtotal: Number(order.subtotal) || 0,
    deliveryFee: Number(order.deliveryFee) || 0,
    // null = order created before extra-item pricing existed
    itemSurcharge: order.itemSurcharge == null ? null : Number(order.itemSurcharge) || 0,
    // null = order created before weight pricing existed (do not show an invented 0)
    weightSurcharge: order.weightSurcharge == null ? null : Number(order.weightSurcharge) || 0,
    delivery: order.delivery || null,
    total: Number(order.total) || 0,
    paymentMethod,
    paymentLabel: PAYMENT_LABELS[paymentMethod] || "Paiement à la livraison",
    deliveryMethod,
    deliveryLabel: DELIVERY_LABELS[deliveryMethod] || "Livraison à domicile",
    status: order.status || "nouvelle",
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
};

const getStatusMeta = (id) => ORDER_STATUSES.find((status) => status.id === id) || ORDER_STATUSES[0];

const OrderStore = {
  statuses: ORDER_STATUSES,
  flow: ORDER_FLOW,
  getStatusMeta,

  all() {
    return orderCache.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  get(id) {
    const key = String(id);
    return this.all().find((order) => order.id === key) || null;
  },

  nextStatuses(current) {
    return (ORDER_FLOW[current] || []).map(getStatusMeta);
  },

  async refresh() {
    if (typeof AdminApi === "undefined") {
      orderCache = [];
      throw new Error("L'API administration n'est pas disponible.");
    }

    const response = await AdminApi.request("/api/orders", { cache: "no-store" });
    orderCache = Array.isArray(response.data) ? response.data.map(fromApiOrder) : [];
    return this.all();
  },

  async updateStatus(id, status) {
    const current = this.get(id);
    if (!current || !(ORDER_FLOW[current.status] || []).includes(status)) {
      return null;
    }

    const response = await AdminApi.request(`/api/orders/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
    const updated = fromApiOrder(response.data);
    orderCache = orderCache.map((item) => (item.id === updated.id ? updated : item));
    return updated;
  },
};
