/*
 * API base URL.
 *  - Served from localhost / 127.0.0.1 / a file: the local backend is used.
 *  - Anywhere else (Vercel…) the site NEVER falls back to localhost: set
 *    API_BASE_PRODUCTION below to the deployed backend URL (no trailing slash),
 *    e.g. "https://elegance-vegetal-api.example.com".
 *    (Alternative: leave it "" and add a Vercel rewrite of /api/* to the backend.)
 */
const API_BASE_PRODUCTION = "";
const IS_LOCAL_HOST = ["localhost", "127.0.0.1", "[::1]", ""].includes(window.location.hostname);
const CUSTOMER_API_BASE = (IS_LOCAL_HOST ? "http://localhost:5000" : API_BASE_PRODUCTION).replace(/\/+$/, "");
if (!IS_LOCAL_HOST && !API_BASE_PRODUCTION) {
  console.warn(
    "API_BASE_PRODUCTION is empty (frontend/js/product-data.js): API calls use this site's own /api path. " +
      "Set it to the backend URL, or configure a Vercel rewrite for /api/*."
  );
}

let PRODUCTS = [];

const formatPrice = (price) => {
  const value = Number(price);
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toLocaleString("fr-FR").replace(/\s/g, "\u00a0")}\u00a0DA`;
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const availabilityFromStock = (stock) => {
  if (stock <= 0) {
    return { availability: "made-to-order", availabilityLabel: "Sur commande — 48 h" };
  }
  if (stock <= 5) {
    return { availability: "limited", availabilityLabel: "Dernières pièces" };
  }
  return { availability: "in-stock", availabilityLabel: "En stock" };
};

const fromApiProduct = (product) => {
  const stock = Number(product.stock);
  const fallback = availabilityFromStock(stock);
  return {
    id: product.slug || product._id || product.id,
    _id: product._id || product.id,
    name: product.name,
    category: product.category,
    price: Number(product.price),
    description: product.description || "",
    story: product.story || product.description || "",
    availability: product.availability || fallback.availability,
    availabilityLabel: product.availabilityLabel || fallback.availabilityLabel,
    image: product.image,
    alt: product.alt || product.name,
    stock,
  };
};

const loadProductsFromApi = async () => {
  const response = await fetch(`${CUSTOMER_API_BASE}/api/products?active=true`);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((payload && payload.message) || "Impossible de charger les produits.");
  }
  PRODUCTS = (payload.data || []).map(fromApiProduct);
  document.dispatchEvent(new CustomEvent("products:loaded"));
  return PRODUCTS;
};

const catalogReady = loadProductsFromApi().catch((error) => {
  console.error(error.message);
  PRODUCTS = [];
  document.dispatchEvent(new CustomEvent("products:loaded"));
  return PRODUCTS;
});

const ProductCatalog = {
  ready() {
    return catalogReady;
  },
};

const getProductById = (id) =>
  PRODUCTS.find((product) => product.id === id || product._id === id) || null;

const getRelatedProducts = (product, limit = 4) => {
  const sameCategory = PRODUCTS.filter(
    (item) => item.category === product.category && item.id !== product.id
  );
  const others = PRODUCTS.filter(
    (item) => item.category !== product.category && item.id !== product.id
  );
  return [...sameCategory, ...others].slice(0, limit);
};

const getProductIdFromLocation = () => {
  const fromQuery = new URLSearchParams(window.location.search).get("id");
  if (fromQuery) {
    return fromQuery.trim();
  }
  return decodeURIComponent(window.location.hash.replace(/^#/, "")).trim();
};
