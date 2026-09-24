export type ProductCategory =
  | 'spices'
  | 'dal_pulses'
  | 'grains_flour'
  | 'oil_ghee'
  | 'dry_fruits'
  | 'packaged_grocery'
  | 'daily_needs'
  | 'general';

export type UnitType = 'kg' | 'g' | 'quintal' | 'packet' | 'litre' | 'piece' | 'pcs' | string;

export interface Product {
  id: string;
  name: string;
  hindiName?: string;
  category: ProductCategory;
  unit: UnitType;
  rate: number; // Price per default unit (Selling price)
  costPrice?: number; // Wholesale / Purchase cost price for margin calculations
  stock?: number;
  popular?: boolean;
  minStockAlert?: number;
  barcode?: string;
  notes?: string;
  imageUrl?: string;
  updatedAt?: string;
  outletId?: string; // outlet/store this product belongs to ('store-1', 'store-2', etc. or 'all'/'shared')
  outletName?: string;
  assignedOutletIds?: string[]; // optionally assigned to specific outlets or ['all']
}

export interface BillItem {
  id: string;
  productId?: string;
  name: string;
  hindiName?: string;
  category?: ProductCategory;
  quantity: number;
  unit: UnitType;
  rate: number;
  total: number;
}

export type PaymentMode = 'cash' | 'online_upi' | 'credit_udhaar';

export interface CalcHistoryItem {
  id: string;
  expression: string;
  result: number;
  time: string;
  timestamp?: number;
  date?: string;
  isoDate?: string;
  note?: string;
  staffName?: string;
}

export interface StaffAccount {
  id: string;
  username?: string; // User ID / login handle
  serverId?: string; // Central server identification ID (e.g. 'faizan-inamdar')
  name: string;
  role: 'master_admin' | 'owner' | 'manager' | 'cashier';
  pin: string; // Password or 4-digit PIN
  phone?: string;
  active: boolean;
  createdAt?: string;
  permissions?: {
    canEditProducts?: boolean;
    canViewReports?: boolean;
    canManageUdhaar?: boolean;
    canVoidBills?: boolean;
    canAccessMasterAdmin?: boolean;
  };
  assignedOutletIds?: string[]; // IDs of stores this staff is assigned to manage. If undefined or empty, has access to all outlets.
  defaultOutletId?: string; // Primary/default outlet for this staff
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  entity: 'product' | 'transaction' | 'customer' | 'settings' | 'staff' | 'database' | 'system';
  details: string;
  performedBy: string;
}

export interface CentralDbStatus {
  status: 'connected' | 'syncing' | 'offline' | 'error';
  version: string;
  serverId?: string;
  serverAdmin?: string;
  masterAdminUsername?: string;
  lastSyncedAt: string;
  productsCount: number;
  transactionsCount: number;
  customersCount: number;
  storeName: string;
  connectedClients?: number;
  cloudSyncMode?: 'central_api' | 'firebase_firestore' | 'hybrid';
  pendingQueueCount?: number;
  serverLatencyMs?: number;
  totalOpeningCash?: number;
  totalAddedCash?: number;
  totalCashInHand?: number;
}

export interface PrinterConfig {
  printerType: 'browser' | 'bluetooth' | 'serial';
  paperWidth: '58mm' | '80mm';
  deviceName?: string;
  autoPrintOnSale: boolean;
  printHeaderNotes?: string;
  printFooterNotes?: string;
  connected?: boolean;
  printQrCodeOnSlip?: boolean; // Toggle whether to print UPI QR code on receipt
  cashDrawerEnabled?: boolean; // Toggle POS cash drawer auto-kick
  openDrawerOnSale?: boolean;  // Automatically kick cash drawer when sale is confirmed
  openDrawerOnRecord?: boolean; // Automatically kick cash drawer when transaction/calc is recorded
}

export interface Transaction {
  id: string;
  receiptNumber: string;
  type: 'sale' | 'expense';
  amount: number;
  baseAmount?: number;
  taxAmount?: number;
  taxRate?: number;
  paymentMode: PaymentMode;
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
  staffName?: string;
  staffId?: string;
  remarks?: string;
  notes?: string;
  timestamp: string;
  items?: BillItem[];
  storeId?: string;
  storeName?: string;
  outletId?: string;
  outletName?: string;
  voided?: boolean;
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
}

export interface MarketCreditPayment {
  id: string;
  amount: number;
  date: string;
  paymentMode: 'cash' | 'online_upi' | 'bank_transfer';
  note?: string;
  recordedBy?: string;
}

export interface MarketCreditEntry {
  id: string;
  goodsDescription: string; // items / goods taken on credit
  supplierName: string; // vendor / distributor / party
  supplierPhone?: string;
  outletId?: string; // 'store-1' (sy Nayab) or 'store-2' (kp Nayab)
  outletName?: string;
  timestamp: string; // date & time when taken
  dueDate?: string; // payment deadline / due date (YYYY-MM-DD)
  totalAmount: number; // total bill value of goods
  paidOnDay: number; // payment (jama) done on that day
  remainingBaaki: number; // remaining baaki
  billImageUrl?: string; // photo/scan of physical bill
  voiceNoteUrl?: string; // base64 audio data URL (15s voice note)
  voiceNoteDurationSeconds?: number;
  status: 'pending' | 'cleared';
  paymentsHistory?: MarketCreditPayment[];
  notes?: string;
  recordedBy?: string;
  createdAt?: string;
}

export interface CustomerUdhaar {
  id: string;
  name: string;
  phone: string;
  totalDue: number; // Amount they owe store
  creditLimit?: number;
  lastActive: string;
  notes?: string;
  outletId?: string;
  outletName?: string;
  storeId?: string;
}

export interface StoreProfile {
  id: string;
  shopName: string;
  shortcutName?: string;
  tagline?: string;
  phone: string;
  upiId: string;
  upiName?: string;
  gstin?: string;
  address: string;
  defaultTaxRate: number;
  createdAt?: string;
  updatedAt?: string;
  isDefault?: boolean;
  isPrimary?: boolean;
  active?: boolean;
  // Live operational metrics from central server
  todaySales?: number;
  todayBillsCount?: number;
  cashSales?: number;
  upiSales?: number;
  udhaarSales?: number;
  totalRevenue?: number;
  totalBillsCount?: number;
  udhaarDueTotal?: number;
  customersCount?: number;
  assignedStaffCount?: number;
  assignedStaff?: Array<{ id: string; name: string; role: string; username?: string }>;
  lastSyncAt?: string;
  lastTransactionAt?: string;
  openingCash?: number;
  addedCash?: number;
  cashInHand?: number;
  todayExpenses?: number;
}

export interface StoreSettings {
  shopName: string;
  tagline: string;
  phone: string;
  upiId: string;
  upiName?: string;
  gstin?: string;
  address: string;
  defaultTaxRate: number;
  lowStockThreshold?: number;
  printerConfig: PrinterConfig;
  staffAccounts: StaffAccount[];
  activeStaffId: string;
  autoBackupEnabled?: boolean;
  autoBackupFrequency?: 'daily' | 'each_shift' | 'weekly';
  lastBackupTimestamp?: string;
  autoSyncStaffEnabled?: boolean;
  autoSyncStaffIntervalSeconds?: number;
  lastStaffAutoSyncTimestamp?: string;
  stores?: StoreProfile[];
  activeStoreId?: string;
  openingAmount?: number;
  addedCash?: number;
}

export interface StaffAutoSyncStatus {
  isAutoSyncEnabled: boolean;
  isSyncing: boolean;
  lastSyncTimestamp?: string;
  lastSyncSuccess?: boolean;
  lastSyncError?: string;
  syncedBillsCount?: number;
  syncedCustomersCount?: number;
  syncedProductsCount?: number;
  lastUploadedBy?: string;
  targetOutletId?: string;
  targetOutletName?: string;
}

export interface FullBackupData {
  version: string;
  appName: string;
  backupTimestamp: string;
  storeName: string;
  summary: {
    totalProducts: number;
    totalTransactions: number;
    totalCustomers: number;
    totalUdhaarDue: number;
    totalMarketCreditBaaki?: number;
  };
  data: {
    products: Product[];
    transactions: Transaction[];
    customers: CustomerUdhaar[];
    marketCredits?: MarketCreditEntry[];
    storeSettings?: Partial<StoreSettings>;
    cashFlow?: {
      openingAmount: number;
      addedAmount: number;
    };
  };
}

export interface WebItemSearchResult {
  name: string;
  hindiName?: string;
  category: ProductCategory;
  suggestedUnit: UnitType;
  typicalMarketRate: number;
  description?: string;
}

export interface OutletDailySnapshot {
  id: string; // `${date}_${outletId}`
  date: string; // YYYY-MM-DD
  outletId: string;
  outletName: string;
  grossSales: number;
  salesCount: number;
  expenses: number;
  expenseCount: number;
  cashSales: number;
  upiSales: number;
  udhaarSales: number;
  netProfit: number;
  openingCash: number;
  addedCash: number;
  cashInHand: number;
  lastResetAt: string;
  resetsCount: number;
  archivedTransactions?: Transaction[];
}

