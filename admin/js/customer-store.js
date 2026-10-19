// Customers are derived from MongoDB orders loaded by OrderStore (phone as identity).

const CUSTOMER_STATUSES = [
  { id: "fidele", label: "Fidèle", className: "status--received" },
  { id: "actif", label: "Actif", className: "status--nouvelle" },
  { id: "inactif", label: "Inactif", className: "status--cancelled" },
];

const normalizePhone = (phone) => String(phone || "").replace(/\s/g, "");

const customerStatusMeta = (id) => CUSTOMER_STATUSES.find((status) => status.id === id) || CUSTOMER_STATUSES[1];

const deriveStatus = (orders) => {
  const active = orders.filter((order) => order.status !== "annulee");
  if (active.length === 0) {
    return "inactif";
  }
  if (active.length >= 2) {
    return "fidele";
  }
  return "actif";
};

const summarizeCustomer = (phone, displayPhone, orders) => {
  const newest = orders[0];
  const status = deriveStatus(orders);
  const spentOrders = orders.filter((order) => order.status !== "annulee");
  return {
    id: phone,
    phone: displayPhone,
    fullName: newest.customer.fullName || "",
    wilaya: newest.customer.wilaya,
    orderCount: orders.length,
    totalSpent: spentOrders.reduce((sum, order) => sum + Number(order.total), 0),
    lastOrderAt: newest.createdAt,
    lastOrderRef: newest.orderReference,
    status,
    statusLabel: customerStatusMeta(status).label,
    statusClass: customerStatusMeta(status).className,
    orders,
  };
};

const CustomerStore = {
  statuses: CUSTOMER_STATUSES,

  all() {
    // Later: GET /api/customers
    const groups = new Map();

    OrderStore.all().forEach((order) => {
      const phone = normalizePhone(order.customer?.phone);
      if (!phone) {
        return;
      }
      if (!groups.has(phone)) {
        groups.set(phone, { phone: order.customer.phone, orders: [] });
      }
      groups.get(phone).orders.push(order);
    });

    return [...groups.entries()]
      .map(([id, group]) => summarizeCustomer(id, group.phone, group.orders))
      .sort((a, b) => new Date(b.lastOrderAt) - new Date(a.lastOrderAt));
  },

  get(phone) {
    // Later: GET /api/customers/:phone
    const id = normalizePhone(phone);
    return this.all().find((customer) => customer.id === id) || null;
  },
};
