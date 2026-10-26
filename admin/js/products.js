const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const API_FIELD_MAP = { oldPrice: "previousPrice", isActive: "status" };

const isAllowedImageFile = (file) => {
  if (ALLOWED_IMAGE_TYPES.has(file.type)) {
    return true;
  }
  const extension = String(file.name || "").split(".").pop().toLowerCase();
  return ALLOWED_IMAGE_EXTENSIONS.has(extension);
};

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
      <td data-label="Prix">${
        product.previousPrice != null && product.previousPrice > product.price
          ? `<del class="price-old">${formatAdminPrice(product.previousPrice)}</del> <strong>${formatAdminPrice(product.price)}</strong>`
          : formatAdminPrice(product.price)
      }</td>
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
  const pageBanner = page.querySelector("[data-page-banner]");
  const pageSuccess = page.querySelector("[data-page-success]");
  const loading = page.querySelector("[data-product-loading]");
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
  let pendingFile = null;
  let previewObjectUrl = "";
  let pendingDeleteId = null;

  const revokePreviewUrl = () => {
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = "";
    }
  };

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
    ["name", "category", "price", "stock", "image", "previousPrice", "weightKg"].forEach((name) => setError(name, ""));
    banner.hidden = true;
    banner.textContent = "";
    imageInput.classList.remove("is-invalid");
  };

  const showPageError = (message) => {
    pageSuccess.hidden = true;
    pageBanner.hidden = false;
    pageBanner.textContent = message;
  };

  const showPageSuccess = (message) => {
    pageBanner.hidden = true;
    pageSuccess.hidden = false;
    pageSuccess.textContent = message;
  };

  const applyApiFieldErrors = (errors) => {
    if (!Array.isArray(errors)) {
      return;
    }
    errors.forEach((item) => {
      const field = API_FIELD_MAP[item.field] || item.field;
      if (field === "image") {
        imageInput.classList.add("is-invalid");
      }
      setError(field, item.message);
    });
  };

  const showPreview = (src) => {
    const previewSrc = src || "";
    if (previewSrc) {
      preview.innerHTML = `<img src="${escapeAdminHtml(previewSrc)}" alt="Aperçu du produit" />`;
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
    pendingFile = null;
    revokePreviewUrl();
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
    form.querySelector("[name='weightKg']").value = product?.weightKg != null ? String(product.weightKg) : "";
    form.querySelector("[name='stock']").value = product ? String(product.stock) : "0";
    form.querySelector(`[name='status'][value='${product?.status === "inactive" ? "inactive" : "active"}']`).checked =
      true;
    pendingFile = null;
    revokePreviewUrl();
    pendingImage = product?.image || "";
    showPreview(pendingImage);
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

  const loadProducts = async () => {
    pageBanner.hidden = true;
    pageSuccess.hidden = true;
    loading.hidden = false;
    empty.hidden = true;
    page.querySelector(".table-wrap").hidden = true;
    count.textContent = "";

    try {
      await ProductStore.refresh();
      render();
    } catch (error) {
      list.innerHTML = "";
      count.textContent = "";
      empty.hidden = true;
      page.querySelector(".table-wrap").hidden = true;
      showPageError(error.message || "Impossible de charger les produits.");
    } finally {
      loading.hidden = true;
    }
  };

  const collect = () => {
    const data = new FormData(form);
    const previousRaw = String(data.get("previousPrice") || "").trim();
    const priceRaw = String(data.get("price") || "").trim();
    const stockRaw = String(data.get("stock") || "").trim();
    const weightRaw = String(data.get("weightKg") || "").trim();
    return {
      weightKg: weightRaw === "" ? null : Number(weightRaw),
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
    } else if (payload.previousPrice != null && payload.previousPrice <= payload.price) {
      setError("previousPrice", "L'ancien prix doit être plus élevé que le prix actuel.");
      valid = false;
    }
    if (
      payload.weightKg != null &&
      (!Number.isFinite(payload.weightKg) ||
        payload.weightKg <= 0 ||
        Math.abs(payload.weightKg * 1000 - Math.round(payload.weightKg * 1000)) > 1e-6)
    ) {
      setError("weightKg", "Le poids doit être positif (3 décimales maximum), ou laissé vide.");
      valid = false;
    }
    if (!Number.isFinite(payload.stock) || payload.stock < 0 || !Number.isInteger(payload.stock)) {
      setError("stock", "Le stock doit être un entier positif ou égal à 0.");
      valid = false;
    }
    if (!payload.image && !pendingFile) {
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
  loadProducts();

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

  page.querySelector("[data-confirm-delete]").addEventListener("click", async () => {
    const button = page.querySelector("[data-confirm-delete]");
    if (!pendingDeleteId) {
      return;
    }

    button.disabled = true;
    button.textContent = "Suppression…";

    try {
      await ProductStore.remove(pendingDeleteId);
      pendingDeleteId = null;
      deleteDialog.hidden = true;
      document.body.classList.remove("is-locked");
      render();
      showPageSuccess("Le produit a été supprimé.");
    } catch (error) {
      deleteDialog.hidden = true;
      document.body.classList.remove("is-locked");
      showPageError(error.message || "La suppression a échoué.");
    } finally {
      button.disabled = false;
      button.textContent = "Supprimer";
    }
  });

  imageInput.addEventListener("change", () => {
    const file = imageInput.files?.[0];
    setError("image", "");
    imageInput.classList.remove("is-invalid");
    if (!file) {
      pendingFile = null;
      revokePreviewUrl();
      showPreview(pendingImage);
      return;
    }
    if (!isAllowedImageFile(file)) {
      pendingFile = null;
      imageInput.value = "";
      setError("image", "Choisissez une image JPG, JPEG, PNG ou WEBP.");
      imageInput.classList.add("is-invalid");
      showPreview(pendingImage);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      pendingFile = null;
      imageInput.value = "";
      setError("image", "L'image doit faire 5 Mo maximum.");
      imageInput.classList.add("is-invalid");
      showPreview(pendingImage);
      return;
    }
    pendingFile = file;
    revokePreviewUrl();
    previewObjectUrl = URL.createObjectURL(file);
    showPreview(previewObjectUrl);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = collect();
    if (!validate(payload)) {
      form.querySelector(".is-invalid")?.focus();
      return;
    }

    const submit = form.querySelector("[type='submit']");
    submit.disabled = true;
    imageInput.disabled = true;

    try {
      if (pendingFile) {
        submit.textContent = "Téléchargement de l'image…";
        banner.hidden = false;
        banner.textContent = "Téléchargement de l'image…";
        payload.image = await AdminApi.uploadImage(pendingFile);
        pendingImage = payload.image;
        pendingFile = null;
        banner.hidden = true;
        banner.textContent = "";
      }

      submit.textContent = "Enregistrement…";

      if (editingId) {
        await ProductStore.update(editingId, payload);
        closeForm();
        render();
        showPageSuccess("Le produit a été modifié.");
      } else {
        await ProductStore.create(payload);
        closeForm();
        render();
        showPageSuccess("Le produit a été ajouté.");
      }
    } catch (error) {
      applyApiFieldErrors(error.errors);
      banner.hidden = false;
      banner.textContent = error.message || "L'enregistrement a échoué.";
    } finally {
      submit.disabled = false;
      imageInput.disabled = false;
      submit.textContent = "Enregistrer";
    }
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
