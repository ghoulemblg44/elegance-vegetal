const escapeLivraisonHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const initLivraisonPage = () => {
  const page = document.querySelector("[data-livraison-page]");
  if (!page) {
    return;
  }

  const list = page.querySelector("[data-tariff-list]");
  const search = page.querySelector("[data-wilaya-search]");
  const feeInput = page.querySelector("[data-extra-item-fee]");
  const saveBtn = page.querySelector("[data-save-tariffs]");
  const countEl = page.querySelector("[data-tariff-count]");
  const emptyEl = page.querySelector("[data-tariff-empty]");
  const banner = page.querySelector("[data-livraison-banner]");

  let wilayas = [];
  let saving = false;

  const showBanner = (message, isError = false) => {
    if (!banner) {
      return;
    }
    banner.hidden = !message;
    banner.textContent = message || "";
    banner.classList.toggle("is-error", Boolean(isError));
  };

  const moneyValue = (value) => {
    if (value === null || value === undefined || value === "") {
      return "";
    }
    return String(value);
  };

  const parseFee = (raw) => {
    const text = String(raw || "").trim();
    if (text === "") {
      return null;
    }
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
  };

  const isAvailable = (wilaya) => wilaya.home != null && wilaya.stopDesk != null;

  const rowTemplate = (wilaya) => {
    const available = isAvailable(wilaya);
    return `
      <tr data-wilaya-row="${escapeLivraisonHtml(wilaya.code)}">
        <td data-label="Code"><strong>${escapeLivraisonHtml(wilaya.code)}</strong></td>
        <td data-label="Wilaya">${escapeLivraisonHtml(wilaya.name)}</td>
        <td data-label="Domicile (DA)">
          <input
            type="number"
            min="0"
            step="1"
            data-home
            value="${escapeLivraisonHtml(moneyValue(wilaya.home))}"
            placeholder="—"
            aria-label="Tarif domicile ${escapeLivraisonHtml(wilaya.name)}"
          />
        </td>
        <td data-label="Stop-Desk (DA)">
          <input
            type="number"
            min="0"
            step="1"
            data-stop-desk
            value="${escapeLivraisonHtml(moneyValue(wilaya.stopDesk))}"
            placeholder="—"
            aria-label="Tarif Stop-Desk ${escapeLivraisonHtml(wilaya.name)}"
          />
        </td>
        <td data-label="Disponible">
          <span class="livraison-available ${available ? "is-on" : ""}" data-available>
            ${available ? "Oui" : "Non"}
          </span>
        </td>
      </tr>
    `;
  };

  const syncRow = (row) => {
    const code = row.getAttribute("data-wilaya-row");
    const wilaya = wilayas.find((entry) => entry.code === code);
    if (!wilaya) {
      return;
    }
    wilaya.home = parseFee(row.querySelector("[data-home]").value);
    wilaya.stopDesk = parseFee(row.querySelector("[data-stop-desk]").value);
    const badge = row.querySelector("[data-available]");
    const available = isAvailable(wilaya);
    badge.textContent = available ? "Oui" : "Non";
    badge.classList.toggle("is-on", available);
  };

  const normalizeQuery = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const render = () => {
    // Persist visible edits before re-rendering (search filter).
    list.querySelectorAll("[data-wilaya-row]").forEach(syncRow);

    const query = normalizeQuery(search.value);
    const filtered = wilayas.filter((wilaya) =>
      normalizeQuery(`${wilaya.code} ${wilaya.name}`).includes(query)
    );

    list.innerHTML = filtered.map(rowTemplate).join("");
    countEl.textContent = `${filtered.length} wilaya${filtered.length > 1 ? "s" : ""}`;
    emptyEl.hidden = filtered.length > 0;

    list.querySelectorAll("[data-wilaya-row]").forEach((row) => {
      row.querySelectorAll("input").forEach((input) => {
        input.addEventListener("input", () => syncRow(row));
      });
    });
  };

  const collectPayload = () => {
    list.querySelectorAll("[data-wilaya-row]").forEach(syncRow);
    return {
      extraItemFee: Number(feeInput.value),
      wilayas: wilayas.map((wilaya) => ({
        code: wilaya.code,
        zone: wilaya.zone == null ? 0 : wilaya.zone,
        home: wilaya.home,
        stopDesk: wilaya.stopDesk,
      })),
    };
  };

  const load = async () => {
    showBanner("");
    try {
      const payload = await AdminApi.request("/api/delivery/tariffs");
      const data = payload.data || {};
      wilayas = (data.wilayas || []).map((wilaya) => ({ ...wilaya }));
      feeInput.value = data.extraItemFee != null ? data.extraItemFee : 250;
      render();
    } catch (error) {
      showBanner(error.message || "Impossible de charger les tarifs.", true);
      list.innerHTML = "";
      countEl.textContent = "";
    }
  };

  const save = async () => {
    if (saving) {
      return;
    }
    saving = true;
    saveBtn.disabled = true;
    showBanner("");

    try {
      const payload = collectPayload();
      if (!Number.isFinite(payload.extraItemFee) || payload.extraItemFee < 0) {
        throw new Error("Indiquez un montant valide pour le frais par article supplémentaire.");
      }
      const response = await AdminApi.request("/api/delivery/tariffs", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      wilayas = ((response.data && response.data.wilayas) || payload.wilayas).map((wilaya) => ({ ...wilaya }));
      feeInput.value =
        response.data && response.data.extraItemFee != null ? response.data.extraItemFee : payload.extraItemFee;
      render();
      showBanner("Tarifs enregistrés. Les nouveaux prix s'appliquent immédiatement aux commandes.");
    } catch (error) {
      showBanner(error.message || "Enregistrement impossible.", true);
    } finally {
      saving = false;
      saveBtn.disabled = false;
    }
  };

  search.addEventListener("input", render);
  saveBtn.addEventListener("click", save);
  load();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLivraisonPage);
} else {
  initLivraisonPage();
}
