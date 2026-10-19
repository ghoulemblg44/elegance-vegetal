const LOW_STOCK_THRESHOLD = 5;
const PRODUCT_CATEGORIES = [
  "Fleurs",
  "Bouquets",
  "Plantes",
  "Roses",
  "Occasions",
  "Cadeaux",
  "Fleurs séchées",
  "Compositions",
];

let productCache = [];

const fromApiProduct = (product) => ({
  id: product._id || product.id,
  name: product.name,
  description: product.description || "",
  category: product.category,
  price: Number(product.price),
  previousPrice: product.oldPrice == null ? null : Number(product.oldPrice),
  image: product.image,
  weightKg: product.weightKg == null ? null : Number(product.weightKg),
  stock: Number(product.stock),
  status: product.isActive === false ? "inactive" : "active",
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
});

const toApiProduct = (data) => {
  const image = String(data.image || "").trim();
  if (!image || image.startsWith("data:")) {
    const error = new Error("L'image du produit doit être une URL, pas un fichier encodé.");
    error.status = 400;
    throw error;
  }

  const payload = {
    name: data.name,
    description: data.description || "",
    category: data.category,
    price: data.price,
    image,
    stock: data.stock,
    isActive: data.status !== "inactive",
  };

  payload.weightKg = data.weightKg == null || data.weightKg === "" ? null : data.weightKg;

  if (data.previousPrice == null || data.previousPrice === "") {
    payload.oldPrice = null;
  } else {
    payload.oldPrice = data.previousPrice;
  }

  return payload;
};

const ProductStore = {
  categories: PRODUCT_CATEGORIES,
  lowStockThreshold: LOW_STOCK_THRESHOLD,

  all() {
    return productCache.map((item) => ({ ...item }));
  },

  get(id) {
    const product = productCache.find((item) => item.id === id);
    return product ? { ...product } : null;
  },

  async refresh() {
    const response = await AdminApi.request("/api/products");
    productCache = (response.data || []).map(fromApiProduct);
    return this.all();
  },

  async create(data) {
    const response = await AdminApi.request("/api/products", {
      method: "POST",
      body: JSON.stringify(toApiProduct(data)),
    });
    const product = fromApiProduct(response.data);
    productCache.unshift(product);
    return product;
  },

  async update(id, data) {
    const response = await AdminApi.request(`/api/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(toApiProduct(data)),
    });
    const product = fromApiProduct(response.data);
    productCache = productCache.map((item) => (item.id === id ? product : item));
    return product;
  },

  async remove(id) {
    await AdminApi.request(`/api/products/${id}`, { method: "DELETE" });
    productCache = productCache.filter((item) => item.id !== id);
  },
};
