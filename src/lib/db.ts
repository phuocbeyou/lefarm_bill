"use client";

import { openDB, DBSchema, IDBPDatabase } from "idb";

// Types
export interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
  priceHistory: number[]; // Lịch sử các mức giá đã dùng
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
}

export interface Unit {
  id: string;
  name: string;
  order: number;
}

export interface Settings {
  id: string;
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  shopLogo: string;
  bankName: string;
  bankBin: string;
  accountNumber: string;
  accountName: string;
}

// Database Schema
interface BillAppDB extends DBSchema {
  products: {
    key: string;
    value: Product;
    indexes: { "by-name": string };
  };
  units: {
    key: string;
    value: Unit;
    indexes: { "by-order": number };
  };
  customers: {
    key: string;
    value: Customer;
    indexes: { "by-name": string };
  };
  settings: {
    key: string;
    value: Settings;
  };
}

const DB_NAME = "BillAppDB";
const DB_VERSION = 2; // Increment version

let dbPromise: Promise<IDBPDatabase<BillAppDB>> | null = null;

// Initialize database
export async function initDB(): Promise<IDBPDatabase<BillAppDB>> {
  if (!dbPromise) {
    dbPromise = openDB<BillAppDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Products store
        if (!db.objectStoreNames.contains("products")) {
          const productStore = db.createObjectStore("products", { keyPath: "id" });
          productStore.createIndex("by-name", "name");
        }

        // Units store
        if (!db.objectStoreNames.contains("units")) {
          const unitStore = db.createObjectStore("units", { keyPath: "id" });
          unitStore.createIndex("by-order", "order");
        }

        // Customers store
        if (!db.objectStoreNames.contains("customers")) {
          const customerStore = db.createObjectStore("customers", { keyPath: "id" });
          customerStore.createIndex("by-name", "name");
        }

        // Settings store
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

// ============ PRODUCTS ============

export async function getAllProducts(): Promise<Product[]> {
  const db = await initDB();
  return db.getAll("products");
}

export async function getProduct(id: string): Promise<Product | undefined> {
  const db = await initDB();
  return db.get("products", id);
}

export async function addProduct(product: Omit<Product, "id" | "priceHistory">): Promise<Product> {
  const db = await initDB();
  const newProduct: Product = {
    ...product,
    id: Date.now().toString(),
    priceHistory: [product.price],
  };
  await db.add("products", newProduct);
  return newProduct;
}

export async function updateProduct(product: Product): Promise<void> {
  const db = await initDB();
  await db.put("products", product);
}

export async function deleteProduct(id: string): Promise<void> {
  const db = await initDB();
  await db.delete("products", id);
}

// Add price to history if not exists
export async function addPriceToHistory(productId: string, price: number): Promise<void> {
  const db = await initDB();
  const product = await db.get("products", productId);
  if (product && !product.priceHistory.includes(price)) {
    product.priceHistory = [...product.priceHistory, price].sort((a, b) => b - a);
    await db.put("products", product);
  }
}

// ============ CUSTOMERS ============

export async function getAllCustomers(): Promise<Customer[]> {
  const db = await initDB();
  return db.getAll("customers");
}

export async function addCustomer(customer: Omit<Customer, "id">): Promise<Customer> {
  const db = await initDB();
  const newCustomer: Customer = {
    ...customer,
    id: Date.now().toString(),
  };
  await db.add("customers", newCustomer);
  return newCustomer;
}

export async function updateCustomer(customer: Customer): Promise<void> {
  const db = await initDB();
  await db.put("customers", customer);
}

export async function deleteCustomer(id: string): Promise<void> {
  const db = await initDB();
  await db.delete("customers", id);
}

// ============ UNITS ============

export async function getAllUnits(): Promise<Unit[]> {
  const db = await initDB();
  const units = await db.getAllFromIndex("units", "by-order");
  return units;
}

export async function addUnit(name: string): Promise<Unit> {
  const db = await initDB();
  const allUnits = await db.getAll("units");
  const newUnit: Unit = {
    id: Date.now().toString(),
    name,
    order: allUnits.length,
  };
  await db.add("units", newUnit);
  return newUnit;
}

export async function updateUnit(unit: Unit): Promise<void> {
  const db = await initDB();
  await db.put("units", unit);
}

export async function deleteUnit(id: string): Promise<void> {
  const db = await initDB();
  await db.delete("units", id);
}

export async function initDefaultUnits(): Promise<void> {
  const db = await initDB();
  const existingUnits = await db.getAll("units");
  
  if (existingUnits.length === 0) {
    const defaultUnits = ["KG", "Gói", "Hộp", "Cái", "Chai", "Thùng", "Túi"];
    for (let i = 0; i < defaultUnits.length; i++) {
      await db.add("units", {
        id: Date.now().toString() + i,
        name: defaultUnits[i],
        order: i,
      });
    }
  }
}

// ============ SETTINGS ============

export async function getSettings(): Promise<Settings | undefined> {
  const db = await initDB();
  return db.get("settings", "main");
}

export async function saveSettings(settings: Omit<Settings, "id">): Promise<void> {
  const db = await initDB();
  await db.put("settings", { ...settings, id: "main" });
}

export async function initDefaultSettings(): Promise<void> {
  const db = await initDB();
  const existing = await db.get("settings", "main");
  
  if (!existing) {
    await db.put("settings", {
      id: "main",
      shopName: "Hạt điều Tinh Hoa Việt",
      shopAddress: "TT Tân Khai, H. Hớn Quản, T. Bình Phước",
      shopPhone: "0349 939 393 - 0988 885 192",
      shopLogo: "",
      bankName: "MB Bank",
      bankBin: "970422",
      accountNumber: "0988885192",
      accountName: "PHAM THI HONG NHUNG",
    });
  }
}

// ============ MIGRATION from localStorage ============

export async function migrateFromLocalStorage(): Promise<void> {
  const db = await initDB();
  
  // Migrate products
  const savedProducts = localStorage.getItem("products");
  if (savedProducts) {
    const products = JSON.parse(savedProducts);
    for (const p of products) {
      const existing = await db.get("products", p.id);
      if (!existing) {
        await db.put("products", {
          ...p,
          priceHistory: p.priceHistory || [p.price],
        });
      }
    }
    // Don't remove localStorage yet for backup
  }
  
  // Migrate settings
  const savedSettings = localStorage.getItem("settings");
  if (savedSettings) {
    const settings = JSON.parse(savedSettings);
    const existing = await db.get("settings", "main");
    if (!existing) {
      await db.put("settings", { ...settings, id: "main" });
    }
  }
  
  // Init defaults
  await initDefaultUnits();
  await initDefaultSettings();
}
