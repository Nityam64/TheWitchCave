// js/app.js - Master Application Controller for Hexley's Potion Pantry
import { dbService } from "./db-service.js";
import { calculateForecastForItem, generateDailyHistoryAndForecast } from "./forecast.js";
import { detectUnusualConsumption } from "./alerts.js";
// Local-only mode: no Firebase imports needed.

// Global App State
export const state = {
  currentPage: "dashboard",
  inventory: [],
  suppliers: [],
  sales: [],
  movements: [],
  settings: {},
  cart: {}, // { [itemId]: quantity }
  dbStatus: "initializing"
};

// --- TOAST NOTIFICATIONS ---
export function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "toast-error" : type === "success" ? "toast-success" : ""}`;
  const icon = type === "error"
    ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
    : type === "success"
    ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
    : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  toast.innerHTML = `<span style="display:flex;align-items:center;">${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// --- MODAL HELPERS ---
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add("open");
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("open");
}

// --- INITIALIZATION ---
async function initApp() {
  setupNavigation();
  setupEventListeners();

  // Initialize DB Service
  const res = await dbService.initialize();
  updateDbStatusUI(res);

  await loadAllData();
  renderCurrentPage();
}

function updateDbStatusUI(res) {
  const badge = document.getElementById("db-status-badge");
  const icon = document.getElementById("db-status-icon");
  const text = document.getElementById("db-status-text");

  if (!badge) return;

  badge.className = "db-status-badge status-demo";
  if (icon) icon.textContent = "●";
  if (text) text.textContent = "Local Storage Active";
}

// --- DATA LOADING ---
export async function loadAllData() {
  try {
    const [inv, sup, sal, mov, set] = await Promise.all([
      dbService.getInventory(),
      dbService.getSuppliers(),
      dbService.getSales(),
      dbService.getStockMovements(),
      dbService.getSettings()
    ]);
    state.inventory = inv;
    state.suppliers = sup;
    state.sales = sal;
    state.movements = mov;
    state.settings = set || {};
  } catch (err) {
    console.error("Data load error:", err);
    showToast("Error loading pantry data: " + err.message, "error");
  }
}

// --- NAVIGATION ---
function setupNavigation() {
  const navButtons = document.querySelectorAll(".nav-btn");
  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const page = btn.dataset.page;
      navigateTo(page);
    });
  });

  // Handle Hash routing
  window.addEventListener("hashchange", () => {
    const hash = window.location.hash.replace("#", "");
    if (hash && ["dashboard", "inventory", "sale", "forecast", "activity", "suppliers"].includes(hash)) {
      navigateTo(hash, false);
    }
  });

  // Check initial hash
  const initialHash = window.location.hash.replace("#", "");
  if (initialHash && ["dashboard", "inventory", "sale", "forecast", "activity", "suppliers"].includes(initialHash)) {
    navigateTo(initialHash, false);
  }
}

export function navigateTo(page, updateHash = true) {
  state.currentPage = page;
  if (updateHash) {
    window.location.hash = page;
  }

  // Update nav buttons
  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.page === page);
  });

  // Show target section
  document.querySelectorAll(".page-section").forEach(sec => {
    sec.classList.remove("active");
  });
  const target = document.getElementById(`section-${page}`);
  if (target) target.classList.add("active");

  renderCurrentPage();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderCurrentPage() {
  switch (state.currentPage) {
    case "dashboard":
      renderDashboard();
      break;
    case "inventory":
      renderInventory();
      break;
    case "sale":
      renderSalePage();
      break;
    case "forecast":
      renderForecastPage();
      break;
    case "activity":
      renderActivityPage();
      break;
    case "suppliers":
      renderSuppliersPage();
      break;
  }
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
  // Global modal close handlers
  document.querySelectorAll("[data-close-modal]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const modal = e.target.closest(".modal-backdrop");
      if (modal) modal.classList.remove("open");
    });
  });

  // Close modals on backdrop click
  document.querySelectorAll(".modal-backdrop").forEach(modal => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("open");
    });
  });

  // Header quick buttons
  document.getElementById("dash-btn-sale")?.addEventListener("click", () => navigateTo("sale"));
  document.getElementById("dash-btn-add")?.addEventListener("click", () => openItemModal());
  document.getElementById("inv-btn-add")?.addEventListener("click", () => openItemModal());
  // Local storage badge — clicking just shows a friendly info toast

  // Inventory Filters
  document.getElementById("inv-search")?.addEventListener("input", renderInventory);
  document.getElementById("inv-filter-category")?.addEventListener("change", renderInventory);
  document.getElementById("inv-filter-status")?.addEventListener("change", renderInventory);

  // Forms
  document.getElementById("form-item")?.addEventListener("submit", handleSaveItem);
  document.getElementById("form-delivery")?.addEventListener("submit", handleRecordDelivery);
  document.getElementById("form-adjust")?.addEventListener("submit", handleRecordAdjustment);
  document.getElementById("form-supplier")?.addEventListener("submit", handleSaveSupplier);
  document.getElementById("form-festival")?.addEventListener("submit", handleSaveFestival);

  // Buttons on other pages
  document.getElementById("btn-confirm-sale")?.addEventListener("click", handleConfirmSale);
  document.getElementById("btn-edit-festival")?.addEventListener("click", openFestivalModal);
  document.getElementById("btn-record-delivery")?.addEventListener("click", openDeliveryModal);
  document.getElementById("btn-add-supplier")?.addEventListener("click", openSupplierModal);
  document.getElementById("btn-open-adjust-modal")?.addEventListener("click", openAdjustModal);
  document.getElementById("btn-reset-sample-data")?.addEventListener("click", handleResetSampleData);

  // Forecast item selector
  document.getElementById("forecast-item-select")?.addEventListener("change", (e) => {
    renderForecastDetails(e.target.value);
  });
}

// ==========================================
// 1. DASHBOARD PAGE
// ==========================================
function renderDashboard() {
  const items = state.inventory.filter(i => !i.isArchived);
  const totalItems = items.length;
  const lowStockItems = items.filter(i => i.quantity > 0 && i.quantity <= i.minStock);
  const outOfStockItems = items.filter(i => i.quantity === 0);

  // Sales Today
  const todayStr = new Date().toISOString().split("T")[0];
  const salesToday = state.sales.filter(s => new Date(s.timestamp).toISOString().split("T")[0] === todayStr);
  const salesCountToday = salesToday.reduce((sum, s) => {
    return sum + (s.items ? s.items.reduce((acc, it) => acc + (it.quantity || 0), 0) : 0);
  }, 0);
  const salesAmountToday = salesToday.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

  // Items predicted to run out < 7 days
  const runoutSoon = items.filter(item => {
    const fc = calculateForecastForItem(item, state.sales, state.settings);
    return fc.hasEnoughData && fc.daysUntilStockout <= 7 && fc.daysUntilStockout > 0;
  });

  // Update Stat Elements
  document.getElementById("stat-total-items").textContent = totalItems;
  document.getElementById("stat-low-stock").textContent = lowStockItems.length;
  document.getElementById("stat-out-stock").textContent = outOfStockItems.length;
  document.getElementById("stat-sales-today").textContent = salesCountToday;
  document.getElementById("stat-sales-amount").textContent = `¢${salesAmountToday.toFixed(2)} total earned`;
  document.getElementById("stat-runout-soon").textContent = runoutSoon.length;

  // Festival Banner update
  const festItems = items.filter(i => i.isFestivalAffected);
  const festNamesHtml = festItems.length > 0
    ? festItems.map(i => `<span class="apothecary-pill"><span class="pill-moon">☾</span> ${i.name}</span>`).join(" ")
    : '<span class="apothecary-pill-empty">None currently designated</span>';
  const festNamesEl = document.getElementById("festival-item-names");
  if (festNamesEl) festNamesEl.innerHTML = festNamesHtml;

  // Unusual Consumption Alerts
  const unusualAlerts = detectUnusualConsumption(state.inventory, state.sales);
  const alertsContainer = document.getElementById("unusual-alerts-container");
  if (alertsContainer) {
    if (unusualAlerts.length === 0) {
      alertsContainer.innerHTML = "";
    } else {
      alertsContainer.innerHTML = unusualAlerts.map(alert => `
        <div class="alert-box ${alert.severity === "critical" ? "alert-critical" : "alert-warning"}">
          <div class="alert-icon-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${alert.severity === "critical" ? "#fda4af" : "#fcd34d"}" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div class="alert-content">
            <div class="alert-title">
              ${alert.date ? `<span style="display:inline-block; background:rgba(200,109,59,0.25); border:1px solid rgba(200,109,59,0.5); padding:1px 6px; border-radius:4px; font-size:0.75rem; margin-right:8px; font-family:monospace; color:var(--accent-copper);">${alert.date}</span>` : ""}
              ${alert.itemName}: ${alert.headline}
            </div>
            <div class="alert-text">
              <strong>Measured Usage:</strong> ${alert.measuredUsage} vs <strong>Normal Average:</strong> ${alert.normalAverage} ${alert.zScore ? `(Z-Score: +${alert.zScore}σ)` : ""}.<br>
              ${alert.suggestion}
            </div>
            <div class="alert-meta">
              <a href="#activity" class="nav-shortcut" style="color:var(--accent-copper); text-decoration:underline;">Inspect Movements &rarr;</a>
            </div>
          </div>
        </div>
      `).join("");
    }
  }

  // Recent Sales Widget
  const recentSalesEl = document.getElementById("dash-recent-sales");
  if (recentSalesEl) {
    if (state.sales.length === 0) {
      recentSalesEl.innerHTML = `<p style="color:var(--text-dim); font-size:0.9rem;">No sales recorded yet.</p>`;
    } else {
      const recent = [...state.sales].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 4);
      recentSalesEl.innerHTML = recent.map(s => {
        const itemSummaries = (s.items || []).map(i => `${i.quantity}x ${i.itemName}`).join(", ");
        const timeAgo = formatTimeAgo(new Date(s.timestamp));
        return `
          <div class="ledger-entry-row">
            <div>
              <div class="ledger-item-name">${itemSummaries || "Apothecary draught"}</div>
              <div class="ledger-meta">${timeAgo} ${s.notes ? `&bull; ${s.notes}` : ""}</div>
            </div>
            <div class="ledger-amount-copper">&cent;${(s.totalAmount || 0).toFixed(2)}</div>
          </div>
        `;
      }).join("");
    }
  }

  // Recent Movements Widget
  const recentMovementsEl = document.getElementById("dash-recent-movements");
  if (recentMovementsEl) {
    if (state.movements.length === 0) {
      recentMovementsEl.innerHTML = `<p style="color:var(--text-dim); font-size:0.9rem;">No stock movements recorded yet.</p>`;
    } else {
      const recentMovs = [...state.movements].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 4);
      recentMovementsEl.innerHTML = recentMovs.map(m => {
        const isDeduction = m.quantityDelta < 0;
        const color = isDeduction ? "#fda4af" : "#6ee7b7";
        return `
          <div class="ledger-entry-row">
            <div>
              <div class="ledger-item-name">${m.itemName}</div>
              <div class="ledger-meta">${capitalize(m.type)} &bull; ${m.reason || "Inventory count"}</div>
            </div>
            <div style="font-weight:700; color:${color}; font-size:0.92rem; font-feature-settings:'tnum';">
              ${isDeduction ? "" : "+"}${m.quantityDelta} &rarr; ${m.quantityAfter}
            </div>
          </div>
        `;
      }).join("");
    }
  }
}

// ==========================================
// 2. INVENTORY PAGE
// ==========================================
function renderInventory() {
  const tbody = document.getElementById("inventory-tbody");
  if (!tbody) return;

  const searchTerm = (document.getElementById("inv-search")?.value || "").toLowerCase();
  const catFilter = document.getElementById("inv-filter-category")?.value || "all";
  const statusFilter = document.getElementById("inv-filter-status")?.value || "all";

  let items = [...state.inventory];

  // Search filter
  if (searchTerm) {
    items = items.filter(i =>
      i.name.toLowerCase().includes(searchTerm) ||
      (i.supplierName && i.supplierName.toLowerCase().includes(searchTerm)) ||
      i.category.toLowerCase().includes(searchTerm)
    );
  }

  // Category filter
  if (catFilter !== "all") {
    items = items.filter(i => i.category === catFilter);
  }

  // Status filter
  if (statusFilter !== "all") {
    if (statusFilter === "in_stock") items = items.filter(i => !i.isArchived && i.quantity > i.minStock);
    else if (statusFilter === "low_stock") items = items.filter(i => !i.isArchived && i.quantity > 0 && i.quantity <= i.minStock);
    else if (statusFilter === "out_of_stock") items = items.filter(i => !i.isArchived && i.quantity === 0);
    else if (statusFilter === "festival") items = items.filter(i => !i.isArchived && i.isFestivalAffected);
    else if (statusFilter === "archived") items = items.filter(i => i.isArchived);
  } else {
    // Hide archived by default unless chosen
    items = items.filter(i => !i.isArchived);
  }

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:32px; color:var(--text-dim);">
          No ingredients match your search and filter criteria.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map(item => {
    let badgeClass = "badge-in-stock";
    let badgeIcon = "●";
    let badgeText = "In Stock";

    if (item.isArchived) {
      badgeClass = "badge-archived";
      badgeIcon = "◌";
      badgeText = "Archived";
    } else if (item.quantity === 0) {
      badgeClass = "badge-out-of-stock";
      badgeIcon = "■";
      badgeText = "Out of Stock";
    } else if (item.quantity <= item.minStock) {
      badgeClass = "badge-low-stock";
      badgeIcon = "▲";
      badgeText = "Low Stock";
    }

    return `
      <tr style="${item.isArchived ? "opacity:0.6;" : ""}">
        <td>
          <div class="item-cell-title">${item.name}</div>
          <div class="item-cell-sub">${capitalize(item.category)} • Unit: ${item.unit}</div>
        </td>
        <td>
          <strong style="font-size:1.05rem; color:${item.quantity === 0 ? "#fda4af" : "inherit"};">
            ${item.quantity} ${item.unit}
          </strong>
        </td>
        <td>
          <span style="color:var(--text-muted);">${item.minStock} ${item.unit}</span>
        </td>
        <td>
          <span class="badge ${badgeClass}">${badgeIcon} ${badgeText}</span>
        </td>
        <td>
          <div>${item.supplierName || "No Supplier Assigned"}</div>
          <div class="item-cell-sub">${item.leadTimeDays ? `${item.leadTimeDays}d lead time` : ""}</div>
        </td>
        <td>
          ${item.isFestivalAffected ? `<span class="badge badge-festival"><span class="badge-dot">☾</span> ${item.festivalMultiplier || 3}&times; Demand</span>` : `<span style="color:var(--text-dim);">Normal (1&times;)</span>`}
        </td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary btn-sm" onclick="window.hexleyEditItem('${item.id}')">Edit</button>
            ${!item.isArchived ? `<button class="btn btn-danger btn-sm" onclick="window.hexleyArchiveItem('${item.id}')">Archive</button>` : ""}
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// Window bindings for inline button triggers
window.hexleyEditItem = (id) => {
  const item = state.inventory.find(i => i.id === id);
  if (item) openItemModal(item);
};

window.hexleyArchiveItem = async (id) => {
  const item = state.inventory.find(i => i.id === id);
  if (!item) return;

  // Check if item has sales history
  const hasSales = state.sales.some(s => (s.items || []).some(line => line.itemId === id));
  const confirmMsg = hasSales
    ? `"${item.name}" has recorded sales history. Per pantry guidelines, it cannot be permanently deleted. Archive it instead?`
    : `Are you sure you want to archive "${item.name}"?`;

  if (confirm(confirmMsg)) {
    try {
      await dbService.archiveInventoryItem(id);
      showToast(`Archived ${item.name}`, "info");
      await loadAllData();
      renderCurrentPage();
    } catch (err) {
      showToast("Error archiving item: " + err.message, "error");
    }
  }
};

function openItemModal(item = null) {
  const modal = document.getElementById("modal-item");
  const form = document.getElementById("form-item");
  form.reset();

  const title = document.getElementById("modal-item-title");
  const idInput = document.getElementById("item-id");
  const nameInput = document.getElementById("item-name");
  const catInput = document.getElementById("item-category");
  const unitInput = document.getElementById("item-unit");
  const qtyInput = document.getElementById("item-quantity");
  const minInput = document.getElementById("item-min-stock");
  const costInput = document.getElementById("item-cost");
  const supSelect = document.getElementById("item-supplier");
  const festCheck = document.getElementById("item-festival-affected");
  const festMult = document.getElementById("item-festival-mult");

  // Populate suppliers dropdown
  supSelect.innerHTML = `<option value="">-- No Supplier --</option>` +
    state.suppliers.map(s => `<option value="${s.id}">${s.name} (${s.leadTimeDays}d lead)</option>`).join("");

  if (item) {
    title.textContent = `Edit ${item.name}`;
    idInput.value = item.id;
    nameInput.value = item.name;
    catInput.value = item.category || "ingredient";
    unitInput.value = item.unit || "units";
    qtyInput.value = item.quantity;
    minInput.value = item.minStock;
    costInput.value = item.costPerUnit || "";
    supSelect.value = item.supplierId || "";
    festCheck.checked = Boolean(item.isFestivalAffected);
    festMult.value = item.festivalMultiplier || 3;
  } else {
    title.textContent = "Add Pantry Ingredient";
    idInput.value = "";
    catInput.value = "ingredient";
    festCheck.checked = false;
    festMult.value = 3;
  }

  modal.classList.add("open");
}

async function handleSaveItem(e) {
  e.preventDefault();
  const id = document.getElementById("item-id").value;
  const name = document.getElementById("item-name").value.trim();
  const category = document.getElementById("item-category").value;
  const unit = document.getElementById("item-unit").value.trim();
  const quantity = Math.max(0, parseInt(document.getElementById("item-quantity").value, 10) || 0);
  const minStock = Math.max(0, parseInt(document.getElementById("item-min-stock").value, 10) || 0);
  const costPerUnit = parseFloat(document.getElementById("item-cost").value) || 0;
  const supplierId = document.getElementById("item-supplier").value;
  const isFestivalAffected = document.getElementById("item-festival-affected").checked;
  const festivalMultiplier = parseInt(document.getElementById("item-festival-mult").value, 10) || 3;

  const supplier = state.suppliers.find(s => s.id === supplierId);
  const supplierName = supplier ? supplier.name : "";
  const leadTimeDays = supplier ? supplier.leadTimeDays : 3;

  const itemPayload = {
    name,
    category,
    unit,
    quantity,
    minStock,
    costPerUnit,
    supplierId,
    supplierName,
    leadTimeDays,
    isFestivalAffected,
    festivalMultiplier,
    isArchived: false
  };

  if (id) itemPayload.id = id;

  try {
    await dbService.saveInventoryItem(itemPayload);
    closeModal("modal-item");
    showToast(`Saved ingredient: ${name}`, "success");
    await loadAllData();
    renderCurrentPage();
  } catch (err) {
    showToast("Error saving item: " + err.message, "error");
  }
}

// ==========================================
// 3. RECORD SALE PAGE
// ==========================================
function renderSalePage() {
  const grid = document.getElementById("sale-item-picker");
  const ticket = document.getElementById("sale-ticket-list");
  if (!grid || !ticket) return;

  const activeItems = state.inventory.filter(i => !i.isArchived);

  function getItemIcon(name) {
    if (!name) return "🧪";
    const lower = name.toLowerCase();
    if (lower.includes("bat")) return "🦇";
    if (lower.includes("mandrake")) return "🌿";
    if (lower.includes("pepper")) return "🌶️";
    if (lower.includes("eye")) return "👁️";
    if (lower.includes("elixir") || lower.includes("shadow")) return "🔮";
    if (lower.includes("flask") || lower.includes("cauldron")) return "🧪";
    if (lower.includes("petal") || lower.includes("dust")) return "✨";
    if (lower.includes("honey")) return "🍯";
    if (lower.includes("root")) return "🥀";
    if (lower.includes("death") || lower.includes("draught")) return "☠️";
    if (lower.includes("mortar")) return "🥣";
    if (lower.includes("dragon")) return "🐉";
    return "🧪";
  }

  // Render clickable item cards (Victorian apothecary parchment cards with Sold Out stamp)
  grid.innerHTML = activeItems.map(item => {
    const isSelected = Boolean(state.cart[item.id]);
    const isOut = item.quantity === 0;
    const icon = getItemIcon(item.name);

    return `
      <button class="item-ticket-btn ${isSelected ? "selected" : ""}" 
              ${isOut ? "disabled" : ""}
              onclick="${isOut ? "" : `window.hexleyToggleCartItem('${item.id}')`}">
        <span class="stamp">Sold out</span>
        <strong>${icon} ${item.name}</strong>
        <span class="stock">${isOut ? "Depleted" : `Available: ${item.quantity} ${item.unit}`}</span>
        <span class="price">&cent;${(item.costPerUnit || 5).toFixed(2)} / ${item.unit}</span>
      </button>
    `;
  }).join("");

  // Render Ticket List
  const cartItemIds = Object.keys(state.cart);
  if (cartItemIds.length === 0) {
    ticket.innerHTML = `<p style="color:var(--text-dim); font-size:0.9rem; padding:12px 0;">No items added to ticket yet. Click ingredients on the left.</p>`;
    document.getElementById("sale-total-qty").textContent = "0";
    document.getElementById("sale-total-cost").textContent = "¢0.00";
    return;
  }

  let totalQty = 0;
  let totalCost = 0;

  ticket.innerHTML = cartItemIds.map(id => {
    const item = state.inventory.find(i => i.id === id);
    if (!item) return "";
    const qty = state.cart[id] || 1;
    const price = item.costPerUnit || 5.0;
    const lineCost = qty * price;
    totalQty += qty;
    totalCost += lineCost;

    return `
      <div class="cart-item-row">
        <div>
          <div style="font-weight:600; color:var(--text-cream);">${item.name}</div>
          <div style="font-size:0.75rem; color:var(--text-dim);">Stock: ${item.quantity} ${item.unit}</div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <input type="number" class="cart-qty-input" min="1" max="${item.quantity}" value="${qty}"
                 onchange="window.hexleyUpdateCartQty('${item.id}', this.value)">
          <span style="font-size:0.85rem; color:var(--text-muted);">${item.unit}</span>
          <button class="btn btn-danger btn-sm" onclick="window.hexleyRemoveCartItem('${item.id}')" style="padding:4px 8px;">✕</button>
        </div>
      </div>
    `;
  }).join("");

  document.getElementById("sale-total-qty").textContent = totalQty;
  document.getElementById("sale-total-cost").textContent = `¢${totalCost.toFixed(2)}`;
}

window.hexleyToggleCartItem = (id) => {
  if (state.cart[id]) {
    delete state.cart[id];
  } else {
    state.cart[id] = 1;
  }
  renderSalePage();
};

window.hexleyUpdateCartQty = (id, val) => {
  const item = state.inventory.find(i => i.id === id);
  if (!item) return;
  let qty = parseInt(val, 10);
  if (isNaN(qty) || qty <= 0) qty = 1;
  if (qty > item.quantity) {
    showToast(`Cannot sell ${qty}! Only ${item.quantity} in stock.`, "error");
    qty = item.quantity;
  }
  state.cart[id] = qty;
  renderSalePage();
};

window.hexleyRemoveCartItem = (id) => {
  delete state.cart[id];
  renderSalePage();
};

async function handleConfirmSale() {
  const cartItemIds = Object.keys(state.cart);
  if (cartItemIds.length === 0) {
    showToast("Please add at least one item to the sale ticket.", "error");
    return;
  }

  // Pre-flight validation
  const lineItems = [];
  let totalAmount = 0;
  for (const id of cartItemIds) {
    const item = state.inventory.find(i => i.id === id);
    const qty = state.cart[id];
    if (!item) continue;
    if (qty > item.quantity) {
      showToast(`Cannot complete sale! Not enough stock for ${item.name} (have: ${item.quantity}, need: ${qty}).`, "error");
      return;
    }
    const unitPrice = item.costPerUnit || 5.0;
    lineItems.push({
      itemId: item.id,
      itemName: item.name,
      quantity: qty,
      unitPrice,
      unit: item.unit
    });
    totalAmount += qty * unitPrice;
  }

  const notes = (document.getElementById("sale-notes")?.value || "").trim();
  const salePayload = {
    items: lineItems,
    totalAmount,
    notes
  };

  try {
    const res = await dbService.recordSaleAtomic(salePayload);
    if (res.success) {
      const ticketCard = document.getElementById("sale-ticket-card");
      if (ticketCard) {
        ticketCard.classList.add("flash");
        setTimeout(() => ticketCard.classList.remove("flash"), 900);
      }
      showToast("✨ Sale completed and stock deducted successfully!", "success");
      state.cart = {};
      if (document.getElementById("sale-notes")) {
        document.getElementById("sale-notes").value = "";
      }
      await loadAllData();
      renderCurrentPage();
    }
  } catch (err) {
    showToast("Sale failed: " + err.message, "error");
  }
}

// ==========================================
// 4. FORECAST & RESTOCK PAGE
// ==========================================
function renderForecastPage() {
  const select = document.getElementById("forecast-item-select");
  if (!select) return;

  const items = state.inventory.filter(i => !i.isArchived);

  // Update header quick counts
  const festMultiplier = state.settings.festivalMultiplier || 3;
  const cursedItems = items.filter(i => i.isFestivalAffected);
  document.getElementById("fc-multiplier-val").textContent = `${festMultiplier}x`;
  document.getElementById("fc-cursed-count").textContent = `${cursedItems.length} ingredients cursed`;

  // Populate item selector
  const prevVal = select.value;
  select.innerHTML = items.map(i => `<option value="${i.id}">${i.name} (${i.quantity} ${i.unit} in stock)</option>`).join("");

  const selectedId = (prevVal && items.some(i => i.id === prevVal)) ? prevVal : (items[0]?.id || "");
  select.value = selectedId;

  if (selectedId) {
    renderForecastDetails(selectedId);
  }

  // Render All Items Restock Table
  renderAllRestockTable();
}

function renderForecastDetails(itemId) {
  const item = state.inventory.find(i => i.id === itemId);
  const container = document.getElementById("forecast-details-card");
  const chartContainer = document.getElementById("forecast-chart-container");
  if (!item || !container) return;

  const fc = calculateForecastForItem(item, state.sales, state.settings);

  container.innerHTML = `
    <div style="background:var(--bg-elevated); border:1px solid var(--border-subtle); border-radius:12px; padding:20px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
        <div>
          <h3 style="font-family:var(--font-serif); font-size:1.3rem; color:var(--text-cream);">
            ${item.name} ${fc.isFestivalActiveForThisItem ? "🌕 (3x FESTIVAL SURGE)" : ""}
          </h3>
          <p style="font-size:0.85rem; color:var(--text-muted); margin-top:2px;">
            ${capitalize(item.category)} • Supplier: ${item.supplierName || "Direct Gathering"} (${item.leadTimeDays || 3}d lead time)
          </p>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.8rem; text-transform:uppercase; color:var(--text-dim);">Recommended Reorder</div>
          <div style="font-size:1.8rem; font-weight:700; color:var(--accent-festival);">
            ${fc.reorderQuantity} ${item.unit}
          </div>
        </div>
      </div>

      <!-- Plain Language Explanation -->
      <div style="background:rgba(18,9,28,0.7); border-left:4px solid var(--accent-purple); border-radius:6px; padding:12px 16px; margin:16px 0; font-size:0.92rem; line-height:1.5;">
        🔮 <strong>Prophecy Insight:</strong> ${fc.explanation}
      </div>

      <!-- Math Breakdown Grid -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; margin-top:14px;">
        <div style="background:var(--bg-surface); padding:10px; border-radius:8px; border:1px solid var(--border-subtle);">
          <div style="font-size:0.75rem; color:var(--text-dim);">Daily Burn Rate</div>
          <div style="font-size:1.1rem; font-weight:700; color:var(--text-cream);">${fc.avgDailySales} ${item.unit}/day</div>
        </div>
        <div style="background:var(--bg-surface); padding:10px; border-radius:8px; border:1px solid var(--border-subtle);">
          <div style="font-size:0.75rem; color:var(--text-dim);">7-Day Demand</div>
          <div style="font-size:1.1rem; font-weight:700; color:var(--text-cream);">${fc.forecastDemand} ${item.unit}</div>
        </div>
        <div style="background:var(--bg-surface); padding:10px; border-radius:8px; border:1px solid var(--border-subtle);">
          <div style="font-size:0.75rem; color:var(--text-dim);">Safety Stock (Min)</div>
          <div style="font-size:1.1rem; font-weight:700; color:var(--text-cream);">${fc.safetyStock} ${item.unit}</div>
        </div>
        <div style="background:var(--bg-surface); padding:10px; border-radius:8px; border:1px solid var(--border-subtle);">
          <div style="font-size:0.75rem; color:var(--text-dim);">Current Stock</div>
          <div style="font-size:1.1rem; font-weight:700; color:var(--text-cream);">${fc.currentStock} ${item.unit}</div>
        </div>
        <div style="background:var(--bg-surface); padding:10px; border-radius:8px; border:1px solid var(--border-subtle);">
          <div style="font-size:0.75rem; color:var(--text-dim);">Stockout Forecast</div>
          <div style="font-size:1.1rem; font-weight:700; color:${fc.daysUntilStockout <= 7 ? "#fda4af" : "#6ee7b7"};">
            ${fc.daysUntilStockout > 100 ? "Stable (>30d)" : `${fc.daysUntilStockout} days`}
          </div>
        </div>
      </div>
    </div>
  `;

  // Render SVG Chart
  if (chartContainer) {
    chartContainer.innerHTML = renderForecastSvgChart(fc.itemSales, fc.forecastDemand);
  }
}

function renderForecastSvgChart(itemSales, forecastDemand) {
  const points = generateDailyHistoryAndForecast(itemSales, forecastDemand);
  const maxVal = Math.max(15, ...points.map(p => (p.actual !== null ? p.actual : p.forecast || 0))) * 1.2;

  const svgWidth = 720;
  const svgHeight = 200;
  const padLeft = 40;
  const padRight = 30;
  const padTop = 20;
  const padBottom = 30;

  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;
  const stepX = plotW / (points.length - 1);

  // Build Bars for actual history and dashed line for future forecast
  let barsHtml = "";
  let pathD = "";

  points.forEach((pt, idx) => {
    const x = padLeft + idx * stepX;
    const val = pt.actual !== null ? pt.actual : pt.forecast;
    const y = padTop + plotH - (val / maxVal) * plotH;

    if (!pt.isFuture) {
      // Historical actual sales bar
      const barH = (pt.actual / maxVal) * plotH;
      const barY = padTop + plotH - barH;
      barsHtml += `
        <rect x="${x - 12}" y="${barY}" width="24" height="${barH}" fill="#2e1f3b" stroke="#c86d3b" stroke-width="1" rx="2">
          <title>${pt.label}: ${pt.actual} units sold</title>
        </rect>
        <text x="${x}" y="${barY - 5}" font-size="10" fill="#f5eedf" text-anchor="middle">${pt.actual}</text>
      `;
    } else {
      // Future projected forecast dot & line
      if (!pathD) {
        // connect from last historical point
        const prevPt = points[idx - 1];
        const prevX = padLeft + (idx - 1) * stepX;
        const prevVal = prevPt.actual !== null ? prevPt.actual : prevPt.forecast;
        const prevY = padTop + plotH - (prevVal / maxVal) * plotH;
        pathD = `M ${prevX} ${prevY} L ${x} ${y}`;
      } else {
        pathD += ` L ${x} ${y}`;
      }
      barsHtml += `
        <circle cx="${x}" cy="${y}" r="4" fill="#dc7a42" stroke="#fff" stroke-width="1">
          <title>${pt.label}: ${pt.forecast} predicted</title>
        </circle>
        <text x="${x}" y="${y - 8}" font-size="10" fill="#dc7a42" font-weight="700" text-anchor="middle">${pt.forecast}</text>
      `;
    }

    // X-axis label
    barsHtml += `
      <text x="${x}" y="${svgHeight - 10}" font-size="9" fill="#8e72a4" text-anchor="middle">${pt.label}</text>
    `;
  });

  return `
    <svg class="chart-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
      <!-- Grid line -->
      <line x1="${padLeft}" y1="${padTop + plotH}" x2="${svgWidth - padRight}" y2="${padTop + plotH}" stroke="#331f52" stroke-width="1"/>
      <!-- Forecast Path -->
      ${pathD ? `<path d="${pathD}" fill="none" stroke="#ff9e00" stroke-width="2" stroke-dasharray="4,4"/>` : ""}
      <!-- Bars & Dots -->
      ${barsHtml}
    </svg>
    <div style="display:flex; justify-content:center; gap:20px; font-size:0.8rem; margin-top:6px; color:var(--text-muted);">
      <span style="display:flex; align-items:center; gap:6px;"><span style="display:inline-block; width:12px; height:12px; background:#7b2cbf; border-radius:2px;"></span> Actual Sales</span>
      <span style="display:flex; align-items:center; gap:6px;"><span style="display:inline-block; width:12px; height:2px; background:#ff9e00; border-bottom:1px dashed #ff9e00;"></span> 7-Day Forecast Curve</span>
    </div>
  `;
}

function renderAllRestockTable() {
  const tbody = document.getElementById("restock-table-tbody");
  if (!tbody) return;

  const items = state.inventory.filter(i => !i.isArchived);

  tbody.innerHTML = items.map(item => {
    const fc = calculateForecastForItem(item, state.sales, state.settings);
    return `
      <tr>
        <td>
          <div class="item-cell-title">${item.name}</div>
          <div class="item-cell-sub">${item.unit} ${fc.isFestivalActiveForThisItem ? "• 🌕 3x Cursed" : ""}</div>
        </td>
        <td><strong>${item.quantity}</strong></td>
        <td>${item.minStock}</td>
        <td>${fc.forecastDemand}</td>
        <td>
          <strong style="color:${fc.reorderQuantity > 0 ? "var(--accent-festival)" : "#6ee7b7"}; font-size:1.05rem;">
            ${fc.reorderQuantity > 0 ? `+${fc.reorderQuantity} ${item.unit}` : "Sufficient"}
          </strong>
        </td>
        <td>${item.supplierName || "Direct"} (${item.leadTimeDays || 3}d)</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="window.hexleyQuickRestockOrder('${item.id}', ${fc.reorderQuantity})">
            Order Restock
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

window.hexleyQuickRestockOrder = (itemId, suggestedQty) => {
  openDeliveryModal(itemId, suggestedQty > 0 ? suggestedQty : 15);
};

// ==========================================
// 5. STOCK ACTIVITY PAGE
// ==========================================
function renderActivityPage() {
  const tbody = document.getElementById("activity-tbody");
  if (!tbody) return;

  const sortedMovements = [...state.movements].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (sortedMovements.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:32px; color:var(--text-dim);">
          No stock movements recorded yet.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = sortedMovements.map(m => {
    const isNegative = m.quantityDelta < 0;
    const deltaColor = isNegative ? "#fda4af" : "#6ee7b7";
    const deltaSign = isNegative ? "" : "+";

    return `
      <tr>
        <td style="font-size:0.85rem; color:var(--text-muted);">${formatDate(new Date(m.timestamp))}</td>
        <td><strong style="color:var(--text-cream);">${m.itemName}</strong></td>
        <td><span class="badge ${m.type === "sale" ? "badge-low-stock" : m.type === "delivery" ? "badge-in-stock" : "badge-archived"}">${capitalize(m.type)}</span></td>
        <td><strong style="color:${deltaColor};">${deltaSign}${m.quantityDelta}</strong></td>
        <td>${m.quantityAfter !== undefined ? m.quantityAfter : "—"}</td>
        <td style="color:var(--text-muted); font-size:0.85rem;">${m.reason || "Pantry update"}</td>
      </tr>
    `;
  }).join("");
}

function openAdjustModal() {
  const modal = document.getElementById("modal-adjust");
  const select = document.getElementById("adj-item");
  select.innerHTML = state.inventory.filter(i => !i.isArchived)
    .map(i => `<option value="${i.id}">${i.name} (Current: ${i.quantity} ${i.unit})</option>`).join("");
  modal.classList.add("open");
}

async function handleRecordAdjustment(e) {
  e.preventDefault();
  const itemId = document.getElementById("adj-item").value;
  const quantityDelta = parseInt(document.getElementById("adj-delta").value, 10);
  const reason = document.getElementById("adj-reason").value.trim();

  try {
    await dbService.recordStockAdjustment({ itemId, quantityDelta, reason });
    closeModal("modal-adjust");
    showToast("Stock adjustment audit logged", "success");
    await loadAllData();
    renderCurrentPage();
  } catch (err) {
    showToast("Adjustment error: " + err.message, "error");
  }
}

// ==========================================
// 6. SUPPLIERS & SETTINGS PAGE
// ==========================================
function renderSuppliersPage() {
  const list = document.getElementById("suppliers-list");
  if (!list) return;

  if (state.suppliers.length === 0) {
    list.innerHTML = `<p style="color:var(--text-dim); font-size:0.9rem;">No apothecary suppliers registered.</p>`;
    return;
  }

  list.innerHTML = state.suppliers.map(s => {
    return `
      <div style="background:var(--bg-elevated); border:1px solid var(--border-subtle); border-radius:10px; padding:14px; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <h4 style="font-family:var(--font-serif); color:var(--text-cream); font-size:1.05rem;">${s.name}</h4>
            <div style="font-size:0.8rem; color:var(--accent-festival); margin-top:2px;">
              Delivery Lead Time: ${s.leadTimeDays} days • Contact: ${s.contact || "Raven Owl"}
            </div>
            <p style="font-size:0.85rem; color:var(--text-muted); margin-top:6px;">${s.notes || ""}</p>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="window.hexleyDeliverFromSupplier('${s.id}')">
            Record Delivery
          </button>
        </div>
      </div>
    `;
  }).join("");
}

window.hexleyDeliverFromSupplier = (supplierId) => {
  openDeliveryModal(null, 20, supplierId);
};

function openSupplierModal() {
  const modal = document.getElementById("modal-supplier");
  document.getElementById("form-supplier")?.reset();
  modal.classList.add("open");
}

async function handleSaveSupplier(e) {
  e.preventDefault();
  const name = document.getElementById("sup-name").value.trim();
  const contact = document.getElementById("sup-contact").value.trim();
  const leadTimeDays = parseInt(document.getElementById("sup-lead").value, 10) || 3;
  const notes = document.getElementById("sup-notes").value.trim();

  try {
    await dbService.saveSupplier({ name, contact, leadTimeDays, notes });
    closeModal("modal-supplier");
    showToast(`Registered supplier: ${name}`, "success");
    await loadAllData();
    renderCurrentPage();
  } catch (err) {
    showToast("Error saving supplier: " + err.message, "error");
  }
}

function openDeliveryModal(defaultItemId = null, defaultQty = 20, defaultSupplierId = null) {
  const modal = document.getElementById("modal-delivery");
  const supSelect = document.getElementById("del-supplier");
  const itemSelect = document.getElementById("del-item");
  const qtyInput = document.getElementById("del-qty");

  supSelect.innerHTML = state.suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
  itemSelect.innerHTML = state.inventory.filter(i => !i.isArchived)
    .map(i => `<option value="${i.id}">${i.name} (Unit: ${i.unit})</option>`).join("");

  if (defaultItemId) itemSelect.value = defaultItemId;
  if (defaultSupplierId) supSelect.value = defaultSupplierId;
  qtyInput.value = defaultQty;

  modal.classList.add("open");
}

async function handleRecordDelivery(e) {
  e.preventDefault();
  const supplierId = document.getElementById("del-supplier").value;
  const itemId = document.getElementById("del-item").value;
  const quantity = parseInt(document.getElementById("del-qty").value, 10);
  const notes = document.getElementById("del-notes").value.trim();

  try {
    await dbService.recordDelivery({ itemId, supplierId, quantity, notes });
    closeModal("modal-delivery");
    showToast("✨ Delivery received and stock restocked!", "success");
    await loadAllData();
    renderCurrentPage();
  } catch (err) {
    showToast("Delivery error: " + err.message, "error");
  }
}

// Festival Modal
function openFestivalModal() {
  const modal = document.getElementById("modal-festival");
  const activeCheck = document.getElementById("fest-active");
  const nameInput = document.getElementById("fest-name");
  const multInput = document.getElementById("fest-multiplier");
  const checklist = document.getElementById("fest-items-checklist");

  activeCheck.checked = state.settings.festivalActive !== false;
  nameInput.value = state.settings.festivalName || "Full Moon Festival";
  multInput.value = state.settings.festivalMultiplier || 3;

  const currentAffected = state.settings.affectedItemIds || ["item-1", "item-2", "item-4"];

  checklist.innerHTML = state.inventory.filter(i => !i.isArchived).map(item => {
    const isChecked = currentAffected.includes(item.id) || item.isFestivalAffected;
    return `
      <label class="checkbox-label" style="margin-bottom:6px;">
        <input type="checkbox" name="fest-item" value="${item.id}" ${isChecked ? "checked" : ""}>
        <span>${item.name} (${item.unit})</span>
      </label>
    `;
  }).join("");

  modal.classList.add("open");
}

async function handleSaveFestival(e) {
  e.preventDefault();
  const festivalActive = document.getElementById("fest-active").checked;
  const festivalName = document.getElementById("fest-name").value.trim();
  const festivalMultiplier = parseInt(document.getElementById("fest-multiplier").value, 10) || 3;

  const checkedBoxes = Array.from(document.querySelectorAll("input[name='fest-item']:checked"));
  const affectedItemIds = checkedBoxes.map(cb => cb.value);

  // Update items in inventory with new festival flag
  for (const item of state.inventory) {
    const isAffected = affectedItemIds.includes(item.id);
    if (item.isFestivalAffected !== isAffected) {
      item.isFestivalAffected = isAffected;
      item.festivalMultiplier = festivalMultiplier;
      await dbService.saveInventoryItem(item);
    }
  }

  const updatedSettings = {
    ...state.settings,
    festivalActive,
    festivalName,
    festivalMultiplier,
    affectedItemIds
  };

  await dbService.saveSettings(updatedSettings);
  state.settings = updatedSettings;

  closeModal("modal-festival");
  showToast("Festival rules updated", "success");
  await loadAllData();
  renderCurrentPage();
}

// Sample Data Reset
async function handleResetSampleData() {
  if (confirm("Reset local storage back to pre-seeded authentic witch inventory and sales history?")) {
    dbService.resetToSampleData();
    showToast("Pantry reset to default sample data", "info");
    await loadAllData();
    renderCurrentPage();
  }
}

// --- UTILITY HELPERS ---
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Boot application
window.addEventListener("DOMContentLoaded", initApp);

