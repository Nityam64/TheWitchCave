// js/sample-data.js - Comprehensive Victorian Apothecary dataset for Hexley's Potion Pantry

export const SAMPLE_SUPPLIERS = [
  {
    id: "sup-1",
    name: "Grimoire & Grove Apothecary",
    contact: "Raven Owl Dispatch #04",
    leadTimeDays: 3,
    notes: "Specializes in preserved nocturnal fauna, bat parts, and dried moorland herbs.",
    createdAt: new Date(Date.now() - 40 * 86400000).toISOString()
  },
  {
    id: "sup-2",
    name: "Obsidian Peak Foragers Guild",
    contact: "Broomstick Express Couriers #12",
    leadTimeDays: 5,
    notes: "High-altitude cliff roots, volcanic peppers, and sulfurous mineral crystals.",
    createdAt: new Date(Date.now() - 35 * 86400000).toISOString()
  },
  {
    id: "sup-3",
    name: "Moonlit Caverns Cooperative",
    contact: "Subterranean Bat Post B-7",
    leadTimeDays: 2,
    notes: "Bioluminescent fungal spores, distilled cave honeys, and blown glass apparatus.",
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
  },
  {
    id: "sup-4",
    name: "Blackwood Herbalists & Vintners",
    contact: "Whispering Crow Post #09",
    leadTimeDays: 4,
    notes: "Rare dried botanicals, mandrake cultivators, and fermented venom extractions.",
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString()
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
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
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
    supplierId: "sup-4",
    supplierName: "Blackwood Herbalists & Vintners",
    leadTimeDays: 4,
    isFestivalAffected: true,
    festivalMultiplier: 3,
    isArchived: false,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
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
    supplierName: "Obsidian Peak Foragers Guild",
    leadTimeDays: 5,
    isFestivalAffected: false,
    festivalMultiplier: 1,
    isArchived: false,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
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
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
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
    festivalMultiplier: 1,
    isArchived: false,
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
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
    festivalMultiplier: 1,
    isArchived: false,
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "item-7",
    name: "Moonpetal Dust",
    category: "ingredient",
    quantity: 42,
    unit: "grams",
    minStock: 20,
    costPerUnit: 14.0,
    supplierId: "sup-3",
    supplierName: "Moonlit Caverns Cooperative",
    leadTimeDays: 2,
    isFestivalAffected: false,
    festivalMultiplier: 1,
    isArchived: false,
    createdAt: new Date(Date.now() - 18 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "item-8",
    name: "Frost Honey",
    category: "ingredient",
    quantity: 6,
    unit: "pots",
    minStock: 15,
    costPerUnit: 18.0,
    supplierId: "sup-3",
    supplierName: "Moonlit Caverns Cooperative",
    leadTimeDays: 2,
    isFestivalAffected: false,
    festivalMultiplier: 1,
    isArchived: false,
    createdAt: new Date(Date.now() - 18 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "item-9",
    name: "Rose Root",
    category: "ingredient",
    quantity: 0,
    unit: "bunches",
    minStock: 10,
    costPerUnit: 9.5,
    supplierId: "sup-4",
    supplierName: "Blackwood Herbalists & Vintners",
    leadTimeDays: 4,
    isFestivalAffected: false,
    festivalMultiplier: 1,
    isArchived: false,
    createdAt: new Date(Date.now() - 18 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "item-10",
    name: "Draught of Living Death",
    category: "potion",
    quantity: 4,
    unit: "phials",
    minStock: 8,
    costPerUnit: 45.0,
    supplierId: "sup-1",
    supplierName: "Grimoire & Grove Apothecary",
    leadTimeDays: 3,
    isFestivalAffected: false,
    festivalMultiplier: 1,
    isArchived: false,
    createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "item-11",
    name: "Obsidian Mortar & Pestle",
    category: "supply",
    quantity: 18,
    unit: "sets",
    minStock: 8,
    costPerUnit: 22.0,
    supplierId: "sup-2",
    supplierName: "Obsidian Peak Foragers Guild",
    leadTimeDays: 5,
    isFestivalAffected: false,
    festivalMultiplier: 1,
    isArchived: false,
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "item-12",
    name: "Dragon Scale Polish",
    category: "supply",
    quantity: 25,
    unit: "tins",
    minStock: 10,
    costPerUnit: 7.5,
    supplierId: "sup-2",
    supplierName: "Obsidian Peak Foragers Guild",
    leadTimeDays: 5,
    isFestivalAffected: false,
    festivalMultiplier: 1,
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
      { itemId: "item-1", itemName: "Bat Wings", quantity: 8, unitPrice: 8.0, unit: "pairs" },
      { itemId: "item-7", itemName: "Moonpetal Dust", quantity: 5, unitPrice: 20.0, unit: "grams" }
    ],
    totalAmount: 164.0,
    notes: "Levitation tonic ingredients"
  },
  {
    id: "sale-102",
    timestamp: new Date(Date.now() - 5 * 86400000).toISOString(),
    items: [
      { itemId: "item-1", itemName: "Bat Wings", quantity: 9, unitPrice: 8.0, unit: "pairs" },
      { itemId: "item-2", itemName: "Mandrake Root", quantity: 4, unitPrice: 20.0, unit: "roots" },
      { itemId: "item-5", itemName: "Elixir of Shadow Sight", quantity: 2, unitPrice: 40.0, unit: "bottles" }
    ],
    totalAmount: 232.0,
    notes: "Coventry gathering ritual"
  },
  {
    id: "sale-103",
    timestamp: new Date(Date.now() - 4 * 86400000).toISOString(),
    items: [
      { itemId: "item-1", itemName: "Bat Wings", quantity: 7, unitPrice: 8.0, unit: "pairs" },
      { itemId: "item-3", itemName: "Ghost Pepper Essence", quantity: 11, unitPrice: 12.0, unit: "vials" },
      { itemId: "item-8", itemName: "Frost Honey", quantity: 3, unitPrice: 28.0, unit: "pots" }
    ],
    totalAmount: 272.0,
    notes: "Flame and ice draught brew"
  },
  {
    id: "sale-104",
    timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
    items: [
      { itemId: "item-1", itemName: "Bat Wings", quantity: 10, unitPrice: 8.0, unit: "pairs" },
      { itemId: "item-2", itemName: "Mandrake Root", quantity: 5, unitPrice: 20.0, unit: "roots" },
      { itemId: "item-10", itemName: "Draught of Living Death", quantity: 1, unitPrice: 75.0, unit: "phials" }
    ],
    totalAmount: 255.0,
    notes: "Nocturnal ritual preparation"
  },
  {
    id: "sale-105",
    timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
    items: [
      { itemId: "item-1", itemName: "Bat Wings", quantity: 8, unitPrice: 8.0, unit: "pairs" },
      { itemId: "item-4", itemName: "Newt Eyes", quantity: 6, unitPrice: 15.0, unit: "jars" },
      { itemId: "item-6", itemName: "Cauldron Glass Flasks", quantity: 5, unitPrice: 6.0, unit: "flasks" }
    ],
    totalAmount: 184.0,
    notes: "Local alchemist apprentice order"
  },
  {
    id: "sale-106",
    timestamp: new Date(Date.now() - 1 * 86400000).toISOString(),
    items: [
      { itemId: "item-1", itemName: "Bat Wings", quantity: 9, unitPrice: 8.0, unit: "pairs" },
      { itemId: "item-2", itemName: "Mandrake Root", quantity: 4, unitPrice: 20.0, unit: "roots" },
      { itemId: "item-9", itemName: "Rose Root", quantity: 6, unitPrice: 16.0, unit: "bunches" }
    ],
    totalAmount: 248.0,
    notes: "Evening traveler through Blackwood"
  },
  {
    id: "sale-107",
    timestamp: new Date().toISOString(),
    items: [
      { itemId: "item-1", itemName: "Bat Wings", quantity: 28, unitPrice: 8.0, unit: "pairs" } // Sudden surge on Bat Wings!
    ],
    totalAmount: 224.0,
    notes: "Sudden pre-festival run on Bat Wings by Coventry Coven"
  },
  {
    id: "sale-108",
    timestamp: new Date().toISOString(),
    items: [
      { itemId: "item-5", itemName: "Elixir of Shadow Sight", quantity: 2, unitPrice: 40.0, unit: "bottles" },
      { itemId: "item-7", itemName: "Moonpetal Dust", quantity: 4, unitPrice: 20.0, unit: "grams" }
    ],
    totalAmount: 160.0,
    notes: "Midnight patrol stock"
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
    reason: "Initial apothecary pantry ledger audit",
    timestamp: new Date(Date.now() - 14 * 86400000).toISOString()
  },
  {
    id: "mov-2",
    itemId: "item-1",
    itemName: "Bat Wings",
    type: "sale",
    quantityDelta: -28,
    quantityAfter: 45,
    reason: "Sale #sale-107 (Coventry Coven)",
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
    reason: "Exhausted by wandering high warlock order",
    timestamp: new Date(Date.now() - 1 * 86400000).toISOString()
  },
  {
    id: "mov-5",
    itemId: "item-2",
    itemName: "Mandrake Root",
    type: "delivery",
    quantityDelta: 10,
    quantityAfter: 17,
    reason: "Restock parcel from Blackwood Herbalists",
    timestamp: new Date(Date.now() - 2 * 86400000).toISOString()
  },
  {
    id: "mov-6",
    itemId: "item-2",
    itemName: "Mandrake Root",
    type: "sale",
    quantityDelta: -5,
    quantityAfter: 12,
    reason: "Customer Sale #sale-104",
    timestamp: new Date(Date.now() - 1 * 86400000).toISOString()
  },
  {
    id: "mov-7",
    itemId: "item-9",
    itemName: "Rose Root",
    type: "sale",
    quantityDelta: -6,
    quantityAfter: 0,
    reason: "Sold out to potion brewer #sale-106",
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
