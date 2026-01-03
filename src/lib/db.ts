"use client";

// Types
export interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
  priceHistory: number[];
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

// API Base URL
const API_URL = "https://space-le-farm-api.phuocph1903.workers.dev";

// Helper for API calls
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return response.json();
}

// ============ PRODUCTS ============

export async function getAllProducts(): Promise<Product[]> {
  return fetchAPI<Product[]>("/api/products");
}

export async function getProduct(id: string): Promise<Product | undefined> {
  try {
    return await fetchAPI<Product>(`/api/products/${id}`);
  } catch {
    return undefined;
  }
}

export async function addProduct(product: Omit<Product, "id" | "priceHistory">): Promise<Product> {
  return fetchAPI<Product>("/api/products", {
    method: "POST",
    body: JSON.stringify(product),
  });
}

export async function updateProduct(product: Product): Promise<void> {
  await fetchAPI<Product>(`/api/products/${product.id}`, {
    method: "PUT",
    body: JSON.stringify(product),
  });
}

export async function deleteProduct(id: string): Promise<void> {
  await fetchAPI<{ success: boolean }>(`/api/products/${id}`, {
    method: "DELETE",
  });
}

export async function addPriceToHistory(productId: string, price: number): Promise<void> {
  const product = await getProduct(productId);
  if (product && !product.priceHistory.includes(price)) {
    product.priceHistory = [...product.priceHistory, price].sort((a, b) => b - a);
    await updateProduct(product);
  }
}

// ============ CUSTOMERS ============

export async function getAllCustomers(): Promise<Customer[]> {
  return fetchAPI<Customer[]>("/api/customers");
}

export async function addCustomer(customer: Omit<Customer, "id">): Promise<Customer> {
  return fetchAPI<Customer>("/api/customers", {
    method: "POST",
    body: JSON.stringify(customer),
  });
}

export async function updateCustomer(customer: Customer): Promise<void> {
  await fetchAPI<Customer>(`/api/customers/${customer.id}`, {
    method: "PUT",
    body: JSON.stringify(customer),
  });
}

export async function deleteCustomer(id: string): Promise<void> {
  await fetchAPI<{ success: boolean }>(`/api/customers/${id}`, {
    method: "DELETE",
  });
}

// ============ UNITS ============

export async function getAllUnits(): Promise<Unit[]> {
  return fetchAPI<Unit[]>("/api/units");
}

export async function addUnit(name: string): Promise<Unit> {
  return fetchAPI<Unit>("/api/units", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function updateUnit(unit: Unit): Promise<void> {
  await fetchAPI<Unit>(`/api/units/${unit.id}`, {
    method: "PUT",
    body: JSON.stringify(unit),
  });
}

export async function deleteUnit(id: string): Promise<void> {
  await fetchAPI<{ success: boolean }>(`/api/units/${id}`, {
    method: "DELETE",
  });
}

// No-op for API version (defaults are handled by backend)
export async function initDefaultUnits(): Promise<void> {
  // Default units are initialized by the database schema
  return;
}

// ============ SETTINGS ============

export async function getSettings(): Promise<Settings | undefined> {
  try {
    return await fetchAPI<Settings>("/api/settings");
  } catch {
    return undefined;
  }
}

export async function saveSettings(settings: Omit<Settings, "id">): Promise<void> {
  await fetchAPI<Settings>("/api/settings", {
    method: "PUT",
    body: JSON.stringify({ ...settings, id: "main" }),
  });
}

// No-op for API version (defaults are handled by backend)
export async function initDefaultSettings(): Promise<void> {
  // Default settings are initialized by the database schema
  return;
}

// No-op for API version (no localStorage migration needed)
export async function migrateFromLocalStorage(): Promise<void> {
  // Migration is not needed for cloud database
  return;
}

// ============ BILLS ============

export interface BillItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  price: number;
}

export interface Bill {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  orderCode: string;
  items: BillItem[];
  subtotal: number;
  discount: number;
  total: number;
  createdAt: string;
}

export async function getAllBills(startDate?: string, endDate?: string): Promise<Bill[]> {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  const query = params.toString() ? `?${params.toString()}` : "";
  return fetchAPI<Bill[]>(`/api/bills${query}`);
}

export async function saveBill(bill: Omit<Bill, "id" | "createdAt">): Promise<Bill> {
  return fetchAPI<Bill>("/api/bills", {
    method: "POST",
    body: JSON.stringify(bill),
  });
}

export async function deleteBill(id: string): Promise<void> {
  await fetchAPI<{ success: boolean }>(`/api/bills/${id}`, {
    method: "DELETE",
  });
}

// ============ REPORTS ============

export interface ReportSummary {
  today: { total: number; count: number };
  week: { total: number; count: number };
  month: { total: number; count: number };
  allTime: { count: number };
}

export interface DailyData {
  date: string;
  total: number;
  count: number;
}

export async function getReportSummary(): Promise<ReportSummary> {
  return fetchAPI<ReportSummary>("/api/reports/summary");
}

export async function getDailyReport(days: number = 30): Promise<DailyData[]> {
  return fetchAPI<DailyData[]>(`/api/reports/daily?days=${days}`);
}

