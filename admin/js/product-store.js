const PRODUCTS_STORAGE_KEY = "elegance-vegetal-admin-products";
const LOW_STOCK_THRESHOLD = 5;

// Demo persistence for now. Later this store will call:
// GET /api/products
// POST /api/products
// PUT /api/products/:id
// DELETE /api/products/:id

const PRODUCT_CATEGORIES = ["Fleurs", "Bouquets", "Plantes", "Roses", "Occasions", "Cadeaux"];

const PRODUCT_SEED = [
  {
    id: "eternel",
    name: "Bouquet Éternel",
    description: "Pivoines blush et eucalyptus, composé pour durer plusieurs jours.",
    category: "Bouquets",
    price: 8500,
    previousPrice: null,
    image: "https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=900&q=80",
    stock: 12,
    status: "active",
  },
  {
    id: "damas",
    name: "Roses de Damas",
    description: "Une botte classique de roses rouges, profondes et veloutées.",
    category: "Roses",
    price: 6500,
    previousPrice: 7200,
    image: "https://images.unsplash.com/photo-1519378058457-4c29a0a2efac?auto=format&fit=crop&w=900&q=80",
    stock: 8,
    status: "active",
  },
  {
    id: "monstera",
    name: "Monstera Deliciosa",
    description: "Plante graphique, facile à vivre, en pot terracotta.",
    category: "Plantes",
    price: 4200,
    previousPrice: null,
    image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=80",
    stock: 6,
    status: "active",
  },
  {
    id: "orchidee",
    name: "Orchidée Phalaenopsis",
    description: "Floraison longue, silhouette précieuse, pot céramique inclus.",
    category: "Plantes",
    price: 7500,
    previousPrice: null,
    image: "https://images.unsplash.com/photo-1455659817273-f96807779a8a?auto=format&fit=crop&w=900&q=80",
    stock: 2,
    status: "active",
  },
  {
    id: "valentine",
    name: "Éclat Saint-Valentin",
    description: "Bouquet romantique, ruban et carte message offerts.",
    category: "Occasions",
    price: 12000,
    previousPrice: 13500,
    image: "https://images.unsplash.com/photo-1455582916367-09f2adc16354?auto=format&fit=crop&w=900&q=80",
    stock: 3,
    status: "active",
  },
  {
    id: "douceur",
    name: "Coffret Douceur",
    description: "Fleurs, petit vase et un mot manuscrit, prêt à offrir.",
    category: "Cadeaux",
    price: 8900,
    previousPrice: null,
    image: "https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=900&q=80",
    stock: 0,
    status: "inactive",
  },
  {
    id: "champetre",
    name: "Bouquet Champêtre",
    description: "Fleurs des champs, lumière douce, esprit de jardin au naturel.",
    category: "Fleurs",
    price: 5800,
    previousPrice: null,
    image: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=900&q=80",
    stock: 9,
    status: "active",
  },
];

const stampProduct = (product, existing) => {
  const now = new Date().toISOString();
  return {
    ...product,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
};

const readProducts = () => {
  const raw = localStorage.getItem(PRODUCTS_STORAGE_KEY);
  if (raw === null) {
    writeProducts(PRODUCT_SEED);
    return PRODUCT_SEED.map((item) => ({ ...item }));
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    /* reseed */
  }

  writeProducts(PRODUCT_SEED);
  return PRODUCT_SEED.map((item) => ({ ...item }));
};

const writeProducts = (items) => {
  localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(items));
};

const ProductStore = {
  categories: PRODUCT_CATEGORIES,
  lowStockThreshold: LOW_STOCK_THRESHOLD,

  all() {
    return readProducts().map((item) => ({ ...item }));
  },

  get(id) {
    return this.all().find((item) => item.id === id) || null;
  },

  create(data) {
    const items = readProducts();
    const product = stampProduct({
      ...data,
      id: `prod-${Date.now().toString(36)}`,
    });
    items.unshift(product);
    writeProducts(items);
    return product;
    // Later: POST /api/products
  },

  update(id, data) {
    const items = readProducts();
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) {
      return null;
    }
    const product = stampProduct({ ...items[index], ...data, id }, items[index]);
    items[index] = product;
    writeProducts(items);
    return product;
    // Later: PUT /api/products/:id
  },

  remove(id) {
    writeProducts(readProducts().filter((item) => item.id !== id));
    // Later: DELETE /api/products/:id
  },
};
