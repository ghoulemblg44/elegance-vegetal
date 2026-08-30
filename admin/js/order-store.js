const ORDERS_STORAGE_KEY = "elegance-vegetal-admin-orders";

// Demo persistence for now. Later this store will call:
// GET /api/orders
// GET /api/orders/:id
// PUT /api/orders/:id/status

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

const ORDER_SEED = [
  {
    id: "ord-k4m2",
    orderReference: "EV-20260828-K4M2",
    customer: { phone: "0551234567", wilaya: "Alger" },
    items: [
      { productId: "eternel", name: "Bouquet Éternel", quantity: 2, unitPrice: 8500, subtotal: 17000 },
    ],
    subtotal: 17000,
    deliveryFee: 600,
    total: 17600,
    paymentMethod: "cash_on_delivery",
    paymentLabel: "Paiement à la livraison",
    status: "nouvelle",
    createdAt: "2026-08-28T09:20:00.000Z",
  },
  {
    id: "ord-p9qx",
    orderReference: "EV-20260827-P9QX",
    customer: { phone: "0770987654", wilaya: "Oran" },
    items: [
      { productId: "damas", name: "Roses de Damas", quantity: 1, unitPrice: 6500, subtotal: 6500 },
      { productId: "luna", name: "Fleurs séchées Luna", quantity: 1, unitPrice: 3900, subtotal: 3900 },
    ],
    subtotal: 10400,
    deliveryFee: 0,
    total: 10400,
    paymentMethod: "cash_on_delivery",
    paymentLabel: "Paiement à la livraison",
    status: "confirmee",
    createdAt: "2026-08-27T14:05:00.000Z",
  },
  {
    id: "ord-h2lt",
    orderReference: "EV-20260827-H2LT",
    customer: { phone: "0661122334", wilaya: "Constantine" },
    items: [
      { productId: "valentine", name: "Éclat Saint-Valentin", quantity: 1, unitPrice: 12000, subtotal: 12000 },
    ],
    subtotal: 12000,
    deliveryFee: 0,
    total: 12000,
    paymentMethod: "cash_on_delivery",
    paymentLabel: "Paiement à la livraison",
    status: "preparation",
    createdAt: "2026-08-27T11:40:00.000Z",
  },
  {
    id: "ord-n7wr",
    orderReference: "EV-20260826-N7WR",
    customer: { phone: "0559876543", wilaya: "Blida" },
    items: [
      { productId: "monstera", name: "Monstera Deliciosa", quantity: 1, unitPrice: 4200, subtotal: 4200 },
    ],
    subtotal: 4200,
    deliveryFee: 0,
    total: 4200,
    paymentMethod: "cash_on_delivery",
    paymentLabel: "Paiement à la livraison",
    status: "expediee",
    createdAt: "2026-08-26T16:12:00.000Z",
  },
  {
    id: "ord-c3vf",
    orderReference: "EV-20260825-C3VF",
    customer: { phone: "0790456123", wilaya: "Tizi Ouzou" },
    items: [
      { productId: "champetre", name: "Bouquet Champêtre", quantity: 1, unitPrice: 5800, subtotal: 5800 },
    ],
    subtotal: 5800,
    deliveryFee: 0,
    total: 5800,
    paymentMethod: "cash_on_delivery",
    paymentLabel: "Paiement à la livraison",
    status: "annulee",
    createdAt: "2026-08-25T08:30:00.000Z",
  },
  {
    id: "ord-b8ds",
    orderReference: "EV-20260824-B8DS",
    customer: { phone: "0561789456", wilaya: "Sétif" },
    items: [
      { productId: "orchidee", name: "Orchidée Phalaenopsis", quantity: 1, unitPrice: 7500, subtotal: 7500 },
      { productId: "douceur", name: "Coffret Douceur", quantity: 1, unitPrice: 8900, subtotal: 8900 },
    ],
    subtotal: 16400,
    deliveryFee: 0,
    total: 16400,
    paymentMethod: "cash_on_delivery",
    paymentLabel: "Paiement à la livraison",
    status: "livree",
    createdAt: "2026-08-24T18:45:00.000Z",
  },
  {
    id: "ord-q1az",
    orderReference: "EV-20260823-Q1AZ",
    customer: { phone: "0772341098", wilaya: "Béjaïa" },
    items: [
      { productId: "eternel", name: "Bouquet Éternel", quantity: 1, unitPrice: 8500, subtotal: 8500 },
      { productId: "damas", name: "Roses de Damas", quantity: 2, unitPrice: 6500, subtotal: 13000 },
    ],
    subtotal: 21500,
    deliveryFee: 0,
    total: 21500,
    paymentMethod: "cash_on_delivery",
    paymentLabel: "Paiement à la livraison",
    status: "nouvelle",
    createdAt: "2026-08-23T10:15:00.000Z",
  },
  {
    id: "ord-r5km",
    orderReference: "EV-20260822-R5KM",
    customer: { phone: "0551234567", wilaya: "Alger" },
    items: [
      { productId: "champetre", name: "Bouquet Champêtre", quantity: 1, unitPrice: 5800, subtotal: 5800 },
    ],
    subtotal: 5800,
    deliveryFee: 600,
    total: 6400,
    paymentMethod: "cash_on_delivery",
    paymentLabel: "Paiement à la livraison",
    status: "livree",
    createdAt: "2026-08-22T15:10:00.000Z",
  },
  {
    id: "ord-w2yh",
    orderReference: "EV-20260821-W2YH",
    customer: { phone: "0770987654", wilaya: "Oran" },
    items: [
      { productId: "damas", name: "Roses de Damas", quantity: 1, unitPrice: 6500, subtotal: 6500 },
    ],
    subtotal: 6500,
    deliveryFee: 0,
    total: 6500,
    paymentMethod: "cash_on_delivery",
    paymentLabel: "Paiement à la livraison",
    status: "livree",
    createdAt: "2026-08-21T12:00:00.000Z",
  },
];

const writeOrders = (items) => {
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(items));
};

const readOrders = () => {
  const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
  if (raw === null) {
    writeOrders(ORDER_SEED);
    return ORDER_SEED.map((item) => ({ ...item, customer: { ...item.customer }, items: item.items.map((line) => ({ ...line })) }));
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    /* reseed */
  }

  writeOrders(ORDER_SEED);
  return ORDER_SEED.map((item) => ({ ...item, customer: { ...item.customer }, items: item.items.map((line) => ({ ...line })) }));
};

const getStatusMeta = (id) => ORDER_STATUSES.find((status) => status.id === id) || ORDER_STATUSES[0];

const OrderStore = {
  statuses: ORDER_STATUSES,
  flow: ORDER_FLOW,
  getStatusMeta,

  all() {
    // Later: GET /api/orders
    return readOrders().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  get(id) {
    // Later: GET /api/orders/:id
    return this.all().find((order) => order.id === id) || null;
  },

  nextStatuses(current) {
    return (ORDER_FLOW[current] || []).map(getStatusMeta);
  },

  updateStatus(id, status) {
    const items = readOrders();
    const index = items.findIndex((order) => order.id === id);
    if (index < 0) {
      return null;
    }

    const current = items[index].status;
    if (!(ORDER_FLOW[current] || []).includes(status)) {
      return null;
    }

    items[index] = { ...items[index], status, updatedAt: new Date().toISOString() };
    writeOrders(items);
    // Later: PUT /api/orders/:id/status
    return items[index];
  },
};
