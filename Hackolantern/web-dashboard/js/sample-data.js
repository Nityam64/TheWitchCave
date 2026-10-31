// sample-data.js - Witch Pantry starter dataset for Hexley's Potion Pantry
export const SAMPLE_SUPPLIERS = [
  {
    id: "sup-1",
    name: "Grimoire & Grove Apothecary",
    contact: "Raven Owl #04",
    leadTimeDays: 3,
    notes: "Specializes in dried nocturnal fauna and cave mosses.",
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
  },
  {
    id: "sup-2",
    name: "Obsidian Peak Foragers",
    contact: "Broomstick Dispatch #12",
    leadTimeDays: 5,
    notes: "High-altitude herbs, volatile minerals, and volcanic roots.",
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString()
  },
  {
    id: "sup-3",
    name: "Moonlit Caverns Cooperative",
    contact: "Bat Messenger B-7",
    leadTimeDays: 2,
    notes: "Subterranean fungal growths and bioluminescent crystals.",
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString()
  }
];

export const SAMPLE_INVENTORY = [
  {
    id: "item-1",
    name: "Bat Wings",
    category: "ingredient",
    quantity: 45,
    unit: "pairs",
    minStock: 20,
    costPerUnit: 4.5,
    supplierId: "sup-1",
    supplierName: "Grimoire & Grove Apothecary",
    leadTimeDays: 3,
    isFestivalAffected: true,
    festivalMultiplier: 3,
    isArchived: false,
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "item-2",
    name: "Mandrake Root",
    category: "ingredient",
    quantity: 12,
    unit: "roots",
    minStock: 15,
    costPerUnit: 12.0,
    supplierId: "sup-2",
    supplierName: "Obsidian Peak Foragers",
    leadTimeDays: 5,
    isFestivalAffected: true,
    festivalMultiplier: 3,
    isArchived: false,
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "item-3",
    name: "Ghost Pepper Essence",
    category: "ingredient",
    quantity: 60,
    unit: "vials",
    minStock: 25,
    costPerUnit: 6.0,
    supplierId: "sup-2",
    supplierName: "Obsidian Peak Foragers",
    leadTimeDays: 5,
    isFestivalAffected: false,
    festivalMultiplier: 3,
    isArchived: false,
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "item-4",
    name: "Newt Eyes",
    category: "ingredient",
    quantity: 0,
    unit: "jars",
    minStock: 30,
    costPerUnit: 8.5,
    supplierId: "sup-1",
    supplierName: "Grimoire & Grove Apothecary",
    leadTimeDays: 3,
    isFestivalAffected: true,
    festivalMultiplier: 3,
    isArchived: false,
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "item-5",
    name: "Elixir of Shadow Sight",
    category: "potion",
    quantity: 8,
    unit: "bottles",
    minStock: 10,
    costPerUnit: 25.0,
    supplierId: "sup-3",
    supplierName: "Moonlit Caverns Cooperative",
    leadTimeDays: 2,
    isFestivalAffected: false,
    festivalMultiplier: 3,
    isArchived: false,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "item-6",
    name: "Cauldron Glass Flasks",
    category: "supply",
    quantity: 35,
    unit: "flasks",
    minStock: 15,
    costPerUnit: 3.0,
    supplierId: "sup-3",
    supplierName: "Moonlit Caverns Cooperative",
    leadTimeDays: 2,
    isFestivalAffected: false,
    festivalMultiplier: 3,
    isArchived: false,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const SAMPLE_SALES = [
  {
    id: "sale-101",
    timestamp: new Date(Date.now() - 6 * 86400000).toISOString(),
    items: [
      { itemId: "item-1", itemName: "Bat Wings", quantity: 8, unitPrice: 8.0, unit: "pairs" }
    ],
    totalAmount: 64.0,
    notes: "Customer needed wings for levitation tonic"
  },
  {
    id: "sale-102",
    timestamp: new Date(Date.now() - 5 * 86400000).toISOString(),
    items: [
      { itemId: "item-1", itemName: "Bat Wings", quantity: 9, unitPrice: 8.0, unit: "pairs" },
      { itemId: "item-2", itemName: "Mandrake Root", quantity: 4, unitPrice: 20.0, unit: "roots" }
    ],
    totalAmount: 152.0,
    notes: "Coventry gathering supplies"
  },
  {
    id: "sale-103",
    timestamp: new Date(Date.now() - 4 * 86400000).toISOString(),
    items: [
      { itemId: "item-1", itemName: "Bat Wings", quantity: 7, unitPrice: 8.0, unit: "pairs" },
      { itemId: "item-3", itemName: "Ghost Pepper Essence", quantity: 11, unitPrice: 12.0, unit: "vials" }
    ],
    totalAmount: 188.0,
    notes: "Regular order"
  },
  {
    id: "sale-104",
    timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
    items: [
      { itemId: "item-1", itemName: "Bat Wings", quantity: 10, unitPrice: 8.0, unit: "pairs" },
      { itemId: "item-2", itemName: "Mandrake Root", quantity: 5, unitPrice: 20.0, unit: "roots" }
    ],
    totalAmount: 180.0,
    notes: "Ritual restock"
  },
  {
    id: "sale-105",
    timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
    items: [
      { itemId: "item-1", itemName: "Bat Wings", quantity: 8, unitPrice: 8.0, unit: "pairs" },
      { itemId: "item-4", itemName: "Newt Eyes", quantity: 6, unitPrice: 15.0, unit: "jars" }
    ],
    totalAmount: 154.0,
    notes: "Local alchemist run"
  },
  {
    id: "sale-106",
    timestamp: new Date(Date.now() - 1 * 86400000).toISOString(),
    items: [
      { itemId: "item-1", itemName: "Bat Wings", quantity: 9, unitPrice: 8.0, unit: "pairs" },
      { itemId: "item-2", itemName: "Mandrake Root", quantity: 4, unitPrice: 20.0, unit: "roots" }
    ],
    totalAmount: 152.0,
    notes: "Evening traveler"
  },
  {
    id: "sale-107",
    timestamp: new Date().toISOString(),
    items: [
      { itemId: "item-1", itemName: "Bat Wings", quantity: 28, unitPrice: 8.0, unit: "pairs" } // Sudden spike!
    ],
    totalAmount: 224.0,
    notes: "Sudden pre-festival run on Bat Wings"
  }
];

export const SAMPLE_MOVEMENTS = [
  {
    id: "mov-1",
    itemId: "item-1",
    itemName: "Bat Wings",
    type: "initial",
    quantityDelta: 80,
    quantityAfter: 80,
    reason: "Initial pantry inventory count",
    timestamp: new Date(Date.now() - 14 * 86400000).toISOString()
  },
  {
    id: "mov-2",
    itemId: "item-1",
    itemName: "Bat Wings",
    type: "sale",
    quantityDelta: -28,
    quantityAfter: 45,
    reason: "Sale #sale-107",
    timestamp: new Date().toISOString()
  },
  {
    id: "mov-3",
    itemId: "item-4",
    itemName: "Newt Eyes",
    type: "delivery",
    quantityDelta: 20,
    quantityAfter: 20,
    reason: "Delivery from Grimoire & Grove Apothecary",
    timestamp: new Date(Date.now() - 3 * 86400000).toISOString()
  },
  {
    id: "mov-4",
    itemId: "item-4",
    itemName: "Newt Eyes",
    type: "sale",
    quantityDelta: -20,
    quantityAfter: 0,
    reason: "Batch sale to wandering warlock",
    timestamp: new Date(Date.now() - 1 * 86400000).toISOString()
  }
];

export const SAMPLE_SETTINGS = {
  festivalName: "Full Moon Festival",
  festivalActive: true,
  festivalMultiplier: 3,
  affectedItemIds: ["item-1", "item-2", "item-4"],
  currencySymbol: "¢",
  storeName: "Hexley's Potion Pantry"
};

