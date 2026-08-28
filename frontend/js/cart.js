const CART_KEY = "elegance-vegetal-cart";
const CART_MAX_QTY = 99;

const readCart = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_KEY));
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item) => item && typeof item.id === "string" && Number(item.quantity) > 0)
      .map((item) => ({
        id: item.id,
        quantity: Math.min(CART_MAX_QTY, Math.max(1, Math.round(Number(item.quantity)))),
        name: item.name || "",
        price: Number(item.price) || 0,
        image: item.image || "",
        alt: item.alt || "",
      }));
  } catch {
    return [];
  }
};

const Cart = {
  items() {
    return readCart();
  },

  save(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    this.syncBadge();
    document.dispatchEvent(new CustomEvent("cart:updated"));
  },

  totalQuantity(items = readCart()) {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  },

  totalPrice(items = readCart()) {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },

  add(id, quantity = 1) {
    const product = typeof getProductById === "function" ? getProductById(id) : null;
    if (!product) {
      return false;
    }

    const amount = Math.max(1, Math.round(Number(quantity) || 1));
    const items = readCart();
    const line = items.find((item) => item.id === id);

    if (line) {
      line.quantity = Math.min(CART_MAX_QTY, line.quantity + amount);
      line.name = product.name;
      line.price = product.price;
      line.image = product.image;
      line.alt = product.alt;
    } else {
      items.push({
        id: product.id,
        quantity: Math.min(CART_MAX_QTY, amount),
        name: product.name,
        price: product.price,
        image: product.image,
        alt: product.alt,
      });
    }

    this.save(items);
    return true;
  },

  setQuantity(id, quantity) {
    const next = Math.max(1, Math.min(CART_MAX_QTY, Math.round(Number(quantity) || 1)));
    const items = readCart().map((item) =>
      item.id === id ? { ...item, quantity: next } : item
    );
    this.save(items);
  },

  remove(id) {
    this.save(readCart().filter((item) => item.id !== id));
  },

  clear() {
    this.save([]);
  },

  syncBadge() {
    const count = this.totalQuantity();
    document.querySelectorAll("[data-cart-count]").forEach((badge) => {
      badge.textContent = String(count);
    });
    document.querySelectorAll(".cart-btn").forEach((link) => {
      link.setAttribute(
        "aria-label",
        count <= 1 ? `Panier, ${count} article` : `Panier, ${count} articles`
      );
    });
  },
};

const syncCartBadge = () => Cart.syncBadge();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", syncCartBadge);
} else {
  syncCartBadge();
}

window.addEventListener("storage", (event) => {
  if (event.key === CART_KEY) {
    Cart.syncBadge();
    document.dispatchEvent(new CustomEvent("cart:updated"));
  }
});
