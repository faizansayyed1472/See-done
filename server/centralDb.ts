import fs from 'fs';
import path from 'path';

export interface CentralProduct {
  id: string;
  name: string;
  hindiName?: string;
  category: string;
  unit: string;
  rate: number;
  costPrice?: number;
  stock?: number;
  popular?: boolean;
  minStockAlert?: number;
  barcode?: string;
  notes?: string;
  imageUrl?: string;
  updatedAt?: string;
}

export interface CentralTransaction {
  id: string;
  receiptNumber: string;
  type: 'sale' | 'expense';
  amount: number;
  baseAmount?: number;
  taxAmount?: number;
  taxRate?: number;
  paymentMode: 'cash' | 'online_upi' | 'credit_udhaar';
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
  staffName?: string;
  staffId?: string;
  remarks?: string;
  notes?: string;
  timestamp: string;
  items?: any[];
  storeId?: string;
  storeName?: string;
  outletId?: string;
  outletName?: string;
  voided?: boolean;
  voidReason?: string;
}

export interface CentralCustomer {
  id: string;
  name: string;
  phone: string;
  totalDue: number;
  creditLimit?: number;
  lastActive: string;
  notes?: string;
  outletId?: string;
  outletName?: string;
  storeId?: string;
}

export interface CentralStaff {
  id: string;
  name: string;
  username?: string;
  serverId?: string;
  role: 'master_admin' | 'owner' | 'manager' | 'cashier';
  pin: string;
  phone?: string;
  active: boolean;
  assignedOutletIds?: string[];
  defaultOutletId?: string;
  createdAt?: string;
  permissions?: Record<string, boolean>;
}

export interface CentralOutlet {
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

export interface CentralAuditLog {
  id: string;
  timestamp: string;
  action: string;
  entity: 'product' | 'transaction' | 'customer' | 'settings' | 'staff' | 'database' | 'system';
  details: string;
  performedBy: string;
}

export interface CentralDailySnapshot {
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
  archivedTransactions?: CentralTransaction[];
}

export interface CentralStoreDb {
  version: string;
  serverId?: string;
  serverAdmin?: string;
  masterAdminUsername?: string;
  lastUpdated: string;
  cloudSyncMode: 'central_api' | 'firebase_firestore' | 'hybrid';
  outletSyncTimestamps?: Record<string, string>;
  firebaseConfig?: {
    projectId?: string;
    apiKey?: string;
    firestoreDatabaseId?: string;
    autoSyncToCloud?: boolean;
    connected?: boolean;
  };
  products: CentralProduct[];
  transactions: CentralTransaction[];
  customers: CentralCustomer[];
  staff: CentralStaff[];
  settings: Record<string, any>;
  auditLogs: CentralAuditLog[];
  dailySnapshots?: CentralDailySnapshot[];
  outletCashBalances?: Record<string, { openingCash: number; addedCash: number; date: string; lastUpdated: string; updatedBy?: string }>;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'central_store_db.json');

const DEFAULT_PRODUCTS: CentralProduct[] = [
  { id: 'sp-1', name: 'Haldi Powder (Turmeric)', hindiName: 'हल्दी पाउडर', category: 'spices', unit: 'kg', rate: 260, costPrice: 195, stock: 45, popular: true, barcode: '8901058852011' },
  { id: 'sp-2', name: 'Jeera (Cumin Seeds)', hindiName: 'साबुत जीरा', category: 'spices', unit: 'kg', rate: 380, costPrice: 290, stock: 28, popular: true, barcode: '8901058852028' },
  { id: 'sp-3', name: 'Dhaniya Powder (Coriander)', hindiName: 'धनिया पाउडर', category: 'spices', unit: 'kg', rate: 220, costPrice: 160, stock: 35, popular: true, barcode: '8901058852035' },
  { id: 'sp-4', name: 'Lal Mirch Powder (Red Chilli)', hindiName: 'लाल मिर्च पाउडर', category: 'spices', unit: 'kg', rate: 340, costPrice: 250, stock: 18, popular: true, barcode: '8901058852042' },
  { id: 'sp-5', name: 'Garam Masala Special', hindiName: 'शाही गरम मसाला', category: 'spices', unit: 'kg', rate: 680, costPrice: 480, stock: 6, popular: true, barcode: '8901058852059', minStockAlert: 10 },
  { id: 'sp-6', name: 'Chhoti Elaichi (Green Cardamom)', hindiName: 'छोटी इलायची', category: 'spices', unit: 'g', rate: 3.2, costPrice: 2.4, stock: 250, popular: true, barcode: '8901058852066' },
  { id: 'sp-7', name: 'Sabut Kali Mirch (Black Pepper)', hindiName: 'काली मिर्च', category: 'spices', unit: 'kg', rate: 850, costPrice: 650, stock: 14, popular: true, barcode: '8901058852073' },
  { id: 'sp-8', name: 'Laung (Cloves)', hindiName: 'साबुत लौंग', category: 'spices', unit: 'kg', rate: 1150, costPrice: 880, stock: 7, popular: false, barcode: '8901058852080', minStockAlert: 10 },
  { id: 'sp-9', name: 'Dalchini (Cinnamon Bark)', hindiName: 'दालचीनी', category: 'spices', unit: 'kg', rate: 460, costPrice: 340, stock: 12, popular: false, barcode: '8901058852097' },
  { id: 'sp-10', name: 'Badi Elaichi (Black Cardamom)', hindiName: 'बड़ी इलायची', category: 'spices', unit: 'kg', rate: 1750, costPrice: 1350, stock: 2, popular: false, barcode: '8901058852103', minStockAlert: 5 },
  { id: 'sp-11', name: 'Rai / Sarson (Mustard Seeds)', hindiName: 'राई / सरसों दाना', category: 'spices', unit: 'kg', rate: 110, costPrice: 82, stock: 60, popular: true, barcode: '8901058852110' },
  { id: 'sp-12', name: 'Saunf (Fennel Seeds)', hindiName: 'सौंफ मोटी', category: 'spices', unit: 'kg', rate: 240, costPrice: 180, stock: 22, popular: false, barcode: '8901058852127' },
  { id: 'sp-13', name: 'Ajwain (Carom Seeds)', hindiName: 'अजवाइन', category: 'spices', unit: 'kg', rate: 290, costPrice: 215, stock: 16, popular: false, barcode: '8901058852134' },
  { id: 'sp-14', name: 'Kasuri Methi', hindiName: 'कस्तूरी मेथी', category: 'spices', unit: 'packet', rate: 45, costPrice: 32, stock: 25, popular: false, barcode: '8901058852141' },
  { id: 'sp-15', name: 'Asafoetida (Hing Vandevi 50g)', hindiName: 'हींग (50 ग्राम)', category: 'spices', unit: 'packet', rate: 115, costPrice: 88, stock: 4, popular: true, barcode: '8901058852158', minStockAlert: 8 },
  { id: 'sp-16', name: 'Biryani Masala (Pack 100g)', hindiName: 'बिरयानी मसाला', category: 'spices', unit: 'packet', rate: 75, costPrice: 54, stock: 30, popular: true, barcode: '8901058852165' },
  { id: 'sp-17', name: 'Kashmiri Mirch (Deggi)', hindiName: 'कश्मीरी लाल मिर्च', category: 'spices', unit: 'kg', rate: 480, costPrice: 370, stock: 15, popular: true, barcode: '8901058852172' },
  { id: 'sp-18', name: 'Amchur Powder (Dry Mango)', hindiName: 'आमचूर पाउडर', category: 'spices', unit: 'kg', rate: 320, costPrice: 240, stock: 9, popular: false, barcode: '8901058852189' },
  { id: 'dal-1', name: 'Toor Dal (Arhar Dal)', hindiName: 'अरहर / तूर दाल', category: 'dal_pulses', unit: 'kg', rate: 165, costPrice: 142, stock: 85, popular: true, barcode: '8902058852018' },
  { id: 'dal-2', name: 'Moong Dal Dhuli (Yellow)', hindiName: 'मूंग दाल धुली', category: 'dal_pulses', unit: 'kg', rate: 130, costPrice: 108, stock: 40, popular: true, barcode: '8902058852025' },
  { id: 'dal-3', name: 'Chana Dal', hindiName: 'चना दाल', category: 'dal_pulses', unit: 'kg', rate: 92, costPrice: 76, stock: 55, popular: true, barcode: '8902058852032' },
  { id: 'dal-4', name: 'Urad Dal Dhuli (White)', hindiName: 'उड़द दाल धुली', category: 'dal_pulses', unit: 'kg', rate: 145, costPrice: 122, stock: 18, popular: false, barcode: '8902058852049' },
  { id: 'dal-5', name: 'Kabuli Chana (White Chickpeas)', hindiName: 'काबुली चना', category: 'dal_pulses', unit: 'kg', rate: 135, costPrice: 110, stock: 32, popular: true, barcode: '8902058852056' },
  { id: 'dal-6', name: 'Kala Chana (Desi Gram)', hindiName: 'काला चना', category: 'dal_pulses', unit: 'kg', rate: 85, costPrice: 68, stock: 24, popular: false, barcode: '8902058852063' },
  { id: 'dal-7', name: 'Rajma Chitra (Kidney Beans)', hindiName: 'चित्रा राजमा', category: 'dal_pulses', unit: 'kg', rate: 155, costPrice: 128, stock: 20, popular: true, barcode: '8902058852070' },
  { id: 'gr-1', name: 'Chakki Fresh Sharbati Atta', hindiName: 'शरबती गेहूं आटा', category: 'grains_flour', unit: 'kg', rate: 44, costPrice: 36, stock: 150, popular: true, barcode: '8903058852015' },
  { id: 'gr-2', name: 'Basmati Rice Premium 1121', hindiName: 'बासमती चावल 1121', category: 'grains_flour', unit: 'kg', rate: 135, costPrice: 105, stock: 75, popular: true, barcode: '8903058852022' },
  { id: 'gr-3', name: 'Maida (Refined Flour)', hindiName: 'मैदा', category: 'grains_flour', unit: 'kg', rate: 38, costPrice: 30, stock: 45, popular: false, barcode: '8903058852039' },
  { id: 'gr-4', name: 'Sooji / Rava (Semolina)', hindiName: 'सूजी / रवा', category: 'grains_flour', unit: 'kg', rate: 42, costPrice: 33, stock: 38, popular: false, barcode: '8903058852046' },
  { id: 'gr-5', name: 'Besan (Gram Flour)', hindiName: 'चना बेसन', category: 'grains_flour', unit: 'kg', rate: 98, costPrice: 80, stock: 30, popular: true, barcode: '8903058852053' },
  { id: 'oil-1', name: 'Kachi Ghani Sarson Oil (1L)', hindiName: 'कच्ची घानी सरसों तेल', category: 'oil_ghee', unit: 'litre', rate: 158, costPrice: 138, stock: 50, popular: true, barcode: '8904058852012' },
  { id: 'oil-2', name: 'Fortune Refined Sunflower Oil (1L)', hindiName: 'रिफाइंड तेल 1L', category: 'oil_ghee', unit: 'packet', rate: 138, costPrice: 122, stock: 40, popular: true, barcode: '8904058852029' },
  { id: 'oil-3', name: 'Pure Desi Cow Ghee (1L)', hindiName: 'शुद्ध देशी गाय घी', category: 'oil_ghee', unit: 'litre', rate: 640, costPrice: 520, stock: 15, popular: true, barcode: '8904058852036' },
  { id: 'df-1', name: 'Kaju W320 Cashews (1kg)', hindiName: 'काजू साबुत W320', category: 'dry_fruits', unit: 'kg', rate: 840, costPrice: 680, stock: 25, popular: true, barcode: '8905058852019' },
  { id: 'df-2', name: 'California Badam Almonds (1kg)', hindiName: 'कैलिफोर्निया बादाम', category: 'dry_fruits', unit: 'kg', rate: 780, costPrice: 630, stock: 30, popular: true, barcode: '8905058852026' },
  { id: 'df-3', name: 'Kishmish Green Raisins (1kg)', hindiName: 'हरी किशमिश', category: 'dry_fruits', unit: 'kg', rate: 340, costPrice: 260, stock: 20, popular: true, barcode: '8905058852033' },
  { id: 'df-4', name: 'Phool Makhana (Fox Nuts)', hindiName: 'फूल मखाना', category: 'dry_fruits', unit: 'kg', rate: 920, costPrice: 750, stock: 12, popular: true, barcode: '8905058852040' },
  { id: 'dn-1', name: 'Tata Salt (1kg Pouch)', hindiName: 'टाटा नमक 1kg', category: 'daily_needs', unit: 'packet', rate: 28, costPrice: 24, stock: 90, popular: true, barcode: '8906058852016' },
  { id: 'dn-2', name: 'Sugar / Cheeni (1kg)', hindiName: 'सफेद चीनी', category: 'daily_needs', unit: 'kg', rate: 45, costPrice: 39, stock: 120, popular: true, barcode: '8906058852023' },
  { id: 'dn-3', name: 'Red Label Tea (250g)', hindiName: 'चाय पत्ती 250g', category: 'daily_needs', unit: 'packet', rate: 140, costPrice: 120, stock: 35, popular: true, barcode: '8906058852030' },
];

const DEFAULT_STAFF: CentralStaff[] = [
  {
    id: 'faizan-inamdar',
    name: 'Faizan Inamdar (admin)',
    username: 'faizan',
    serverId: 'faizan-inamdar',
    role: 'owner',
    pin: 'nayab@q6',
    phone: '9876543210',
    active: true,
    assignedOutletIds: ['store-1', 'store-2'],
    defaultOutletId: 'store-1',
    createdAt: new Date().toISOString(),
    permissions: {
      canEditProducts: true,
      canViewReports: true,
      canManageUdhaar: true,
      canVoidBills: true,
      canAccessMasterAdmin: true,
    },
  },
  {
    id: 'staff-1',
    name: 'Abdullah',
    username: 'abdullah',
    role: 'cashier',
    pin: '0000',
    phone: '9876500001',
    active: true,
    assignedOutletIds: ['store-1'],
    defaultOutletId: 'store-1',
    createdAt: new Date().toISOString(),
    permissions: {
      canEditProducts: false,
      canViewReports: false,
      canManageUdhaar: true,
      canVoidBills: false,
      canAccessMasterAdmin: false,
    },
  },
  {
    id: 'staff-2',
    name: 'Ayan',
    username: 'ayan',
    role: 'cashier',
    pin: '0000',
    phone: '9876500002',
    active: true,
    assignedOutletIds: ['store-2'],
    defaultOutletId: 'store-2',
    createdAt: new Date().toISOString(),
    permissions: {
      canEditProducts: false,
      canViewReports: false,
      canManageUdhaar: true,
      canVoidBills: false,
      canAccessMasterAdmin: false,
    },
  },
];

const DEFAULT_CUSTOMERS: CentralCustomer[] = [];

const DEFAULT_SETTINGS = {
  shopName: 'sy Nayab',
  tagline: 'Authentic Indian Spices & Daily Groceries',
  phone: '9876543210',
  upiId: 'nayabmasale@upi',
  upiName: 'sy Nayab',
  address: 'Main Bazaar, Outlet 1',
  defaultTaxRate: 0,
  lowStockThreshold: 10,
  staffAccounts: DEFAULT_STAFF,
  activeStaffId: 'staff-owner',
  stores: [
    {
      id: 'store-1',
      shopName: 'sy Nayab',
      shortcutName: 'SY',
      tagline: 'Authentic Indian Spices & Daily Groceries',
      phone: '9876543210',
      upiId: 'nayabmasale@upi',
      upiName: 'sy Nayab',
      address: 'Main Bazaar, Outlet 1',
      defaultTaxRate: 0,
      isDefault: true,
      isPrimary: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'store-2',
      shopName: 'kp Nayab',
      shortcutName: 'KP',
      tagline: 'Authentic Indian Spices & Daily Groceries',
      phone: '9876543210',
      upiId: 'nayabmasale@upi',
      upiName: 'kp Nayab',
      address: 'Branch 2, Outlet 2',
      defaultTaxRate: 0,
      isDefault: false,
      createdAt: new Date().toISOString(),
    },
  ],
  activeStoreId: 'store-1',
  printerConfig: {
    printerType: 'browser',
    paperWidth: '58mm',
    autoPrintOnSale: false,
    connected: false,
    printQrCodeOnSlip: true,
  },
};

class CentralDatabaseManager {
  private db: CentralStoreDb;
  private isWriting = false;

  constructor() {
    this.ensureDataDir();
    this.db = this.loadOrInitDb();
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch (err) {
        console.error('Failed to create central data directory:', err);
      }
    }
  }

  private loadOrInitDb(): CentralStoreDb {
    // Check for provisioned firebase-applet-config.json
    let provisionedConfig: any = null;
    const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(firebaseConfigPath)) {
      try {
        provisionedConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
      } catch (e) {
        console.warn('Error reading firebase-applet-config.json:', e);
      }
    }

    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.products)) {
          // Verify staff has master_admin
          if (!parsed.staff || !parsed.staff.some((s: CentralStaff) => s.role === 'master_admin' || s.role === 'owner')) {
            parsed.staff = DEFAULT_STAFF;
          }
          // Ensure transactions and customers arrays exist
          if (!Array.isArray(parsed.transactions)) {
            parsed.transactions = [];
          }
          if (!Array.isArray(parsed.customers)) {
            parsed.customers = [];
          }
          // Ensure staff accounts have outlet assignments
          if (Array.isArray(parsed.staff)) {
            parsed.staff = parsed.staff.map((s: CentralStaff) => {
              if (s.name?.toLowerCase().includes('abdullah') || s.id === 'staff-1') {
                return {
                  ...s,
                  username: s.username || 'abdullah',
                  assignedOutletIds: s.assignedOutletIds?.length ? s.assignedOutletIds : ['store-1'],
                  defaultOutletId: s.defaultOutletId || 'store-1',
                };
              }
              if (s.name?.toLowerCase().includes('ayan') || s.id === 'staff-2') {
                return {
                  ...s,
                  username: s.username || 'ayan',
                  assignedOutletIds: s.assignedOutletIds?.length ? s.assignedOutletIds : ['store-2'],
                  defaultOutletId: s.defaultOutletId || 'store-2',
                };
              }
              if (s.role === 'owner' || s.role === 'master_admin' || s.id === 'staff-owner' || s.id === 'faizan-inamdar' || s.name?.toLowerCase().includes('faizan')) {
                return {
                  ...s,
                  id: s.id === 'staff-owner' ? 'faizan-inamdar' : (s.id || 'faizan-inamdar'),
                  name: 'Faizan Inamdar (admin)',
                  username: s.username || 'faizan',
                  serverId: 'faizan-inamdar',
                  assignedOutletIds: s.assignedOutletIds?.length ? s.assignedOutletIds : ['store-1', 'store-2'],
                  defaultOutletId: s.defaultOutletId || 'store-1',
                };
              }
              return s;
            });
          }
          parsed.serverId = parsed.serverId || 'faizan-inamdar';
          parsed.serverAdmin = parsed.serverAdmin || 'Faizan Inamdar';
          parsed.masterAdminUsername = parsed.masterAdminUsername || 'faizan';
          if (!parsed.outletSyncTimestamps) {
            parsed.outletSyncTimestamps = {
              'store-1': new Date().toISOString(),
              'store-2': new Date().toISOString(),
            };
          }
          if (provisionedConfig) {
            parsed.firebaseConfig = {
              projectId: provisionedConfig.projectId,
              apiKey: provisionedConfig.apiKey,
              firestoreDatabaseId: provisionedConfig.firestoreDatabaseId,
              autoSyncToCloud: true,
              connected: true,
            };
            parsed.cloudSyncMode = 'firebase_firestore';
          }
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Central DB file unreadable, initializing fresh central database:', err);
    }

    const initialDb: CentralStoreDb = {
      version: '2.0.0',
      lastUpdated: new Date().toISOString(),
      cloudSyncMode: provisionedConfig ? 'firebase_firestore' : 'central_api',
      firebaseConfig: provisionedConfig
        ? {
            projectId: provisionedConfig.projectId,
            apiKey: provisionedConfig.apiKey,
            firestoreDatabaseId: provisionedConfig.firestoreDatabaseId,
            autoSyncToCloud: true,
            connected: true,
          }
        : undefined,
      products: DEFAULT_PRODUCTS,
      transactions: [],
      customers: DEFAULT_CUSTOMERS,
      staff: DEFAULT_STAFF,
      settings: DEFAULT_SETTINGS,
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: 'DATABASE_INITIALIZED',
          entity: 'database',
          details: 'Central Server Database initialized with initial catalog & master admin.',
          performedBy: 'System Bootstrap',
        },
      ],
    };

    this.persist(initialDb);
    return initialDb;
  }

  private persist(dbToSave = this.db) {
    if (this.isWriting) return;
    this.isWriting = true;
    try {
      dbToSave.lastUpdated = new Date().toISOString();
      fs.writeFileSync(DB_FILE, JSON.stringify(dbToSave, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed writing central database to disk:', err);
    } finally {
      this.isWriting = false;
    }
  }

  public getStatus() {
    const enriched = this.getEnrichedOutlets();
    const totalOpeningCash = enriched.reduce((sum, o) => sum + (o.openingCash || 0), 0);
    const totalAddedCash = enriched.reduce((sum, o) => sum + (o.addedCash || 0), 0);
    const totalCashInHand = enriched.reduce((sum, o) => sum + (o.cashInHand || 0), 0);

    return {
      status: 'connected' as const,
      version: this.db.version,
      serverId: this.db.serverId || 'faizan-inamdar',
      serverAdmin: this.db.serverAdmin || 'Faizan Inamdar',
      masterAdminUsername: this.db.masterAdminUsername || 'faizan',
      lastSyncedAt: this.db.lastUpdated,
      productsCount: this.db.products.length,
      transactionsCount: this.db.transactions.length,
      customersCount: this.db.customers.length,
      storeName: this.db.settings?.shopName || 'sy Nayab',
      cloudSyncMode: this.db.cloudSyncMode,
      firebaseConfigured: Boolean(this.db.firebaseConfig?.projectId),
      totalOpeningCash,
      totalAddedCash,
      totalCashInHand,
    };
  }

  public getFullSnapshot(): CentralStoreDb {
    return this.db;
  }

  public getProducts(): CentralProduct[] {
    return this.db.products;
  }

  public getTransactions(): CentralTransaction[] {
    return this.db.transactions;
  }

  public getCustomers(): CentralCustomer[] {
    return this.db.customers;
  }

  public getStaff(): CentralStaff[] {
    return this.db.staff;
  }

  public getSettings(): Record<string, any> {
    return this.db.settings;
  }

  public getAuditLogs(limit = 100): CentralAuditLog[] {
    return this.db.auditLogs.slice(-limit).reverse();
  }

  public addAuditLog(action: string, entity: CentralAuditLog['entity'], details: string, performedBy = 'Master Admin') {
    const entry: CentralAuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      action,
      entity,
      details,
      performedBy,
    };
    this.db.auditLogs.push(entry);
    // Keep max 1000 audit entries
    if (this.db.auditLogs.length > 1000) {
      this.db.auditLogs = this.db.auditLogs.slice(-800);
    }
    this.persist();
    return entry;
  }

  public verifyMasterAdmin(pin: string, usernameOrServerId?: string): { success: boolean; staff?: CentralStaff; serverId?: string; serverAdmin?: string; message?: string } {
    const cleanPin = (pin || '').trim();
    const cleanId = (usernameOrServerId || '').trim().toLowerCase();
    const cleanIdStripped = cleanId.replace(/[^a-z0-9]/g, '');

    const isFaizanAttempt =
      !cleanId ||
      cleanId === 'faizan' ||
      cleanId === 'faizan inamdar' ||
      cleanId === 'faizan-inamdar' ||
      cleanIdStripped === 'faizaninamdar' ||
      cleanIdStripped === 'faizaninamdaradmin' ||
      cleanIdStripped === 'faizan' ||
      cleanId === 'server' ||
      cleanId === 'admin' ||
      cleanId === 'owner' ||
      cleanId === 'staff-owner';

    // Default master admin pin fallback is 'nayab@q6'
    if (cleanPin === 'nayab@q6') {
      const admin = this.db.staff.find((s) =>
        s.role === 'master_admin' ||
        s.role === 'owner' ||
        s.username === 'faizan' ||
        s.id === 'faizan-inamdar' ||
        s.id === 'staff-owner'
      ) || this.db.staff[0];
      return {
        success: true,
        staff: admin,
        serverId: this.db.serverId || 'faizan-inamdar',
        serverAdmin: this.db.serverAdmin || 'Faizan Inamdar',
      };
    }

    const matched = this.db.staff.find((s) => {
      const isOwnerOrMaster = s.role === 'master_admin' || s.role === 'owner';
      const u = (s.username || '').toLowerCase();
      const n = (s.name || '').toLowerCase();
      const nStripped = n.replace(/[^a-z0-9]/g, '');
      const rawId = (s.id || '').toLowerCase();
      const rawServerId = ((s as any).serverId || '').toLowerCase();

      const pinMatches = s.pin === cleanPin;
      if (!pinMatches) return false;

      if (!cleanId) return isOwnerOrMaster;

      return (
        (isFaizanAttempt && isOwnerOrMaster) ||
        u === cleanId ||
        rawServerId === cleanId ||
        n === cleanId ||
        nStripped === cleanIdStripped ||
        rawId === cleanId
      );
    });

    if (matched) {
      return {
        success: true,
        staff: matched,
        serverId: this.db.serverId || 'faizan-inamdar',
        serverAdmin: this.db.serverAdmin || 'Faizan Inamdar',
      };
    }

    return {
      success: false,
      message: 'Invalid Master Admin credentials. Please check Faizan Inamdar server ID and PIN.',
    };
  }

  /**
   * Merge sync delta from client terminal
   */
  public syncClient(delta: {
    clientTimestamp?: string;
    clientId?: string;
    outletId?: string;
    products?: CentralProduct[];
    transactions?: CentralTransaction[];
    customers?: CentralCustomer[];
    settings?: Record<string, any>;
    staff?: CentralStaff[];
    performedBy?: string;
    openingCash?: number;
    openingAmount?: number;
    addedCash?: number;
    addedAmount?: number;
  }) {
    const actor = delta.performedBy || 'Counter Terminal';

    let hasChanges = false;

    // Track outlet-specific sync timestamp if outletId provided
    if (delta.outletId) {
      this.db.outletSyncTimestamps = this.db.outletSyncTimestamps || {};
      this.db.outletSyncTimestamps[delta.outletId] = new Date().toISOString();
      const outletName = delta.outletId === 'store-2' ? 'kp Nayab' : 'sy Nayab';
      this.addAuditLog(
        'OUTLET_SYNCED',
        'database',
        `Synchronized data separately for outlet: ${outletName} (${delta.outletId})`,
        actor
      );
      hasChanges = true;

      // Check if opening cash or added cash float provided
      const resolvedOpening = typeof delta.openingCash === 'number' ? delta.openingCash : (typeof delta.openingAmount === 'number' ? delta.openingAmount : undefined);
      const resolvedAdded = typeof delta.addedCash === 'number' ? delta.addedCash : (typeof delta.addedAmount === 'number' ? delta.addedAmount : undefined);
      if (typeof resolvedOpening === 'number' || typeof resolvedAdded === 'number') {
        this.updateOutletCash(delta.outletId, {
          openingCash: resolvedOpening,
          addedCash: resolvedAdded,
          mode: 'set',
          actor,
        });
      }
    }

    // 1. Merge Products: match by ID; if client has newer or new products, update/insert
    if (Array.isArray(delta.products) && delta.products.length > 0) {
      const productMap = new Map<string, CentralProduct>(this.db.products.map((p) => [p.id, p]));
      for (const p of delta.products) {
        if (!p || !p.id) continue;
        const existing = productMap.get(p.id);
        if (!existing) {
          productMap.set(p.id, { ...p, updatedAt: p.updatedAt || new Date().toISOString() });
          hasChanges = true;
        } else {
          // Compare updatedAt or rate/stock
          if (p.updatedAt && (!existing.updatedAt || p.updatedAt >= existing.updatedAt)) {
            productMap.set(p.id, { ...existing, ...p });
            hasChanges = true;
          } else if (p.rate !== existing.rate || p.stock !== existing.stock || p.name !== existing.name) {
            productMap.set(p.id, { ...existing, ...p, updatedAt: new Date().toISOString() });
            hasChanges = true;
          }
        }
      }
      this.db.products = Array.from(productMap.values());
    }

    // 2. Merge Transactions: prevent duplicates by ID or receiptNumber
    if (Array.isArray(delta.transactions) && delta.transactions.length > 0) {
      const txIds = new Set(this.db.transactions.map((t) => t.id));
      const receiptNos = new Set(this.db.transactions.map((t) => t.receiptNumber));
      const newTxs: CentralTransaction[] = [];

      for (const t of delta.transactions) {
        if (!t || (!t.id && !t.receiptNumber)) continue;
        const existing = this.db.transactions.find(
          (tx) => tx.id === t.id || (tx.receiptNumber && tx.receiptNumber === t.receiptNumber)
        );

        if (!existing) {
          const storeId = t.outletId || t.storeId || 'store-1';
          const defaultOutletName = storeId === 'store-2' ? 'kp Nayab' : 'sy Nayab';
          const normalizedTx: CentralTransaction = {
            ...t,
            storeId,
            outletId: storeId,
            storeName: t.outletName || t.storeName || defaultOutletName,
            outletName: t.outletName || t.storeName || defaultOutletName,
          };
          newTxs.push(normalizedTx);
          txIds.add(t.id);
          if (t.receiptNumber) receiptNos.add(t.receiptNumber);
          hasChanges = true;
        } else {
          // If voided status changed, update it
          if (t.voided && !existing.voided) {
            existing.voided = true;
            existing.voidReason = t.voidReason;
            hasChanges = true;
          }
          // Backfill outletId/storeId if missing
          if (!existing.outletId && (t.outletId || t.storeId)) {
            existing.outletId = t.outletId || t.storeId;
            existing.storeId = existing.outletId;
            hasChanges = true;
          }
        }
      }

      if (newTxs.length > 0) {
        this.db.transactions = [...newTxs, ...this.db.transactions];
        this.addAuditLog(
          'TRANSACTIONS_SYNCED',
          'transaction',
          `Synced ${newTxs.length} new transaction(s) from counter terminal.`,
          actor
        );
      }
    }

    // 3. Merge Customers: preserve highest totalDue or latest activity and preserve outlet
    if (Array.isArray(delta.customers) && delta.customers.length > 0) {
      const custMap = new Map<string, CentralCustomer>(this.db.customers.map((c) => [c.id, c]));
      for (const c of delta.customers) {
        if (!c || !c.id) continue;
        const storeId = c.outletId || c.storeId || 'store-1';
        const defaultOutletName = storeId === 'store-2' ? 'kp Nayab' : 'sy Nayab';
        const normalizedCust: CentralCustomer = {
          ...c,
          storeId,
          outletId: storeId,
          outletName: c.outletName || defaultOutletName,
        };

        const existing = custMap.get(c.id);
        if (!existing) {
          custMap.set(c.id, normalizedCust);
          hasChanges = true;
        } else {
          if (new Date(c.lastActive || 0) >= new Date(existing.lastActive || 0) || c.totalDue !== existing.totalDue) {
            custMap.set(c.id, { ...existing, ...normalizedCust });
            hasChanges = true;
          }
        }
      }
      this.db.customers = Array.from(custMap.values());
    }

    // 4. Merge Settings if provided
    if (delta.settings && typeof delta.settings === 'object' && Object.keys(delta.settings).length > 0) {
      this.db.settings = { ...this.db.settings, ...delta.settings };
      hasChanges = true;
    }

    // 5. Merge Staff if provided (ensuring Faizan Inamdar maintains serverId)
    if (Array.isArray(delta.staff) && delta.staff.length > 0) {
      const staffMap = new Map<string, CentralStaff>(this.db.staff.map((s) => [s.id, s]));
      for (const s of delta.staff) {
        if (!s || !s.id) continue;
        const isFaizan =
          s.role === 'owner' ||
          s.role === 'master_admin' ||
          s.id === 'staff-owner' ||
          s.id === 'faizan-inamdar' ||
          s.name?.toLowerCase().includes('faizan');

        const normalizedStaff: CentralStaff = {
          ...s,
          serverId: isFaizan ? 'faizan-inamdar' : s.serverId,
        };

        const existing = staffMap.get(s.id);
        if (!existing) {
          staffMap.set(s.id, normalizedStaff);
          hasChanges = true;
        } else {
          staffMap.set(s.id, { ...existing, ...normalizedStaff });
          hasChanges = true;
        }
      }
      this.db.staff = Array.from(staffMap.values());
    }

    if (hasChanges) {
      this.persist();
    }

    return {
      success: true,
      status: 'success',
      snapshot: this.db,
      lastSyncedAt: this.db.lastUpdated,
      lastUpdated: this.db.lastUpdated,
      changesApplied: hasChanges,
    };
  }

  /**
   * Master Admin: Add or update single product
   */
  public saveProduct(product: CentralProduct, actor = 'Master Admin'): CentralProduct {
    const existingIndex = this.db.products.findIndex((p) => p.id === product.id);
    const updatedProd: CentralProduct = {
      ...product,
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      const old = this.db.products[existingIndex];
      this.db.products[existingIndex] = updatedProd;
      this.addAuditLog(
        'PRODUCT_UPDATED',
        'product',
        `Updated ${product.name}: Rate ₹${old.rate} → ₹${product.rate}, Stock ${old.stock ?? 0} → ${product.stock ?? 0}`,
        actor
      );
    } else {
      this.db.products.unshift(updatedProd);
      this.addAuditLog(
        'PRODUCT_CREATED',
        'product',
        `Added new product ${product.name} (@ ₹${product.rate}/${product.unit})`,
        actor
      );
    }

    this.persist();
    return updatedProd;
  }

  /**
   * Master Admin: Delete product
   */
  public deleteProduct(productId: string, actor = 'Master Admin'): boolean {
    const target = this.db.products.find((p) => p.id === productId);
    if (!target) return false;
    this.db.products = this.db.products.filter((p) => p.id !== productId);
    this.addAuditLog('PRODUCT_DELETED', 'product', `Deleted product: ${target.name} (ID: ${productId})`, actor);
    this.persist();
    return true;
  }

  /**
   * Master Admin: Bulk rate adjustment (e.g. increase all spices by 10% or apply flat offset)
   */
  public bulkAdjustRates(params: {
    category?: string;
    percentageChange?: number; // e.g. +10 or -5
    fixedOffset?: number; // e.g. +5 or -2
    rounding?: 'integer' | 'half' | 'none';
    actor?: string;
  }): { count: number; updatedProducts: CentralProduct[] } {
    const { category, percentageChange = 0, fixedOffset = 0, rounding = 'integer', actor = 'Master Admin' } = params;
    let count = 0;
    const updatedList: CentralProduct[] = [];

    this.db.products = this.db.products.map((p) => {
      if (category && category !== 'all' && p.category !== category) {
        return p;
      }

      let newRate = p.rate;
      if (percentageChange !== 0) {
        newRate = newRate * (1 + percentageChange / 100);
      }
      if (fixedOffset !== 0) {
        newRate += fixedOffset;
      }

      if (rounding === 'integer') {
        newRate = Math.round(newRate);
      } else if (rounding === 'half') {
        newRate = Math.round(newRate * 2) / 2;
      } else {
        newRate = Math.round(newRate * 100) / 100;
      }

      if (newRate < 0.1) newRate = 0.1;

      if (newRate !== p.rate) {
        count++;
        const updated = { ...p, rate: newRate, updatedAt: new Date().toISOString() };
        updatedList.push(updated);
        return updated;
      }
      return p;
    });

    if (count > 0) {
      this.addAuditLog(
        'BULK_RATE_ADJUSTMENT',
        'product',
        `Adjusted rates for ${count} product(s) in category [${category || 'all'}]: ${percentageChange >= 0 ? '+' : ''}${percentageChange}%, offset ${fixedOffset}`,
        actor
      );
      this.persist();
    }

    return { count, updatedProducts: updatedList };
  }

  /**
   * Master Admin: Void / Delete a transaction
   */
  public voidTransaction(id: string, reason: string, actor = 'Master Admin'): boolean {
    const tx = this.db.transactions.find((t) => t.id === id);
    if (!tx) return false;
    tx.voided = true;
    tx.voidReason = reason || 'Voided by Master Admin';
    this.addAuditLog('TRANSACTION_VOIDED', 'transaction', `Voided bill #${tx.receiptNumber} (₹${tx.amount}): ${reason}`, actor);
    this.persist();
    return true;
  }

  /**
   * Master Admin: Update staff accounts
   */
  public updateStaff(staffAccounts: CentralStaff[], actor = 'Master Admin') {
    this.db.staff = staffAccounts;
    this.addAuditLog('STAFF_ACCOUNTS_UPDATED', 'staff', `Updated ${staffAccounts.length} staff account(s)`, actor);
    this.persist();
    return this.db.staff;
  }

  /**
   * Get all store outlets configured in settings
   */
  public getOutlets(): CentralOutlet[] {
    if (!this.db.settings) {
      this.db.settings = {};
    }
    if (!Array.isArray(this.db.settings.stores) || this.db.settings.stores.length === 0) {
      this.db.settings.stores = [
        {
          id: 'store-1',
          shopName: this.db.settings.shopName || 'sy Nayab',
          shortcutName: 'SY',
          tagline: this.db.settings.tagline || 'Authentic Indian Spices & Daily Groceries',
          phone: this.db.settings.phone || '9876543210',
          upiId: this.db.settings.upiId || 'nayabmasale@upi',
          upiName: this.db.settings.upiName || 'sy Nayab',
          address: this.db.settings.address || 'Main Bazaar, Outlet 1',
          defaultTaxRate: this.db.settings.defaultTaxRate || 0,
          isDefault: true,
          isPrimary: true,
          active: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'store-2',
          shopName: 'kp Nayab',
          shortcutName: 'KP',
          tagline: 'Authentic Indian Spices & Daily Groceries',
          phone: '9876543210',
          upiId: 'nayabmasale@upi',
          upiName: 'kp Nayab',
          address: 'Branch 2, Outlet 2',
          defaultTaxRate: 0,
          isDefault: false,
          active: true,
          createdAt: new Date().toISOString(),
        },
      ];
      this.persist();
    }
    return this.db.settings.stores;
  }

  /**
   * Get all outlets enriched with real-time sales, collections, udhaar, and staff metrics
   * accessible by admin owner from any device online.
   */
  public getEnrichedOutlets(): CentralOutlet[] {
    const outlets = this.getOutlets();
    const todayStr = new Date().toISOString().slice(0, 10);

    return outlets.map((outlet) => {
      const outletId = outlet.id;
      // Filter transactions for this outlet
      const outletTxs = this.db.transactions.filter(
        (t) =>
          !t.voided &&
          (t.outletId === outletId ||
            t.storeId === outletId ||
            (!t.outletId && !t.storeId && (outlet.isDefault || outlet.isPrimary)))
      );
      const todayTxs = outletTxs.filter((t) => (t.timestamp || '').startsWith(todayStr));

      const todaySales = todayTxs
        .filter((t) => t.type === 'sale')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const cashSales = todayTxs
        .filter((t) => t.type === 'sale' && t.paymentMode === 'cash')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const upiSales = todayTxs
        .filter((t) => t.type === 'sale' && t.paymentMode === 'online_upi')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const udhaarSales = todayTxs
        .filter((t) => t.type === 'sale' && t.paymentMode === 'credit_udhaar')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const totalRevenue = outletTxs
        .filter((t) => t.type === 'sale')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      // Customers assigned or registered to this outlet
      const outletCusts = this.db.customers.filter(
        (c) =>
          c.outletId === outletId ||
          c.storeId === outletId ||
          (!c.outletId && !c.storeId && (outlet.isDefault || outlet.isPrimary))
      );
      const udhaarDueTotal = outletCusts.reduce((sum, c) => sum + (c.totalDue || 0), 0);

      // Staff members assigned
      const assignedStaff = this.db.staff
        .filter(
          (s) =>
            !s.assignedOutletIds ||
            s.assignedOutletIds.length === 0 ||
            s.assignedOutletIds.includes(outletId)
        )
        .map((s) => ({
          id: s.id,
          name: s.name,
          role: s.role,
          username: s.username,
        }));

      const lastSyncAt =
        this.db.outletSyncTimestamps?.[outletId] || outlet.updatedAt || this.db.lastUpdated;
      const lastTransactionAt = outletTxs.length > 0 ? outletTxs[0].timestamp : undefined;

      // Fetch today's snapshot and cash balances for opening amount & added amount
      const todaySnapshot = this.db.dailySnapshots?.find(
        (s) => s.outletId === outletId && s.date === todayStr
      );
      const cashBalances = (this.db.settings?.outletCashBalances || this.db.outletCashBalances || {}) as Record<string, any>;
      const cashBalance = cashBalances[outletId];
      const isCashToday = cashBalance && (cashBalance.date === todayStr || (!cashBalance.date && (cashBalance.lastUpdated || '').startsWith(todayStr)));

      const openingCash = typeof todaySnapshot?.openingCash === 'number' && todaySnapshot.openingCash > 0
        ? todaySnapshot.openingCash
        : (isCashToday && typeof cashBalance?.openingCash === 'number' ? cashBalance.openingCash : (todaySnapshot?.openingCash || 0));

      const addedCash = typeof todaySnapshot?.addedCash === 'number' && todaySnapshot.addedCash > 0
        ? todaySnapshot.addedCash
        : (isCashToday && typeof cashBalance?.addedCash === 'number' ? cashBalance.addedCash : (todaySnapshot?.addedCash || 0));

      const todayExpenses = todayTxs
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const cashInHand = Math.max(0, (openingCash + addedCash + cashSales) - todayExpenses);

      return {
        ...outlet,
        todaySales,
        todayBillsCount: todayTxs.length,
        cashSales,
        upiSales,
        udhaarSales,
        totalRevenue,
        totalBillsCount: outletTxs.length,
        udhaarDueTotal,
        customersCount: outletCusts.length,
        assignedStaffCount: assignedStaff.length,
        assignedStaff,
        lastSyncAt,
        lastTransactionAt,
        openingCash,
        addedCash,
        cashInHand,
        todayExpenses,
      };
    });
  }

  /**
   * Get detailed performance & records for a single outlet
   */
  public getOutletDetails(outletId: string) {
    const outlets = this.getEnrichedOutlets();
    const target = outlets.find((o) => o.id === outletId);
    if (!target) return null;

    const todayStr = new Date().toISOString().slice(0, 10);
    const outletTxs = this.db.transactions.filter(
      (t) =>
        t.outletId === outletId ||
        t.storeId === outletId ||
        (!t.outletId && !t.storeId && (target.isDefault || target.isPrimary))
    );
    const outletCusts = this.db.customers.filter(
      (c) =>
        c.outletId === outletId ||
        c.storeId === outletId ||
        (!c.outletId && !c.storeId && (target.isDefault || target.isPrimary))
    );
    const assignedStaff = this.db.staff.filter(
      (s) =>
        !s.assignedOutletIds ||
        s.assignedOutletIds.length === 0 ||
        s.assignedOutletIds.includes(outletId)
    );

    return {
      outlet: target,
      recentTransactions: outletTxs.slice(0, 50),
      customers: outletCusts,
      staff: assignedStaff,
      metrics: {
        totalRevenue: target.totalRevenue,
        totalBills: target.totalBillsCount,
        todaySales: target.todaySales,
        todayBills: target.todayBillsCount,
        cashSales: target.cashSales,
        upiSales: target.upiSales,
        udhaarSales: target.udhaarSales,
        udhaarDue: target.udhaarDueTotal,
        openingCash: target.openingCash || 0,
        addedCash: target.addedCash || 0,
        cashInHand: target.cashInHand || 0,
        todayExpenses: target.todayExpenses || 0,
      },
    };
  }

  /**
   * Save (create or update) outlet data from online admin client
   */
  public saveOutlet(outletData: any, actor = 'Master Admin'): CentralOutlet {
    const outlets = this.getOutlets();
    const id = (outletData.id || '').trim() || `store-${Date.now()}`;
    const cleanShopName = (outletData.shopName || '').trim();
    if (!cleanShopName) {
      throw new Error('Store / Outlet name is required');
    }

    const existingIndex = outlets.findIndex((o) => o.id === id);
    const nowIso = new Date().toISOString();

    const updatedOutlet: CentralOutlet = {
      id,
      shopName: cleanShopName,
      shortcutName: (outletData.shortcutName || cleanShopName.slice(0, 2).toUpperCase()).trim(),
      tagline: (outletData.tagline || 'Authentic Indian Spices & Daily Groceries').trim(),
      phone: (outletData.phone || '9876543210').trim(),
      upiId: (outletData.upiId || 'nayabmasale@upi').trim(),
      upiName: (outletData.upiName || cleanShopName).trim(),
      gstin: (outletData.gstin || '').trim(),
      address: (outletData.address || '').trim(),
      defaultTaxRate: Number(outletData.defaultTaxRate) || 0,
      isDefault: Boolean(outletData.isDefault),
      isPrimary: Boolean(outletData.isPrimary || (existingIndex >= 0 && outlets[existingIndex].isPrimary)),
      active: outletData.active !== false,
      createdAt: existingIndex >= 0 ? outlets[existingIndex].createdAt || nowIso : nowIso,
      updatedAt: nowIso,
    };

    // If marked default, unset isDefault on other outlets
    if (updatedOutlet.isDefault) {
      for (const o of outlets) {
        if (o.id !== id) o.isDefault = false;
      }
    }

    if (existingIndex >= 0) {
      outlets[existingIndex] = updatedOutlet;
      this.addAuditLog(
        'OUTLET_UPDATED',
        'settings',
        `Admin owner updated outlet "${cleanShopName}" (ID: ${id}) via online client-server architecture`,
        actor
      );
    } else {
      outlets.push(updatedOutlet);
      this.addAuditLog(
        'OUTLET_CREATED',
        'settings',
        `Admin owner created new branch outlet "${cleanShopName}" (ID: ${id}) via online client-server architecture`,
        actor
      );
    }

    // Sync primary settings if this is default outlet
    if (updatedOutlet.isDefault) {
      this.db.settings.shopName = updatedOutlet.shopName;
      this.db.settings.tagline = updatedOutlet.tagline;
      this.db.settings.phone = updatedOutlet.phone;
      this.db.settings.upiId = updatedOutlet.upiId;
      this.db.settings.upiName = updatedOutlet.upiName;
      this.db.settings.address = updatedOutlet.address;
      this.db.settings.defaultTaxRate = updatedOutlet.defaultTaxRate;
    }

    this.db.settings.stores = outlets;
    this.persist();
    return updatedOutlet;
  }

  /**
   * Delete outlet from online admin client
   */
  public deleteOutlet(outletId: string, actor = 'Master Admin'): { success: boolean; remainingOutlets: CentralOutlet[] } {
    const outlets = this.getOutlets();
    if (outlets.length <= 1) {
      throw new Error('Cannot delete the only store outlet. At least one outlet must remain active.');
    }
    const target = outlets.find((o) => o.id === outletId);
    if (!target) {
      throw new Error(`Outlet with ID ${outletId} not found.`);
    }
    if (target.isPrimary) {
      throw new Error('Cannot delete primary HQ outlet.');
    }

    this.db.settings.stores = outlets.filter((o) => o.id !== outletId);

    // If deleted outlet was default, make the first remaining outlet default
    if (target.isDefault && this.db.settings.stores.length > 0) {
      this.db.settings.stores[0].isDefault = true;
    }

    // If activeStoreId was the deleted outlet, switch to first remaining
    if (this.db.settings.activeStoreId === outletId && this.db.settings.stores.length > 0) {
      this.db.settings.activeStoreId = this.db.settings.stores[0].id;
    }

    this.addAuditLog(
      'OUTLET_DELETED',
      'settings',
      `Admin owner deleted outlet "${target.shopName}" (ID: ${outletId}) via online client-server architecture`,
      actor
    );

    this.persist();
    return { success: true, remainingOutlets: this.db.settings.stores };
  }

  /**
   * Switch active counter outlet POS
   */
  public switchActiveOutlet(outletId: string, actor = 'Counter User') {
    const outlets = this.getOutlets();
    const target = outlets.find((o) => o.id === outletId);
    if (!target) {
      throw new Error(`Outlet with ID ${outletId} not found.`);
    }
    this.db.settings.activeStoreId = outletId;
    this.addAuditLog(
      'OUTLET_SWITCHED',
      'settings',
      `Switched active counter POS to outlet "${target.shopName}" (ID: ${outletId})`,
      actor
    );
    this.persist();
    return { success: true, activeStoreId: outletId, outlet: target };
  }

  /**
   * Update and sync opening cash and added cash for an outlet
   */
  public updateOutletCash(
    outletId: string,
    cashData: {
      openingCash?: number;
      addedCash?: number;
      mode?: 'set' | 'add';
      actor?: string;
    }
  ) {
    const todayStr = new Date().toISOString().slice(0, 10);
    this.db.settings = this.db.settings || {};
    this.db.settings.outletCashBalances = this.db.settings.outletCashBalances || {};
    const existing = this.db.settings.outletCashBalances[outletId] || {
      openingCash: 0,
      addedCash: 0,
      date: todayStr,
      lastUpdated: new Date().toISOString(),
    };

    // If existing record was from a previous day, rollover cleanly
    if (existing.date && existing.date !== todayStr) {
      existing.openingCash = 0;
      existing.addedCash = 0;
      existing.date = todayStr;
    }

    let updatedOpening = existing.openingCash || 0;
    let updatedAdded = existing.addedCash || 0;

    if (typeof cashData.openingCash === 'number') {
      updatedOpening = Math.max(0, Math.round(cashData.openingCash * 100) / 100);
    }

    if (typeof cashData.addedCash === 'number') {
      if (cashData.mode === 'add') {
        updatedAdded = Math.max(0, Math.round((updatedAdded + cashData.addedCash) * 100) / 100);
      } else {
        updatedAdded = Math.max(0, Math.round(cashData.addedCash * 100) / 100);
      }
    }

    const nowIso = new Date().toISOString();
    const actor = cashData.actor || 'Counter Terminal / Admin';

    this.db.settings.outletCashBalances[outletId] = {
      openingCash: updatedOpening,
      addedCash: updatedAdded,
      date: todayStr,
      lastUpdated: nowIso,
      updatedBy: actor,
    };

    // Also update today's daily snapshot if present or initialize it
    const snapId = `${todayStr}_${outletId}`;
    this.db.dailySnapshots = this.db.dailySnapshots || [];
    const snapIndex = this.db.dailySnapshots.findIndex((s) => s.id === snapId || (s.date === todayStr && s.outletId === outletId));
    if (snapIndex >= 0) {
      this.db.dailySnapshots[snapIndex].openingCash = updatedOpening;
      this.db.dailySnapshots[snapIndex].addedCash = updatedAdded;
      const snap = this.db.dailySnapshots[snapIndex];
      snap.cashInHand = (updatedOpening + updatedAdded + (snap.cashSales || 0)) - (snap.expenses || 0);
    } else {
      const outletObj = this.getOutlets().find((o) => o.id === outletId);
      this.db.dailySnapshots.push({
        id: snapId,
        date: todayStr,
        outletId,
        outletName: outletObj?.shopName || outletId,
        grossSales: 0,
        salesCount: 0,
        expenses: 0,
        expenseCount: 0,
        cashSales: 0,
        upiSales: 0,
        udhaarSales: 0,
        netProfit: 0,
        openingCash: updatedOpening,
        addedCash: updatedAdded,
        cashInHand: updatedOpening + updatedAdded,
        lastResetAt: nowIso,
        resetsCount: 0,
        archivedTransactions: [],
      });
    }

    const outletName = this.getOutlets().find((o) => o.id === outletId)?.shopName || outletId;
    this.addAuditLog(
      'OUTLET_CASH_UPDATED',
      'settings',
      `Updated float cash for outlet "${outletName}": Opening=₹${updatedOpening}, Added=₹${updatedAdded}`,
      actor
    );

    this.persist();

    return {
      success: true,
      outletId,
      outletName,
      openingCash: updatedOpening,
      addedCash: updatedAdded,
      date: todayStr,
      lastUpdated: nowIso,
      outlets: this.getEnrichedOutlets(),
    };
  }

  /**
   * Fetch cash balances & metrics for a specific outlet
   */
  public getOutletCash(outletId: string) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const outlets = this.getEnrichedOutlets();
    const target = outlets.find((o) => o.id === outletId);
    const cashBalance = this.db.settings?.outletCashBalances?.[outletId];
    const todaySnapshot = this.db.dailySnapshots?.find((s) => s.outletId === outletId && s.date === todayStr);

    const isCashToday = cashBalance && (cashBalance.date === todayStr || (!cashBalance.date && (cashBalance.lastUpdated || '').startsWith(todayStr)));

    const openingCash = target?.openingCash ?? (todaySnapshot?.openingCash ?? (isCashToday ? cashBalance?.openingCash || 0 : 0));
    const addedCash = target?.addedCash ?? (todaySnapshot?.addedCash ?? (isCashToday ? cashBalance?.addedCash || 0 : 0));
    const cashSales = target?.cashSales || 0;
    const todayExpenses = target?.todayExpenses || 0;
    const cashInHand = Math.max(0, (openingCash + addedCash + cashSales) - todayExpenses);

    return {
      outletId,
      outletName: target?.shopName || outletId,
      openingCash,
      addedCash,
      cashSales,
      todayExpenses,
      cashInHand,
      date: todayStr,
      lastUpdated: cashBalance?.lastUpdated || todaySnapshot?.lastResetAt || new Date().toISOString(),
    };
  }

  /**
   * Dedicated Staff Outlet Data Upload:
   * Enables branch staff to upload local outlet transactions, customers, products, and metrics to the central server DB
   */
  public uploadOutletData(payload: {
    outletId: string;
    outletName?: string;
    products?: CentralProduct[];
    transactions?: CentralTransaction[];
    customers?: CentralCustomer[];
    staff?: CentralStaff[];
    outlet?: Partial<CentralOutlet>;
    uploadedBy?: string;
    role?: string;
    clientTimestamp?: string;
    isAutoSync?: boolean;
    openingCash?: number;
    openingAmount?: number;
    addedCash?: number;
    addedAmount?: number;
  }) {
    const { outletId, uploadedBy = 'Branch Staff', role = 'Staff', isAutoSync = false } = payload;
    if (!outletId) {
      throw new Error('outletId is required for outlet data upload');
    }

    const outlets = this.getOutlets();
    const existingOutlet = outlets.find((o) => o.id === outletId);
    const resolvedOutletName = payload.outletName || existingOutlet?.shopName || (outletId === 'store-2' ? 'kp Nayab' : 'sy Nayab');

    // 1. Process sync client delta for transactions, customers, products, staff, and cash
    this.syncClient({
      outletId,
      products: payload.products,
      transactions: payload.transactions,
      customers: payload.customers,
      staff: payload.staff,
      openingCash: payload.openingCash,
      openingAmount: payload.openingAmount,
      addedCash: payload.addedCash,
      addedAmount: payload.addedAmount,
      performedBy: isAutoSync ? `Staff Auto-Sync: ${uploadedBy} (${role})` : `Staff: ${uploadedBy} (${role})`,
    });

    // 2. If outlet profile update provided, save outlet
    if (payload.outlet && payload.outlet.shopName) {
      this.saveOutlet({ ...payload.outlet, id: outletId }, isAutoSync ? `Staff Auto-Sync: ${uploadedBy}` : `Staff: ${uploadedBy}`);
    }

    // 3. Update outlet sync timestamp & metadata
    const nowIso = new Date().toISOString();
    this.db.outletSyncTimestamps = this.db.outletSyncTimestamps || {};
    this.db.outletSyncTimestamps[outletId] = nowIso;

    this.db.settings = this.db.settings || {};
    this.db.settings.outletUploadMetadata = this.db.settings.outletUploadMetadata || {};

    const existingMeta = this.db.settings.outletUploadMetadata[outletId] || {};

    const outletTxs = this.db.transactions.filter(
      (t) => (t.outletId === outletId || t.storeId === outletId) && !t.voided && t.type === 'sale'
    );
    const totalSalesAmount = outletTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const outletCusts = this.db.customers.filter(
      (c) => c.outletId === outletId || c.storeId === outletId
    );
    const totalUdhaarDue = outletCusts.reduce((sum, c) => sum + (Number(c.totalDue) || 0), 0);

    const uploadMeta = {
      ...existingMeta,
      outletId,
      outletName: resolvedOutletName,
      lastUploadedAt: nowIso,
      lastAutoSyncedAt: isAutoSync ? nowIso : (existingMeta.lastAutoSyncedAt || nowIso),
      isAutoSync: Boolean(isAutoSync),
      uploadedBy,
      uploadedRole: role,
      transactionsUploaded: Array.isArray(payload.transactions) ? payload.transactions.length : 0,
      customersUploaded: Array.isArray(payload.customers) ? payload.customers.length : 0,
      productsUploaded: Array.isArray(payload.products) ? payload.products.length : 0,
      totalServerTransactions: outletTxs.length,
      totalServerSalesAmount: totalSalesAmount,
      totalServerCustomers: outletCusts.length,
      totalServerUdhaarDue: totalUdhaarDue,
    };
    this.db.settings.outletUploadMetadata[outletId] = uploadMeta;

    this.addAuditLog(
      isAutoSync ? 'STAFF_OUTLET_AUTOSYNC' : 'STAFF_OUTLET_UPLOAD',
      'database',
      isAutoSync
        ? `Staff ${uploadedBy} (${role}) auto-synced data for outlet "${resolvedOutletName}": ${(payload.transactions || []).length} bills, ${(payload.customers || []).length} customers`
        : `Staff ${uploadedBy} (${role}) uploaded data for outlet "${resolvedOutletName}": ${(payload.transactions || []).length} bills, ${(payload.customers || []).length} customers, ${(payload.products || []).length} products`,
      uploadedBy
    );

    this.persist();

    return {
      success: true,
      outletId,
      outletName: resolvedOutletName,
      lastUploadedAt: nowIso,
      uploadedBy,
      uploadMeta,
      summary: {
        transactionsReceived: (payload.transactions || []).length,
        customersReceived: (payload.customers || []).length,
        productsReceived: (payload.products || []).length,
        totalServerBills: outletTxs.length,
        totalServerSales: totalSalesAmount,
        totalServerUdhaarDue: totalUdhaarDue,
      },
    };
  }

  /**
   * Dedicated Owner Outlet Data Download Package:
   * Enables Owner (Faizan Inamdar / Admin) to download complete data for one or all outlets as structured JSON
   */
  public getOutletDownloadPackage(outletId?: string) {
    const outlets = this.getEnrichedOutlets();
    const isAll = !outletId || outletId === 'all';

    if (isAll) {
      const transactions = this.db.transactions;
      const customers = this.db.customers;
      const products = this.db.products;
      const staff = this.db.staff;
      const uploadMetadata = this.db.settings?.outletUploadMetadata || {};

      const totalRevenue = transactions
        .filter((t) => !t.voided && t.type === 'sale')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const totalUdhaarDue = customers.reduce((sum, c) => sum + (Number(c.totalDue) || 0), 0);

      return {
        exportType: 'all_outlets_master_download',
        exportedAt: new Date().toISOString(),
        exportedBy: 'Faizan Inamdar (Owner)',
        serverId: this.db.serverId || 'faizan-inamdar',
        summary: {
          outletsCount: outlets.length,
          totalBills: transactions.length,
          totalRevenue,
          totalCustomers: customers.length,
          totalUdhaarDue,
          totalProducts: products.length,
        },
        outlets,
        transactions,
        customers,
        products,
        staff: staff.map((s) => ({
          id: s.id,
          name: s.name,
          role: s.role,
          username: s.username,
          assignedOutletIds: s.assignedOutletIds,
        })),
        outletUploadMetadata: uploadMetadata,
      };
    }

    const targetOutlet = outlets.find((o) => o.id === outletId);
    if (!targetOutlet) {
      throw new Error(`Outlet with ID "${outletId}" not found`);
    }

    const transactions = this.db.transactions.filter(
      (t) => t.outletId === outletId || t.storeId === outletId
    );
    const customers = this.db.customers.filter(
      (c) => c.outletId === outletId || c.storeId === outletId
    );
    const assignedStaff = this.db.staff.filter(
      (s) => s.assignedOutletIds && s.assignedOutletIds.includes(outletId)
    );
    const products = this.db.products;
    const uploadMeta = this.db.settings?.outletUploadMetadata?.[outletId] || null;

    const totalRevenue = transactions
      .filter((t) => !t.voided && t.type === 'sale')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const totalUdhaarDue = customers.reduce((sum, c) => sum + (Number(c.totalDue) || 0), 0);

    return {
      exportType: 'single_outlet_download',
      outletId,
      outletName: targetOutlet.shopName,
      exportedAt: new Date().toISOString(),
      exportedBy: 'Faizan Inamdar (Owner)',
      serverId: this.db.serverId || 'faizan-inamdar',
      outlet: targetOutlet,
      uploadMeta,
      summary: {
        totalBills: transactions.length,
        totalRevenue,
        totalCustomers: customers.length,
        totalUdhaarDue,
        totalProducts: products.length,
      },
      transactions,
      customers,
      products,
      staff: assignedStaff.map((s) => ({ id: s.id, name: s.name, role: s.role, username: s.username })),
    };
  }

  /**
   * Dedicated Owner CSV Export:
   * Generates formatted CSV containing Sales Ledger and Udhaar Khata for spreadsheet view
   */
  public getOutletDownloadCsv(outletId?: string): string {
    const pkg = this.getOutletDownloadPackage(outletId);
    const lines: string[] = [];

    const esc = (val: any) => {
      if (val === null || val === undefined) return '';
      const s = String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    lines.push(`NAYAB MASALE & KIRANA - OUTLET SERVER DATA EXPORT`);
    lines.push(`Exported By,Faizan Inamdar (Owner)`);
    lines.push(`Exported At,${pkg.exportedAt}`);
    lines.push(`Server ID,${pkg.serverId}`);
    lines.push(`Scope,${pkg.exportType === 'all_outlets_master_download' ? 'All Outlets Consolidated' : (pkg as any).outletName}`);
    lines.push(``);

    // Section 1: Summary Metrics
    lines.push(`=== FINANCIAL & OPERATIONAL SUMMARY ===`);
    lines.push(`Metric,Value`);
    lines.push(`Total Invoices / Bills,${pkg.summary.totalBills}`);
    lines.push(`Total Sales Revenue (INR),₹${pkg.summary.totalRevenue.toFixed(2)}`);
    lines.push(`Total Udhaar Customers,${pkg.summary.totalCustomers}`);
    lines.push(`Total Outstanding Udhaar Balance (INR),₹${pkg.summary.totalUdhaarDue.toFixed(2)}`);
    lines.push(`Total Products in Catalog,${pkg.summary.totalProducts}`);
    lines.push(``);

    // Section 2: Outlets List
    if (pkg.exportType === 'all_outlets_master_download' && (pkg as any).outlets) {
      lines.push(`=== REGISTERED OUTLETS ===`);
      lines.push(`Outlet ID,Shop Name,Shortcut,Phone,UPI ID,GSTIN,Address,Total Revenue,Total Bills,Udhaar Due`);
      for (const o of (pkg as any).outlets) {
        lines.push([
          esc(o.id),
          esc(o.shopName),
          esc(o.shortcutName),
          esc(o.phone),
          esc(o.upiId),
          esc(o.gstin),
          esc(o.address),
          esc(o.totalRevenue || 0),
          esc(o.totalBillsCount || 0),
          esc(o.udhaarDueTotal || 0),
        ].join(','));
      }
      lines.push(``);
    }

    // Section 3: Transactions
    lines.push(`=== TRANSACTIONS & BILLS REGISTER ===`);
    lines.push(`Receipt No,Date & Time,Type,Outlet ID,Outlet Name,Customer Name,Customer Phone,Payment Mode,Amount (INR),Tax (INR),Staff Name,Voided`);
    for (const t of pkg.transactions) {
      lines.push([
        esc(t.receiptNumber || t.id),
        esc(t.timestamp),
        esc(t.type || 'sale'),
        esc(t.outletId || t.storeId || ''),
        esc(t.outletName || t.storeName || ''),
        esc(t.customerName || 'Cash Customer'),
        esc(t.customerPhone || ''),
        esc(t.paymentMode),
        esc(t.amount || 0),
        esc(t.taxAmount || 0),
        esc(t.staffName || ''),
        esc(t.voided ? 'YES' : 'NO'),
      ].join(','));
    }
    lines.push(``);

    // Section 4: Udhaar Customers
    lines.push(`=== UDHAAR KHATA REGISTER ===`);
    lines.push(`Customer ID,Customer Name,Phone,Outlet ID,Total Due (INR),Credit Limit (INR),Last Active,Notes`);
    for (const c of pkg.customers) {
      lines.push([
        esc(c.id),
        esc(c.name),
        esc(c.phone),
        esc(c.outletId || c.storeId || ''),
        esc(c.totalDue || 0),
        esc(c.creditLimit || ''),
        esc(c.lastActive || ''),
        esc(c.notes || ''),
      ].join(','));
    }

    return lines.join('\n');
  }

  /**
   * Get sync and upload metadata for outlets
   */
  public getOutletUploadMetadata() {
    return this.db.settings?.outletUploadMetadata || {};
  }

  /**
   * Master Admin: Configure Firebase / Cloud sync parameters
   */
  public updateCloudSyncConfig(config: {
    cloudSyncMode?: 'central_api' | 'firebase_firestore' | 'hybrid';
    firebaseConfig?: {
      projectId?: string;
      apiKey?: string;
      firestoreDatabaseId?: string;
      autoSyncToCloud?: boolean;
    };
    actor?: string;
  }) {
    if (config.cloudSyncMode) {
      this.db.cloudSyncMode = config.cloudSyncMode;
    }
    if (config.firebaseConfig) {
      this.db.firebaseConfig = {
        ...this.db.firebaseConfig,
        ...config.firebaseConfig,
        connected: Boolean(config.firebaseConfig.projectId),
      };
    }
    this.addAuditLog(
      'CLOUD_CONFIG_UPDATED',
      'settings',
      `Cloud database config updated. Mode: ${this.db.cloudSyncMode}`,
      config.actor || 'Master Admin'
    );
    this.persist();
    return {
      cloudSyncMode: this.db.cloudSyncMode,
      firebaseConfig: this.db.firebaseConfig,
    };
  }

  /**
   * Master Admin: Restore Full Database Backup
   */
  public restoreDatabase(backupData: any, actor = 'Master Admin'): boolean {
    try {
      if (!backupData || typeof backupData !== 'object') return false;
      const data = backupData.data || backupData;

      if (Array.isArray(data.products)) this.db.products = data.products;
      if (Array.isArray(data.transactions)) this.db.transactions = data.transactions;
      if (Array.isArray(data.customers)) this.db.customers = data.customers;
      if (data.storeSettings) this.db.settings = { ...this.db.settings, ...data.storeSettings };
      if (Array.isArray(data.staff)) this.db.staff = data.staff;

      this.addAuditLog(
        'DATABASE_RESTORED',
        'database',
        `Restored database snapshot (${this.db.products.length} products, ${this.db.transactions.length} transactions)`,
        actor
      );
      this.persist();
      return true;
    } catch (err) {
      console.error('Failed to restore database:', err);
      return false;
    }
  }

  public recordDailySnapshot(snapshot: Partial<CentralDailySnapshot>, mode: 'accumulate' | 'absolute' = 'accumulate'): CentralDailySnapshot {
    if (!this.db.dailySnapshots) {
      this.db.dailySnapshots = [];
    }

    const todayStr = snapshot.date || new Date().toISOString().slice(0, 10);
    const outletId = snapshot.outletId || 'store-1';
    const id = `${todayStr}_${outletId}`;
    const outlet = this.getOutlets().find((o) => o.id === outletId);
    const outletName = snapshot.outletName || outlet?.shopName || (outletId === 'store-1' ? 'sy Nayab' : outletId === 'store-2' ? 'kp Nayab' : outletId);

    const existingIndex = this.db.dailySnapshots.findIndex((s) => s.id === id || (s.date === todayStr && s.outletId === outletId));

    if (existingIndex >= 0 && mode === 'accumulate') {
      const existing = this.db.dailySnapshots[existingIndex];
      existing.grossSales = (Number(existing.grossSales) || 0) + (Number(snapshot.grossSales) || 0);
      existing.salesCount = (Number(existing.salesCount) || 0) + (Number(snapshot.salesCount) || 0);
      existing.expenses = (Number(existing.expenses) || 0) + (Number(snapshot.expenses) || 0);
      existing.expenseCount = (Number(existing.expenseCount) || 0) + (Number(snapshot.expenseCount) || 0);
      existing.cashSales = (Number(existing.cashSales) || 0) + (Number(snapshot.cashSales) || 0);
      existing.upiSales = (Number(existing.upiSales) || 0) + (Number(snapshot.upiSales) || 0);
      existing.udhaarSales = (Number(existing.udhaarSales) || 0) + (Number(snapshot.udhaarSales) || 0);
      existing.netProfit = existing.grossSales - existing.expenses;
      
      existing.openingCash = existing.openingCash || Number(snapshot.openingCash) || 0;
      existing.addedCash = (Number(existing.addedCash) || 0) + (Number(snapshot.addedCash) || 0);
      existing.cashInHand = (existing.openingCash + existing.addedCash + existing.cashSales) - existing.expenses;

      existing.resetsCount = (Number(existing.resetsCount) || 1) + 1;
      existing.lastResetAt = new Date().toISOString();

      if (snapshot.archivedTransactions && snapshot.archivedTransactions.length > 0) {
        const existingTxIds = new Set((existing.archivedTransactions || []).map((t) => t.id));
        const newTxs = snapshot.archivedTransactions.filter((t) => !existingTxIds.has(t.id));
        existing.archivedTransactions = [...(existing.archivedTransactions || []), ...newTxs];
      }

      this.persist();
      return existing;
    } else if (existingIndex >= 0 && mode === 'absolute') {
      const updated: CentralDailySnapshot = {
        ...this.db.dailySnapshots[existingIndex],
        ...snapshot,
        id,
        date: todayStr,
        outletId,
        outletName,
        lastResetAt: new Date().toISOString(),
      };
      this.db.dailySnapshots[existingIndex] = updated;
      this.persist();
      return updated;
    } else {
      const newSnapshot: CentralDailySnapshot = {
        id,
        date: todayStr,
        outletId,
        outletName,
        grossSales: Number(snapshot.grossSales) || 0,
        salesCount: Number(snapshot.salesCount) || 0,
        expenses: Number(snapshot.expenses) || 0,
        expenseCount: Number(snapshot.expenseCount) || 0,
        cashSales: Number(snapshot.cashSales) || 0,
        upiSales: Number(snapshot.upiSales) || 0,
        udhaarSales: Number(snapshot.udhaarSales) || 0,
        netProfit: (Number(snapshot.grossSales) || 0) - (Number(snapshot.expenses) || 0),
        openingCash: Number(snapshot.openingCash) || 0,
        addedCash: Number(snapshot.addedCash) || 0,
        cashInHand: ((Number(snapshot.openingCash) || 0) + (Number(snapshot.addedCash) || 0) + (Number(snapshot.cashSales) || 0)) - (Number(snapshot.expenses) || 0),
        lastResetAt: new Date().toISOString(),
        resetsCount: 1,
        archivedTransactions: snapshot.archivedTransactions || [],
      };
      this.db.dailySnapshots.push(newSnapshot);
      this.persist();
      return newSnapshot;
    }
  }

  public getDailySnapshots(from?: string, to?: string, outletId?: string): CentralDailySnapshot[] {
    let snaps = this.db.dailySnapshots || [];
    if (outletId && outletId !== 'all') {
      snaps = snaps.filter((s) => s.outletId === outletId);
    }
    if (from) {
      snaps = snaps.filter((s) => s.date >= from);
    }
    if (to) {
      snaps = snaps.filter((s) => s.date <= to);
    }
    return [...snaps].sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Reset daily data (sales, expenses, and cash) of a specific outlet or all outlets to 0
   */
  public resetDailyOutletData(outletId: string = 'all', actor = 'Admin / Counter') {
    const isAll = !outletId || outletId === 'all';
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const startOfTodayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Safe archive-before-reset: Accumulate today's data into dailySnapshots so nothing is ever lost
    const outletsList = this.getOutlets();
    const targetOutlets = isAll ? outletsList : outletsList.filter((o) => o.id === outletId);
    if (targetOutlets.length === 0 && !isAll) {
      targetOutlets.push({
        id: outletId,
        shopName: outletId === 'store-1' ? 'sy Nayab' : outletId === 'store-2' ? 'kp Nayab' : outletId,
      } as any);
    }

    for (const out of targetOutlets) {
      const todayOutletTxs = this.db.transactions.filter((t) => {
        const tTime = new Date(t.timestamp).getTime();
        const isToday = (t.timestamp && t.timestamp.startsWith(todayStr)) || tTime >= startOfTodayMs;
        if (!isToday || t.voided) return false;
        const matchId = t.outletId || t.storeId;
        return matchId ? matchId === out.id : (out.isPrimary || out.id === 'store-1');
      });

      if (todayOutletTxs.length > 0) {
        const salesTxs = todayOutletTxs.filter((t) => t.type === 'sale');
        const expenseTxs = todayOutletTxs.filter((t) => t.type === 'expense');
        const sales = salesTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const expenses = expenseTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const cash = salesTxs.filter((t) => t.paymentMode === 'cash').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const upi = salesTxs.filter((t) => t.paymentMode === 'online_upi').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const udhaar = salesTxs.filter((t) => t.paymentMode === 'credit_udhaar').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        this.recordDailySnapshot({
          date: todayStr,
          outletId: out.id,
          outletName: out.shopName,
          grossSales: sales,
          salesCount: salesTxs.length,
          expenses: expenses,
          expenseCount: expenseTxs.length,
          cashSales: cash,
          upiSales: upi,
          udhaarSales: udhaar,
          archivedTransactions: todayOutletTxs,
        }, 'accumulate');
      }
    }

    const initialTxCount = this.db.transactions.length;

    // Filter out transactions that took place today for the targeted outlet(s)
    this.db.transactions = this.db.transactions.filter((t) => {
      const tTime = new Date(t.timestamp).getTime();
      const isToday = (t.timestamp && t.timestamp.startsWith(todayStr)) || tTime >= startOfTodayMs;
      if (!isToday) return true; // Keep previous days' records safe

      if (isAll) {
        return false; // Remove all outlets' today transactions
      }

      const matchId = t.outletId || t.storeId || 'store-1';
      return matchId !== outletId; // Remove only target outlet's today transactions
    });

    const removedCount = initialTxCount - this.db.transactions.length;

    // Reset outletUploadMetadata today's metrics if available
    if (this.db.settings?.outletUploadMetadata) {
      const outletsToReset = isAll
        ? Object.keys(this.db.settings.outletUploadMetadata)
        : [outletId];

      for (const oId of outletsToReset) {
        if (this.db.settings.outletUploadMetadata[oId]) {
          const outletTxs = this.db.transactions.filter(
            (t) => (t.outletId === oId || t.storeId === oId) && !t.voided && t.type === 'sale'
          );
          const totalSales = outletTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
          this.db.settings.outletUploadMetadata[oId].totalServerTransactions = outletTxs.length;
          this.db.settings.outletUploadMetadata[oId].totalServerSalesAmount = totalSales;
          this.db.settings.outletUploadMetadata[oId].lastDailyResetAt = new Date().toISOString();
        }
      }
    }

    // Reset opening & added cash balances in outletCashBalances
    if (this.db.settings?.outletCashBalances) {
      const cashOutletsToReset = isAll
        ? Object.keys(this.db.settings.outletCashBalances)
        : [outletId];

      for (const oId of cashOutletsToReset) {
        if (this.db.settings.outletCashBalances[oId]) {
          this.db.settings.outletCashBalances[oId].openingCash = 0;
          this.db.settings.outletCashBalances[oId].addedCash = 0;
          this.db.settings.outletCashBalances[oId].date = todayStr;
          this.db.settings.outletCashBalances[oId].lastUpdated = new Date().toISOString();
        }
      }
    }

    const outletLabel = isAll ? 'all outlets' : `outlet (${outletId})`;
    this.addAuditLog(
      'DAILY_DATA_RESET',
      'transaction',
      `Reset daily data (sales, expenses, cash) for ${outletLabel} to ₹0. Removed ${removedCount} today transaction(s).`,
      actor
    );

    this.persist();

    return {
      success: true,
      removedTransactionsCount: removedCount,
      outletId,
      outlets: this.getEnrichedOutlets(),
    };
  }

  /**
   * Factory reset database
   */
  public resetToDefaults(actor = 'Master Admin'): CentralStoreDb {
    this.db = {
      version: '2.0.0',
      lastUpdated: new Date().toISOString(),
      cloudSyncMode: 'central_api',
      products: DEFAULT_PRODUCTS,
      transactions: [],
      customers: DEFAULT_CUSTOMERS,
      staff: DEFAULT_STAFF,
      settings: DEFAULT_SETTINGS,
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: 'DATABASE_FACTORY_RESET',
          entity: 'database',
          details: 'Central database reset to initial factory state.',
          performedBy: actor,
        },
      ],
    };
    this.persist();
    return this.db;
  }
}

export const centralDb = new CentralDatabaseManager();
