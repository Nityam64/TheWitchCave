// js/db-service.js - Database Service for Hexley's Potion Pantry
// Supports Cloud Firestore (v10 Modular SDK via CDN) and Local Storage demo fallback.
// Never pretends to be connected if credentials are placeholders.

import {
  getActiveFirebaseConfig,
  isConfigPlaceholder
} from "./firebase-config.js";
import {
  SAMPLE_INVENTORY,
  SAMPLE_SUPPLIERS,
  SAMPLE_SALES,
  SAMPLE_MOVEMENTS,
  SAMPLE_SETTINGS
} from "./sample-data.js";

class DatabaseService {
  constructor() {
    this.status = "uninitialized"; // 'connected' | 'demo' | 'error' | 'offline'
    this.errorMessage = "";
    this.firestore = null;
    this.auth = null;
    this.user = null;
    this.firebaseModules = null;
  }

  async initialize() {
    const { config } = getActiveFirebaseConfig();

    if (isConfigPlaceholder(config)) {
      this.status = "demo";
      this.initLocalStore();
      return { status: "demo", message: "Running in Demo Mode. Firebase credentials not configured." };
    }

    try {
      // Dynamic import from official Firebase v10 CDN
      const appMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
      const firestoreMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      const authMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");

      this.firebaseModules = { ...firestoreMod, ...authMod };
      const app = appMod.initializeApp(config);
      this.firestore = firestoreMod.getFirestore(app);
      this.auth = authMod.getAuth(app);

      // Sign in anonymously to authenticate the session for Firestore rules
      try {
        const userCred = await authMod.signInAnonymously(this.auth);
        this.user = userCred.user;
      } catch (authErr) {
        console.warn("Anonymous auth warning:", authErr.message);
      }

      // Quick connectivity probe on settings collection
      await firestoreMod.getDocs(firestoreMod.collection(this.firestore, "settings"));

      this.status = "connected";
      return { status: "connected", message: `Connected to Cloud Firestore (${config.projectId})` };
    } catch (err) {
      console.error("Firestore Init Error:", err);
      this.status = "error";
      this.errorMessage = err.message || "Failed to connect to Firebase Firestore";
      this.initLocalStore(); // Fallback so app remains functional
      return { status: "error", message: this.errorMessage };
    }
  }

  // --- LOCAL STORE FALLBACK HELPERS ---
  initLocalStore() {
    if (!localStorage.getItem("hexley_inventory")) {
      localStorage.setItem("hexley_inventory", JSON.stringify(SAMPLE_INVENTORY));
    }
    if (!localStorage.getItem("hexley_suppliers")) {
      localStorage.setItem("hexley_suppliers", JSON.stringify(SAMPLE_SUPPLIERS));
    }
    if (!localStorage.getItem("hexley_sales")) {
      localStorage.setItem("hexley_sales", JSON.stringify(SAMPLE_SALES));
    }
    if (!localStorage.getItem("hexley_movements")) {
      localStorage.setItem("hexley_movements", JSON.stringify(SAMPLE_MOVEMENTS));
    }
    if (!localStorage.getItem("hexley_settings")) {
      localStorage.setItem("hexley_settings", JSON.stringify(SAMPLE_SETTINGS));
    }
  }

  resetToSampleData() {
    localStorage.setItem("hexley_inventory", JSON.stringify(SAMPLE_INVENTORY));
    localStorage.setItem("hexley_suppliers", JSON.stringify(SAMPLE_SUPPLIERS));
    localStorage.setItem("hexley_sales", JSON.stringify(SAMPLE_SALES));
    localStorage.setItem("hexley_movements", JSON.stringify(SAMPLE_MOVEMENTS));
    localStorage.setItem("hexley_settings", JSON.stringify(SAMPLE_SETTINGS));
  }

  // --- INVENTORY API ---
  async getInventory() {
    if (this.status === "connected" && this.firestore) {
      const { collection, getDocs } = this.firebaseModules;
      const snap = await getDocs(collection(this.firestore, "inventoryItems"));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    return JSON.parse(localStorage.getItem("hexley_inventory") || "[]");
  }

  async saveInventoryItem(item) {
    if (this.status === "connected" && this.firestore) {
      const { collection, doc, setDoc, addDoc, serverTimestamp } = this.firebaseModules;
      const now = new Date().toISOString();
      const payload = {
        ...item,
        updatedAt: now,
        serverTime: serverTimestamp ? serverTimestamp() : now
      };
      if (item.id) {
        await setDoc(doc(this.firestore, "inventoryItems", item.id), payload, { merge: true });
        return item.id;
      } else {
        payload.createdAt = now;
        const ref = await addDoc(collection(this.firestore, "inventoryItems"), payload);
        return ref.id;
      }
    }

    // LocalStorage fallback
    const items = JSON.parse(localStorage.getItem("hexley_inventory") || "[]");
    const now = new Date().toISOString();
    let savedId = item.id;
    if (item.id) {
      const idx = items.findIndex(i => i.id === item.id);
      if (idx !== -1) {
        items[idx] = { ...items[idx], ...item, updatedAt: now };
      } else {
        items.push({ ...item, updatedAt: now });
      }
    } else {
      savedId = "item-" + Date.now();
      items.push({ ...item, id: savedId, createdAt: now, updatedAt: now });
    }
    localStorage.setItem("hexley_inventory", JSON.stringify(items));
    return savedId;
  }

  async archiveInventoryItem(itemId) {
    if (this.status === "connected" && this.firestore) {
      const { doc, updateDoc } = this.firebaseModules;
      await updateDoc(doc(this.firestore, "inventoryItems", itemId), {
        isArchived: true,
        updatedAt: new Date().toISOString()
      });
      return;
    }
    const items = JSON.parse(localStorage.getItem("hexley_inventory") || "[]");
    const item = items.find(i => i.id === itemId);
    if (item) {
      item.isArchived = true;
      item.updatedAt = new Date().toISOString();
      localStorage.setItem("hexley_inventory", JSON.stringify(items));
    }
  }

  // --- SALES & ATOMIC TRANSACTION API ---
  async recordSaleAtomic(saleData) {
    // saleData: { items: [{ itemId, quantity, unitPrice, itemName }], notes }
    const now = new Date().toISOString();

    if (this.status === "connected" && this.firestore) {
      const { runTransaction, doc, collection } = this.firebaseModules;
      const firestore = this.firestore;

      return await runTransaction(firestore, async (transaction) => {
        const itemReads = [];
        for (const line of saleData.items) {
          const itemRef = doc(firestore, "inventoryItems", line.itemId);
          itemReads.push({ ref: itemRef, line, snapPromise: transaction.get(itemRef) });
        }

        const resolved = [];
        for (const itemRead of itemReads) {
          const snap = await itemRead.snapPromise;
          if (!snap.exists()) {
            throw new Error(`Item ${itemRead.line.itemName || itemRead.line.itemId} no longer exists in pantry!`);
          }
          const currentData = snap.data();
          const currentQty = currentData.quantity || 0;
          if (currentQty < itemRead.line.quantity) {
            throw new Error(`Insufficient stock for ${currentData.name}! Have: ${currentQty}, Requested: ${itemRead.line.quantity}`);
          }
          resolved.push({
            ref: itemRead.ref,
            line: itemRead.line,
            currentData,
            newQty: currentQty - itemRead.line.quantity
          });
        }

        // Apply atomic stock deductions
        for (const res of resolved) {
          transaction.update(res.ref, {
            quantity: res.newQty,
            updatedAt: now
          });

          // Create stock movement record
          const movementRef = doc(collection(firestore, "stockMovements"));
          transaction.set(movementRef, {
            itemId: res.currentData.id,
            itemName: res.currentData.name,
            type: "sale",
            quantityDelta: -res.line.quantity,
            quantityAfter: res.newQty,
            reason: `Sale ${saleData.notes ? `(${saleData.notes})` : ""}`,
            timestamp: now
          });
        }

        // Create sale record
        const saleRef = doc(collection(firestore, "sales"));
        transaction.set(saleRef, {
          ...saleData,
          timestamp: now
        });

        return { success: true, saleId: saleRef.id };
      });
    }

    // LocalStorage atomic simulation
    const items = JSON.parse(localStorage.getItem("hexley_inventory") || "[]");
    const movements = JSON.parse(localStorage.getItem("hexley_movements") || "[]");
    const sales = JSON.parse(localStorage.getItem("hexley_sales") || "[]");

    // Pre-flight validation
    for (const line of saleData.items) {
      const item = items.find(i => i.id === line.itemId);
      if (!item) {
        throw new Error(`Ingredient not found: ${line.itemName}`);
      }
      if (item.quantity < line.quantity) {
        throw new Error(`Cannot sell ${line.quantity} of ${item.name}! Only ${item.quantity} in stock.`);
      }
    }

    // Deduct stock and record movements
    for (const line of saleData.items) {
      const item = items.find(i => i.id === line.itemId);
      item.quantity -= line.quantity;
      item.updatedAt = now;

      movements.unshift({
        id: "mov-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
        itemId: item.id,
        itemName: item.name,
        type: "sale",
        quantityDelta: -line.quantity,
        quantityAfter: item.quantity,
        reason: saleData.notes ? `Sale (${saleData.notes})` : "Customer Sale",
        timestamp: now
      });
    }

    const saleId = "sale-" + Date.now();
    sales.unshift({
      id: saleId,
      ...saleData,
      timestamp: now
    });

    localStorage.setItem("hexley_inventory", JSON.stringify(items));
    localStorage.setItem("hexley_movements", JSON.stringify(movements));
    localStorage.setItem("hexley_sales", JSON.stringify(sales));

    return { success: true, saleId };
  }

  // --- STOCK DELIVERIES & MOVEMENTS ---
  async recordDelivery({ itemId, supplierId, quantity, notes }) {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      throw new Error("Delivery quantity must be a positive number.");
    }
    const now = new Date().toISOString();

    if (this.status === "connected" && this.firestore) {
      const { runTransaction, doc, collection } = this.firebaseModules;
      const firestore = this.firestore;

      return await runTransaction(firestore, async (transaction) => {
        const itemRef = doc(firestore, "inventoryItems", itemId);
        const snap = await transaction.get(itemRef);
        if (!snap.exists()) throw new Error("Ingredient not found");
        const item = snap.data();
        const newQty = (item.quantity || 0) + qty;

        transaction.update(itemRef, {
          quantity: newQty,
          updatedAt: now
        });

        const movementRef = doc(collection(firestore, "stockMovements"));
        transaction.set(movementRef, {
          itemId: item.id,
          itemName: item.name,
          type: "delivery",
          supplierId,
          quantityDelta: qty,
          quantityAfter: newQty,
          reason: notes ? `Delivery: ${notes}` : "Supplier Delivery Restock",
          timestamp: now
        });

        return { success: true, newQty };
      });
    }

    // Local fallback
    const items = JSON.parse(localStorage.getItem("hexley_inventory") || "[]");
    const movements = JSON.parse(localStorage.getItem("hexley_movements") || "[]");
    const item = items.find(i => i.id === itemId);
    if (!item) throw new Error("Ingredient not found in pantry");

    item.quantity = (item.quantity || 0) + qty;
    item.updatedAt = now;

    movements.unshift({
      id: "mov-" + Date.now(),
      itemId: item.id,
      itemName: item.name,
      type: "delivery",
      supplierId,
      quantityDelta: qty,
      quantityAfter: item.quantity,
      reason: notes ? `Delivery: ${notes}` : "Supplier Delivery Restock",
      timestamp: now
    });

    localStorage.setItem("hexley_inventory", JSON.stringify(items));
    localStorage.setItem("hexley_movements", JSON.stringify(movements));
    return { success: true, newQty: item.quantity };
  }

  async recordStockAdjustment({ itemId, quantityDelta, reason }) {
    const delta = parseInt(quantityDelta, 10);
    if (isNaN(delta) || delta === 0) {
      throw new Error("Adjustment must be a non-zero number.");
    }
    const now = new Date().toISOString();

    const items = JSON.parse(localStorage.getItem("hexley_inventory") || "[]");
    const movements = JSON.parse(localStorage.getItem("hexley_movements") || "[]");
    const item = items.find(i => i.id === itemId);
    if (!item) throw new Error("Item not found");

    const newQty = (item.quantity || 0) + delta;
    if (newQty < 0) {
      throw new Error(`Cannot adjust below zero. Current stock is ${item.quantity}.`);
    }

    item.quantity = newQty;
    item.updatedAt = now;

    movements.unshift({
      id: "mov-" + Date.now(),
      itemId: item.id,
      itemName: item.name,
      type: delta < 0 ? "correction_down" : "correction_up",
      quantityDelta: delta,
      quantityAfter: newQty,
      reason: reason || "Manual stock inventory count correction",
      timestamp: now
    });

    localStorage.setItem("hexley_inventory", JSON.stringify(items));
    localStorage.setItem("hexley_movements", JSON.stringify(movements));
    return { success: true, newQty };
  }

  // --- SUPPLIERS API ---
  async getSuppliers() {
    if (this.status === "connected" && this.firestore) {
      const { collection, getDocs } = this.firebaseModules;
      const snap = await getDocs(collection(this.firestore, "suppliers"));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    return JSON.parse(localStorage.getItem("hexley_suppliers") || "[]");
  }

  async saveSupplier(supplier) {
    const now = new Date().toISOString();
    if (this.status === "connected" && this.firestore) {
      const { doc, setDoc, addDoc, collection } = this.firebaseModules;
      if (supplier.id) {
        await setDoc(doc(this.firestore, "suppliers", supplier.id), { ...supplier, updatedAt: now }, { merge: true });
        return supplier.id;
      } else {
        const ref = await addDoc(collection(this.firestore, "suppliers"), { ...supplier, createdAt: now });
        return ref.id;
      }
    }

    const suppliers = JSON.parse(localStorage.getItem("hexley_suppliers") || "[]");
    let savedId = supplier.id;
    if (supplier.id) {
      const idx = suppliers.findIndex(s => s.id === supplier.id);
      if (idx !== -1) {
        suppliers[idx] = { ...suppliers[idx], ...supplier, updatedAt: now };
      } else {
        suppliers.push({ ...supplier, updatedAt: now });
      }
    } else {
      savedId = "sup-" + Date.now();
      suppliers.push({ ...supplier, id: savedId, createdAt: now });
    }
    localStorage.setItem("hexley_suppliers", JSON.stringify(suppliers));
    return savedId;
  }

  // --- SALES & MOVEMENTS QUERIES ---
  async getSales() {
    if (this.status === "connected" && this.firestore) {
      const { collection, getDocs } = this.firebaseModules;
      const snap = await getDocs(collection(this.firestore, "sales"));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    return JSON.parse(localStorage.getItem("hexley_sales") || "[]");
  }

  async getStockMovements() {
    if (this.status === "connected" && this.firestore) {
      const { collection, getDocs } = this.firebaseModules;
      const snap = await getDocs(collection(this.firestore, "stockMovements"));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    return JSON.parse(localStorage.getItem("hexley_movements") || "[]");
  }

  // --- SETTINGS API ---
  async getSettings() {
    if (this.status === "connected" && this.firestore) {
      const { doc, getDoc } = this.firebaseModules;
      const snap = await getDoc(doc(this.firestore, "settings", "global"));
      if (snap.exists()) return snap.data();
    }
    return JSON.parse(localStorage.getItem("hexley_settings") || JSON.stringify(SAMPLE_SETTINGS));
  }

  async saveSettings(settings) {
    if (this.status === "connected" && this.firestore) {
      const { doc, setDoc } = this.firebaseModules;
      await setDoc(doc(this.firestore, "settings", "global"), settings, { merge: true });
    }
    localStorage.setItem("hexley_settings", JSON.stringify(settings));
    return settings;
  }
}

export const dbService = new DatabaseService();

