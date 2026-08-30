const MAX_IMAGE_BYTES = 800 * 1024;

const escapeAdminHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const stockTone = (stock) => {
  if (stock <= 0) {
    return "status--cancelled";
  }
  if (stock <= ProductStore.lowStockThreshold) {
    return "status--low";
  }
  return "status--received";
};

const matchesFilters = (product, query, category, stockFilter) => {
  const haystack = `${product.name} ${product.category} ${product.description}`.toLowerCase();
  const queryOk = !query || haystack.includes(query);
  const categoryOk = category === "all" || product.category === category;
  const stockOk =
    stockFilter === "all" ||
    (stockFilter === "in-stock" && product.stock > 0) ||
    (stockFilter === "low" && product.stock > 0 && product.stock <= ProductStore.lowStockThreshold) ||
    (stockFilter === "out" && product.stock <= 0);
  return queryOk && categoryOk && stockOk;
};

const productRowTemplate = (product) => {
  const active = product.status === "active";
  return `
    <tr>
      <td data-label="Image">
        <img class="product-thumb" src="${escapeAdminHtml(product.image)}" alt="" />
      </td>
      <td data-label="Nom"><strong>${escapeAdminHtml(product.name)}</strong></td>
      <td data-label="Catégorie">${escapeAdminHtml(product.category)}</td>
      <td data-label="Prix">${formatAdminPrice(product.price)}</td>
      <td data-label="Stock"><span class="status ${stockTone(product.stock)}">${product.stock}</span></td>
      <td data-label="Statut">
        <span class="status ${active ? "status--received" : "status--delivered"}">${active ? "Actif" : "Inactif"}</span>
      </td>
      <td data-label="Actions">
        <div class="row-actions">
          <button class="text-btn" type="button" data-edit="${escapeAdminHtml(product.id)}">Modifier</button>
          <button class="text-btn text-btn--danger" type="button" data-delete="${escapeAdminHtml(product.id)}">Supprimer</button>
        </div>
      </td>
    </tr>
  `;
};

const initProductsPage = () => {
  const page = document.querySelector("[data-products-page]");
  if (!page) {
    return;
  }

  const search = page.querySelector("[data-product-search]");
  const categoryFilter = page.querySelector("[data-filter-category]");
  const stockFilter = page.querySelector("[data-filter-stock]");
  const list = page.querySelector("[data-product-list]");
  const count = page.querySelector("[data-product-count]");
  const empty = page.querySelector("[data-product-empty]");
  const formDialog = page.querySelector("[data-product-dialog]");
  const form = page.querySelector("[data-product-form]");
  const formTitle = page.querySelector("[data-form-title]");
  const banner = page.querySelector("[data-form-banner]");
  const preview = page.querySelector("[data-image-preview]");
  const imageInput = page.querySelector("[data-image-input]");
  const deleteDialog = page.querySelector("[data-delete-dialog]");
  const deleteName = page.querySelector("[data-delete-name]");
  let editingId = null;
  let pendingImage = "";
  let pendingDeleteId = null;

  const fillCategories = () => {
    const options = ProductStore.categories
      .map((category) => `<option value="${escapeAdminHtml(category)}">${escapeAdminHtml(category)}</option>`)
      .join("");
    categoryFilter.insertAdjacentHTML("beforeend", options);
    form.querySelector("[name='category']").insertAdjacentHTML("beforeend", options);
  };

  const setError = (name, message) => {
    const field = form.querySelector(`[name="${name}"]`);
    const error = form.querySelector(`[data-error="${name}"]`);
    if (field) {
      field.classList.toggle("is-invalid", Boolean(message));
      field.setAttribute("aria-invalid", message ? "true" : "false");
    }
    if (error) {
      error.hidden = !message;
      error.textContent = message || "";
    }
  };

  const clearErrors = () => {
    ["name", "category", "price", "stock", "image"].forEach((name) => setError(name, ""));
    banner.hidden = true;
    banner.textContent = "";
    imageInput.classList.remove("is-invalid");
  };

  const showPreview = (src) => {
    pendingImage = src || "";
    if (pendingImage) {
      preview.innerHTML = `<img src="${escapeAdminHtml(pendingImage)}" alt="Aperçu du produit" />`;
      preview.hidden = false;
    } else {
      preview.innerHTML = "";
      preview.hidden = true;
    }
  };

  const closeForm = () => {
    formDialog.hidden = true;
    editingId = null;
    pendingImage = "";
    form.reset();
    showPreview("");
    clearErrors();
    document.body.classList.remove("is-locked");
  };

  const openForm = (product) => {
    clearErrors();
    form.reset();
    editingId = product?.id || null;
    formTitle.textContent = product ? "Modifier le produit" : "Ajouter un produit";
    form.querySelector("[name='name']").value = product?.name || "";
    form.querySelector("[name='description']").value = product?.description || "";
    form.querySelector("[name='category']").value = product?.category || "";
    form.querySelector("[name='price']").value = product ? String(product.price) : "";
    form.querySelector("[name='previousPrice']").value =
      product?.previousPrice != null ? String(product.previousPrice) : "";
    form.querySelector("[name='stock']").value = product ? String(product.stock) : "0";
    form.querySelector(`[name='status'][value='${product?.status === "inactive" ? "inactive" : "active"}']`).checked =
      true;
    showPreview(product?.image || "");
    formDialog.hidden = false;
    document.body.classList.add("is-locked");
    form.querySelector("[name='name']").focus();
  };

  const render = () => {
    const query = search.value.trim().toLowerCase();
    const category = categoryFilter.value;
    const stock = stockFilter.value;
    const visible = ProductStore.all().filter((product) => matchesFilters(product, query, category, stock));

    count.textContent = visible.length <= 1 ? `${visible.length} produit` : `${visible.length} produits`;
    empty.hidden = visible.length > 0;
    page.querySelector(".table-wrap").hidden = visible.length === 0;
    list.innerHTML = visible.map(productRowTemplate).join("");
  };

  const collect = () => {
    const data = new FormData(form);
    const previousRaw = String(data.get("previousPrice") || "").trim();
    const priceRaw = String(data.get("price") || "").trim();
    const stockRaw = String(data.get("stock") || "").trim();
    return {
      name: String(data.get("name") || "").trim(),
      description: String(data.get("description") || "").trim(),
      category: String(data.get("category") || "").trim(),
      price: priceRaw === "" ? NaN : Number(priceRaw),
      previousPrice: previousRaw === "" ? null : Number(previousRaw),
      stock: stockRaw === "" ? NaN : Number(stockRaw),
      status: String(data.get("status") || "active"),
      image: pendingImage,
    };
  };

  const validate = (payload) => {
    clearErrors();
    let valid = true;

    if (!payload.name) {
      setError("name", "Indiquez le nom du produit.");
      valid = false;
    }
    if (!ProductStore.categories.includes(payload.category)) {
      setError("category", "Choisissez une catégorie.");
      valid = false;
    }
    if (!Number.isFinite(payload.price) || payload.price <= 0) {
      setError("price", "Le prix doit être un nombre positif, en DA.");
      valid = false;
    }
    if (payload.previousPrice != null && (!Number.isFinite(payload.previousPrice) || payload.previousPrice <= 0)) {
      setError("previousPrice", "L'ancien prix doit être positif, ou laissé vide.");
      valid = false;
    }
    if (!Number.isFinite(payload.stock) || payload.stock < 0 || !Number.isInteger(payload.stock)) {
      setError("stock", "Le stock doit être un entier positif ou égal à 0.");
      valid = false;
    }
    if (!payload.image) {
      setError("image", "Ajoutez une image du produit.");
      imageInput.classList.add("is-invalid");
      valid = false;
    }

    if (!valid) {
      banner.hidden = false;
      banner.textContent = "Veuillez corriger les champs indiqués.";
    }

    return valid;
  };

  fillCategories();
  render();

  search.addEventListener("input", render);
  categoryFilter.addEventListener("change", render);
  stockFilter.addEventListener("change", render);

  page.querySelector("[data-open-create]").addEventListener("click", () => openForm(null));
  page.querySelectorAll("[data-close-form]").forEach((el) => {
    el.addEventListener("click", closeForm);
  });
  formDialog.addEventListener("click", (event) => {
    if (event.target === formDialog) {
      closeForm();
    }
  });

  list.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit]");
    const remove = event.target.closest("[data-delete]");
    if (edit) {
      openForm(ProductStore.get(edit.dataset.edit));
    }
    if (remove) {
      const product = ProductStore.get(remove.dataset.delete);
      pendingDeleteId = product?.id || null;
      deleteName.textContent = product ? `« ${product.name} »` : "ce produit";
      deleteDialog.hidden = false;
      document.body.classList.add("is-locked");
    }
  });

  page.querySelectorAll("[data-close-delete]").forEach((el) => {
    el.addEventListener("click", () => {
      pendingDeleteId = null;
      deleteDialog.hidden = true;
      if (formDialog.hidden) {
        document.body.classList.remove("is-locked");
      }
    });
  });

  page.querySelector("[data-confirm-delete]").addEventListener("click", () => {
    if (pendingDeleteId) {
      ProductStore.remove(pendingDeleteId);
    }
    pendingDeleteId = null;
    deleteDialog.hidden = true;
    document.body.classList.remove("is-locked");
    render();
  });

  imageInput.addEventListener("change", () => {
    const file = imageInput.files?.[0];
    setError("image", "");
    imageInput.classList.remove("is-invalid");
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("image", "Choisissez un fichier image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("image", "L'image doit faire moins de 800 Ko pour cette démo.");
      imageInput.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => showPreview(String(reader.result || ""));
    reader.readAsDataURL(file);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const payload = collect();
    if (!validate(payload)) {
      form.querySelector(".is-invalid")?.focus();
      return;
    }

    if (editingId) {
      ProductStore.update(editingId, payload);
    } else {
      ProductStore.create(payload);
    }
    closeForm();
    render();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }
    if (!deleteDialog.hidden) {
      pendingDeleteId = null;
      deleteDialog.hidden = true;
      if (formDialog.hidden) {
        document.body.classList.remove("is-locked");
      }
      event.stopImmediatePropagation();
      return;
    }
    if (!formDialog.hidden) {
      closeForm();
      event.stopImmediatePropagation();
    }
  });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initProductsPage);
} else {
  initProductsPage();
}
