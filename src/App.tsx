/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TohandsHeader } from './components/TohandsHeader';
import { NayabCalculator } from './components/NayabCalculator';
import { PosCatalogDrawer } from './components/PosCatalogDrawer';
import { SalePaymentModal } from './components/SalePaymentModal';
import { ExpenseModal } from './components/ExpenseModal';
import { QuickUpiQrModal } from './components/QuickUpiQrModal';
import { UdhaarLedgerModal } from './components/UdhaarLedgerModal';
import { ReportsDashboardModal } from './components/ReportsDashboardModal';
import { StoreSettingsModal } from './components/StoreSettingsModal';
import { CustomWeightModal } from './components/CustomWeightModal';
import { PosBarcodeScannerModal } from './components/PosBarcodeScannerModal';
import { TopCashFlowBanner } from './components/TopCashFlowBanner';
import { WebProductSearch } from './components/WebProductSearch';
import { AuthLoginModal } from './components/AuthLoginModal';
import { BillsManagementModal } from './components/BillsManagementModal';
import { BillReviewPrintModal } from './components/BillReviewPrintModal';
import { MasterAdminModal } from './components/MasterAdminModal';
import { OutletDataSyncModal } from './components/OutletDataSyncModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, SlidersHorizontal, Layers, ShoppingBag, Database, ArrowDown } from 'lucide-react';
import { printReceipt } from './utils/printer';
import { fetchCentralSnapshot, pushCentralDelta, saveCentralProduct, deleteCentralProduct, resetDailyOutletData, recordOutletDailySnapshot, syncOutletCash, fetchCentralOutlets } from './utils/centralSync';
import { useStaffAutoSync } from './utils/staffAutoSync';
import {
  recordTransactionInFirestore,
  syncCustomerToFirestore,
  syncProductToFirestore,
  deleteProductFromFirestore,
  syncOutletCashToFirestore,
} from './firebase';
import {
  Product,
  BillItem,
  UnitType,
  Transaction,
  CustomerUdhaar,
  StoreSettings,
  StaffAccount,
  FullBackupData,
  StoreProfile,
  MarketCreditEntry,
} from './types';
import { INITIAL_PRODUCTS } from './data/defaultInventory';
import { playKeySound } from './utils/audio';
import { createFullBackupData, saveAutoBackupSnapshot } from './utils/backup';
import {
  getAllProductsFromIDB,
  saveAllProductsToIDB,
  saveSingleProductToIDB,
  deleteProductFromIDB,
  CATALOGUE_MAX_CAPACITY,
} from './utils/idbStorage';

const LEGACY_STORAGE_KEYS = {
  PRODUCTS: ['tohands_products_v2', 'tohands_products_v1'],
  TRANSACTIONS: ['tohands_transactions_v2', 'tohands_transactions_v1'],
  CUSTOMERS: ['tohands_customers_v2', 'tohands_customers_v1'],
  SETTINGS: ['tohands_settings_v2', 'tohands_settings_v1'],
  OPENING_AMOUNT: ['tohands_opening_amount'],
  ADDED_CASH: ['tohands_added_cash'],
  THEME: ['tohands_theme_mode'],
  LAST_BACKUP: ['tohands_last_auto_backup_date'],
};

const STORAGE_KEYS = {
  PRODUCTS: 'nayab_products_v2',
  TRANSACTIONS: 'nayab_transactions_v2',
  CUSTOMERS: 'nayab_customers_v2',
  SETTINGS: 'nayab_settings_v2',
  OPENING_AMOUNT: 'nayab_opening_amount',
  ADDED_CASH: 'nayab_added_cash',
  THEME: 'nayab_theme_mode',
  LAST_BACKUP: 'nayab_last_auto_backup_date',
  LAST_ACTIVE_DATE: 'nayab_last_active_date',
};

// Returns standard YYYY-MM-DD local date string for reliable day-boundary tracking
const getLocalDateString = (d: Date = new Date()): string => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Safe storage reader that prioritizes new nayab_ keys and seamlessly migrates legacy tohands_ data
function getStoredItem(newKey: string, legacyKeys: string[] = []): string | null {
  try {
    const val = localStorage.getItem(newKey);
    if (val !== null) return val;
    for (const oldKey of legacyKeys) {
      const oldVal = localStorage.getItem(oldKey);
      if (oldVal !== null) {
        localStorage.setItem(newKey, oldVal);
        return oldVal;
      }
    }
  } catch (e) {
    console.warn('Storage read error:', e);
  }
  return null;
}

const normalizeStaffWithOutlets = (staffList: StaffAccount[]): StaffAccount[] => {
  return staffList.map((s) => {
    // If Abdullah -> Sy Nayab (store-1)
    if (s.name.toLowerCase().includes('abdullah') || s.id === 'staff-1' || s.username === 'abdullah') {
      const assigned = s.assignedOutletIds && s.assignedOutletIds.length > 0 && !s.assignedOutletIds.includes('all')
        ? s.assignedOutletIds
        : ['store-1'];
      return {
        ...s,
        username: s.username || 'abdullah',
        assignedOutletIds: assigned,
        defaultOutletId: s.defaultOutletId || 'store-1',
      };
    }
    // If Ayan -> Kp Nayab (store-2)
    if (s.name.toLowerCase().includes('ayan') || s.id === 'staff-2' || s.username === 'ayan') {
      const assigned = s.assignedOutletIds && s.assignedOutletIds.length > 0 && !s.assignedOutletIds.includes('all')
        ? s.assignedOutletIds
        : ['store-2'];
      return {
        ...s,
        username: s.username || 'ayan',
        assignedOutletIds: assigned,
        defaultOutletId: s.defaultOutletId || 'store-2',
      };
    }
    // If Faizan / Owner -> All Outlets with store-1 default
    if (s.role === 'owner' || s.role === 'master_admin' || s.id === 'staff-owner') {
      return {
        ...s,
        username: s.username || 'faizan',
        assignedOutletIds: s.assignedOutletIds && s.assignedOutletIds.length > 0 ? s.assignedOutletIds : ['store-1', 'store-2'],
        defaultOutletId: s.defaultOutletId || 'store-1',
      };
    }
    return s;
  });
};

const DEFAULT_STAFF: StaffAccount[] = [
  {
    id: 'staff-owner',
    username: 'faizan',
    name: 'Faizan Inamdar (admin)',
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
    username: 'abdullah',
    name: 'Abdullah',
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
    username: 'ayan',
    name: 'Ayan',
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

const DEFAULT_STORES: StoreProfile[] = [
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
];

const DEFAULT_SETTINGS: StoreSettings = {
  shopName: 'sy Nayab',
  tagline: 'Authentic Indian Spices & Daily Groceries',
  phone: '9876543210',
  upiId: 'nayabmasale@upi',
  upiName: 'sy Nayab',
  address: 'Main Bazaar, Outlet 1',
  defaultTaxRate: 0,
  lowStockThreshold: 10,
  staffAccounts: DEFAULT_STAFF,
  activeStaffId: '',
  stores: DEFAULT_STORES,
  activeStoreId: 'store-1',
  printerConfig: {
    printerType: 'browser',
    paperWidth: '58mm',
    autoPrintOnSale: false,
    connected: false,
  },
};

const INITIAL_CUSTOMERS: CustomerUdhaar[] = [];

/**
 * Safely inspect authenticated session on application load or page reload.
 * SECURITY DIRECTIVE:
 * - Admin/Owner sessions MUST NEVER automatically log in on reload without password verification.
 * - This prevents the automated "password breach" security event in the admin portal upon reload.
 * - Only explicit, verified non-admin cashier sessions may persist across reloads if "remember" was active.
 */
function getInitialAuthSession(staffAccounts: StaffAccount[]): { isAuthenticated: boolean; staffId: string } {
  try {
    const isSessionAuth = sessionStorage.getItem('nayab_authenticated_session') === 'true';
    const sessionStaffId = sessionStorage.getItem('nayab_active_session_staff') || '';
    const sessionRole = sessionStorage.getItem('nayab_active_session_role') || '';

    // If session was a non-admin cashier, allow restoring that cashier
    if (isSessionAuth && sessionStaffId && sessionRole === 'cashier') {
      const matched = staffAccounts.find((s) => s.id === sessionStaffId && s.role === 'cashier');
      if (matched) {
        return { isAuthenticated: true, staffId: matched.id };
      }
    }

    // Check localStorage (strictly for cashier accounts who chose rememberSession)
    const isLocalAuth = localStorage.getItem('nayab_session_authenticated') === 'true';
    const localStaffId = localStorage.getItem('nayab_active_session_staff') || '';
    if (isLocalAuth && localStaffId) {
      const matched = staffAccounts.find((s) => s.id === localStaffId && s.role === 'cashier');
      if (matched) {
        return { isAuthenticated: true, staffId: matched.id };
      }
    }
  } catch (e) {
    console.warn('Auth session check error:', e);
  }

  // Any admin, owner, or unauthenticated session must re-authenticate with password
  return { isAuthenticated: false, staffId: '' };
}

export default function App() {
  // Theme state (dark / light mode)
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    try {
      const saved = getStoredItem(STORAGE_KEYS.THEME, LEGACY_STORAGE_KEYS.THEME);
      return saved === 'light' || saved === 'dark' ? saved : 'dark';
    } catch {
      return 'dark';
    }
  });

  const handleToggleTheme = () => {
    setThemeMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEYS.THEME, next);
      } catch {}
      return next;
    });
  };

  // Store inventory products
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = getStoredItem(STORAGE_KEYS.PRODUCTS, LEGACY_STORAGE_KEYS.PRODUCTS);
      return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
    } catch {
      return INITIAL_PRODUCTS;
    }
  });

  // Transactions ledger
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = getStoredItem(STORAGE_KEYS.TRANSACTIONS, LEGACY_STORAGE_KEYS.TRANSACTIONS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Customers credit ledger (Udhaar) - initial udhaar khaata nil
  const [customers, setCustomers] = useState<CustomerUdhaar[]>(() => {
    try {
      const saved = getStoredItem(STORAGE_KEYS.CUSTOMERS, LEGACY_STORAGE_KEYS.CUSTOMERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // If stored customers are solely the old dummy demo ones (c-1, c-2, c-3), reset to nil
          const isOldDummyOnly = parsed.length > 0 && parsed.every((c: any) => ['c-1', 'c-2', 'c-3'].includes(c.id));
          if (isOldDummyOnly) {
            localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify([]));
            return [];
          }
          return parsed;
        }
      }
      return INITIAL_CUSTOMERS;
    } catch {
      return INITIAL_CUSTOMERS;
    }
  });

  // Store profile, UPI, Staff & Printer settings
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(() => {
    try {
      const saved = getStoredItem(STORAGE_KEYS.SETTINGS, LEGACY_STORAGE_KEYS.SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        const hasOldStaff = !parsed.staffAccounts?.length || parsed.staffAccounts.some((s: StaffAccount) => s.name === 'Nayab Bhai' || s.name === 'Rahul (Cashier)');
        const existingStaff: StaffAccount[] = hasOldStaff ? DEFAULT_SETTINGS.staffAccounts : parsed.staffAccounts;

        const hasOldStores = !parsed.stores?.length || !parsed.stores.some((st: StoreProfile) => st.shopName.includes('Nayab'));
        const existingStores: StoreProfile[] = hasOldStores ? DEFAULT_SETTINGS.stores : parsed.stores;

        const normalizedStaff = normalizeStaffWithOutlets(existingStaff);
        const initialAuth = getInitialAuthSession(normalizedStaff);

        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          shopName: parsed.shopName === 'Nayab Masale & Kirana Store' ? 'sy Nayab' : (parsed.shopName || 'sy Nayab'),
          defaultTaxRate: typeof parsed.defaultTaxRate === 'number' ? parsed.defaultTaxRate : 0,
          lowStockThreshold: typeof parsed.lowStockThreshold === 'number' ? parsed.lowStockThreshold : 10,
          staffAccounts: normalizedStaff,
          activeStaffId: initialAuth.staffId,
          stores: existingStores,
          activeStoreId: parsed.activeStoreId || existingStores[0]?.id || 'store-1',
          printerConfig: {
            ...DEFAULT_SETTINGS.printerConfig,
            ...(parsed.printerConfig || {}),
          },
        };
      }
      const initialAuth = getInitialAuthSession(DEFAULT_SETTINGS.staffAccounts);
      return {
        ...DEFAULT_SETTINGS,
        activeStaffId: initialAuth.staffId,
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Credit in Market (माल बाक़ी - Goods taken on credit from suppliers/mandis)
  const [marketCredits, setMarketCredits] = useState<MarketCreditEntry[]>(() => {
    try {
      const saved = localStorage.getItem('nayab_market_credit_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load market credits in App:', e);
    }
    return [];
  });

  const handleUpdateMarketCredits = (updated: MarketCreditEntry[]) => {
    setMarketCredits(updated);
    try {
      localStorage.setItem('nayab_market_credit_v1', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save market credits:', e);
    }
  };

  // Active POS bill items currently on the counter
  const [billItems, setBillItems] = useState<BillItem[]>([]);

  // Modal control states
  const [isPosCatalogOpen, setIsPosCatalogOpen] = useState(false);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isUpiQrModalOpen, setIsUpiQrModalOpen] = useState(false);
  const [isUdhaarLedgerOpen, setIsUdhaarLedgerOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBillsManagerOpen, setIsBillsManagerOpen] = useState(false);
  const [billsInitialTab, setBillsInitialTab] = useState<'all' | 'sale' | 'online' | 'cash' | 'udhaar' | 'expense'>('sale');
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [isBillReviewOpen, setIsBillReviewOpen] = useState(false);
  const [reviewModalCalcAmount, setReviewModalCalcAmount] = useState<number>(0);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'upi' | 'inventory' | 'staff' | 'printer' | 'profile' | 'backup' | 'reports' | 'stores' | 'free_apis' | 'pwa'>('upi');
  const [quickWeightProduct, setQuickWeightProduct] = useState<Product | null>(null);
  const [isMasterAdminOpen, setIsMasterAdminOpen] = useState(false);
  const [isOutletSyncOpen, setIsOutletSyncOpen] = useState(false);
  const [outletSyncInitialTab, setOutletSyncInitialTab] = useState<'staff_upload' | 'owner_download'>('staff_upload');

  // Automatic Staff Data Sync Hook & Engine
  const {
    syncStatus: staffAutoSyncStatus,
    triggerSync: triggerStaffAutoSync,
    setAutoSyncEnabled: setStaffAutoSyncEnabled,
    syncNow: triggerInstantStaffSync,
  } = useStaffAutoSync();

  // Authentication State (Staff & Owner Login on application launch)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(storeSettings.activeStaffId);
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(() => {
    return !Boolean(storeSettings.activeStaffId);
  });

  // Active amount passed to modals from keypad or bill
  const [activeModalAmount, setActiveModalAmount] = useState<number>(0);
  // Separate track of calculator keypad amount to combine with active bill items
  const [calculatorAmount, setCalculatorAmount] = useState<number>(0);

  // Fast Moving products vertical scrolling
  const fastMovingScrollRef = useRef<HTMLDivElement>(null);

  const handleScrollFastMoving = (direction: 'up' | 'down') => {
    if (fastMovingScrollRef.current) {
      const scrollAmount = 140;
      fastMovingScrollRef.current.scrollBy({
        top: direction === 'up' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  // Active counter outlet ID bound to store settings
  const activeCounterOutletId = storeSettings.activeStoreId || 'store-1';

  // Per-Outlet Counter Cash Balances (Opening float and added cash tracked separately for each individual outlet/store)
  const [outletCashBalances, setOutletCashBalances] = useState<
    Record<string, { openingCash: number; addedCash: number; lastUpdated?: string }>
  >(() => {
    try {
      const saved = localStorage.getItem('nayab_outlet_cash_balances_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
      const legacyOpeningStr = getStoredItem(STORAGE_KEYS.OPENING_AMOUNT, LEGACY_STORAGE_KEYS.OPENING_AMOUNT);
      const legacyAddedStr = getStoredItem(STORAGE_KEYS.ADDED_CASH, LEGACY_STORAGE_KEYS.ADDED_CASH);
      const legacyOpening = legacyOpeningStr ? parseFloat(legacyOpeningStr) : 0;
      const legacyAdded = legacyAddedStr ? parseFloat(legacyAddedStr) : 0;
      return {
        'store-1': {
          openingCash: isNaN(legacyOpening) || legacyOpening === 1000 ? 0 : legacyOpening,
          addedCash: isNaN(legacyAdded) ? 0 : legacyAdded,
          lastUpdated: new Date().toISOString(),
        },
        'store-2': { openingCash: 0, addedCash: 0, lastUpdated: new Date().toISOString() },
      };
    } catch {
      return {
        'store-1': { openingCash: 0, addedCash: 0 },
        'store-2': { openingCash: 0, addedCash: 0 },
      };
    }
  });

  // Current counter active outlet cash figures
  const activeOutletCash = outletCashBalances[activeCounterOutletId] || { openingCash: 0, addedCash: 0 };
  const openingAmount = activeOutletCash.openingCash || 0;
  const addedAmount = activeOutletCash.addedCash || 0;

  // Granular updater for outlet cash float
  const handleUpdateOutletCash = (
    outletId: string,
    cash: { openingCash?: number; addedCash?: number; mode?: 'set' | 'add' }
  ) => {
    setOutletCashBalances((prev) => {
      const existing = prev[outletId] || { openingCash: 0, addedCash: 0 };
      let newOpening = existing.openingCash;
      let newAdded = existing.addedCash;

      if (typeof cash.openingCash === 'number') {
        newOpening = Math.max(0, cash.openingCash);
      }
      if (typeof cash.addedCash === 'number') {
        if (cash.mode === 'add') {
          newAdded = Math.max(0, Math.round((existing.addedCash + cash.addedCash) * 100) / 100);
        } else {
          newAdded = Math.max(0, cash.addedCash);
        }
      }

      const updated = {
        ...prev,
        [outletId]: {
          openingCash: newOpening,
          addedCash: newAdded,
          lastUpdated: new Date().toISOString(),
        },
      };
      try {
        localStorage.setItem('nayab_outlet_cash_balances_v1', JSON.stringify(updated));
        if (outletId === activeCounterOutletId) {
          localStorage.setItem(STORAGE_KEYS.OPENING_AMOUNT, String(newOpening));
          localStorage.setItem(STORAGE_KEYS.ADDED_CASH, String(newAdded));
        }
      } catch {}
      return updated;
    });

    const activeStaff = storeSettings.staffAccounts.find((s) => s.id === storeSettings.activeStaffId);
    const actorName = activeStaff?.name || 'Staff';

    // 1. Asynchronously sync to Central Express DB
    syncOutletCash(outletId, {
      openingCash: cash.openingCash,
      addedCash: cash.addedCash,
      mode: cash.mode || 'set',
      actor: actorName,
    }).catch((e) => console.warn('Central outlet cash sync note:', e));

    // 2. Asynchronously sync to Firestore
    syncOutletCashToFirestore(
      outletId,
      {
        ...(typeof cash.openingCash === 'number' ? { openingCash: cash.openingCash } : {}),
        ...(typeof cash.addedCash === 'number' ? { addedCash: cash.addedCash } : {}),
      }
    ).catch((e) => console.warn('Firestore cash sync note:', e));
  };

  const handleUpdateOpeningAmount = (newAmount: number) => {
    handleUpdateOutletCash(activeCounterOutletId, { openingCash: newAmount, mode: 'set' });
  };

  const handleAddCashAmount = (added: number) => {
    handleUpdateOutletCash(activeCounterOutletId, { addedCash: added, mode: 'add' });
  };

  const handleResetDailyCash = (targetOutletId?: string | 'all') => {
    const target = targetOutletId || activeCounterOutletId;
    if (target === 'all') {
      setOutletCashBalances((prev) => {
        const resetObj: Record<string, { openingCash: number; addedCash: number; lastUpdated?: string }> = {};
        for (const k of Object.keys(prev)) {
          resetObj[k] = { openingCash: 0, addedCash: 0, lastUpdated: new Date().toISOString() };
        }
        try {
          localStorage.setItem('nayab_outlet_cash_balances_v1', JSON.stringify(resetObj));
          localStorage.setItem(STORAGE_KEYS.OPENING_AMOUNT, '0');
          localStorage.setItem(STORAGE_KEYS.ADDED_CASH, '0');
        } catch {}
        return resetObj;
      });
      (storeSettings.stores || [{ id: 'store-1' }, { id: 'store-2' }]).forEach((st) => {
        syncOutletCash(st.id, { openingCash: 0, addedCash: 0, mode: 'set', actor: 'Counter Reset' }).catch(console.warn);
        syncOutletCashToFirestore(st.id, { openingCash: 0, addedCash: 0 }).catch(console.warn);
      });
    } else {
      handleUpdateOutletCash(target, { openingCash: 0, addedCash: 0, mode: 'set' });
    }
  };

  // Daily Date Tracking for Automatic Next-Day Counter Reset
  const [currentDayStr, setCurrentDayStr] = useState<string>(() => getLocalDateString());

  // Automatic Next-Day Daily Counter Reset Engine:
  // Detects day transitions (including overnight running across midnight 12:00 AM, or reopening app next day)
  // Automatically zeroes out daily counters, opening/added cash, and drafts for the new day
  useEffect(() => {
    const checkAndPerformNextDayReset = () => {
      const todayStr = getLocalDateString();
      const lastRecordedDay = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE_DATE);

      if (!lastRecordedDay) {
        localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE_DATE, todayStr);
        return;
      }

      if (lastRecordedDay !== todayStr) {
        console.log(`[Auto-Reset] Next day detected: switching from ${lastRecordedDay} to ${todayStr}. Automatically resetting daily counters to 0.`);

        // 1. Reset Opening Cash and Added Cash for all outlets to ₹0 for the fresh day
        setOutletCashBalances((prev) => {
          const resetObj: Record<string, { openingCash: number; addedCash: number; lastUpdated?: string }> = {};
          for (const k of Object.keys(prev)) {
            resetObj[k] = { openingCash: 0, addedCash: 0, lastUpdated: new Date().toISOString() };
          }
          try {
            localStorage.setItem('nayab_outlet_cash_balances_v1', JSON.stringify(resetObj));
            localStorage.setItem(STORAGE_KEYS.OPENING_AMOUNT, '0');
            localStorage.setItem(STORAGE_KEYS.ADDED_CASH, '0');
            localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE_DATE, todayStr);
          } catch (e) {
            console.warn('Auto reset storage write error:', e);
          }
          return resetObj;
        });

        // 2. Clear any lingering unfinalized bill items from yesterday's counter
        setBillItems([]);
        setCalculatorAmount(0);

        // 3. Update day state which automatically forces recomputation of startOfToday and today's sales/expenses to ₹0
        setCurrentDayStr(todayStr);

        // 4. Play key sound cue
        playKeySound('action');
      }
    };

    // Run check on mount
    checkAndPerformNextDayReset();

    // Check periodically every 15 seconds to catch midnight rollover seamlessly without reload
    const interval = setInterval(checkAndPerformNextDayReset, 15000);

    return () => clearInterval(interval);
  }, []);

  // Reset daily data (Sales, Expenses, Cash Added, Opening Cash) of outlets to 0
  const handleResetDailyOutletData = async (targetOutletId: string | 'all' = 'all') => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const startOfTodayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const isAll = !targetOutletId || targetOutletId === 'all';

    // 0. Archiving before reset: Accumulate today's data into daily snapshots so no history is lost across resets
    const outletsList = (storeSettings.stores && storeSettings.stores.length > 0)
      ? storeSettings.stores
      : [{ id: storeSettings.activeStoreId || 'store-1', shopName: storeSettings.shopName, isPrimary: true }];
    const targetOutlets = isAll ? outletsList : outletsList.filter((o) => o.id === targetOutletId);
    if (targetOutlets.length === 0 && !isAll) {
      targetOutlets.push({
        id: targetOutletId,
        shopName: targetOutletId === 'store-1' ? 'sy Nayab' : targetOutletId === 'store-2' ? 'kp Nayab' : targetOutletId,
      } as any);
    }

    for (const out of targetOutlets) {
      const todayOutletTxs = transactions.filter((t) => {
        const tTime = new Date(t.timestamp).getTime();
        const isToday = (t.timestamp && t.timestamp.startsWith(todayStr)) || tTime >= startOfTodayMs;
        if (!isToday || t.voided) return false;
        const matchId = t.outletId || t.storeId;
        return matchId ? matchId === out.id : (out.isPrimary || out.id === 'store-1');
      });

      if (todayOutletTxs.length > 0 || openingAmount > 0 || addedAmount > 0) {
        const salesTxs = todayOutletTxs.filter((t) => t.type === 'sale');
        const expenseTxs = todayOutletTxs.filter((t) => t.type === 'expense');
        const sales = salesTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const expenses = expenseTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const cash = salesTxs.filter((t) => t.paymentMode === 'cash').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const upi = salesTxs.filter((t) => t.paymentMode === 'online_upi').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const udhaar = salesTxs.filter((t) => t.paymentMode === 'credit_udhaar').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        const isThisActive = out.id === (storeSettings.activeStoreId || 'store-1');
        const outOpening = isThisActive ? openingAmount : 0;
        const outAdded = isThisActive ? addedAmount : 0;

        await recordOutletDailySnapshot({
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
          openingCash: outOpening,
          addedCash: outAdded,
          archivedTransactions: todayOutletTxs,
        }, 'accumulate');
      }
    }

    // 1. Remove today's transactions for the targeted outlet(s)
    setTransactions((prev) => {
      const updated = prev.filter((t) => {
        const tTime = new Date(t.timestamp).getTime();
        const isToday = (t.timestamp && t.timestamp.startsWith(todayStr)) || tTime >= startOfTodayMs;
        if (!isToday) return true; // Keep past days completely safe

        if (isAll) return false;

        const matchId = t.outletId || t.storeId || 'store-1';
        return matchId !== targetOutletId;
      });
      try {
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated));
      } catch (err) {
        console.warn('Local storage transactions save:', err);
      }
      return updated;
    });

    // 2. Reset Opening and Added Cash balances to 0
    setOutletCashBalances((prev) => {
      const updated = { ...prev };
      if (isAll) {
        for (const k of Object.keys(updated)) {
          updated[k] = { openingCash: 0, addedCash: 0, lastUpdated: new Date().toISOString() };
        }
      } else if (targetOutletId) {
        updated[targetOutletId] = { openingCash: 0, addedCash: 0, lastUpdated: new Date().toISOString() };
      }
      try {
        localStorage.setItem('nayab_outlet_cash_balances_v1', JSON.stringify(updated));
        localStorage.setItem(STORAGE_KEYS.OPENING_AMOUNT, '0');
        localStorage.setItem(STORAGE_KEYS.ADDED_CASH, '0');
      } catch {}
      return updated;
    });

    // 3. Reset active calculator & bill tape
    setBillItems([]);
    setCalculatorAmount(0);

    // 4. Synchronize daily reset to central server Express database
    try {
      const actorName = currentActiveStaff?.name || 'Counter Terminal';
      await resetDailyOutletData(targetOutletId, actorName);
    } catch (err) {
      console.warn('Central server reset sync note:', err);
    }

    playKeySound('clear');
  };

  // Combined bill items: includes all active POS items PLUS the calculator manual entry if present
  const effectiveBillItems = useMemo<BillItem[]>(() => {
    if (calculatorAmount <= 0) {
      return billItems;
    }
    const calcItem: BillItem = {
      id: `calc-entry-${Date.now()}`,
      name: 'Calculator / Manual Entry',
      hindiName: 'कैलकुलेटर योग',
      rate: calculatorAmount,
      quantity: 1,
      unit: 'item',
      total: calculatorAmount,
    };
    return [...billItems, calcItem];
  }, [billItems, calculatorAmount]);

  // Open Pre-Print Review Modal (Allows reviewing items, quantities, rates and receipt preview before printing)
  const handleQuickPrintSlip = (combinedAmt?: number, calcAmt?: number) => {
    playKeySound('action');
    let currentCalc = typeof calcAmt === 'number' ? calcAmt : 0;
    if (currentCalc === 0 && typeof combinedAmt === 'number' && combinedAmt > billGrandTotal && billItems.length > 0) {
      currentCalc = Math.round((combinedAmt - billGrandTotal) * 100) / 100;
    } else if (currentCalc === 0 && billItems.length === 0 && typeof combinedAmt === 'number' && combinedAmt > 0) {
      currentCalc = combinedAmt;
    }

    setReviewModalCalcAmount(currentCalc);
    setIsBillReviewOpen(true);
  };

  // Print current active bill (opens Pre-Print Review Modal)
  const handlePrintCurrentBill = (calcAmt?: number) => {
    playKeySound('action');
    const currentCalc = typeof calcAmt === 'number' ? calcAmt : calculatorAmount;
    setReviewModalCalcAmount(currentCalc);
    setIsBillReviewOpen(true);
  };

  // Sync reviewed items back to active counter bill tape
  const handleUpdateBillItemsFromReview = (updatedItems: BillItem[]) => {
    setBillItems(updatedItems);
  };

  // Load catalogue products from High-Capacity IndexedDB (supports up to 1,500,000 items)
  useEffect(() => {
    getAllProductsFromIDB()
      .then((idbProducts) => {
        if (idbProducts && idbProducts.length > 0) {
          setProducts((current) => {
            const productMap = new Map<string, Product>();
            for (const p of idbProducts) {
              if (p && p.id) productMap.set(p.id, p);
            }
            for (const p of current) {
              if (p && p.id && !productMap.has(p.id)) {
                productMap.set(p.id, p);
              }
            }
            return Array.from(productMap.values());
          });
        }
      })
      .catch((err) => {
        console.warn('Could not load products from IndexedDB:', err);
      });
  }, []);

  // Persist products to High-Capacity IndexedDB (supports up to 1,500,000 items)
  useEffect(() => {
    if (!products || products.length === 0) return;
    saveAllProductsToIDB(products).catch((err) => {
      console.warn('Failed saving to IndexedDB:', err);
    });

    // Safely cache a small fallback snapshot to LocalStorage without exceeding 5MB quota
    try {
      if (products.length <= 500) {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
      }
    } catch {
      // Ignore local storage quota overflow
    }
  }, [products]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(storeSettings));
  }, [storeSettings]);

  // Automated Full Data Backup Snapshot (Safeguards inventory, ledger & udhaar khata)
  useEffect(() => {
    if (storeSettings.autoBackupEnabled === false) return;
    try {
      const todayDateStr = new Date().toISOString().slice(0, 10);
      const lastAutoBackupDate = getStoredItem(STORAGE_KEYS.LAST_BACKUP, LEGACY_STORAGE_KEYS.LAST_BACKUP);
      if (lastAutoBackupDate !== todayDateStr && products.length > 0) {
        const fullBackup = createFullBackupData(
          products,
          transactions,
          customers,
          storeSettings,
          { openingAmount, addedAmount }
        );
        saveAutoBackupSnapshot(fullBackup);
        localStorage.setItem(STORAGE_KEYS.LAST_BACKUP, todayDateStr);
      }
    } catch (e) {
      console.warn('Auto backup check:', e);
    }
  }, [storeSettings.autoBackupEnabled, products.length, transactions.length, customers.length]);

  // Central Database Cloud Sync (Load initial snapshot from server)
  useEffect(() => {
    let isMounted = true;

    fetchCentralSnapshot()
      .then((snap) => {
        if (!isMounted || !snap) return;
        if (snap.products && snap.products.length > 0) {
          setProducts((currentLocalProducts) => {
            if (!currentLocalProducts || currentLocalProducts.length === 0) {
              return snap.products;
            }
            // Smart two-way reconciliation: do NOT discard locally added or modified products
            const productMap = new Map<string, Product>();
            // 1. Put all server products in map
            for (const sp of snap.products) {
              if (sp && sp.id) {
                productMap.set(sp.id, sp);
              }
            }
            // 2. Merge local products: keep locally added products & newer local updates
            let hasLocalAdditions = false;
            for (const lp of currentLocalProducts) {
              if (!lp || !lp.id) continue;
              const serverProd = productMap.get(lp.id);
              if (!serverProd) {
                // New local product created by user! Keep it!
                productMap.set(lp.id, lp);
                hasLocalAdditions = true;
              } else {
                // Product exists in both: compare updatedAt or keep local modifications
                const localUpdated = lp.updatedAt ? new Date(lp.updatedAt).getTime() : 0;
                const serverUpdated = serverProd.updatedAt ? new Date(serverProd.updatedAt).getTime() : 0;
                if (localUpdated >= serverUpdated) {
                  productMap.set(lp.id, { ...serverProd, ...lp });
                }
              }
            }
            const mergedProducts = Array.from(productMap.values());

            // If local had additions not yet in server database, push delta to server!
            if (hasLocalAdditions) {
              pushCentralDelta({ products: mergedProducts }).catch(console.warn);
            }

            // Immediately persist merged list to IDB & localStorage
            saveAllProductsToIDB(mergedProducts).catch(console.warn);
            try {
              if (mergedProducts.length <= 500) {
                localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(mergedProducts));
              }
            } catch {}

            return mergedProducts;
          });
        }
        if (snap.customers && snap.customers.length > 0) {
          setCustomers(snap.customers);
        }
        if (snap.transactions && snap.transactions.length > 0) {
          setTransactions(snap.transactions);
        }
        if (snap.staff && snap.staff.length > 0) {
          setStoreSettings((prev) => ({
            ...prev,
            staffAccounts: normalizeStaffWithOutlets(snap.staff),
          }));
        }

        // Also fetch live enriched outlets to populate latest counter balances per outlet
        fetchCentralOutlets().then((outRes) => {
          if (!isMounted || !outRes.success || !outRes.outlets?.length) return;
          setStoreSettings((prev) => ({
            ...prev,
            stores: outRes.outlets,
          }));
          setOutletCashBalances((prev) => {
            const updated = { ...prev };
            for (const out of outRes.outlets!) {
              if (typeof out.openingCash === 'number' || typeof out.addedCash === 'number') {
                updated[out.id] = {
                  openingCash: typeof out.openingCash === 'number' ? out.openingCash : (prev[out.id]?.openingCash || 0),
                  addedCash: typeof out.addedCash === 'number' ? out.addedCash : (prev[out.id]?.addedCash || 0),
                  lastUpdated: out.lastSyncAt || new Date().toISOString(),
                };
              }
            }
            try {
              localStorage.setItem('nayab_outlet_cash_balances_v1', JSON.stringify(updated));
            } catch {}
            return updated;
          });
        }).catch(console.warn);
      })
      .catch((err) => {
        console.info('Central database initial sync:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync autoSyncStaffEnabled from storeSettings into the manager if changed
  useEffect(() => {
    if (typeof storeSettings.autoSyncStaffEnabled === 'boolean') {
      setStaffAutoSyncEnabled(storeSettings.autoSyncStaffEnabled);
    }
  }, [storeSettings.autoSyncStaffEnabled, setStaffAutoSyncEnabled]);

  // Automatic Staff Data Sync Loop (runs periodically & on network reconnection)
  useEffect(() => {
    if (storeSettings.autoSyncStaffEnabled === false || !staffAutoSyncStatus.isAutoSyncEnabled) {
      return;
    }

    const intervalSec = storeSettings.autoSyncStaffIntervalSeconds || 30;
    const intervalMs = Math.max(10, intervalSec) * 1000;

    const performPeriodicSync = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return;
      }
      const activeStore = storeSettings.stores?.find((s) => s.id === storeSettings.activeStoreId) || storeSettings.stores?.[0];
      const activeStoreId = activeStore?.id || storeSettings.activeStoreId || 'store-1';
      const activeStoreName = activeStore?.shopName || storeSettings.shopName;
      const activeStaff = storeSettings.staffAccounts.find((s) => s.id === storeSettings.activeStaffId);

      triggerStaffAutoSync(
        {
          outletId: activeStoreId,
          outletName: activeStoreName,
          transactions,
          customers,
          products,
          staff: storeSettings.staffAccounts,
          openingCash: openingAmount,
          addedCash: addedAmount,
          uploadedBy: activeStaff?.name || 'Staff Auto-Sync',
          role: activeStaff?.role || 'Staff',
        },
        { immediate: false, delayMs: 150 }
      );
    };

    const timer = setInterval(performPeriodicSync, intervalMs);

    const handleOnline = () => {
      performPeriodicSync();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', handleOnline);
    };
  }, [
    storeSettings.autoSyncStaffEnabled,
    storeSettings.autoSyncStaffIntervalSeconds,
    staffAutoSyncStatus.isAutoSyncEnabled,
    storeSettings.activeStoreId,
    storeSettings.stores,
    storeSettings.shopName,
    storeSettings.staffAccounts,
    storeSettings.activeStaffId,
    transactions,
    customers,
    products,
    triggerStaffAutoSync,
  ]);

  // Compute active bill total
  const billSubtotal = billItems.reduce((sum, item) => sum + item.total, 0);
  const billTax = (billSubtotal * storeSettings.defaultTaxRate) / 100;
  const billGrandTotal = Math.round((billSubtotal + billTax) * 100) / 100;

  // Dynamic start of today timestamp bound to currentDayStr
  // Whenever midnight crosses or day changes, this automatically triggers a clean zero-out of today's counters
  const startOfToday = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }, [currentDayStr]);

  const activeOutletTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchId = t.outletId || t.storeId;
      if (matchId) return matchId === activeCounterOutletId;
      return activeCounterOutletId === 'store-1';
    });
  }, [transactions, activeCounterOutletId]);

  const activeOutletCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchId = c.outletId || c.storeId;
      if (matchId) return matchId === activeCounterOutletId;
      return activeCounterOutletId === 'store-1';
    });
  }, [customers, activeCounterOutletId]);

  const todaySalesTotal = useMemo(() => {
    return activeOutletTransactions
      .filter((t) => !t.voided && t.type === 'sale' && new Date(t.timestamp).getTime() >= startOfToday)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [activeOutletTransactions, startOfToday]);

  const todayOnlineSalesTotal = useMemo(() => {
    return activeOutletTransactions
      .filter(
        (t) =>
          !t.voided &&
          t.type === 'sale' &&
          t.paymentMode === 'online_upi' &&
          new Date(t.timestamp).getTime() >= startOfToday
      )
      .reduce((sum, t) => sum + t.amount, 0);
  }, [activeOutletTransactions, startOfToday]);

  const todayUdhaarSalesTotal = useMemo(() => {
    return activeOutletTransactions
      .filter(
        (t) =>
          !t.voided &&
          t.type === 'sale' &&
          t.paymentMode === 'credit_udhaar' &&
          new Date(t.timestamp).getTime() >= startOfToday
      )
      .reduce((sum, t) => sum + t.amount, 0);
  }, [activeOutletTransactions, startOfToday]);

  const todayExpensesTotal = useMemo(() => {
    return activeOutletTransactions
      .filter((t) => !t.voided && t.type === 'expense' && new Date(t.timestamp).getTime() >= startOfToday)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [activeOutletTransactions, startOfToday]);

  const pendingUdhaarTotal = activeOutletCustomers.reduce((sum, c) => sum + c.totalDue, 0);
  const currentActiveStaff = isAuthenticated && storeSettings.activeStaffId
    ? storeSettings.staffAccounts.find((s) => s.id === storeSettings.activeStaffId)
    : undefined;
  const isOwner = Boolean(
    isAuthenticated &&
    currentActiveStaff &&
    (currentActiveStaff.role === 'owner' || currentActiveStaff.role === 'master_admin')
  );

  const ownerStaffAccount = useMemo(() => {
    return storeSettings.staffAccounts.find(
      (s) => s.role === 'owner' || s.role === 'master_admin' || s.id === 'faizan-inamdar'
    );
  }, [storeSettings.staffAccounts]);

  // Add Item to Bill
  const handleAddItemToBill = (item: Omit<BillItem, 'id'>) => {
    playKeySound('action');
    const newItem: BillItem = {
      ...item,
      id: `bi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    setBillItems((prev) => [...prev, newItem]);
  };

  // Add Multiple Items to Bill (Batch Voice Utterances)
  const handleAddItemsToBill = (items: Omit<BillItem, 'id'>[]) => {
    if (!items || items.length === 0) return;
    playKeySound('action');
    const newItems: BillItem[] = items.map((item, idx) => ({
      ...item,
      id: `bi-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    }));
    setBillItems((prev) => [...prev, ...newItems]);
  };

  // Update Item Quantity directly on the bill tape
  const handleUpdateItemQuantity = (id: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveItem(id);
      return;
    }
    setBillItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const total = Math.round(newQuantity * item.rate * 100) / 100;
          return { ...item, quantity: newQuantity, total };
        }
        return item;
      })
    );
  };

  // Remove Item from Bill
  const handleRemoveItem = (id: string) => {
    playKeySound('clear');
    setBillItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Clear Bill
  const handleClearBill = () => {
    playKeySound('clear');
    setBillItems([]);
  };

  // Inventory modifications (High-capacity catalogue up to 1,500,000 items)
  const handleAddProductToInventory = (newProd: Product) => {
    const effectiveProd: Product = {
      ...newProd,
      outletId: newProd.outletId || 'all',
      outletName:
        newProd.outletName ||
        (newProd.outletId && newProd.outletId !== 'all'
          ? (storeSettings.stores || DEFAULT_STORES).find((s) => s.id === newProd.outletId)?.shopName
          : 'All Outlets (Shared)'),
      updatedAt: new Date().toISOString(),
    };

    setProducts((prev) => {
      const updated = [effectiveProd, ...prev.filter((p) => p.id !== effectiveProd.id)];
      // Immediate localStorage backup
      try {
        if (updated.length <= 500) {
          localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(updated));
        }
      } catch {}
      return updated;
    });

    // Directly save single item to High-Capacity IndexedDB immediately for instant offline persistence
    saveSingleProductToIDB(effectiveProd).catch(console.warn);

    // Save directly to Central Server database
    saveCentralProduct(effectiveProd).catch(console.warn);

    // Replicate to Firestore
    syncProductToFirestore(effectiveProd).catch(console.warn);
  };

  const handleBulkAddProducts = (newItems: Product[]) => {
    const stampedItems = newItems.map((it) => ({
      ...it,
      updatedAt: it.updatedAt || new Date().toISOString(),
    }));

    setProducts((prev) => {
      const existingIds = new Set(stampedItems.map((it) => it.id));
      const merged = [...stampedItems, ...prev.filter((p) => !existingIds.has(p.id))];
      const capped = merged.slice(0, CATALOGUE_MAX_CAPACITY);
      saveAllProductsToIDB(capped).catch(console.warn);
      try {
        if (capped.length <= 500) {
          localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(capped));
        }
      } catch {}
      return capped;
    });

    pushCentralDelta({ products: stampedItems }).catch(console.warn);
  };

  const handleClearAllProducts = () => {
    setProducts([]);
  };

  const handleUpdateProduct = (updated: Product) => {
    const withTimestamp: Product = {
      ...updated,
      updatedAt: new Date().toISOString(),
    };
    setProducts((prev) => {
      const nextList = prev.map((p) => (p.id === withTimestamp.id ? withTimestamp : p));
      try {
        if (nextList.length <= 500) {
          localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(nextList));
        }
      } catch {}
      return nextList;
    });
    saveSingleProductToIDB(withTimestamp).catch((err) => console.warn('Failed saving updated product to IDB:', err));
    saveCentralProduct(withTimestamp).catch(console.warn);
    syncProductToFirestore(withTimestamp).catch(console.warn);
  };

  const handleDeleteProduct = (productId: string) => {
    setProducts((prev) => {
      const nextList = prev.filter((p) => p.id !== productId);
      try {
        if (nextList.length <= 500) {
          localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(nextList));
        }
      } catch {}
      return nextList;
    });
    deleteProductFromIDB(productId).catch((err) => console.warn('Failed deleting from IDB:', err));
    deleteCentralProduct(productId).catch(console.warn);
    deleteProductFromFirestore(productId).catch(console.warn);
    playKeySound('clear');
  };

  // Staff switch
  const handleSwitchStaff = (staffId: string) => {
    const target = storeSettings.staffAccounts.find((s) => s.id === staffId);
    if (target) {
      try {
        sessionStorage.setItem('nayab_authenticated_session', 'true');
        sessionStorage.setItem('nayab_active_session_staff', target.id);
        sessionStorage.setItem('nayab_active_session_role', target.role);
        if (target.role !== 'cashier') {
          localStorage.removeItem('nayab_session_authenticated');
          localStorage.removeItem('nayab_active_session_staff');
        }
      } catch {}
      setIsAuthenticated(true);
      setStoreSettings((prev) => {
        let targetStoreId = prev.activeStoreId;
        const assigned = target.assignedOutletIds;
        if (assigned && assigned.length > 0 && !assigned.includes('all')) {
          if (target.defaultOutletId && assigned.includes(target.defaultOutletId)) {
            targetStoreId = target.defaultOutletId;
          } else if (!assigned.includes(prev.activeStoreId || '')) {
            targetStoreId = assigned[0];
          }
        }
        const matchedStore = (prev.stores || []).find((s) => s.id === targetStoreId);

        return {
          ...prev,
          activeStaffId: target.id,
          activeStoreId: targetStoreId,
          ...(matchedStore
            ? {
                shopName: matchedStore.shopName,
                upiId: matchedStore.upiId,
                upiName: matchedStore.upiName || matchedStore.shopName,
                phone: matchedStore.phone,
                address: matchedStore.address,
              }
            : {}),
        };
      });
    }
  };

  // User Login & Logout Handlers
  const handleLoginSuccess = (staff: StaffAccount, remember: boolean = false) => {
    setIsAuthenticated(true);
    setIsLoginModalOpen(false);
    try {
      sessionStorage.setItem('nayab_authenticated_session', 'true');
      sessionStorage.setItem('nayab_active_session_staff', staff.id);
      sessionStorage.setItem('nayab_active_session_role', staff.role);

      // Security: Only non-admin cashier sessions may persist across reloads.
      // Owner/Admin accounts NEVER persist auto-login tokens in localStorage!
      if (remember && staff.role === 'cashier') {
        localStorage.setItem('nayab_session_authenticated', 'true');
        localStorage.setItem('nayab_active_session_staff', staff.id);
      } else {
        localStorage.removeItem('nayab_session_authenticated');
        localStorage.removeItem('nayab_active_session_staff');
      }
    } catch (e) {
      console.warn('Failed saving session:', e);
    }
    setStoreSettings((prev) => {
      let targetStoreId = prev.activeStoreId;
      const assigned = staff.assignedOutletIds;
      if (assigned && assigned.length > 0 && !assigned.includes('all')) {
        if (staff.defaultOutletId && assigned.includes(staff.defaultOutletId)) {
          targetStoreId = staff.defaultOutletId;
        } else if (!assigned.includes(prev.activeStoreId || '')) {
          targetStoreId = assigned[0];
        }
      }
      const matchedStore = (prev.stores || []).find((s) => s.id === targetStoreId);

      return {
        ...prev,
        activeStaffId: staff.id,
        activeStoreId: targetStoreId,
        ...(matchedStore
          ? {
              shopName: matchedStore.shopName,
              upiId: matchedStore.upiId,
              upiName: matchedStore.upiName || matchedStore.shopName,
              phone: matchedStore.phone,
              address: matchedStore.address,
            }
          : {}),
      };
    });
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsLoginModalOpen(true);
    try {
      sessionStorage.removeItem('nayab_authenticated_session');
      sessionStorage.removeItem('nayab_active_session_staff');
      sessionStorage.removeItem('nayab_active_session_role');
      localStorage.removeItem('nayab_session_authenticated');
      localStorage.removeItem('nayab_active_session_staff');
    } catch (e) {
      console.warn('Failed clearing session:', e);
    }
    setStoreSettings((prev) => ({
      ...prev,
      activeStaffId: '',
    }));
  };

  // Update and Delete Transactions (Bills Management for Owner)
  const handleUpdateTransaction = (updatedTx: Transaction) => {
    const updated = transactions.map((t) => (t.id === updatedTx.id ? updatedTx : t));
    setTransactions(updated);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated));
    recordTransactionInFirestore(updatedTx).catch((err) => {
      console.warn('Firestore transaction update sync:', err);
    });

    const activeStore = storeSettings.stores?.find((s) => s.id === storeSettings.activeStoreId) || storeSettings.stores?.[0];
    const activeStoreId = activeStore?.id || storeSettings.activeStoreId || 'store-1';
    const activeStoreName = activeStore?.shopName || storeSettings.shopName;
    const activeStaff = storeSettings.staffAccounts.find((s) => s.id === storeSettings.activeStaffId);

    triggerStaffAutoSync({
      outletId: activeStoreId,
      outletName: activeStoreName,
      transactions: updated,
      customers,
      products,
      staff: storeSettings.staffAccounts,
      uploadedBy: activeStaff?.name || 'Staff',
      role: activeStaff?.role || 'Staff',
    }, { immediate: false });
  };

  const handleDeleteTransaction = (transactionId: string) => {
    const updated = transactions.filter((t) => t.id !== transactionId);
    setTransactions(updated);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated));

    const activeStore = storeSettings.stores?.find((s) => s.id === storeSettings.activeStoreId) || storeSettings.stores?.[0];
    const activeStoreId = activeStore?.id || storeSettings.activeStoreId || 'store-1';
    const activeStoreName = activeStore?.shopName || storeSettings.shopName;
    const activeStaff = storeSettings.staffAccounts.find((s) => s.id === storeSettings.activeStaffId);

    triggerStaffAutoSync({
      outletId: activeStoreId,
      outletName: activeStoreName,
      transactions: updated,
      customers,
      products,
      staff: storeSettings.staffAccounts,
      uploadedBy: activeStaff?.name || 'Staff',
      role: activeStaff?.role || 'Staff',
    }, { immediate: false });
  };

  // Open Sale Modal from keypad or checkout, combining active sale bill items + calculator amount
  const handleOpenSale = (combinedAmt?: number, calcAmt?: number) => {
    let currentCalc = typeof calcAmt === 'number' ? calcAmt : 0;
    if (currentCalc === 0 && typeof combinedAmt === 'number' && billItems.length > 0 && combinedAmt > billGrandTotal) {
      currentCalc = Math.round((combinedAmt - billGrandTotal) * 100) / 100;
    } else if (currentCalc === 0 && typeof combinedAmt === 'number' && billItems.length === 0) {
      currentCalc = combinedAmt;
    }
    setCalculatorAmount(currentCalc);

    const totalAmt = typeof combinedAmt === 'number' && combinedAmt > 0
      ? combinedAmt
      : Math.round((billGrandTotal + currentCalc) * 100) / 100;

    setActiveModalAmount(totalAmt);
    setIsSaleModalOpen(true);
  };

  // Open Expense Modal
  const handleOpenExpense = (currentAmt: number) => {
    setActiveModalAmount(currentAmt > 0 ? currentAmt : 100);
    setIsExpenseModalOpen(true);
  };

  // Open UPI QR Modal, combining active sale bill items + calculator amount
  const handleOpenUpiQr = (combinedAmt?: number, calcAmt?: number) => {
    let currentCalc = typeof calcAmt === 'number' ? calcAmt : 0;
    if (currentCalc === 0 && typeof combinedAmt === 'number' && billItems.length > 0 && combinedAmt > billGrandTotal) {
      currentCalc = Math.round((combinedAmt - billGrandTotal) * 100) / 100;
    } else if (currentCalc === 0 && typeof combinedAmt === 'number' && billItems.length === 0) {
      currentCalc = combinedAmt;
    }
    setCalculatorAmount(currentCalc);

    const totalAmt = typeof combinedAmt === 'number' && combinedAmt > 0
      ? combinedAmt
      : (billGrandTotal + currentCalc > 0 ? billGrandTotal + currentCalc : 100);

    setActiveModalAmount(totalAmt);
    setIsUpiQrModalOpen(true);
  };

  // Complete Sale
  const handleCompleteSale = (saleData: Omit<Transaction, 'id' | 'receiptNumber' | 'timestamp'>) => {
    const receiptNo = `NB-${Date.now().toString().slice(-6)}`;
    const activeStaff = storeSettings.staffAccounts.find((s) => s.id === storeSettings.activeStaffId);

    const itemsToSave = saleData.items && saleData.items.length > 0
      ? saleData.items
      : (effectiveBillItems.length > 0 ? [...effectiveBillItems] : undefined);

    const activeStore = storeSettings.stores?.find((s) => s.id === storeSettings.activeStoreId) || storeSettings.stores?.[0];
    const activeStoreId = activeStore?.id || storeSettings.activeStoreId || 'store-1';
    const activeStoreName = activeStore?.shopName || storeSettings.shopName;

    const newTx: Transaction = {
      ...saleData,
      id: `tx-${Date.now()}`,
      receiptNumber: receiptNo,
      timestamp: new Date().toISOString(),
      staffId: activeStaff?.id,
      staffName: activeStaff?.name,
      items: itemsToSave,
      storeId: activeStoreId,
      storeName: activeStoreName,
      outletId: activeStoreId,
      outletName: activeStoreName,
    };

    setTransactions((prev) => [newTx, ...prev]);

    // Replicate sale transaction to Firestore cloud database
    recordTransactionInFirestore(newTx).catch((err) => {
      console.warn('Firestore sale sync:', err);
    });
    if (saleData.paymentMode === 'credit_udhaar' && saleData.customerName) {
      setCustomers((prev) => {
        const existingIdx = prev.findIndex(
          (c) =>
            c.id === saleData.customerId ||
            c.name.toLowerCase() === saleData.customerName?.toLowerCase()
        );

        if (existingIdx >= 0) {
          const updated = [...prev];
          const updatedCust = {
            ...updated[existingIdx],
            totalDue: updated[existingIdx].totalDue + saleData.amount,
            lastActive: new Date().toISOString(),
            storeId: updated[existingIdx].storeId || activeStoreId,
            outletId: updated[existingIdx].outletId || activeStoreId,
            outletName: updated[existingIdx].outletName || activeStoreName,
          };
          updated[existingIdx] = updatedCust;
          syncCustomerToFirestore(updatedCust).catch(console.warn);
          return updated;
        } else {
          const newCustomer: CustomerUdhaar = {
            id: `cust-${Date.now()}`,
            name: saleData.customerName || 'Customer',
            phone: saleData.customerPhone || 'Not provided',
            totalDue: saleData.amount,
            lastActive: new Date().toISOString(),
            storeId: activeStoreId,
            outletId: activeStoreId,
            outletName: activeStoreName,
          };
          syncCustomerToFirestore(newCustomer).catch(console.warn);
          return [newCustomer, ...prev];
        }
      });
    }

    // Deduct sold quantities from Inventory stock if item has tracked stock
    if (itemsToSave && itemsToSave.length > 0) {
      setProducts((prev) => {
        let changed = false;
        const updatedList = prev.map((p) => {
          const soldItem = itemsToSave.find(
            (it) => it.productId === p.id || it.name.trim().toLowerCase() === p.name.trim().toLowerCase()
          );
          if (soldItem && p.stock !== undefined) {
            const soldQty = Number(soldItem.quantity) || 1;
            const newStock = Math.max(0, Math.round((p.stock - soldQty) * 100) / 100);
            changed = true;
            const updatedProd: Product = {
              ...p,
              stock: newStock,
              updatedAt: new Date().toISOString(),
            };
            saveSingleProductToIDB(updatedProd).catch(console.warn);
            saveCentralProduct(updatedProd).catch(console.warn);
            syncProductToFirestore(updatedProd).catch(console.warn);
            return updatedProd;
          }
          return p;
        });

        if (changed) {
          try {
            if (updatedList.length <= 500) {
              localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(updatedList));
            }
          } catch {}
        }
        return updatedList;
      });
    }

    // Automatic staff data sync to Central Database & Cloud Firestore
    const updatedTransactions = [newTx, ...transactions];
    triggerStaffAutoSync(
      {
        outletId: activeStoreId,
        outletName: activeStoreName,
        transactions: updatedTransactions,
        customers,
        products,
        staff: storeSettings.staffAccounts,
        openingCash: openingAmount,
        addedCash: addedAmount,
        uploadedBy: activeStaff?.name || 'Staff',
        role: activeStaff?.role || 'Staff',
      },
      { immediate: true }
    );

    // Clear active bill tape and calculator amount
    setBillItems([]);
    setCalculatorAmount(0);
  };

  // Record Expense
  const handleRecordExpense = (expenseData: Omit<Transaction, 'id' | 'receiptNumber' | 'timestamp'>) => {
    const receiptNo = `EXP-${Date.now().toString().slice(-6)}`;
    const activeStaff = storeSettings.staffAccounts.find((s) => s.id === storeSettings.activeStaffId);
    const activeStore = storeSettings.stores?.find((s) => s.id === storeSettings.activeStoreId) || storeSettings.stores?.[0];
    const activeStoreId = activeStore?.id || storeSettings.activeStoreId || 'store-1';
    const activeStoreName = activeStore?.shopName || storeSettings.shopName;

    const newTx: Transaction = {
      ...expenseData,
      id: `tx-${Date.now()}`,
      receiptNumber: receiptNo,
      timestamp: new Date().toISOString(),
      staffId: activeStaff?.id,
      staffName: activeStaff?.name,
      storeId: activeStoreId,
      storeName: activeStoreName,
      outletId: activeStoreId,
      outletName: activeStoreName,
    };
    const updatedTransactions = [newTx, ...transactions];
    setTransactions(updatedTransactions);

    // Replicate expense transaction to Firestore cloud database
    recordTransactionInFirestore(newTx).catch((err) => {
      console.warn('Firestore expense sync:', err);
    });

    // Automatic staff data sync to Central Database & Cloud Firestore
    triggerStaffAutoSync(
      {
        outletId: activeStoreId,
        outletName: activeStoreName,
        transactions: updatedTransactions,
        customers,
        products,
        staff: storeSettings.staffAccounts,
        openingCash: openingAmount,
        addedCash: addedAmount,
        uploadedBy: activeStaff?.name || 'Staff',
        role: activeStaff?.role || 'Staff',
      },
      { immediate: true }
    );
  };

  const handleRecordQuickUpiSale = (amt: number) => {
    handleCompleteSale({
      type: 'sale',
      amount: amt,
      paymentMode: 'online_upi',
      remarks: 'Instant UPI QR Counter Payment',
      taxRate: storeSettings.defaultTaxRate,
    });
  };

  // Customer Udhaar Payment Received (Jama)
  const handleSettleCustomerUdhaar = (customerId: string, amount: number) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          const updated = {
            ...c,
            totalDue: Math.max(0, c.totalDue - amount),
            lastActive: new Date().toISOString(),
          };
          syncCustomerToFirestore(updated).catch(console.warn);
          return updated;
        }
        return c;
      })
    );

    const cust = customers.find((c) => c.id === customerId);
    handleCompleteSale({
      type: 'sale',
      amount,
      paymentMode: 'cash',
      customerName: cust?.name,
      customerPhone: cust?.phone,
      customerId,
      remarks: `Udhaar Chukaya (Jama) by ${cust?.name || 'Customer'}`,
      taxRate: 0,
    });
  };

  // Add new customer account
  const handleAddCustomer = (newCustomer: CustomerUdhaar) => {
    const updatedCustomers = [newCustomer, ...customers];
    setCustomers(updatedCustomers);
    syncCustomerToFirestore(newCustomer).catch(console.warn);

    const activeStore = storeSettings.stores?.find((s) => s.id === storeSettings.activeStoreId) || storeSettings.stores?.[0];
    const activeStoreId = activeStore?.id || storeSettings.activeStoreId || 'store-1';
    const activeStoreName = activeStore?.shopName || storeSettings.shopName;
    const activeStaff = storeSettings.staffAccounts.find((s) => s.id === storeSettings.activeStaffId);

    triggerStaffAutoSync({
      outletId: activeStoreId,
      outletName: activeStoreName,
      transactions,
      customers: updatedCustomers,
      products,
      staff: storeSettings.staffAccounts,
      uploadedBy: activeStaff?.name || 'Staff',
      role: activeStaff?.role || 'Staff',
    });
  };

  // Restore backup
  const handleImportBackup = (backup: any) => {
    if (backup.products && Array.isArray(backup.products)) setProducts(backup.products);
    if (backup.transactions && Array.isArray(backup.transactions)) setTransactions(backup.transactions);
    if (backup.customers && Array.isArray(backup.customers)) setCustomers(backup.customers);
    if (backup.storeSettings) setStoreSettings((prev) => ({ ...prev, ...backup.storeSettings }));
  };

  // Full JSON Backup Restore
  const handleRestoreFullBackup = (backup: FullBackupData) => {
    if (backup.data.products && Array.isArray(backup.data.products)) {
      setProducts(backup.data.products);
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(backup.data.products));
    }
    if (backup.data.transactions && Array.isArray(backup.data.transactions)) {
      setTransactions(backup.data.transactions);
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(backup.data.transactions));
    }
    if (backup.data.customers && Array.isArray(backup.data.customers)) {
      setCustomers(backup.data.customers);
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(backup.data.customers));
    }
    if (backup.data.storeSettings) {
      const merged: StoreSettings = {
        ...storeSettings,
        ...backup.data.storeSettings,
        lastBackupTimestamp: new Date().toISOString(),
      };
      setStoreSettings(merged);
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
    }
    if (backup.data.cashFlow) {
      const activeId = storeSettings.activeStoreId || 'store-1';
      const op = typeof backup.data.cashFlow.openingAmount === 'number' ? backup.data.cashFlow.openingAmount : 0;
      const ad = typeof backup.data.cashFlow.addedAmount === 'number' ? backup.data.cashFlow.addedAmount : 0;
      setOutletCashBalances((prev) => ({
        ...prev,
        [activeId]: { openingCash: op, addedCash: ad },
      }));
      localStorage.setItem(STORAGE_KEYS.OPENING_AMOUNT, String(op));
      localStorage.setItem(STORAGE_KEYS.ADDED_CASH, String(ad));
    }
    if (backup.data.marketCredits && Array.isArray(backup.data.marketCredits)) {
      setMarketCredits(backup.data.marketCredits);
      localStorage.setItem('nayab_market_credit_v1', JSON.stringify(backup.data.marketCredits));
    }
  };

  const handleSaveStoreSettings = (newSettings: StoreSettings) => {
    setStoreSettings(newSettings);
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));
    } catch (e) {
      console.warn('Failed to persist store settings:', e);
    }
  };

  const handleOpenSettingsWithTab = (tab: 'upi' | 'inventory' | 'staff' | 'printer' | 'profile' | 'backup' | 'reports' | 'stores' | 'free_apis' | 'pwa' = 'upi') => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
  };

  const handleOpenOutletSync = (tab?: 'staff_upload' | 'owner_download') => {
    if (tab) {
      setOutletSyncInitialTab(tab);
    } else {
      setOutletSyncInitialTab(isOwner ? 'owner_download' : 'staff_upload');
    }
    setIsOutletSyncOpen(true);
  };

  return (
    <div className={`min-h-screen flex flex-col font-['Plus_Jakarta_Sans',sans-serif] transition-colors duration-200 ${themeMode === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'}`}>
      {/* Top Application Bar */}
      <TohandsHeader
        storeSettings={storeSettings}
        productsCount={products.length}
        pendingUdhaarTotal={pendingUdhaarTotal}
        onOpenPosCatalog={() => setIsPosCatalogOpen(true)}
        onOpenBarcodeScanner={() => setIsBarcodeScannerOpen(true)}
        onOpenUdhaarLedger={() => setIsUdhaarLedgerOpen(true)}
        onOpenReports={() => handleOpenSettingsWithTab('reports')}
        onOpenBillsManager={() => setIsBillsManagerOpen(true)}
        onOpenMasterAdmin={() => setIsMasterAdminOpen(true)}
        onOpenOutletSync={() => handleOpenOutletSync()}
        onOpenSettings={handleOpenSettingsWithTab}
        onSwitchStaff={handleSwitchStaff}
        onLogout={handleLogout}
        themeMode={themeMode}
        onToggleTheme={handleToggleTheme}
        isAuthenticated={isAuthenticated}
        isOwner={isOwner}
        staffAutoSyncStatus={staffAutoSyncStatus}
        onTriggerAutoSync={triggerInstantStaffSync}
      />

      {/* Top Cash Addition & Daily Galla Bar (Opening + Added + Physical Cash Sale - Expenses = Cash In Hand) */}
      <TopCashFlowBanner
        openingAmount={openingAmount}
        addedAmount={addedAmount}
        todaySalesTotal={todaySalesTotal}
        todayOnlineSalesTotal={todayOnlineSalesTotal}
        todayUdhaarSalesTotal={todayUdhaarSalesTotal}
        todayExpensesTotal={todayExpensesTotal}
        outlets={storeSettings.stores || []}
        activeOutletId={storeSettings.activeStoreId}
        isOwner={isOwner}
        ownerStaffPin={ownerStaffAccount?.pin || 'nayab@q6'}
        onOpenExpenseModal={() => setIsExpenseModalOpen(true)}
        onUpdateOpeningAmount={handleUpdateOpeningAmount}
        onAddCashAmount={handleAddCashAmount}
        onResetDailyCash={handleResetDailyCash}
        onResetDailyOutletData={handleResetDailyOutletData}
        onOpenBillsSearch={(tab) => {
          setBillsInitialTab(tab);
          setIsBillsManagerOpen(true);
        }}
        themeMode={themeMode}
      />

      {/* Main Work Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-6">
        {/* Top Two-Column Grid: NAYAB Smart Calculator & Bill on Left, Fast Moving Kirana on Right */}
        <div className="flex flex-col lg:flex-row items-start justify-center gap-6">
          {/* Primary Column: NAYAB Smart Calculator + Bill Tape */}
          <div className="w-full lg:w-[580px] xl:w-[620px] flex-shrink-0">
            <NayabCalculator
              onOpenSale={handleOpenSale}
              onOpenExpense={handleOpenExpense}
              onOpenUpiQr={handleOpenUpiQr}
              onOpenPosCatalog={() => setIsPosCatalogOpen(true)}
              activeBillCount={billItems.length}
              activeBillTotal={billGrandTotal}
              defaultTaxRate={storeSettings.defaultTaxRate}
              products={products}
              onAddItemToBill={handleAddItemToBill}
              onAddItemsToBill={handleAddItemsToBill}
              onSelectProductForWeight={(product) => setQuickWeightProduct(product)}
              onUpdateProduct={handleUpdateProduct}
              onOpenBarcodeScanner={() => setIsBarcodeScannerOpen(true)}
              activeBillItems={billItems}
              onUpdateItemQuantity={handleUpdateItemQuantity}
              onRemoveItem={handleRemoveItem}
              onClearBill={handleClearBill}
              onQuickPrintBill={handleQuickPrintSlip}
              onAddProductToInventory={handleAddProductToInventory}
              onDeleteProduct={handleDeleteProduct}
            />
          </div>

          {/* Right Column: Fast Moving Kirana Products */}
          <div className="w-full lg:flex-1 space-y-4">
            {/* Quick Shortcuts & Fast Kirana Items (6 on Display + Vertical Scrolling) */}
            <div className="bg-slate-900/70 rounded-3xl p-4 border border-slate-800 space-y-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Fast Moving Kirana Masale
                  </span>
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-300 font-semibold px-2 py-0.5 rounded-full border border-cyan-500/30">
                    6 on Display
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Vertical Scroll Controls */}
                  <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-xl border border-slate-700/80">
                    <button
                      onClick={() => handleScrollFastMoving('up')}
                      className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
                      title="Scroll Up"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleScrollFastMoving('down')}
                      className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
                      title="Scroll Down"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => setIsPosCatalogOpen(true)}
                    className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 ml-1 hidden sm:inline"
                  >
                    All ({products.length}) →
                  </button>
                </div>
              </div>

              {/* Fast Moving Products Grid: Exactly 6 on display, remaining items scroll vertically */}
              {(() => {
                const fastMovingItems = products.filter((p) => p.popular).length >= 6
                  ? products.filter((p) => p.popular)
                  : products;

                return (
                  <div className="space-y-2">
                    <div
                      ref={fastMovingScrollRef}
                      className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[164px] sm:max-h-[170px] overflow-y-auto pr-1 select-none scroll-smooth"
                      style={{ scrollbarWidth: 'thin' }}
                    >
                      {fastMovingItems.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setQuickWeightProduct(p)}
                          className="p-2.5 rounded-2xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/60 text-left transition-all group shadow-sm flex flex-col justify-between"
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            {p.imageUrl ? (
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="w-8 h-8 rounded-lg object-cover border border-slate-700 flex-shrink-0 bg-slate-900 mt-0.5"
                              />
                            ) : null}
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-sm text-white truncate group-hover:text-cyan-300">
                                {p.name}
                              </div>
                              {p.hindiName && (
                                <div className="text-xs text-amber-300/90 truncate mt-0.5">{p.hindiName}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-700/50 text-[11px]">
                            <span className="font-mono font-bold text-emerald-400">₹{p.rate}</span>
                            <span className="text-[10px] text-slate-400">/{p.unit}</span>
                          </div>
                        </button>
                      ))}
                    </div>

                    {fastMovingItems.length > 6 && (
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                        <span>Showing 6 items on display</span>
                        <button
                          onClick={() => handleScrollFastMoving('down')}
                          className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
                        >
                          <span>Scroll vertically for {fastMovingItems.length - 6} more</span>
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Dedicated Search from Web Bar Placed Below the Application */}
        <div className="w-full">
          <WebProductSearch
            existingProducts={products}
            onAddProductToInventory={handleAddProductToInventory}
            onSelectProductForBill={(p, customQty) => {
              if (customQty && customQty > 0) {
                handleAddItemToBill({
                  productId: p.id,
                  name: p.name,
                  hindiName: p.hindiName,
                  rate: p.rate,
                  quantity: customQty,
                  unit: p.unit,
                  total: Math.round(p.rate * customQty * 100) / 100,
                });
              } else {
                setQuickWeightProduct(p);
              }
            }}
          />
        </div>
      </main>

      {/* POS Catalog Drawer (with Web Item Search & Editable Rates/Stock & 1.5M Capacity & Low Stock Alerts) */}
      <PosCatalogDrawer
        isOpen={isPosCatalogOpen}
        onClose={() => setIsPosCatalogOpen(false)}
        products={products}
        lowStockThreshold={storeSettings.lowStockThreshold ?? 10}
        currentStores={storeSettings.stores || DEFAULT_STORES}
        activeStoreId={storeSettings.activeStoreId || 'store-1'}
        onOpenSettings={(tab) => handleOpenSettingsWithTab(tab || 'inventory')}
        onAddProductToInventory={handleAddProductToInventory}
        onBulkAddProducts={handleBulkAddProducts}
        onAddItemToBill={handleAddItemToBill}
        onUpdateProduct={handleUpdateProduct}
        onDeleteProduct={handleDeleteProduct}
      />

      {/* Sale Settlement Modal with Thermal Printer support */}
      <SalePaymentModal
        isOpen={isSaleModalOpen}
        onClose={() => setIsSaleModalOpen(false)}
        initialAmount={activeModalAmount}
        billItems={effectiveBillItems}
        storeSettings={storeSettings}
        customers={customers}
        onCompleteSale={handleCompleteSale}
      />

      {/* Expense Modal */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        initialAmount={activeModalAmount}
        onRecordExpense={handleRecordExpense}
      />

      {/* Instant UPI QR Modal */}
      <QuickUpiQrModal
        isOpen={isUpiQrModalOpen}
        onClose={() => setIsUpiQrModalOpen(false)}
        initialAmount={activeModalAmount}
        storeSettings={storeSettings}
        onRecordSaleAsUpi={handleRecordQuickUpiSale}
      />

      {/* Customer Udhaar Khata Modal */}
      <UdhaarLedgerModal
        isOpen={isUdhaarLedgerOpen}
        onClose={() => setIsUdhaarLedgerOpen(false)}
        customers={customers}
        onSettlePayment={handleSettleCustomerUdhaar}
        onAddCustomer={handleAddCustomer}
        storeSettings={storeSettings}
      />

      {/* Scrolling Business Reports & Analytics Dashboard Modal */}
      <ReportsDashboardModal
        isOpen={isReportsOpen}
        onClose={() => setIsReportsOpen(false)}
        transactions={transactions}
        customers={customers}
        products={products}
        storeSettings={storeSettings}
        marketCredits={marketCredits}
        onUpdateMarketCredits={handleUpdateMarketCredits}
        onImportBackup={handleImportBackup}
        onOpenSettings={handleOpenSettingsWithTab}
      />

      {/* Store Profile, UPI, Inventory, Staff, Thermal Printer & Full Data Backup Settings Modal */}
      <StoreSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={storeSettings}
        products={products}
        transactions={transactions}
        customers={customers}
        marketCredits={marketCredits}
        onUpdateMarketCredits={handleUpdateMarketCredits}
        cashFlow={{ openingAmount, addedAmount }}
        onSaveSettings={handleSaveStoreSettings}
        onUpdateProduct={handleUpdateProduct}
        onAddProduct={handleAddProductToInventory}
        onBulkAddProducts={handleBulkAddProducts}
        onClearAllProducts={handleClearAllProducts}
        onDeleteProduct={handleDeleteProduct}
        onRestoreFullBackup={handleRestoreFullBackup}
        onOpenBillsManager={() => setIsBillsManagerOpen(true)}
        onResetShiftCash={handleResetDailyCash}
        onResetDailyOutletData={handleResetDailyOutletData}
        onOpenOutletSync={() => handleOpenOutletSync()}
        initialTab={settingsInitialTab}
        isOwner={isOwner}
        activeStaff={currentActiveStaff}
      />

      {/* Bills & Transactions Manager (Search, Edit Cash/Online/Udhaar bills & Expenses) */}
      <BillsManagementModal
        isOpen={isBillsManagerOpen}
        onClose={() => setIsBillsManagerOpen(false)}
        transactions={transactions}
        customers={customers}
        storeSettings={storeSettings}
        onUpdateTransaction={handleUpdateTransaction}
        onDeleteTransaction={handleDeleteTransaction}
        isOwner={isOwner}
        initialTab={billsInitialTab}
      />

      {/* Review Items in Bill Before Printing Modal */}
      <BillReviewPrintModal
        isOpen={isBillReviewOpen}
        onClose={() => setIsBillReviewOpen(false)}
        billItems={billItems}
        calculatorAmount={reviewModalCalcAmount}
        storeSettings={storeSettings}
        customers={customers}
        products={products}
        onUpdateBillItems={handleUpdateBillItemsFromReview}
        onCompleteSale={handleCompleteSale}
        onClearBill={handleClearBill}
        onOpenPrinterSettings={() => handleOpenSettingsWithTab('printer')}
      />

      {/* Staff & Owner Initial Login Popup Modal */}
      <AuthLoginModal
        isOpen={isLoginModalOpen || !isAuthenticated}
        onClose={() => {
          if (isAuthenticated) {
            setIsLoginModalOpen(false);
          }
        }}
        settings={storeSettings}
        onLoginSuccess={handleLoginSuccess}
        canDismiss={isAuthenticated}
      />

      {/* Quick Custom Weight & Quantity Modal (No pre-added forced quantity) */}
      {quickWeightProduct && (
        <CustomWeightModal
          isOpen={Boolean(quickWeightProduct)}
          onClose={() => setQuickWeightProduct(null)}
          product={quickWeightProduct}
          onConfirmAdd={handleAddItemToBill}
        />
      )}

      {/* POS Camera Barcode Scanner Modal */}
      <PosBarcodeScannerModal
        isOpen={isBarcodeScannerOpen}
        onClose={() => setIsBarcodeScannerOpen(false)}
        products={products}
        onAddItemToBill={handleAddItemToBill}
        onSelectProductForWeight={(product) => {
          setQuickWeightProduct(product);
        }}
        onCreateNewProductWithBarcode={(_barcode) => {
          setIsPosCatalogOpen(true);
        }}
      />

      {/* Dedicated Master Admin View & Central Cloud DB Portal */}
      <MasterAdminModal
        isOpen={isMasterAdminOpen}
        onClose={() => setIsMasterAdminOpen(false)}
        products={products}
        transactions={transactions}
        customers={customers}
        storeSettings={storeSettings}
        staffAccounts={storeSettings.staffAccounts}
        outletCashBalances={outletCashBalances}
        onUpdateOutletCash={(outletId, openingCash, addedCash) => {
          setOutletCashBalances((prev) => ({
            ...prev,
            [outletId]: { openingCash, addedCash },
          }));
        }}
        onReloadData={async () => {
          try {
            const snap = await fetchCentralSnapshot();
            if (snap) {
              if (snap.products && snap.products.length > 0) setProducts(snap.products);
              if (snap.customers && snap.customers.length > 0) {
                setCustomers((prev) => {
                  const serverCustIds = new Set(snap.customers.map((c) => c.id));
                  const localOnly = prev.filter((c) => !serverCustIds.has(c.id));
                  return [...snap.customers, ...localOnly];
                });
              }
              if (snap.transactions && snap.transactions.length > 0) {
                setTransactions((prev) => {
                  const serverTxIds = new Set(snap.transactions.map((t) => t.id));
                  const localOnly = prev.filter((t) => !serverTxIds.has(t.id));
                  return [...snap.transactions, ...localOnly];
                });
              }
              if (snap.staff && snap.staff.length > 0) {
                setStoreSettings((prev) => ({
                  ...prev,
                  staffAccounts: snap.staff,
                }));
              }
            }
          } catch (err) {
            console.warn('Snapshot reload error:', err);
          }
        }}
        onOpenOutletSync={() => handleOpenOutletSync('owner_download')}
        onResetDailyOutletData={handleResetDailyOutletData}
        onUpdateProducts={(updated) => setProducts(updated)}
        onUpdateTransactions={(updated) => setTransactions(updated)}
        onUpdateCustomers={(updated) => setCustomers(updated)}
        onUpdateStoreSettings={(updated) => setStoreSettings(updated)}
      />

      {/* Outlet Server Database Sync Hub (Staff Upload & Owner Download) */}
      <OutletDataSyncModal
        isOpen={isOutletSyncOpen}
        onClose={() => setIsOutletSyncOpen(false)}
        storeSettings={storeSettings}
        transactions={transactions}
        customers={customers}
        products={products}
        isOwner={isOwner}
        activeStaff={currentActiveStaff}
        autoSyncStatus={staffAutoSyncStatus}
        onToggleAutoSync={setStaffAutoSyncEnabled}
        onTriggerAutoSync={triggerInstantStaffSync}
        onResetDailyOutletData={handleResetDailyOutletData}
        initialTab={outletSyncInitialTab}
        onDataImported={async () => {
          try {
            const snap = await fetchCentralSnapshot();
            if (snap) {
              if (snap.products && snap.products.length > 0) setProducts(snap.products);
              if (snap.customers && snap.customers.length > 0) setCustomers(snap.customers);
              if (snap.transactions && snap.transactions.length > 0) setTransactions(snap.transactions);
            }
          } catch (err) {
            console.warn('Post-import snapshot reload error:', err);
          }
        }}
      />

      {/* PWA Offline & Online Network Indicator Banner */}
      <OfflineIndicator />
    </div>
  );
}
