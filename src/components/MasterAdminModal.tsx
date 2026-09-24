import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Database,
  RefreshCw,
  Layers,
  DollarSign,
  Users,
  Store,
  FileText,
  AlertTriangle,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  Filter,
  Download,
  Upload,
  Percent,
  CheckCircle2,
  Activity,
  Cloud,
  Wifi,
  WifiOff,
  ChevronDown,
  Lock,
  Phone,
  MessageSquare,
  Key,
  Shield,
  Save,
  HelpCircle,
  ExternalLink,
  Building2,
  Globe,
  MapPin,
  CreditCard,
  Eye,
  UploadCloud,
  DownloadCloud,
  FileSpreadsheet,
  RotateCcw,
  Coins,
  Wallet,
  Banknote,
} from 'lucide-react';
import {
  Product,
  Transaction,
  CustomerUdhaar,
  StoreSettings,
  StoreProfile,
  StaffAccount,
  AuditLogEntry,
  ProductCategory,
  UnitType,
} from '../types';
import { CATEGORY_LABELS } from '../data/defaultInventory';
import {
  checkCentralStatus,
  pullCentralSnapshot,
  pushCentralSync,
  saveCentralProduct,
  deleteCentralProduct,
  bulkAdjustCentralRates,
  voidCentralTransaction,
  updateCentralStaff,
  fetchCentralAuditLogs,
  updateCentralCloudConfig,
  restoreCentralDatabase,
  resetCentralDatabase,
  fetchCentralOutlets,
  fetchCentralOutletData,
  saveCentralOutlet,
  deleteCentralOutlet,
  switchCentralActiveOutlet,
  triggerOutletFileDownload,
  resetDailyOutletData,
  syncOutletCash,
} from '../utils/centralSync';
import {
  syncCatalogToFirestore,
  fetchProductsFromFirestore,
  testFirestoreConnection,
  syncOutletToFirestore,
  deleteOutletFromFirestore,
  fetchOutletsFromFirestore,
  syncOutletCashToFirestore,
} from '../firebase';
import firebaseAppConfig from '../../firebase-applet-config.json';

interface MasterAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  transactions: Transaction[];
  customers: CustomerUdhaar[];
  storeSettings: StoreSettings;
  staffAccounts?: StaffAccount[];
  outletCashBalances?: Record<string, { openingCash: number; addedCash: number }>;
  onUpdateOutletCash?: (outletId: string, openingCash: number, addedCash: number) => void;
  onReloadData?: () => Promise<void> | void;
  onOpenOutletSync?: () => void;
  onResetDailyOutletData?: (outletId: string | 'all') => void;
  onUpdateProducts: (products: Product[]) => void;
  onUpdateTransactions: (transactions: Transaction[]) => void;
  onUpdateCustomers: (customers: CustomerUdhaar[]) => void;
  onUpdateStoreSettings: (settings: StoreSettings) => void;
}

type AdminTab =
  | 'overview'
  | 'outlets'
  | 'inventory'
  | 'transactions'
  | 'udhaar'
  | 'staff'
  | 'settings'
  | 'cloud_db'
  | 'audit';

export const MasterAdminModal: React.FC<MasterAdminModalProps> = ({
  isOpen,
  onClose,
  products,
  transactions,
  customers,
  storeSettings,
  staffAccounts,
  outletCashBalances,
  onUpdateOutletCash,
  onReloadData,
  onOpenOutletSync,
  onResetDailyOutletData,
  onUpdateProducts,
  onUpdateTransactions,
  onUpdateCustomers,
  onUpdateStoreSettings,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // Outlets List & Separate Outlet Filtering & Sync state
  const outletsList = useMemo(() => {
    if (storeSettings.stores && storeSettings.stores.length > 0) {
      return storeSettings.stores;
    }
    return [
      {
        id: 'store-1',
        shopName: storeSettings.shopName || 'sy Nayab (Main)',
        shortcutName: 'SY',
        phone: storeSettings.phone || '9876543210',
        upiId: storeSettings.upiId || 'nayabmasale@upi',
        upiName: storeSettings.upiName || storeSettings.shopName || 'sy Nayab',
        address: storeSettings.address || 'Main Bazaar',
        defaultTaxRate: storeSettings.defaultTaxRate || 0,
        isDefault: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'store-2',
        shopName: 'kp Nayab',
        shortcutName: 'KP',
        phone: '9876543211',
        upiId: 'kpnayab@upi',
        upiName: 'kp Nayab',
        address: 'Market Yard Branch',
        defaultTaxRate: 0,
        isDefault: false,
        createdAt: new Date().toISOString(),
      },
    ];
  }, [storeSettings.stores, storeSettings.shopName, storeSettings.phone, storeSettings.upiId, storeSettings.upiName, storeSettings.address, storeSettings.defaultTaxRate]);

  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>(() => storeSettings.activeStoreId || 'all');
  const [isSyncingOutlet, setIsSyncingOutlet] = useState<string | null>(null);
  const [lastOutletSyncTimes, setLastOutletSyncTimes] = useState<Record<string, string>>({});
  const [liveOutlets, setLiveOutlets] = useState<StoreProfile[]>(() => storeSettings.stores || []);
  const [lastAutoSyncTime, setLastAutoSyncTime] = useState<string>(() => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  // Keep Master Admin outlet filter reactive to the active counter store
  useEffect(() => {
    if (storeSettings?.activeStoreId) {
      setSelectedOutletFilter(storeSettings.activeStoreId);
    }
  }, [storeSettings?.activeStoreId, isOpen]);

  // Automatic live sync of outlet counter data from database for Admin
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchLiveOutlets = async () => {
      try {
        const res = await fetchCentralOutlets();
        if (isMounted && res.success && Array.isArray(res.outlets) && res.outlets.length > 0) {
          setLiveOutlets(res.outlets);
          setLastAutoSyncTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }
      } catch (err) {
        console.warn('Auto-sync live outlets notice:', err);
      }
    };

    fetchLiveOutlets();
    const interval = setInterval(fetchLiveOutlets, 12000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen]);

  const isMatchingOutlet = (t: Transaction, outletId: string) => {
    if (!outletId || outletId === 'all') return true;
    const matchId = t.outletId || t.storeId;
    if (matchId) return matchId === outletId;
    // Default fallback to first outlet
    const primaryId = outletsList[0]?.id || 'store-1';
    return outletId === primaryId;
  };

  const isMatchingCustomerOutlet = (c: CustomerUdhaar, outletId: string) => {
    if (!outletId || outletId === 'all') return true;
    const matchId = c.outletId || c.storeId;
    if (matchId) return matchId === outletId;
    const primaryId = outletsList[0]?.id || 'store-1';
    return outletId === primaryId;
  };

  const handleSwitchActiveOutlet = (outlet: StoreProfile) => {
    const updatedSettings: StoreSettings = {
      ...storeSettings,
      activeStoreId: outlet.id,
      shopName: outlet.shopName,
      tagline: outlet.tagline || storeSettings.tagline || '',
      phone: outlet.phone,
      upiId: outlet.upiId,
      upiName: outlet.upiName || outlet.shopName,
      address: outlet.address,
      gstin: outlet.gstin,
      defaultTaxRate: typeof outlet.defaultTaxRate === 'number' ? outlet.defaultTaxRate : storeSettings.defaultTaxRate,
    };
    onUpdateStoreSettings(updatedSettings);
    setSelectedOutletFilter(outlet.id);
    showToast(`Active POS Counter switched to "${outlet.shopName}".`);
  };

  // Central Server & Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState<string>('Connected');
  const [serverLatency, setServerLatency] = useState<number>(12);
  const [cloudSyncMode, setCloudSyncMode] = useState<string>('central_api');
  const [serverId, setServerId] = useState<string>('faizan-inamdar');
  const [serverAdmin, setServerAdmin] = useState<string>('Faizan Inamdar');
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [toastMessage, setToastMessage] = useState<string>('');

  // Search & Filter in Inventory
  const [prodSearch, setProdSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);

  // Inline editing row in Product Master
  const [editingProdId, setEditingProdId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});

  // Add Product Modal state
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProductForm, setNewProductForm] = useState<Partial<Product>>({
    name: '',
    hindiName: '',
    category: 'spices',
    unit: 'kg',
    rate: 100,
    costPrice: 80,
    stock: 20,
    minStockAlert: 5,
    barcode: '',
  });

  // Bulk Price Adjust Modal state
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);
  const [bulkCategory, setBulkCategory] = useState<string>('all');
  const [bulkPercent, setBulkPercent] = useState<number>(5);
  const [bulkOffset, setBulkOffset] = useState<number>(0);
  const [bulkRounding, setBulkRounding] = useState<'integer' | 'half' | 'none'>('integer');

  // Transactions Master state
  const [txSearch, setTxSearch] = useState('');
  const [txModeFilter, setTxModeFilter] = useState<'all' | 'cash' | 'online_upi' | 'credit_udhaar' | 'expense'>('all');
  const [selectedTxDetail, setSelectedTxDetail] = useState<Transaction | null>(null);
  const [voidReasonInput, setVoidReasonInput] = useState('');
  const [showVoidModal, setShowVoidModal] = useState(false);

  // Udhaar Master state
  const [udhaarSearch, setUdhaarSearch] = useState('');
  const [jamaAmount, setJamaAmount] = useState<number>(0);
  const [selectedUdhaarCust, setSelectedUdhaarCust] = useState<CustomerUdhaar | null>(null);

  // Staff Master state
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [staffForm, setStaffForm] = useState<Partial<StaffAccount>>({
    name: '',
    role: 'cashier',
    pin: '',
    phone: '',
    active: true,
  });

  // Cloud DB Config state
  const [firebaseProjectId, setFirebaseProjectId] = useState<string>(firebaseAppConfig?.projectId || '');
  const [firebaseApiKey, setFirebaseApiKey] = useState<string>(firebaseAppConfig?.apiKey || '');
  const [firebaseDbId, setFirebaseDbId] = useState<string>(firebaseAppConfig?.firestoreDatabaseId || '(default)');
  const [confirmResetText, setConfirmResetText] = useState<string>('');
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [isPushingToFirestore, setIsPushingToFirestore] = useState<boolean>(false);
  const [isPullingFromFirestore, setIsPullingFromFirestore] = useState<boolean>(false);
  const [firestorePingStatus, setFirestorePingStatus] = useState<string | null>(null);

  // Online Outlets Management State (Client-Server Remote Admin)
  const [showOutletModal, setShowOutletModal] = useState<boolean>(false);
  const [editingOutlet, setEditingOutlet] = useState<StoreProfile | null>(null);
  const [outletForm, setOutletForm] = useState<Partial<StoreProfile>>({
    shopName: '',
    shortcutName: '',
    tagline: 'Authentic Indian Spices & Daily Groceries',
    phone: '',
    upiId: 'nayabmasale@upi',
    upiName: '',
    address: '',
    gstin: '',
    defaultTaxRate: 0,
    isDefault: false,
    active: true,
  });
  const [assignedStaffForOutlet, setAssignedStaffForOutlet] = useState<string[]>([]);
  const [isSavingOutlet, setIsSavingOutlet] = useState<boolean>(false);
  const [isLoadingOutlets, setIsLoadingOutlets] = useState<boolean>(false);
  const [viewingOutletDetails, setViewingOutletDetails] = useState<any | null>(null);
  const [isLoadingOutletDetails, setIsLoadingOutletDetails] = useState<boolean>(false);
  const [outletSearch, setOutletSearch] = useState<string>('');

  // Cash Float Management (Opening & Added Cash Synced with Database)
  const [cashEditOutlet, setCashEditOutlet] = useState<StoreProfile | null>(null);
  const [cashEditForm, setCashEditForm] = useState<{
    openingCash: number;
    addedCash: number;
    amountToAdd: number;
    mode: 'set' | 'add';
  }>({
    openingCash: 0,
    addedCash: 0,
    amountToAdd: 0,
    mode: 'set',
  });
  const [isSavingCash, setIsSavingCash] = useState<boolean>(false);

  // Toast notification helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Poll central DB status, outlets cash balances, and audit logs on mount
  useEffect(() => {
    if (!isOpen) return;

    const fetchStatus = async () => {
      const res = await checkCentralStatus();
      setServerLatency(res.latencyMs);
      if (res.connected) {
        setSyncStatusText('Connected');
        setCloudSyncMode(res.status.cloudSyncMode || 'central_api');
        if (res.status.serverId) setServerId(res.status.serverId);
        if (res.status.serverAdmin) setServerAdmin(res.status.serverAdmin);
      } else {
        setSyncStatusText('Offline / Standalone');
      }
      const logs = await fetchCentralAuditLogs(60);
      setAuditLogs(logs);

      // Live fetch & sync outlet opening & added cash balances from Central DB
      try {
        const outRes = await fetchCentralOutlets();
        if (outRes.success && Array.isArray(outRes.outlets) && outRes.outlets.length > 0) {
          onUpdateStoreSettings({
            ...storeSettings,
            stores: outRes.outlets,
          });
        }
      } catch (e) {
        console.warn('Central outlets cash auto-sync error:', e);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Master Synchronize Now button
  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncStatusText('Syncing with Central Server...');
    try {
      // 1. Push local changes to server
      const pushRes = await pushCentralSync({
        products,
        transactions,
        customers,
        settings: storeSettings,
        staff: storeSettings.staffAccounts,
        performedBy: 'Master Admin Portal',
      });

      if (pushRes.success && pushRes.snapshot) {
        if (Array.isArray(pushRes.snapshot.products) && pushRes.snapshot.products.length > 0) {
          onUpdateProducts(pushRes.snapshot.products);
        }
        if (Array.isArray(pushRes.snapshot.transactions)) {
          onUpdateTransactions(pushRes.snapshot.transactions);
        }
        if (Array.isArray(pushRes.snapshot.customers)) {
          onUpdateCustomers(pushRes.snapshot.customers);
        }
        if (pushRes.snapshot.settings) {
          onUpdateStoreSettings({
            ...storeSettings,
            ...pushRes.snapshot.settings,
            activeStoreId: storeSettings.activeStoreId || pushRes.snapshot.settings.activeStoreId || 'store-1',
          });
        }
        setSyncStatusText('Central Database Synchronized');
        showToast('Successfully synchronized with Central Cloud Database!');
      } else {
        // Fallback: pull
        const pullRes = await pullCentralSnapshot();
        if (pullRes.success && pullRes.snapshot) {
          if (pullRes.snapshot.products) onUpdateProducts(pullRes.snapshot.products);
          if (pullRes.snapshot.transactions) onUpdateTransactions(pullRes.snapshot.transactions);
          if (pullRes.snapshot.customers) onUpdateCustomers(pullRes.snapshot.customers);
          showToast('Pulled latest snapshot from central server');
        }
      }

      const logs = await fetchCentralAuditLogs(60);
      setAuditLogs(logs);
    } catch (err: any) {
      setSyncStatusText('Sync Failed');
      showToast(`Sync error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Sync a specific outlet separately
  const handleSyncOutletSeparately = async (outletId: string) => {
    setIsSyncingOutlet(outletId);
    const targetOutlet = outletsList.find((o) => o.id === outletId);
    const outletLabel = targetOutlet?.shopName || outletId;

    try {
      // Isolate transactions and customers for this specific outlet
      const outletTxs = transactions.filter((t) => isMatchingOutlet(t, outletId));
      const outletCusts = customers.filter((c) => isMatchingCustomerOutlet(c, outletId));

      const pushRes = await pushCentralSync({
        products,
        transactions: outletTxs,
        customers: outletCusts,
        settings: storeSettings,
        staff: storeSettings.staffAccounts,
        performedBy: `Master Admin (Outlet Sync: ${outletLabel})`,
        outletId,
      });

      setLastOutletSyncTimes((prev) => ({
        ...prev,
        [outletId]: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      }));

      if (pushRes.success && pushRes.snapshot) {
        if (Array.isArray(pushRes.snapshot.products) && pushRes.snapshot.products.length > 0) {
          onUpdateProducts(pushRes.snapshot.products);
        }
        if (Array.isArray(pushRes.snapshot.transactions)) {
          const otherOutletTxs = transactions.filter((t) => !isMatchingOutlet(t, outletId));
          const snapshotIds = new Set(pushRes.snapshot.transactions.map((t) => t.id));
          onUpdateTransactions([
            ...pushRes.snapshot.transactions,
            ...otherOutletTxs.filter((t) => !snapshotIds.has(t.id)),
          ]);
        }
        if (Array.isArray(pushRes.snapshot.customers)) {
          const otherOutletCusts = customers.filter((c) => !isMatchingCustomerOutlet(c, outletId));
          const snapshotCustIds = new Set(pushRes.snapshot.customers.map((c) => c.id));
          onUpdateCustomers([
            ...pushRes.snapshot.customers,
            ...otherOutletCusts.filter((c) => !snapshotCustIds.has(c.id)),
          ]);
        }
      } else {
        const pullRes = await pullCentralSnapshot();
        if (pullRes.success && pullRes.snapshot) {
          if (pullRes.snapshot.products) onUpdateProducts(pullRes.snapshot.products);
          if (pullRes.snapshot.transactions) onUpdateTransactions(pullRes.snapshot.transactions);
          if (pullRes.snapshot.customers) onUpdateCustomers(pullRes.snapshot.customers);
        }
      }

      const logs = await fetchCentralAuditLogs(60);
      setAuditLogs(logs);
      showToast(`Successfully synchronized data for outlet: ${outletLabel} separately!`);
    } catch (err: any) {
      showToast(`Sync error for ${outletLabel}: ${err.message}`);
    } finally {
      setIsSyncingOutlet(null);
    }
  };

  // -------------------------------------------------------------
  // Outlets Management Handlers (Client-Server Architecture)
  // -------------------------------------------------------------
  const handleOpenAddOutlet = () => {
    setEditingOutlet(null);
    setOutletForm({
      id: `store-${Date.now()}`,
      shopName: '',
      shortcutName: '',
      tagline: 'Authentic Indian Spices & Daily Groceries',
      phone: storeSettings.phone || '9876543210',
      upiId: 'nayabmasale@upi',
      upiName: '',
      gstin: '',
      address: '',
      defaultTaxRate: 0,
      isDefault: false,
      active: true,
    });
    setAssignedStaffForOutlet([]);
    setShowOutletModal(true);
  };

  const handleOpenEditOutlet = (outlet: StoreProfile) => {
    setEditingOutlet(outlet);
    setOutletForm({ ...outlet });
    const currentStaff = staffAccounts || storeSettings.staffAccounts || [];
    const assignedIds = currentStaff
      .filter((s) => s.assignedOutletIds && s.assignedOutletIds.includes(outlet.id))
      .map((s) => s.id);
    setAssignedStaffForOutlet(assignedIds);
    setShowOutletModal(true);
  };

  const handleSaveOutletSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outletForm.shopName || !outletForm.shopName.trim()) {
      showToast('Store / Outlet Name is required');
      return;
    }

    setIsSavingOutlet(true);
    try {
      const outletToSave: StoreProfile = {
        id: outletForm.id || (editingOutlet ? editingOutlet.id : `store-${Date.now()}`),
        shopName: outletForm.shopName.trim(),
        shortcutName: outletForm.shortcutName?.trim() || outletForm.shopName.trim().slice(0, 2).toUpperCase(),
        tagline: outletForm.tagline?.trim() || 'Authentic Indian Spices & Daily Groceries',
        phone: outletForm.phone?.trim() || '9876543210',
        upiId: outletForm.upiId?.trim() || 'nayabmasale@upi',
        upiName: outletForm.upiName?.trim() || outletForm.shopName.trim(),
        gstin: outletForm.gstin?.trim() || '',
        address: outletForm.address?.trim() || '',
        defaultTaxRate: Number(outletForm.defaultTaxRate) || 0,
        createdAt: editingOutlet?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDefault: Boolean(outletForm.isDefault),
        isPrimary: Boolean(editingOutlet?.isPrimary),
        active: outletForm.active !== false,
      };

      // 1. Save to Central Server via Client-Server REST API
      const saveRes = await saveCentralOutlet(outletToSave, 'Admin Owner Online');
      if (!saveRes.success) {
        throw new Error(saveRes.error || 'Server rejected outlet update');
      }

      // 2. Also sync to Firestore Cloud database if configured
      try {
        await syncOutletToFirestore(outletToSave);
      } catch (fErr) {
        console.warn('Firestore cloud outlet sync skipped:', fErr);
      }

      // 3. Update staff assignments if changed
      const currentStaff = staffAccounts || storeSettings.staffAccounts || [];
      const updatedStaff = currentStaff.map((st) => {
        const isAssigned = assignedStaffForOutlet.includes(st.id);
        const existingOutlets = st.assignedOutletIds || ['store-1', 'store-2'];
        let newOutlets: string[];
        if (isAssigned) {
          newOutlets = Array.from(new Set([...existingOutlets, outletToSave.id]));
        } else {
          newOutlets = existingOutlets.filter((id) => id !== outletToSave.id);
        }
        return {
          ...st,
          assignedOutletIds: newOutlets,
        };
      });

      try {
        await updateCentralStaff(updatedStaff, 'Admin Owner Online');
      } catch (stErr) {
        console.warn('Central staff sync note:', stErr);
      }

      // 4. Update local settings state
      const existingStores = storeSettings.stores || outletsList;
      let newStores: StoreProfile[];
      if (editingOutlet) {
        newStores = existingStores.map((s) =>
          s.id === outletToSave.id ? outletToSave : outletToSave.isDefault ? { ...s, isDefault: false } : s
        );
      } else {
        newStores = [...existingStores, outletToSave];
      }

      const updatedSettings: StoreSettings = {
        ...storeSettings,
        stores: newStores,
        staffAccounts: updatedStaff,
        ...(outletToSave.isDefault
          ? {
              shopName: outletToSave.shopName,
              phone: outletToSave.phone,
              upiId: outletToSave.upiId,
              upiName: outletToSave.upiName,
              address: outletToSave.address,
              defaultTaxRate: outletToSave.defaultTaxRate,
            }
          : {}),
      };

      onUpdateStoreSettings(updatedSettings);

      // 5. Log audit
      const logs = await fetchCentralAuditLogs(60);
      setAuditLogs(logs);

      setShowOutletModal(false);
      showToast(`Outlet "${outletToSave.shopName}" saved online to central server successfully!`);
    } catch (err: any) {
      showToast(`Failed to save outlet: ${err.message}`);
    } finally {
      setIsSavingOutlet(false);
    }
  };

  const handleDeleteOutletClick = async (outlet: StoreProfile) => {
    if (outletsList.length <= 1) {
      showToast('Cannot delete the only store outlet. At least one outlet must remain.');
      return;
    }
    if (outlet.isPrimary) {
      showToast('Cannot delete Primary HQ outlet.');
      return;
    }
    if (
      !window.confirm(
        `Are you sure you want to delete outlet "${outlet.shopName}" from the central server? This will remove it across all devices online.`
      )
    ) {
      return;
    }

    try {
      const delRes = await deleteCentralOutlet(outlet.id, 'Admin Owner Online');
      if (!delRes.success) {
        throw new Error(delRes.error || 'Server failed to delete outlet');
      }

      try {
        await deleteOutletFromFirestore(outlet.id);
      } catch (fErr) {
        console.warn('Firestore cloud delete skipped:', fErr);
      }

      const remaining = outletsList.filter((o) => o.id !== outlet.id);
      if (outlet.isDefault && remaining.length > 0) {
        remaining[0].isDefault = true;
      }

      const updatedSettings: StoreSettings = {
        ...storeSettings,
        stores: remaining,
        activeStoreId:
          storeSettings.activeStoreId === outlet.id ? remaining[0].id : storeSettings.activeStoreId,
      };
      onUpdateStoreSettings(updatedSettings);

      const logs = await fetchCentralAuditLogs(60);
      setAuditLogs(logs);

      showToast(`Outlet "${outlet.shopName}" deleted successfully from central server.`);
    } catch (err: any) {
      showToast(`Error deleting outlet: ${err.message}`);
    }
  };

  const handleRefreshOutletsOnline = async () => {
    setIsLoadingOutlets(true);
    try {
      const res = await fetchCentralOutlets();
      if (res.success && Array.isArray(res.outlets) && res.outlets.length > 0) {
        setLiveOutlets(res.outlets);
        setLastAutoSyncTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        onUpdateStoreSettings({
          ...storeSettings,
          stores: res.outlets,
        });
        showToast(`Synchronized ${res.outlets.length} outlet(s) live from central server!`);
      } else {
        const firestoreOutlets = await fetchOutletsFromFirestore();
        if (firestoreOutlets && firestoreOutlets.length > 0) {
          setLiveOutlets(firestoreOutlets);
          setLastAutoSyncTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
          onUpdateStoreSettings({
            ...storeSettings,
            stores: firestoreOutlets,
          });
          showToast(`Synchronized ${firestoreOutlets.length} outlet(s) from Firestore Cloud!`);
        } else {
          showToast('Outlets are already up to date with server');
        }
      }
    } catch (err: any) {
      showToast(`Refresh failed: ${err.message}`);
    } finally {
      setIsLoadingOutlets(false);
    }
  };

  const handleResetOutletDaily = async (targetOutletId: string | 'all') => {
    const targetName =
      targetOutletId === 'all'
        ? 'ALL Outlets'
        : outletsList.find((o) => o.id === targetOutletId)?.shopName || targetOutletId;
    if (
      !window.confirm(
        `Reset today's daily operations (Sales, Expenses & Added Cash) for ${targetName} to ₹0?\n\nThis zeroes out today's transactions for the selected outlet for a clean start.`
      )
    ) {
      return;
    }

    try {
      if (onResetDailyOutletData) {
        onResetDailyOutletData(targetOutletId);
      }
      const res = await resetDailyOutletData(targetOutletId, 'Master Admin');
      if (!res.success) {
        throw new Error(res.error || 'Server reset failed');
      }
      showToast(`Daily data for ${targetName} successfully reset to ₹0!`);
      if (onReloadData) {
        await onReloadData();
      }
    } catch (err: any) {
      showToast(`Reset failed: ${err.message}`);
    }
  };

  const handleViewOutletDeepDive = async (outletId: string) => {
    setIsLoadingOutletDetails(true);
    try {
      const data = await fetchCentralOutletData(outletId);
      if (data.success) {
        setViewingOutletDetails(data);
      } else {
        showToast(`Could not load live breakdown: ${data.error}`);
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setIsLoadingOutletDetails(false);
    }
  };

  const handleOpenCashEdit = (outlet: StoreProfile) => {
    setCashEditOutlet(outlet);
    setCashEditForm({
      openingCash: typeof outlet.openingCash === 'number' ? outlet.openingCash : 0,
      addedCash: typeof outlet.addedCash === 'number' ? outlet.addedCash : 0,
      amountToAdd: 0,
      mode: 'set',
    });
  };

  const handleSaveCashEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashEditOutlet) return;
    setIsSavingCash(true);
    try {
      let finalOpening = Number(cashEditForm.openingCash) || 0;
      let finalAdded = Number(cashEditForm.addedCash) || 0;
      if (cashEditForm.mode === 'add') {
        finalAdded += Number(cashEditForm.amountToAdd) || 0;
      }

      // 1. Sync to Central Server DB
      const res = await syncOutletCash(cashEditOutlet.id, {
        openingCash: finalOpening,
        addedCash: finalAdded,
        mode: 'set',
        actor: 'Master Admin Remote',
      });
      if (!res.success) {
        throw new Error(res.error || 'Server cash sync failed');
      }

      // 2. Sync to Cloud Firestore
      await syncOutletCashToFirestore(cashEditOutlet.id, {
        openingCash: finalOpening,
        addedCash: finalAdded,
        date: todayDateStr,
      }).catch(console.warn);

      // 3. Update local state
      onUpdateOutletCash?.(cashEditOutlet.id, finalOpening, finalAdded);

      const updatedStores = outletsList.map((st) =>
        st.id === cashEditOutlet.id
          ? {
              ...st,
              openingCash: finalOpening,
              addedCash: finalAdded,
              cashInHand: res.cashInHand ?? Math.max(0, finalOpening + finalAdded + (st.cashSales || 0) - (st.todayExpenses || 0)),
            }
          : st
      );

      onUpdateStoreSettings({
        ...storeSettings,
        stores: updatedStores,
        ...(storeSettings.activeStoreId === cashEditOutlet.id
          ? { openingAmount: finalOpening, addedCash: finalAdded }
          : {}),
      });

      showToast(`Cash float synced for ${cashEditOutlet.shopName} (Opening: ₹${finalOpening.toLocaleString('en-IN')}, Added: ₹${finalAdded.toLocaleString('en-IN')})`);
      setCashEditOutlet(null);
      // Refresh outlets list from server
      handleRefreshOutletsOnline();
    } catch (err: any) {
      showToast(`Cash sync error: ${err.message}`);
    } finally {
      setIsSavingCash(false);
    }
  };

  // -------------------------------------------------------------
  // Overview Calculations
  // -------------------------------------------------------------
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const todayTransactions = useMemo(() => {
    return transactions.filter(
      (t) => !t.voided && (t.timestamp || '').startsWith(todayDateStr) && isMatchingOutlet(t, selectedOutletFilter)
    );
  }, [transactions, todayDateStr, selectedOutletFilter]);

  const todayRevenue = useMemo(() => {
    return todayTransactions
      .filter((t) => t.type === 'sale')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [todayTransactions]);

  const todayExpenses = useMemo(() => {
    return todayTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [todayTransactions]);

  const totalOutstandingUdhaar = useMemo(() => {
    return customers
      .filter((c) => isMatchingCustomerOutlet(c, selectedOutletFilter))
      .reduce((sum, c) => sum + (c.totalDue || 0), 0);
  }, [customers, selectedOutletFilter]);

  const totalStockValuation = useMemo(() => {
    return products.reduce((sum, p) => {
      const cost = p.costPrice || p.rate * 0.75;
      const stock = p.stock || 0;
      return sum + cost * stock;
    }, 0);
  }, [products]);

  const totalRetailValuation = useMemo(() => {
    return products.reduce((sum, p) => sum + (p.rate || 0) * (p.stock || 0), 0);
  }, [products]);

  const estimatedGrossProfitMargin = useMemo(() => {
    if (totalRetailValuation <= 0) return 0;
    const profit = totalRetailValuation - totalStockValuation;
    return Math.round((profit / totalRetailValuation) * 100);
  }, [totalRetailValuation, totalStockValuation]);

  const lowStockCount = useMemo(() => {
    return products.filter((p) => (p.stock ?? 0) <= (p.minStockAlert ?? 10)).length;
  }, [products]);

  // -------------------------------------------------------------
  // Filtered Inventory List
  // -------------------------------------------------------------
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !prodSearch ||
        p.name.toLowerCase().includes(prodSearch.toLowerCase()) ||
        (p.hindiName && p.hindiName.includes(prodSearch)) ||
        (p.barcode && p.barcode.includes(prodSearch));
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      const matchLowStock = !filterLowStockOnly || (p.stock ?? 0) <= (p.minStockAlert ?? 10);
      return matchSearch && matchCat && matchLowStock;
    });
  }, [products, prodSearch, selectedCategory, filterLowStockOnly]);

  // Handle start inline edit
  const handleStartInlineEdit = (prod: Product) => {
    setEditingProdId(prod.id);
    setEditForm({ ...prod });
  };

  // Handle save inline edit
  const handleSaveInlineEdit = async (prodId: string) => {
    const original = products.find((p) => p.id === prodId);
    if (!original) return;
    const updated: Product = {
      ...original,
      ...editForm,
      rate: Number(editForm.rate) || original.rate,
      costPrice: editForm.costPrice !== undefined ? Number(editForm.costPrice) : original.costPrice,
      stock: editForm.stock !== undefined ? Number(editForm.stock) : original.stock,
      minStockAlert: editForm.minStockAlert !== undefined ? Number(editForm.minStockAlert) : original.minStockAlert,
      updatedAt: new Date().toISOString(),
    };

    const newProducts = products.map((p) => (p.id === prodId ? updated : p));
    onUpdateProducts(newProducts);
    setEditingProdId(null);
    setEditForm({});

    // Save to central server
    await saveCentralProduct(updated, 'Master Admin');
    showToast(`Saved changes for ${updated.name}`);
  };

  // Handle Delete Product
  const handleDeleteProduct = async (prodId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently remove "${name}" from the central catalogue?`)) {
      return;
    }
    const newProducts = products.filter((p) => p.id !== prodId);
    onUpdateProducts(newProducts);
    await deleteCentralProduct(prodId, 'Master Admin');
    showToast(`Deleted ${name} from central catalog`);
  };

  // Handle Add New Product
  const handleAddNewProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductForm.name || !newProductForm.name.trim()) {
      alert('Product name is required');
      return;
    }

    const prodId = `prod-${Date.now()}`;
    const newProd: Product = {
      id: prodId,
      name: newProductForm.name.trim(),
      hindiName: newProductForm.hindiName?.trim() || undefined,
      category: (newProductForm.category as ProductCategory) || 'general',
      unit: (newProductForm.unit as UnitType) || 'kg',
      rate: Number(newProductForm.rate) || 100,
      costPrice: Number(newProductForm.costPrice) || 80,
      stock: Number(newProductForm.stock) || 0,
      minStockAlert: Number(newProductForm.minStockAlert) || 5,
      barcode: newProductForm.barcode?.trim() || undefined,
      popular: false,
      updatedAt: new Date().toISOString(),
    };

    const newProducts = [newProd, ...products];
    onUpdateProducts(newProducts);
    await saveCentralProduct(newProd, 'Master Admin');

    setShowAddProductModal(false);
    setNewProductForm({
      name: '',
      hindiName: '',
      category: 'spices',
      unit: 'kg',
      rate: 100,
      costPrice: 80,
      stock: 20,
      minStockAlert: 5,
      barcode: '',
    });
    showToast(`Added new product: ${newProd.name}`);
  };

  // Handle Bulk Price Adjustment
  const handleApplyBulkPriceAdjust = async () => {
    const res = await bulkAdjustCentralRates({
      category: bulkCategory,
      percentageChange: bulkPercent,
      fixedOffset: bulkOffset,
      rounding: bulkRounding,
      actor: 'Master Admin',
    });

    if (res.success && res.updatedProducts) {
      const updatedMap = new Map(res.updatedProducts.map((p) => [p.id, p]));
      const newProducts = products.map((p) => updatedMap.get(p.id) || p);
      onUpdateProducts(newProducts);
      showToast(`Updated rates for ${res.count} product(s) in bulk!`);
      setShowBulkPriceModal(false);
    } else {
      showToast(`Bulk update failed: ${res.error}`);
    }
  };

  // -------------------------------------------------------------
  // Transactions Master Actions
  // -------------------------------------------------------------
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchSearch =
        !txSearch ||
        (t.receiptNumber && t.receiptNumber.toLowerCase().includes(txSearch.toLowerCase())) ||
        (t.customerName && t.customerName.toLowerCase().includes(txSearch.toLowerCase())) ||
        (t.staffName && t.staffName.toLowerCase().includes(txSearch.toLowerCase()));
      const matchMode =
        txModeFilter === 'all' ||
        (txModeFilter === 'expense' ? t.type === 'expense' : t.type === 'sale' && t.paymentMode === txModeFilter);
      const matchOutlet = isMatchingOutlet(t, selectedOutletFilter);
      return matchSearch && matchMode && matchOutlet;
    });
  }, [transactions, txSearch, txModeFilter, selectedOutletFilter]);

  const handleConfirmVoid = async () => {
    if (!selectedTxDetail) return;
    const reason = voidReasonInput.trim() || 'Voided by Master Admin';
    await voidCentralTransaction(selectedTxDetail.id, reason, 'Master Admin');

    const newTxs = transactions.map((t) =>
      t.id === selectedTxDetail.id ? { ...t, voided: true, voidReason: reason } : t
    );
    onUpdateTransactions(newTxs);
    setShowVoidModal(false);
    setSelectedTxDetail(null);
    setVoidReasonInput('');
    showToast(`Bill #${selectedTxDetail.receiptNumber} marked as VOID`);
  };

  // -------------------------------------------------------------
  // Udhaar Master Actions
  // -------------------------------------------------------------
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchSearch =
        !udhaarSearch ||
        c.name.toLowerCase().includes(udhaarSearch.toLowerCase()) ||
        c.phone.includes(udhaarSearch);
      const matchOutlet = isMatchingCustomerOutlet(c, selectedOutletFilter);
      return matchSearch && matchOutlet;
    });
  }, [customers, udhaarSearch, selectedOutletFilter]);

  const handleSettleJama = (cust: CustomerUdhaar) => {
    if (jamaAmount <= 0) {
      alert('Please enter valid settlement amount');
      return;
    }
    const updatedDue = Math.max(0, cust.totalDue - jamaAmount);
    const newCustomers = customers.map((c) =>
      c.id === cust.id ? { ...c, totalDue: updatedDue, lastActive: new Date().toISOString() } : c
    );
    onUpdateCustomers(newCustomers);

    // Record receipt transaction
    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      receiptNumber: `JAMA-${Date.now().toString().slice(-5)}`,
      type: 'sale',
      amount: jamaAmount,
      paymentMode: 'cash',
      customerName: cust.name,
      customerPhone: cust.phone,
      customerId: cust.id,
      remarks: `Master Admin Jama Settlement: ₹${jamaAmount} received`,
      timestamp: new Date().toISOString(),
      staffName: 'Master Admin',
    };
    onUpdateTransactions([newTx, ...transactions]);

    setSelectedUdhaarCust(null);
    setJamaAmount(0);
    showToast(`Recorded Jama of ₹${jamaAmount} for ${cust.name}`);
  };

  // -------------------------------------------------------------
  // Staff Master Actions
  // -------------------------------------------------------------
  const handleSaveNewStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.name || !staffForm.pin) {
      alert('Staff name and PIN are required');
      return;
    }
    const newStaff: StaffAccount = {
      id: `staff-${Date.now()}`,
      name: staffForm.name.trim(),
      role: (staffForm.role as any) || 'cashier',
      pin: staffForm.pin.trim(),
      phone: staffForm.phone?.trim() || undefined,
      active: staffForm.active ?? true,
      createdAt: new Date().toISOString(),
      permissions: {
        canEditProducts: staffForm.role === 'master_admin' || staffForm.role === 'owner',
        canViewReports: staffForm.role === 'master_admin' || staffForm.role === 'owner' || staffForm.role === 'manager',
        canManageUdhaar: true,
        canVoidBills: staffForm.role === 'master_admin' || staffForm.role === 'owner',
        canAccessMasterAdmin: staffForm.role === 'master_admin',
      },
    };

    const currentStaffList = staffAccounts || storeSettings?.staffAccounts || [];
    const updatedStaffList = [...currentStaffList, newStaff];
    if (storeSettings && onUpdateStoreSettings) {
      onUpdateStoreSettings({ ...storeSettings, staffAccounts: updatedStaffList });
    }
    await updateCentralStaff(updatedStaffList, 'Master Admin');
    if (onReloadData) await onReloadData();

    setShowAddStaffModal(false);
    setStaffForm({ name: '', role: 'cashier', pin: '', phone: '', active: true });
    showToast(`Added staff account: ${newStaff.name}`);
  };

  const handleToggleStaffActive = async (staffId: string) => {
    const currentStaffList = staffAccounts || storeSettings?.staffAccounts || [];
    const updatedStaff = currentStaffList.map((s) =>
      s.id === staffId ? { ...s, active: !s.active } : s
    );
    if (storeSettings && onUpdateStoreSettings) {
      onUpdateStoreSettings({ ...storeSettings, staffAccounts: updatedStaff });
    }
    await updateCentralStaff(updatedStaff, 'Master Admin');
    if (onReloadData) await onReloadData();
    showToast('Updated staff active status');
  };

  // -------------------------------------------------------------
  // Cloud Database & Backup Controls
  // -------------------------------------------------------------
  const handleExportFullDatabaseJson = () => {
    const backupSnapshot = {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      exportedBy: 'Master Admin',
      data: {
        products,
        transactions,
        customers,
        storeSettings,
        staff: storeSettings.staffAccounts,
        auditLogs,
      },
    };

    const blob = new Blob([JSON.stringify(backupSnapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nayab_master_cloud_db_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded Central Database JSON Backup');
  };

  const handleImportDatabaseJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await restoreCentralDatabase(parsed, 'Master Admin');
      if (res.success && res.snapshot) {
        onUpdateProducts(res.snapshot.products || []);
        onUpdateTransactions(res.snapshot.transactions || []);
        onUpdateCustomers(res.snapshot.customers || []);
        if (res.snapshot.settings) onUpdateStoreSettings(res.snapshot.settings);
        showToast('Successfully restored Central Database from file!');
      } else {
        alert('Invalid database snapshot JSON file');
      }
    } catch (err: any) {
      alert(`Failed to import JSON: ${err.message}`);
    }
  };

  const handleExecuteFactoryReset = async () => {
    if (confirmResetText !== 'RESET_NAYAB_CENTRAL_DB') {
      alert('Confirmation phrase does not match exactly.');
      return;
    }
    const res = await resetCentralDatabase(confirmResetText, 'Master Admin');
    if (res.success && res.snapshot) {
      onUpdateProducts(res.snapshot.products || []);
      onUpdateTransactions(res.snapshot.transactions || []);
      onUpdateCustomers(res.snapshot.customers || []);
      if (res.snapshot.settings) onUpdateStoreSettings(res.snapshot.settings);
      setShowResetConfirmModal(false);
      setConfirmResetText('');
      showToast('Database reset to factory catalog defaults');
    }
  };

  const handleSaveCloudConfig = async () => {
    const res = await updateCentralCloudConfig({
      cloudSyncMode: cloudSyncMode as any,
      firebaseConfig: {
        projectId: firebaseProjectId.trim() || undefined,
        apiKey: firebaseApiKey.trim() || undefined,
        firestoreDatabaseId: firebaseDbId.trim() || undefined,
        autoSyncToCloud: true,
      },
      actor: 'Master Admin',
    });
    if (res.success) {
      showToast('Cloud Database & Firestore configuration saved successfully!');
    }
  };

  const handlePushAllToFirestore = async () => {
    setIsPushingToFirestore(true);
    try {
      const count = await syncCatalogToFirestore(products);
      showToast(`Successfully uploaded ${count} products to Firebase Firestore!`);
    } catch (err: any) {
      showToast(`Firestore write error: ${err.message}`);
    } finally {
      setIsPushingToFirestore(false);
    }
  };

  const handlePullFromFirestore = async () => {
    setIsPullingFromFirestore(true);
    try {
      const cloudProducts = await fetchProductsFromFirestore();
      if (cloudProducts && cloudProducts.length > 0) {
        onUpdateProducts(cloudProducts);
        showToast(`Pulled ${cloudProducts.length} items from Firebase Firestore!`);
      } else {
        showToast('Firestore products collection is empty.');
      }
    } catch (err: any) {
      showToast(`Firestore pull error: ${err.message}`);
    } finally {
      setIsPullingFromFirestore(false);
    }
  };

  const handleTestFirestorePing = async () => {
    setFirestorePingStatus('Checking Firestore...');
    try {
      const connected = await testFirestoreConnection();
      if (connected) {
        setFirestorePingStatus('Active & Online');
        showToast('Firebase Firestore connection verified successfully!');
      } else {
        setFirestorePingStatus('Unavailable');
      }
    } catch (e) {
      setFirestorePingStatus('Connection error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-hidden">
      <div className="relative w-full max-w-7xl h-[92vh] max-h-[920px] bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Toast Alert Banner */}
        {toastMessage && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-500 text-slate-950 font-bold text-xs sm:text-sm rounded-full shadow-lg flex items-center gap-2 animate-bounce">
            <CheckCircle2 className="w-4 h-4" />
            {toastMessage}
          </div>
        )}

        {/* Master Admin Header */}
        <header className="px-4 py-3 sm:px-6 sm:py-4 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 rounded-2xl shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                  NAYAB MASTER ADMIN & CENTRAL DATABASE
                </h1>
                <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Full Authority
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Centralized Multi-Terminal Server &bull; Live Cloud Sync &bull; Full Catalog & Khata Control
              </p>
            </div>
          </div>

          {/* Telemetry Status Bar */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Live DB connection pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700 text-xs">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="font-semibold text-emerald-400">{syncStatusText}</span>
              <span className="text-slate-500 text-[10px]">({serverLatency}ms)</span>
            </div>

            {/* Sync Now Button */}
            <button
              onClick={handleTriggerSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition-all disabled:opacity-50 shadow-sm"
              title="Push local mutations to central server and pull latest updates"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Cloud'}</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
              title="Close Master Admin"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Navigation Tabs Bar */}
        <nav className="px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all ${
              activeTab === 'overview'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Telemetry & Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('outlets')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all ${
              activeTab === 'outlets'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Outlets & Branches ({outletsList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all ${
              activeTab === 'inventory'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Product Master ({products.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all ${
              activeTab === 'transactions'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Invoices & Sales ({transactions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('udhaar')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all ${
              activeTab === 'udhaar'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Udhaar Khata (₹{totalOutstandingUdhaar.toLocaleString('en-IN')})</span>
          </button>

          <button
            onClick={() => setActiveTab('staff')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all ${
              activeTab === 'staff'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Staff & Multi-Terminal</span>
          </button>

          <button
            onClick={() => setActiveTab('cloud_db')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all ${
              activeTab === 'cloud_db'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Cloud DB & Firebase</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all ${
              activeTab === 'audit'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Audit Trail</span>
          </button>

          {/* Outlet Selector & Separate Sync Bar */}
          <div className="ml-auto flex items-center gap-2 pl-2 border-l border-slate-800 shrink-0">
            <span className="text-[11px] text-slate-400 font-semibold hidden md:inline">Outlet:</span>
            <select
              value={selectedOutletFilter}
              onChange={(e) => setSelectedOutletFilter(e.target.value)}
              className="bg-slate-950 border border-amber-500/40 text-amber-300 text-xs font-bold rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="all">🌐 All Outlets (सभी शाखाएं)</option>
              {outletsList.map((st) => (
                <option key={st.id} value={st.id}>
                  🏪 {st.shopName} {st.shortcutName ? `(${st.shortcutName})` : ''}
                </option>
              ))}
            </select>

            {selectedOutletFilter !== 'all' && (
              <button
                onClick={() => handleSyncOutletSeparately(selectedOutletFilter)}
                disabled={isSyncingOutlet === selectedOutletFilter}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                title="Sync this outlet data separately to central server"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncingOutlet === selectedOutletFilter ? 'animate-spin' : ''}`} />
                <span>{isSyncingOutlet === selectedOutletFilter ? 'Syncing...' : 'Sync Outlet Separately'}</span>
              </button>
            )}
          </div>
        </nav>

        {/* Tab Content Body */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* TAB 1: OVERVIEW & TELEMETRY */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Active Outlet Filter Banner */}
              {selectedOutletFilter !== 'all' && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-2.5 text-xs text-amber-300">
                    <div className="p-1.5 bg-amber-500/20 rounded-lg text-amber-400">
                      <Store className="w-4 h-4" />
                    </div>
                    <span>
                      Filtering Overview for Outlet:{' '}
                      <strong className="text-white text-sm">
                        {outletsList.find((o) => o.id === selectedOutletFilter)?.shopName}
                      </strong>{' '}
                      (Sales, Invoices, and Udhaar metrics reflect this outlet)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSyncOutletSeparately(selectedOutletFilter)}
                      disabled={isSyncingOutlet === selectedOutletFilter}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncingOutlet === selectedOutletFilter ? 'animate-spin' : ''}`} />
                      <span>{isSyncingOutlet === selectedOutletFilter ? 'Syncing...' : 'Sync This Outlet'}</span>
                    </button>
                    <button
                      onClick={() => setSelectedOutletFilter('all')}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-colors"
                    >
                      Show All Outlets
                    </button>
                  </div>
                </div>
              )}

              {/* Stat Metric Bento Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Today's Gross Sales
                  </span>
                  <div className="text-2xl font-black text-emerald-400">
                    ₹{todayRevenue.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Expenses: ₹{todayExpenses}</span>
                    <span className="text-emerald-400 font-semibold">{todayTransactions.length} bills</span>
                  </div>
                </div>

                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Stock Cost Valuation
                  </span>
                  <div className="text-2xl font-black text-amber-400">
                    ₹{Math.round(totalStockValuation).toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Retail Value: ₹{Math.round(totalRetailValuation).toLocaleString('en-IN')}</span>
                    <span className="text-amber-400 font-semibold">{products.length} SKUs</span>
                  </div>
                </div>

                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Estimated Gross Margin
                  </span>
                  <div className="text-2xl font-black text-cyan-400">
                    {estimatedGrossProfitMargin}%
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Profit Potential: ₹{Math.round(totalRetailValuation - totalStockValuation).toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Outstanding Udhaar
                  </span>
                  <div className="text-2xl font-black text-rose-400">
                    ₹{totalOutstandingUdhaar.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Customers: {customers.length}</span>
                    <span className="text-rose-400 font-semibold">Active Ledger</span>
                  </div>
                </div>
              </div>

              {/* Central Server Architecture Status Banner */}
              <div className="bg-gradient-to-r from-slate-950 to-slate-900 border border-amber-500/20 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <Database className="w-4 h-4 text-amber-400" />
                      CENTRAL SERVER & CLOUD STORAGE TOPOLOGY
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Single source of truth for all counter terminals, mobile tablets, and POS devices.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportFullDatabaseJson}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Snapshot</span>
                    </button>
                    <button
                      onClick={handleTriggerSync}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Sync All Clients</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Primary Server ID</span>
                    <p className="font-mono font-bold text-amber-400 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-amber-400" />
                      {serverId || 'faizan-inamdar'}
                    </p>
                    <p className="text-[10px] text-slate-400">Admin: {serverAdmin || 'Faizan Inamdar'}</p>
                  </div>
                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Database Mode</span>
                    <p className="font-bold text-white flex items-center gap-1.5">
                      <Cloud className="w-3.5 h-3.5 text-cyan-400" />
                      Central Cloud REST API
                    </p>
                    <p className="text-[10px] text-emerald-400 font-semibold">{syncStatusText}</p>
                  </div>
                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Server Path</span>
                    <p className="font-mono text-[11px] text-slate-300 truncate">
                      data/central_store_db.json
                    </p>
                    <p className="text-[10px] text-slate-400">Multi-client sync hub</p>
                  </div>
                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Live Endpoints</span>
                    <p className="font-mono text-[10px] text-emerald-400 truncate">
                      /api/db/status, /api/db/sync
                    </p>
                    <p className="font-mono text-[10px] text-amber-400 truncate">
                      /api/db/master-admin/auth
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Actions Grid */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Administrative Shortcuts
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button
                    onClick={() => {
                      setActiveTab('inventory');
                      setShowAddProductModal(true);
                    }}
                    className="p-3.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-2xl flex items-center gap-3 text-left transition-colors"
                  >
                    <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                      <Plus className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Add New Product</div>
                      <div className="text-[10px] text-slate-400">Barcode, Price, Cost</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('inventory');
                      setShowBulkPriceModal(true);
                    }}
                    className="p-3.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-2xl flex items-center gap-3 text-left transition-colors"
                  >
                    <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                      <Percent className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Bulk Price Adjust</div>
                      <div className="text-[10px] text-slate-400">Mass % or Flat markup</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('inventory');
                      setFilterLowStockOnly(true);
                    }}
                    className="p-3.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-2xl flex items-center gap-3 text-left transition-colors"
                  >
                    <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Low Stock Alerts</div>
                      <div className="text-[10px] text-slate-400">{lowStockCount} items below alert</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('cloud_db')}
                    className="p-3.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-2xl flex items-center gap-3 text-left transition-colors"
                  >
                    <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-xl">
                      <Cloud className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Firebase / Cloud</div>
                      <div className="text-[10px] text-slate-400">Configure Cloud Sync</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: OUTLETS & BRANCH PERFORMANCE MANAGEMENT */}
          {activeTab === 'outlets' && (
            <div className="space-y-6">
              {/* Header & Client-Server Remote Management Architecture Bar */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800/90 to-slate-900 p-4 sm:p-5 rounded-2xl border border-amber-500/30 shadow-xl space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 flex-shrink-0">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base sm:text-lg font-black text-white">Store Outlets & Remote Multi-Branch Management</h2>
                        <span className="px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold rounded-full flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          Client-Server Online Architecture
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Admin owner can view, edit, configure, and monitor store outlets from any device online (laptop, phone, tablet) via central API and Cloud Firestore sync.
                      </p>
                    </div>
                  </div>

                  {/* Actions Header */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {onOpenOutletSync && (
                      <button
                        onClick={onOpenOutletSync}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                        title="Open Outlet Data Hub: Staff Upload / Owner Download"
                      >
                        <Database className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Outlet Data Hub</span>
                      </button>
                    )}

                    <button
                      onClick={() => triggerOutletFileDownload('all', 'json')}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-700 cursor-pointer shadow-sm"
                      title="Download complete database package of all outlets (JSON)"
                    >
                      <DownloadCloud className="w-3.5 h-3.5 text-blue-400" />
                      <span>Download All (JSON)</span>
                    </button>

                    <button
                      onClick={() => triggerOutletFileDownload('all', 'csv')}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-700 cursor-pointer shadow-sm"
                      title="Export complete database of all outlets to CSV spreadsheet"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Export CSV</span>
                    </button>

                    <button
                      onClick={() => handleResetOutletDaily('all')}
                      className="flex items-center gap-1.5 px-3 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                      title="Reset today's daily operations (sales, expenses, added cash) of all outlets to ₹0"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                      <span>Reset All Daily (₹0)</span>
                    </button>

                    <button
                      onClick={handleRefreshOutletsOnline}
                      disabled={isLoadingOutlets}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-700 disabled:opacity-50 cursor-pointer shadow-sm"
                      title="Pull latest outlet definitions & live sales directly from central server"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOutlets ? 'animate-spin text-amber-400' : ''}`} />
                      <span>{isLoadingOutlets ? 'Refreshing...' : 'Refresh Online'}</span>
                    </button>

                    <button
                      onClick={handleOpenAddOutlet}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md cursor-pointer"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>+ Add New Store Outlet</span>
                    </button>
                  </div>
                </div>

                {/* Remote Architecture Details Pill Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-700/60">
                  <div className="flex items-center gap-2 text-slate-300 bg-slate-950/50 px-3 py-1.5 rounded-xl border border-slate-800">
                    <Globe className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>REST API Endpoint: <code className="text-amber-300 font-mono text-[11px]">/api/db/outlets</code></span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300 bg-slate-950/50 px-3 py-1.5 rounded-xl border border-slate-800">
                    <Cloud className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span>Cloud Sync: <strong className="text-white font-semibold">Firestore Outlets Collection</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300 bg-slate-950/50 px-3 py-1.5 rounded-xl border border-slate-800">
                    <ShieldCheck className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <span>Access Role: <strong className="text-amber-300">Admin Owner Remote Edit</strong></span>
                  </div>
                </div>
              </div>

              {/* Filter & Search Outlets Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800/50 p-3 rounded-2xl border border-slate-700/60">
                <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={outletSearch}
                    onChange={(e) => setOutletSearch(e.target.value)}
                    placeholder="Search outlets by name, shortcut, or address..."
                    className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                  {outletSearch && (
                    <button
                      onClick={() => setOutletSearch('')}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {selectedOutletFilter !== 'all' && (
                    <button
                      onClick={() => setSelectedOutletFilter('all')}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition-colors"
                    >
                      Clear Filter (Showing All)
                    </button>
                  )}
                  <span className="text-xs text-slate-400 font-mono">
                    Total: {outletsList.length} Outlet{outletsList.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              {/* Network Cash Float & Liquidity Summary (Synced Live from Database) */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Auto-Sync: Live ({lastAutoSyncTime})
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Multi-Outlet Cloud Counter Synchronization
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRefreshOutletsOnline}
                    disabled={isLoadingOutlets}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 border border-slate-700 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOutlets ? 'animate-spin text-emerald-400' : ''}`} />
                    <span>Sync All from DB</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-amber-950/30 p-3.5 rounded-2xl border border-emerald-500/30 shadow-md">
                  {/* 1. Opening */}
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-emerald-500/30">
                    <span className="text-[9px] uppercase font-bold text-emerald-300 block">Total Opening</span>
                    <span className="text-base font-black text-emerald-400 font-mono block mt-0.5">
                      ₹{outletsList
                        .reduce((sum, o) => {
                          const lm = liveOutlets.find((l) => l.id === o.id);
                          const val = outletCashBalances?.[o.id]?.openingCash ?? (lm?.openingCash ?? (typeof o.openingCash === 'number' ? o.openingCash : (storeSettings.activeStoreId === o.id ? (storeSettings.openingAmount ?? 0) : 0)));
                          return sum + val;
                        }, 0)
                        .toLocaleString('en-IN')}
                    </span>
                    <span className="text-[9px] text-slate-400">आरंभिक रोकड़</span>
                  </div>

                  {/* 2. Expenses */}
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-rose-500/30">
                    <span className="text-[9px] uppercase font-bold text-rose-300 block">Total Expenses</span>
                    <span className="text-base font-black text-rose-400 font-mono block mt-0.5">
                      ₹{outletsList
                        .reduce((sum, o) => {
                          const lm = liveOutlets.find((l) => l.id === o.id);
                          if (lm?.todayExpenses !== undefined && lm.todayExpenses > 0) return sum + lm.todayExpenses;
                          const txs = transactions.filter((t) => !t.voided && isMatchingOutlet(t, o.id) && (t.timestamp || '').startsWith(todayDateStr) && t.type === 'expense');
                          return sum + txs.reduce((s, t) => s + (t.amount || 0), 0);
                        }, 0)
                        .toLocaleString('en-IN')}
                    </span>
                    <span className="text-[9px] text-slate-400">दुकान खर्च</span>
                  </div>

                  {/* 3. Added Cash */}
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-blue-500/30">
                    <span className="text-[9px] uppercase font-bold text-blue-300 block">Total Added</span>
                    <span className="text-base font-black text-blue-400 font-mono block mt-0.5">
                      ₹{outletsList
                        .reduce((sum, o) => {
                          const lm = liveOutlets.find((l) => l.id === o.id);
                          const val = outletCashBalances?.[o.id]?.addedCash ?? (lm?.addedCash ?? (typeof o.addedCash === 'number' ? o.addedCash : (storeSettings.activeStoreId === o.id ? (storeSettings.addedCash ?? 0) : 0)));
                          return sum + val;
                        }, 0)
                        .toLocaleString('en-IN')}
                    </span>
                    <span className="text-[9px] text-slate-400">जोड़ी रोकड़</span>
                  </div>

                  {/* 4. Total Sales */}
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-emerald-500/30">
                    <span className="text-[9px] uppercase font-bold text-emerald-300 block">Total Sales</span>
                    <span className="text-base font-black text-emerald-300 font-mono block mt-0.5">
                      ₹{outletsList
                        .reduce((sum, o) => {
                          const lm = liveOutlets.find((l) => l.id === o.id);
                          if (lm?.todaySales !== undefined && lm.todaySales > 0) return sum + lm.todaySales;
                          const txs = transactions.filter((t) => !t.voided && isMatchingOutlet(t, o.id) && (t.timestamp || '').startsWith(todayDateStr) && t.type === 'sale');
                          return sum + txs.reduce((s, t) => s + (t.amount || 0), 0);
                        }, 0)
                        .toLocaleString('en-IN')}
                    </span>
                    <span className="text-[9px] text-slate-400">कुल बिक्री</span>
                  </div>

                  {/* 5. Online UPI */}
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-cyan-500/30">
                    <span className="text-[9px] uppercase font-bold text-cyan-300 block">Online UPI</span>
                    <span className="text-base font-black text-cyan-400 font-mono block mt-0.5">
                      ₹{outletsList
                        .reduce((sum, o) => {
                          const lm = liveOutlets.find((l) => l.id === o.id);
                          if (lm?.upiSales !== undefined && lm.upiSales > 0) return sum + lm.upiSales;
                          const txs = transactions.filter((t) => !t.voided && isMatchingOutlet(t, o.id) && (t.timestamp || '').startsWith(todayDateStr) && t.type === 'sale' && t.paymentMode === 'online_upi');
                          return sum + txs.reduce((s, t) => s + (t.amount || 0), 0);
                        }, 0)
                        .toLocaleString('en-IN')}
                    </span>
                    <span className="text-[9px] text-slate-400">ऑनलाइन बिक्री</span>
                  </div>

                  {/* 6. Cash In Hand */}
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-amber-500/30">
                    <span className="text-[9px] uppercase font-bold text-amber-300 block">Cash in Hand</span>
                    <span className="text-base font-black text-amber-400 font-mono block mt-0.5">
                      ₹{outletsList
                        .reduce((sum, o) => {
                          const lm = liveOutlets.find((l) => l.id === o.id);
                          if (lm?.cashInHand !== undefined) return sum + lm.cashInHand;
                          const op = outletCashBalances?.[o.id]?.openingCash ?? (typeof o.openingCash === 'number' ? o.openingCash : (storeSettings.activeStoreId === o.id ? (storeSettings.openingAmount ?? 0) : 0));
                          const ad = outletCashBalances?.[o.id]?.addedCash ?? (typeof o.addedCash === 'number' ? o.addedCash : (storeSettings.activeStoreId === o.id ? (storeSettings.addedCash ?? 0) : 0));
                          const txs = transactions.filter((t) => !t.voided && isMatchingOutlet(t, o.id) && (t.timestamp || '').startsWith(todayDateStr));
                          const cs = txs.filter((t) => t.type === 'sale' && (t.paymentMode === 'cash' || !t.paymentMode)).reduce((s, t) => s + (t.amount || 0), 0);
                          const ex = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
                          return sum + Math.max(0, op + ad + cs - ex);
                        }, 0)
                        .toLocaleString('en-IN')}
                    </span>
                    <span className="text-[9px] text-slate-400">गल्ला रोकड़</span>
                  </div>
                </div>
              </div>

              {/* Grid of Outlets */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {outletsList
                  .filter((o) => {
                    if (!outletSearch.trim()) return true;
                    const query = outletSearch.toLowerCase();
                    return (
                      o.shopName.toLowerCase().includes(query) ||
                      (o.shortcutName && o.shortcutName.toLowerCase().includes(query)) ||
                      (o.address && o.address.toLowerCase().includes(query)) ||
                      (o.phone && o.phone.includes(query))
                    );
                  })
                  .map((outlet) => {
                    const liveMatch = liveOutlets.find((l) => l.id === outlet.id);
                    const outletTxs = transactions.filter((t) => !t.voided && isMatchingOutlet(t, outlet.id));
                    const outletTodayTxs = outletTxs.filter((t) => (t.timestamp || '').startsWith(todayDateStr));

                    const todaySales = liveMatch?.todaySales !== undefined && liveMatch.todaySales > 0
                      ? liveMatch.todaySales
                      : outletTodayTxs.filter((t) => t.type === 'sale').reduce((sum, t) => sum + (t.amount || 0), 0);

                    const cashSales = liveMatch?.cashSales !== undefined && liveMatch.cashSales > 0
                      ? liveMatch.cashSales
                      : outletTodayTxs.filter((t) => t.type === 'sale' && (t.paymentMode === 'cash' || !t.paymentMode)).reduce((sum, t) => sum + (t.amount || 0), 0);

                    const upiSales = liveMatch?.upiSales !== undefined && liveMatch.upiSales > 0
                      ? liveMatch.upiSales
                      : outletTodayTxs.filter((t) => t.type === 'sale' && t.paymentMode === 'online_upi').reduce((sum, t) => sum + (t.amount || 0), 0);

                    const udhaarSales = outletTodayTxs
                      .filter((t) => t.type === 'sale' && t.paymentMode === 'credit_udhaar')
                      .reduce((sum, t) => sum + (t.amount || 0), 0);

                    const outletExpenses = liveMatch?.todayExpenses !== undefined && liveMatch.todayExpenses > 0
                      ? liveMatch.todayExpenses
                      : outletTodayTxs.filter((t) => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);

                    const outletCustomers = customers.filter((c) => isMatchingCustomerOutlet(c, outlet.id));
                    const outletUdhaarTotal = outletCustomers.reduce((sum, c) => sum + (c.totalDue || 0), 0);

                    const currentStaff = staffAccounts || storeSettings?.staffAccounts || [];
                    const assignedStaff = currentStaff.filter(
                      (s) => !s.assignedOutletIds || s.assignedOutletIds.length === 0 || s.assignedOutletIds.includes(outlet.id) || s.assignedOutletIds.includes('all') || s.defaultOutletId === outlet.id
                    );

                    const isFiltered = selectedOutletFilter === outlet.id;
                    const isSyncingThis = isSyncingOutlet === outlet.id;
                    const isCurrentActive = storeSettings.activeStoreId === outlet.id;

                    // Cash Float synced from DB or fallback
                    const outletOpeningCash =
                      outletCashBalances?.[outlet.id]?.openingCash ??
                      (liveMatch?.openingCash ??
                        (typeof outlet.openingCash === 'number'
                          ? outlet.openingCash
                          : isCurrentActive
                          ? storeSettings.openingAmount ?? 0
                          : 0));

                    const outletAddedCash =
                      outletCashBalances?.[outlet.id]?.addedCash ??
                      (liveMatch?.addedCash ??
                        (typeof outlet.addedCash === 'number'
                          ? outlet.addedCash
                          : isCurrentActive
                          ? storeSettings.addedCash ?? 0
                          : 0));

                    const outletEffectiveCashInHand =
                      liveMatch?.cashInHand !== undefined
                        ? liveMatch.cashInHand
                        : Math.max(0, outletOpeningCash + outletAddedCash + cashSales - outletExpenses);

                    return (
                      <div
                        key={outlet.id}
                        className={`relative bg-slate-900/95 border ${
                          isCurrentActive
                            ? 'border-emerald-500/80 ring-2 ring-emerald-500/20 shadow-emerald-950/40'
                            : isFiltered
                            ? 'border-amber-500 ring-2 ring-amber-500/20'
                            : 'border-slate-800'
                        } rounded-2xl p-5 space-y-4 hover:border-slate-700 transition-all shadow-lg`}
                      >
                        {/* Outlet Header with Edit & Admin Online Actions */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-3 rounded-2xl border ${
                                isCurrentActive
                                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400'
                                  : 'bg-slate-800 border-slate-700 text-amber-400'
                              }`}
                            >
                              <Store className="w-6 h-6" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="text-base font-black text-white">{outlet.shopName}</h3>
                                {outlet.shortcutName && (
                                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-extrabold rounded-md border border-amber-500/30 uppercase font-mono">
                                    {outlet.shortcutName}
                                  </span>
                                )}
                                {outlet.isDefault && (
                                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] font-bold rounded-md border border-blue-500/30">
                                    HQ / Default
                                  </span>
                                )}
                                {isCurrentActive && (
                                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-md border border-emerald-500/40 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                    Active POS Counter
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {outlet.address || 'Address not specified'}
                              </p>
                            </div>
                          </div>

                          {/* Quick Admin Owner Edit & Management Buttons */}
                          <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                            <button
                              type="button"
                              onClick={() => handleOpenCashEdit(outlet)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                              title="Set or Add Cash Float & Sync with Central Database"
                            >
                              <Coins className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Cash Float</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditOutlet(outlet)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                              title="Edit store outlet details online (shop name, address, phone, UPI, tax)"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Edit Outlet</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => triggerOutletFileDownload(outlet.id, 'json')}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-xl transition-colors cursor-pointer border border-slate-700"
                              title={`Download ${outlet.shopName} complete database package (JSON)`}
                            >
                              <DownloadCloud className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => triggerOutletFileDownload(outlet.id, 'csv')}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl transition-colors cursor-pointer border border-slate-700"
                              title={`Export ${outlet.shopName} data to CSV spreadsheet`}
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleViewOutletDeepDive(outlet.id)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer border border-slate-700"
                              title="View real-time transactions & deep dive report for this outlet"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSyncOutletSeparately(outlet.id)}
                              disabled={isSyncingThis}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl transition-colors cursor-pointer border border-slate-700 disabled:opacity-50"
                              title="Synchronize this outlet separately"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingThis ? 'animate-spin' : ''}`} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleResetOutletDaily(outlet.id)}
                              className="p-1.5 bg-slate-800 hover:bg-rose-900/40 text-rose-400 rounded-xl transition-colors cursor-pointer border border-slate-700 hover:border-rose-500/50"
                              title={`Reset today's sales, expenses & cash for ${outlet.shopName} to ₹0`}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              disabled={outletsList.length <= 1 || outlet.isPrimary}
                              onClick={() => handleDeleteOutletClick(outlet)}
                              className={`p-1.5 rounded-xl transition-colors border ${
                                outletsList.length <= 1 || outlet.isPrimary
                                  ? 'border-slate-800 text-slate-600 cursor-not-allowed'
                                  : 'border-slate-700 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 cursor-pointer'
                              }`}
                              title={
                                outlet.isPrimary
                                  ? 'Cannot delete Primary HQ outlet'
                                  : outletsList.length <= 1
                                  ? 'Cannot delete the only outlet'
                                  : 'Delete store outlet online'
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Outlet Details Bar */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                          {outlet.phone && (
                            <div className="flex items-center gap-1.5 text-slate-300">
                              <Phone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                              <span>Phone: <strong className="text-white font-mono">{outlet.phone}</strong></span>
                            </div>
                          )}
                          {outlet.upiId && (
                            <div className="flex items-center gap-1.5 text-slate-300">
                              <DollarSign className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                              <span>UPI QR: <strong className="font-mono text-emerald-300">{outlet.upiId}</strong></span>
                            </div>
                          )}
                          {outlet.gstin && (
                            <div className="flex items-center gap-1.5 text-slate-300">
                              <FileText className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                              <span>GSTIN: <strong className="font-mono text-slate-200">{outlet.gstin}</strong></span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Percent className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                            <span>Default Tax: <strong className="text-amber-300">{outlet.defaultTaxRate || 0}%</strong></span>
                          </div>
                        </div>

                        {/* The 6 Per-Outlet Counter Metrics Synced Live from Database */}
                        <div className="space-y-2">
                          {/* Row 1: Opening Float, Store Expense, Added Cash */}
                          <div className="grid grid-cols-3 gap-2">
                            <div
                              onClick={() => handleOpenCashEdit(outlet)}
                              className="bg-emerald-950/30 border border-emerald-500/40 hover:border-emerald-400 rounded-xl p-2.5 cursor-pointer transition-colors group"
                              title="Click to adjust Opening Cash float"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-bold text-emerald-300 block">Opening Float</span>
                                <span className="text-[9px] font-mono px-1 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-bold">
                                  SYNCED
                                </span>
                              </div>
                              <span className="text-base font-black text-emerald-400 font-mono block mt-0.5">
                                ₹{outletOpeningCash.toLocaleString('en-IN')}
                              </span>
                              <span className="text-[10px] text-slate-400 block group-hover:text-emerald-300 transition-colors">
                                आरंभिक रोकड़ ✎
                              </span>
                            </div>

                            <div className="bg-rose-950/30 border border-rose-500/40 rounded-xl p-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-bold text-rose-300 block">Store Expense</span>
                                <span className="text-[9px] font-mono px-1 py-0.2 bg-rose-500/20 text-rose-300 rounded font-bold">
                                  TODAY
                                </span>
                              </div>
                              <span className="text-base font-black text-rose-400 font-mono block mt-0.5">
                                ₹{outletExpenses.toLocaleString('en-IN')}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                दुकान खर्च
                              </span>
                            </div>

                            <div
                              onClick={() => handleOpenCashEdit(outlet)}
                              className="bg-blue-950/30 border border-blue-500/40 hover:border-blue-400 rounded-xl p-2.5 cursor-pointer transition-colors group"
                              title="Click to add midday Cash float"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-bold text-blue-300 block">Added Cash</span>
                                <span className="text-[9px] font-mono px-1 py-0.2 bg-blue-500/20 text-blue-300 rounded font-bold">
                                  SYNCED
                                </span>
                              </div>
                              <span className="text-base font-black text-blue-400 font-mono block mt-0.5">
                                ₹{outletAddedCash.toLocaleString('en-IN')}
                              </span>
                              <span className="text-[10px] text-slate-400 block group-hover:text-blue-300 transition-colors">
                                जोड़ी रोकड़ ✎
                              </span>
                            </div>
                          </div>

                          {/* Row 2: Total Sales, Online UPI, Cash in Hand */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-2.5">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Sales</span>
                              <span className="text-base font-black text-emerald-400 font-mono block mt-0.5">
                                ₹{todaySales.toLocaleString('en-IN')}
                              </span>
                              <span className="text-[10px] text-slate-500 block">
                                {outletTodayTxs.length} bills (Cash ₹{cashSales})
                              </span>
                            </div>

                            <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-2.5">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Online UPI</span>
                              <span className="text-base font-black text-cyan-400 font-mono block mt-0.5">
                                ₹{upiSales.toLocaleString('en-IN')}
                              </span>
                              <span className="text-[10px] text-slate-500 block">डिजिटल बिक्री</span>
                            </div>

                            <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-bold text-amber-300 block">Cash in Hand</span>
                                <Coins className="w-3.5 h-3.5 text-amber-400" />
                              </div>
                              <span className="text-base font-black text-amber-400 font-mono block mt-0.5">
                                ₹{outletEffectiveCashInHand.toLocaleString('en-IN')}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                गल्ला रोकड़
                              </span>
                            </div>
                          </div>

                          {/* Row 3: Udhaar, Cash Sales & Bills summary */}
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2">
                              <span className="text-[9px] text-slate-400 uppercase font-bold block">Udhaar Outstanding</span>
                              <span className="text-sm font-bold text-rose-400 font-mono block">
                                ₹{outletUdhaarTotal.toLocaleString('en-IN')}
                              </span>
                              <span className="text-[9px] text-slate-500">{outletCustomers.length} customers</span>
                            </div>

                            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2">
                              <span className="text-[9px] text-slate-400 uppercase font-bold block">Pure Cash Sales</span>
                              <span className="text-sm font-bold text-emerald-400 font-mono block">
                                ₹{cashSales.toLocaleString('en-IN')}
                              </span>
                              <span className="text-[9px] text-slate-500">Drawer additions</span>
                            </div>

                            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2">
                              <span className="text-[9px] text-slate-400 uppercase font-bold block">Bills Issued</span>
                              <span className="text-sm font-bold text-white font-mono block">
                                {outletTodayTxs.length} Receipts
                              </span>
                              <span className="text-[9px] text-slate-500">Today's count</span>
                            </div>
                          </div>
                        </div>

                        {/* Assigned Staff Preview */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-indigo-400" />
                              Assigned Staff Members ({assignedStaff.length}):
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {lastOutletSyncTimes[outlet.id] ? `Last synced: ${lastOutletSyncTimes[outlet.id]}` : 'Ready online'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {assignedStaff.length === 0 ? (
                              <span className="text-xs text-slate-500 italic">No specific staff assigned (open access)</span>
                            ) : (
                              assignedStaff.map((st) => (
                                <span
                                  key={st.id}
                                  className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 flex items-center gap-1.5"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  <span className="font-medium text-white">{st.name}</span>
                                  <span className="text-[10px] text-slate-400 capitalize">({st.role})</span>
                                </span>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Outlet Action Controls */}
                        <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => {
                                setSelectedOutletFilter(outlet.id);
                                setActiveTab('transactions');
                              }}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer border border-slate-700/60"
                            >
                              Invoices ({outletTxs.length})
                            </button>
                            <button
                              onClick={() => {
                                setSelectedOutletFilter(outlet.id);
                                setActiveTab('udhaar');
                              }}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer border border-slate-700/60"
                            >
                              Khata ({outletCustomers.length})
                            </button>
                            <button
                              onClick={() => handleViewOutletDeepDive(outlet.id)}
                              className="px-2.5 py-1.5 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer border border-indigo-500/40 flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Live Report
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            {isCurrentActive ? (
                              <span className="px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                Current Active Counter
                              </span>
                            ) : (
                              <button
                                onClick={() => handleSwitchActiveOutlet(outlet)}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm shadow-emerald-950 flex items-center gap-1"
                                title="Switch active billing terminal to this outlet"
                              >
                                ⚡ Switch Counter Here
                              </button>
                            )}

                            <button
                              onClick={() => setSelectedOutletFilter(outlet.id === selectedOutletFilter ? 'all' : outlet.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                isFiltered
                                  ? 'bg-amber-500 text-slate-950 font-bold'
                                  : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {isFiltered ? 'Filtered ✓' : 'Filter View'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCT MASTER & DIRECT EDITOR */}
          {activeTab === 'inventory' && (
            <div className="space-y-4">
              {/* Search & Filter Header Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={prodSearch}
                      onChange={(e) => setProdSearch(e.target.value)}
                      placeholder="Search by name, Hindi name, or barcode..."
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Category Filter */}
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="all">All Categories ({products.length})</option>
                    {Object.entries(CATEGORY_LABELS).map(([catKey, catVal]) => (
                      <option key={catKey} value={catKey}>
                        {catVal.label}
                      </option>
                    ))}
                  </select>

                  {/* Low Stock Filter Pill */}
                  <button
                    onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                      filterLowStockOnly
                        ? 'bg-rose-500 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-700'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Low Stock ({lowStockCount})</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowBulkPriceModal(true)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <Percent className="w-3.5 h-3.5" />
                    <span>Bulk Price Adjust</span>
                  </button>

                  <button
                    onClick={() => setShowAddProductModal(true)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add New SKU</span>
                  </button>
                </div>
              </div>

              {/* Products Table with Inline Editing */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60 shadow-sm">
                <div className="overflow-x-auto max-h-[520px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900/90 text-slate-400 font-bold sticky top-0 z-10 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Unit</th>
                        <th className="py-2.5 px-3 text-right">Cost Price (₹)</th>
                        <th className="py-2.5 px-3 text-right">Selling Rate (₹)</th>
                        <th className="py-2.5 px-3 text-right">Margin %</th>
                        <th className="py-2.5 px-3 text-right">Current Stock</th>
                        <th className="py-2.5 px-3 text-center">Barcode</th>
                        <th className="py-2.5 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {filteredProducts.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-500 text-xs">
                            No products match current search or filters.
                          </td>
                        </tr>
                      ) : (
                        filteredProducts.map((p) => {
                          const isEditing = editingProdId === p.id;
                          const cost = isEditing ? Number(editForm.costPrice ?? p.costPrice ?? 0) : (p.costPrice || 0);
                          const rate = isEditing ? Number(editForm.rate ?? p.rate) : p.rate;
                          const marginPercent = rate > 0 && cost > 0 ? Math.round(((rate - cost) / rate) * 100) : 0;
                          const isLow = (p.stock ?? 0) <= (p.minStockAlert ?? 10);

                          return (
                            <tr
                              key={p.id}
                              className={`hover:bg-slate-800/40 transition-colors ${
                                isEditing ? 'bg-amber-500/10' : ''
                              }`}
                            >
                              {/* Name */}
                              <td className="py-2.5 px-3 font-semibold text-white">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editForm.name ?? p.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                                  />
                                ) : (
                                  <div>
                                    <div className="font-bold text-sm text-white">{p.name}</div>
                                    {p.hindiName && (
                                      <div className="text-xs text-amber-300 font-medium">{p.hindiName}</div>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Category */}
                              <td className="py-2.5 px-3">
                                {isEditing ? (
                                  <select
                                    value={editForm.category ?? p.category}
                                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value as any })}
                                    className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[11px] text-white"
                                  >
                                    {Object.entries(CATEGORY_LABELS).map(([catKey, catVal]) => (
                                      <option key={catKey} value={catKey}>
                                        {catVal.label}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="text-[10px] font-semibold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-full">
                                    {CATEGORY_LABELS[p.category]?.label || p.category}
                                  </span>
                                )}
                              </td>

                              {/* Unit */}
                              <td className="py-2.5 px-3 text-slate-300">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editForm.unit ?? p.unit}
                                    onChange={(e) => setEditForm({ ...editForm, unit: e.target.value as any })}
                                    className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white text-center"
                                  />
                                ) : (
                                  <span className="font-mono text-slate-400">/{p.unit}</span>
                                )}
                              </td>

                              {/* Cost Price */}
                              <td className="py-2.5 px-3 text-right font-mono">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="any"
                                    value={editForm.costPrice ?? p.costPrice ?? ''}
                                    onChange={(e) => setEditForm({ ...editForm, costPrice: Number(e.target.value) })}
                                    className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white text-right"
                                  />
                                ) : (
                                  <span className="text-slate-400">
                                    {p.costPrice ? `₹${p.costPrice}` : '—'}
                                  </span>
                                )}
                              </td>

                              {/* Selling Rate */}
                              <td className="py-2.5 px-3 text-right font-mono font-bold">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="any"
                                    value={editForm.rate ?? p.rate}
                                    onChange={(e) => setEditForm({ ...editForm, rate: Number(e.target.value) })}
                                    className="w-20 px-2 py-1 bg-slate-900 border border-amber-500 rounded text-xs text-amber-300 text-right font-bold"
                                  />
                                ) : (
                                  <span className="text-amber-400">₹{p.rate}</span>
                                )}
                              </td>

                              {/* Margin % */}
                              <td className="py-2.5 px-3 text-right">
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    marginPercent >= 25
                                      ? 'bg-emerald-500/20 text-emerald-400'
                                      : marginPercent > 10
                                      ? 'bg-amber-500/20 text-amber-400'
                                      : 'bg-slate-700 text-slate-400'
                                  }`}
                                >
                                  {marginPercent}%
                                </span>
                              </td>

                              {/* Current Stock */}
                              <td className="py-2.5 px-3 text-right font-mono">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    value={editForm.stock ?? p.stock ?? 0}
                                    onChange={(e) => setEditForm({ ...editForm, stock: Number(e.target.value) })}
                                    className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white text-right"
                                  />
                                ) : (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      isLow
                                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                        : 'text-slate-300'
                                    }`}
                                  >
                                    {p.stock ?? 0} {p.unit}
                                  </span>
                                )}
                              </td>

                              {/* Barcode */}
                              <td className="py-2.5 px-3 text-center font-mono text-[10px] text-slate-400">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editForm.barcode ?? p.barcode ?? ''}
                                    onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })}
                                    className="w-24 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-white text-center"
                                  />
                                ) : (
                                  p.barcode || '—'
                                )}
                              </td>

                              {/* Actions */}
                              <td className="py-2.5 px-3 text-center">
                                {isEditing ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => handleSaveInlineEdit(p.id)}
                                      className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
                                      title="Save"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setEditingProdId(null)}
                                      className="p-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                                      title="Cancel"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => handleStartInlineEdit(p)}
                                      className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-colors"
                                      title="Inline Edit"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteProduct(p.id, p.name)}
                                      className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                                      title="Delete Product"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TRANSACTIONS & INVOICES MASTER */}
          {activeTab === 'transactions' && (
            <div className="space-y-4">
              {/* Search & Filter Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={txSearch}
                      onChange={(e) => setTxSearch(e.target.value)}
                      placeholder="Search bill number, customer, cashier..."
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <select
                    value={txModeFilter}
                    onChange={(e) => setTxModeFilter(e.target.value as any)}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="all">All Modes ({transactions.length})</option>
                    <option value="cash">Cash Sales</option>
                    <option value="online_upi">UPI Online</option>
                    <option value="credit_udhaar">Udhaar (Credit)</option>
                    <option value="expense">Expenses Only</option>
                  </select>
                </div>

                <div className="text-xs text-slate-400">
                  Showing <span className="text-white font-bold">{filteredTransactions.length}</span> records
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60 shadow-sm">
                <div className="overflow-x-auto max-h-[520px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900/90 text-slate-400 font-bold sticky top-0 z-10 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Receipt #</th>
                        <th className="py-2.5 px-3">Date & Time</th>
                        <th className="py-2.5 px-3">Outlet</th>
                        <th className="py-2.5 px-3">Type / Mode</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Terminal / Staff</th>
                        <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {filteredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-500 text-xs">
                            No bills found matching current filter.
                          </td>
                        </tr>
                      ) : (
                        filteredTransactions.map((t) => (
                          <tr
                            key={t.id}
                            className={`hover:bg-slate-800/40 transition-colors ${
                              t.voided ? 'opacity-50 line-through bg-rose-500/5' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3 font-mono font-bold text-white">
                              {t.receiptNumber || t.id.slice(-8)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                              {t.timestamp ? new Date(t.timestamp).toLocaleString('en-IN') : '—'}
                            </td>
                            <td className="py-2.5 px-3">
                              {(() => {
                                const txOutlet = outletsList.find((o) => o.id === t.outletId) || outletsList[0];
                                return (
                                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-medium inline-flex items-center gap-1 whitespace-nowrap">
                                    <Store className="w-2.5 h-2.5 text-amber-400" />
                                    <span>{txOutlet?.shortcutName || txOutlet?.shopName || 'Main'}</span>
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                  t.type === 'expense'
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                    : t.paymentMode === 'online_upi'
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                    : t.paymentMode === 'credit_udhaar'
                                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                }`}
                              >
                                {t.type === 'expense' ? 'Expense' : t.paymentMode || 'Sale'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">
                              {t.customerName ? (
                                <div>
                                  <div className="font-semibold">{t.customerName}</div>
                                  {t.customerPhone && (
                                    <div className="text-[10px] text-slate-500">{t.customerPhone}</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-500">Counter Cash</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                              {t.staffName || 'Counter 1'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                              ₹{t.amount?.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {t.voided ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400">
                                  VOID
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                                  PAID
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => setSelectedTxDetail(t)}
                                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] rounded transition-colors"
                                >
                                  View
                                </button>
                                {!t.voided && (
                                  <button
                                    onClick={() => {
                                      setSelectedTxDetail(t);
                                      setShowVoidModal(true);
                                    }}
                                    className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 text-[11px] rounded transition-colors"
                                  >
                                    Void
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: UDHAAR KHATA MASTER */}
          {activeTab === 'udhaar' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={udhaarSearch}
                    onChange={(e) => setUdhaarSearch(e.target.value)}
                    placeholder="Search customer by name or phone..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="text-xs text-slate-400">
                  Total Outstanding:{' '}
                  <span className="font-bold text-rose-400 text-sm">
                    ₹{totalOutstandingUdhaar.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Customer Khata Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredCustomers.map((c) => (
                  <div
                    key={c.id}
                    className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-3 shadow-sm hover:border-amber-500/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm">{c.name}</h4>
                          {(() => {
                            const custOutlet = outletsList.find((o) => o.id === c.outletId) || outletsList[0];
                            return (
                              <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[9px] text-amber-300 font-bold inline-flex items-center gap-1">
                                <Store className="w-2.5 h-2.5 text-amber-400" />
                                <span>{custOutlet?.shortcutName || custOutlet?.shopName || 'Main'}</span>
                              </span>
                            );
                          })()}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span>{c.phone}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Balance Due</div>
                        <div className="text-lg font-black text-rose-400 font-mono">
                          ₹{c.totalDue.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-700/60">
                      <span>Credit Limit: ₹{c.creditLimit?.toLocaleString('en-IN') || '5,000'}</span>
                      <span>Last: {c.lastActive ? new Date(c.lastActive).toLocaleDateString('en-IN') : '—'}</span>
                    </div>

                    {/* Actions: Record Jama / WhatsApp Reminder */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => {
                          setSelectedUdhaarCust(c);
                          setJamaAmount(c.totalDue);
                        }}
                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors shadow-sm text-center"
                      >
                        Settle Jama (Payment)
                      </button>

                      <a
                        href={`https://wa.me/91${c.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                          `Namaste ${c.name} ji, from ${storeSettings.shopName}. Your outstanding Udhaar balance is ₹${c.totalDue}. Kindly settle at your convenience. Thank you!`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-xl border border-green-500/30 transition-colors"
                        title="Send WhatsApp Reminder"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: STAFF & MULTI-TERMINAL ROLES */}
          {activeTab === 'staff' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
                <div>
                  <h3 className="text-sm font-bold text-white">Staff Accounts & Terminal Roles</h3>
                  <p className="text-xs text-slate-400">
                    Control cashier logins, access rights, and Master Admin PIN codes.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddStaffModal(true)}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Staff Account</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(staffAccounts || storeSettings?.staffAccounts || []).map((s) => (
                  <div
                    key={s.id}
                    className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-2 rounded-xl ${
                            s.role === 'master_admin' || s.role === 'owner'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-blue-500/20 text-blue-300'
                          }`}
                        >
                          <Shield className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-white text-sm">{s.name}</h4>
                            {(s.serverId || s.id === 'faizan-inamdar' || s.role === 'owner' || s.role === 'master_admin') && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Server ID: {s.serverId || 'faizan-inamdar'}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] uppercase tracking-wider font-bold text-amber-400">
                            {s.role} {s.username ? `• @${s.username}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleStaffActive(s.id)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                            s.active
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-slate-700 text-slate-400 border-slate-600'
                          }`}
                        >
                          {s.active ? 'Active' : 'Disabled'}
                        </button>
                      </div>
                    </div>

                    <div className="text-xs bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400">Login PIN:</span>
                      <span className="font-mono font-bold text-amber-300">
                        {s.role === 'master_admin' ? '••••••' : s.pin}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 flex flex-wrap gap-2">
                      <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        Catalog Edit: {s.role === 'master_admin' || s.role === 'owner' ? 'Yes' : 'No'}
                      </span>
                      <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        Void Bills: {s.role === 'master_admin' || s.role === 'owner' ? 'Yes' : 'No'}
                      </span>
                      <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        Master Admin Access: {s.role === 'master_admin' ? 'Full' : 'None'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: CLOUD DATABASE & FIREBASE CONFIG */}
          {activeTab === 'cloud_db' && (
            <div className="space-y-6">
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-cyan-400" />
                    Cloud Database & Firebase Firestore Sync Engine
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Connect this POS to a centralized Cloud Database or Firebase Firestore collection.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Synchronization Architecture Mode
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <label
                        className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 ${
                          cloudSyncMode === 'central_api'
                            ? 'bg-amber-500/10 border-amber-500 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="syncMode"
                            checked={cloudSyncMode === 'central_api'}
                            onChange={() => setCloudSyncMode('central_api')}
                            className="text-amber-500"
                          />
                          <span className="font-bold">Central REST API (Recommended)</span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Auto-persists in <code>data/central_store_db.json</code>. Zero external API keys needed.
                        </span>
                      </label>

                      <label
                        className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 ${
                          cloudSyncMode === 'firebase_firestore'
                            ? 'bg-amber-500/10 border-amber-500 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="syncMode"
                            checked={cloudSyncMode === 'firebase_firestore'}
                            onChange={() => setCloudSyncMode('firebase_firestore')}
                            className="text-amber-500"
                          />
                          <span className="font-bold">Firebase Firestore</span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Real-time multi-terminal document sync via Google Cloud Firebase.
                        </span>
                      </label>

                      <label
                        className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 ${
                          cloudSyncMode === 'hybrid'
                            ? 'bg-amber-500/10 border-amber-500 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="syncMode"
                            checked={cloudSyncMode === 'hybrid'}
                            onChange={() => setCloudSyncMode('hybrid')}
                            className="text-amber-500"
                          />
                          <span className="font-bold">Hybrid Offline-First</span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Local IndexedDB primary cache with periodic background server synchronization.
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Firebase credentials & live action controls */}
                  <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div>
                        <div className="text-xs font-bold text-amber-400 flex items-center gap-2">
                          <Cloud className="w-4 h-4 text-cyan-400" />
                          <span>Google Cloud Firebase Firestore Configuration</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Provisioned Project: <span className="font-mono text-cyan-300 font-bold">{firebaseProjectId || 'concise-tributary-mggh3'}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleTestFirestorePing}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors"
                        >
                          <Activity className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{firestorePingStatus || 'Test Connection'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1">Project ID</label>
                        <input
                          type="text"
                          value={firebaseProjectId}
                          onChange={(e) => setFirebaseProjectId(e.target.value)}
                          placeholder="e.g. concise-tributary-mggh3"
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Firestore Database ID</label>
                        <input
                          type="text"
                          value={firebaseDbId}
                          onChange={(e) => setFirebaseDbId(e.target.value)}
                          placeholder="Database ID"
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Web API Key</label>
                        <input
                          type="password"
                          value={firebaseApiKey}
                          onChange={(e) => setFirebaseApiKey(e.target.value)}
                          placeholder="AIzaSy..."
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                        />
                      </div>
                    </div>

                    {/* Firestore Synchronization Actions */}
                    <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs">
                        <span className="font-bold text-white block">Direct Firestore Document Sync</span>
                        <span className="text-[11px] text-slate-400">
                          Replicate local products, sales records, and ledger directly into Firestore documents.
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={handlePushAllToFirestore}
                          disabled={isPushingToFirestore}
                          className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-colors shadow-sm"
                        >
                          <Upload className={`w-3.5 h-3.5 ${isPushingToFirestore ? 'animate-bounce' : ''}`} />
                          <span>{isPushingToFirestore ? 'Pushing...' : `Push Catalog (${products.length})`}</span>
                        </button>

                        <button
                          onClick={handlePullFromFirestore}
                          disabled={isPullingFromFirestore}
                          className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors"
                        >
                          <Download className={`w-3.5 h-3.5 ${isPullingFromFirestore ? 'animate-bounce' : ''}`} />
                          <span>{isPullingFromFirestore ? 'Pulling...' : 'Pull Catalog'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handleSaveCloudConfig}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
                    >
                      Save Configuration
                    </button>
                  </div>
                </div>
              </div>

              {/* Central Database Outlets & Branches Cash Float Status */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-emerald-400" />
                      Central Database Outlets & Branches Cash Floats
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Live synced Opening Amount (आरंभिक रोकड़) and Added Cash (जोड़ी रोकड़) stored in central database and Cloud Firestore.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetchCentralOutlets();
                        if (res.outlets && res.outlets.length > 0) {
                          onUpdateStoreSettings({
                            ...storeSettings,
                            stores: res.outlets,
                          });
                        }
                      } catch (e) {}
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-emerald-400 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sync From DB Now</span>
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-700/80">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-[10px] uppercase text-slate-400 tracking-wider">
                      <tr>
                        <th className="p-3">Outlet / Branch</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Opening Cash</th>
                        <th className="p-3 text-right">Added Cash</th>
                        <th className="p-3 text-right">Est. Drawer Cash</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 bg-slate-950/50 font-mono">
                      {outletsList.map((outlet) => {
                        const isCurrentActive = storeSettings.activeStoreId === outlet.id;
                        const op = typeof outlet.openingCash === 'number'
                          ? outlet.openingCash
                          : (isCurrentActive ? (storeSettings.openingAmount ?? 0) : 0);
                        const ad = typeof outlet.addedCash === 'number'
                          ? outlet.addedCash
                          : (isCurrentActive ? (storeSettings.addedCash ?? 0) : 0);
                        const txs = transactions.filter((t) => !t.voided && isMatchingOutlet(t, outlet.id) && (t.timestamp || '').startsWith(todayDateStr));
                        const cs = txs.filter((t) => t.type === 'sale' && t.paymentMode === 'cash').reduce((s, t) => s + (t.amount || 0), 0);
                        const ex = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
                        const inHand = typeof outlet.cashInHand === 'number' && outlet.cashInHand > 0
                          ? outlet.cashInHand
                          : Math.max(0, op + ad + cs - ex);

                        return (
                          <tr key={outlet.id} className="hover:bg-slate-900/60 font-sans">
                            <td className="p-3">
                              <div className="font-bold text-white flex items-center gap-1.5">
                                {outlet.shopName}
                                {outlet.isDefault && (
                                  <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-300 text-[9px] rounded border border-blue-500/30">
                                    HQ
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500">{outlet.address || 'Local branch'}</div>
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-bold">
                                DB Synced
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-400 text-sm">
                              ₹{op.toLocaleString('en-IN')}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-blue-400 text-sm">
                              ₹{ad.toLocaleString('en-IN')}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-amber-400 text-sm">
                              ₹{inHand.toLocaleString('en-IN')}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleOpenCashEdit(outlet)}
                                className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              >
                                Edit Cash
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Database Backup & Disaster Recovery */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-amber-400" />
                    Database Backup, Export & Factory Reset
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Maintain offline copies or restore entire store catalog and sales history.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleExportFullDatabaseJson}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-700 text-white border border-slate-700 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>Download Full Backup (.JSON)</span>
                  </button>

                  <label className="px-4 py-2 bg-slate-900 hover:bg-slate-700 text-white border border-slate-700 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer">
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span>Restore Database (.JSON)</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportDatabaseJson}
                      className="hidden"
                    />
                  </label>

                  <button
                    onClick={() => setShowResetConfirmModal(true)}
                    className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors ml-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Factory Reset Database</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
                <div>
                  <h3 className="text-sm font-bold text-white">Central Admin Audit Trail</h3>
                  <p className="text-xs text-slate-400">
                    Chronological activity log of catalog changes, rate adjustments, voided bills, and staff actions.
                  </p>
                </div>
                <span className="text-xs text-slate-400">{auditLogs.length} events recorded</span>
              </div>

              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60">
                <div className="overflow-y-auto max-h-[500px] divide-y divide-slate-800/60">
                  {auditLogs.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No audit events recorded yet.
                    </div>
                  ) : (
                    auditLogs.map((log) => (
                      <div key={log.id} className="p-3 text-xs flex items-start gap-3 hover:bg-slate-900/40">
                        <div className="p-1.5 bg-amber-500/20 text-amber-300 rounded-lg shrink-0 mt-0.5">
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-white">{log.action}</span>
                            <span className="text-[10px] text-slate-500">
                              {new Date(log.timestamp).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <p className="text-slate-300 text-[11px] mt-0.5">{log.details}</p>
                          <div className="text-[10px] text-slate-400 mt-1">
                            Actor: <span className="text-amber-400 font-semibold">{log.performedBy}</span> &bull; Entity: {log.entity}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL: ADD PRODUCT */}
        {showAddProductModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-base text-white">Add New Product to Central Catalog</h3>
                <button
                  onClick={() => setShowAddProductModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddNewProductSubmit} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Product Name (English) *</label>
                    <input
                      type="text"
                      required
                      value={newProductForm.name}
                      onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
                      placeholder="e.g. Kashmiri Kesar"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Hindi Name (Optional)</label>
                    <input
                      type="text"
                      value={newProductForm.hindiName}
                      onChange={(e) => setNewProductForm({ ...newProductForm, hindiName: e.target.value })}
                      placeholder="e.g. कश्मीरी केसर"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Category</label>
                    <select
                      value={newProductForm.category}
                      onChange={(e) => setNewProductForm({ ...newProductForm, category: e.target.value as any })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                    >
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Unit</label>
                    <select
                      value={newProductForm.unit}
                      onChange={(e) => setNewProductForm({ ...newProductForm, unit: e.target.value as any })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                    >
                      <option value="kg">kg (Kilogram)</option>
                      <option value="g">g (Gram)</option>
                      <option value="packet">packet (Pack)</option>
                      <option value="litre">litre (Litre)</option>
                      <option value="piece">piece (Pcs)</option>
                      <option value="quintal">quintal (100kg)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Purchase / Cost Price (₹)</label>
                    <input
                      type="number"
                      step="any"
                      value={newProductForm.costPrice}
                      onChange={(e) => setNewProductForm({ ...newProductForm, costPrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Selling Rate (₹) *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newProductForm.rate}
                      onChange={(e) => setNewProductForm({ ...newProductForm, rate: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-950 border border-amber-500 rounded-xl text-amber-300 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Current Stock Level</label>
                    <input
                      type="number"
                      value={newProductForm.stock}
                      onChange={(e) => setNewProductForm({ ...newProductForm, stock: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Barcode (EAN / UPC)</label>
                    <input
                      type="text"
                      value={newProductForm.barcode}
                      onChange={(e) => setNewProductForm({ ...newProductForm, barcode: e.target.value })}
                      placeholder="e.g. 8901234567890"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddProductModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl"
                  >
                    Add Product
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: BULK PRICE ADJUSTMENT */}
        {showBulkPriceModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-base text-white">Bulk Rate Adjustment</h3>
                <button
                  onClick={() => setShowBulkPriceModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-400">
                Mass update selling prices across all products or a specific category.
              </p>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Target Category</label>
                  <select
                    value={bulkCategory}
                    onChange={(e) => setBulkCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="all">All Products in Store ({products.length})</option>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Percentage Change (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={bulkPercent}
                    onChange={(e) => setBulkPercent(Number(e.target.value))}
                    placeholder="e.g. +5 or -10"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold text-amber-300"
                  />
                  <span className="text-[10px] text-slate-500">
                    Use positive numbers to increase (e.g. +5%), negative to discount (-10%).
                  </span>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Fixed ₹ Offset</label>
                  <input
                    type="number"
                    step="1"
                    value={bulkOffset}
                    onChange={(e) => setBulkOffset(Number(e.target.value))}
                    placeholder="e.g. +5 or -2"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Rounding Rule</label>
                  <select
                    value={bulkRounding}
                    onChange={(e) => setBulkRounding(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="integer">Round to nearest Rupee (₹1)</option>
                    <option value="half">Round to 50 Paise (₹0.50)</option>
                    <option value="none">Exact calculation</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  onClick={() => setShowBulkPriceModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyBulkPriceAdjust}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs"
                >
                  Apply Rate Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: SETTLE JAMA PAYMENT */}
        {selectedUdhaarCust && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-base text-white">Record Jama Payment</h3>
                <button
                  onClick={() => setSelectedUdhaarCust(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1 text-xs">
                <div className="text-slate-400">Customer Name:</div>
                <div className="font-bold text-white text-sm">{selectedUdhaarCust.name}</div>
                <div className="text-slate-400">Current Outstanding:</div>
                <div className="font-mono font-black text-rose-400 text-base">
                  ₹{selectedUdhaarCust.totalDue.toLocaleString('en-IN')}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Amount Received (Jama)
                </label>
                <input
                  type="number"
                  value={jamaAmount}
                  onChange={(e) => setJamaAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-emerald-500 rounded-xl text-white font-mono font-black text-lg text-emerald-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setSelectedUdhaarCust(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSettleJama(selectedUdhaarCust)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs"
                >
                  Confirm Jama Payment
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: FACTORY RESET CONFIRMATION */}
        {showResetConfirmModal && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
            <div className="bg-slate-900 border border-rose-500/50 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl text-slate-100">
              <div className="flex items-center gap-3 text-rose-400">
                <AlertTriangle className="w-8 h-8 shrink-0" />
                <div>
                  <h3 className="font-black text-base text-white">Reset Database to Factory State?</h3>
                  <p className="text-xs text-slate-400">
                    This will clear all transactions, reset customers, and restore initial factory catalog.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs space-y-2">
                <p className="text-slate-300">
                  Type <span className="font-mono font-bold text-rose-400 select-all">RESET_NAYAB_CENTRAL_DB</span> below to confirm:
                </p>
                <input
                  type="text"
                  value={confirmResetText}
                  onChange={(e) => setConfirmResetText(e.target.value)}
                  placeholder="Type RESET_NAYAB_CENTRAL_DB"
                  className="w-full px-3 py-2 bg-slate-900 border border-rose-500/40 rounded-xl text-white font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowResetConfirmModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteFactoryReset}
                  disabled={confirmResetText !== 'RESET_NAYAB_CENTRAL_DB'}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs disabled:opacity-40"
                >
                  Execute Factory Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: ADD STAFF */}
        {showAddStaffModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-base text-white">Add Staff / Cashier Account</h3>
                <button
                  onClick={() => setShowAddStaffModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveNewStaff} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Staff Full Name *</label>
                  <input
                    type="text"
                    required
                    value={staffForm.name}
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                    placeholder="e.g. Suresh Kumar"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Role</label>
                  <select
                    value={staffForm.role}
                    onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="cashier">Cashier (Billing & Cash entry)</option>
                    <option value="manager">Manager (Reports & Catalog view)</option>
                    <option value="owner">Store Owner</option>
                    <option value="master_admin">Master Admin (Full Root Access)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Login PIN *</label>
                    <input
                      type="password"
                      required
                      value={staffForm.pin}
                      onChange={(e) => setStaffForm({ ...staffForm, pin: e.target.value })}
                      placeholder="4-digit PIN"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Phone (Optional)</label>
                    <input
                      type="text"
                      value={staffForm.phone}
                      onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                      placeholder="10-digit number"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddStaffModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl"
                  >
                    Create Staff
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: EDIT / REGISTER STORE OUTLET (CLIENT-SERVER REMOTE ADMIN) */}
        {showOutletModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
            <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 w-full max-w-2xl space-y-4 shadow-2xl text-slate-100 my-8 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-white">
                      {editingOutlet ? `Edit Store Outlet: ${editingOutlet.shopName}` : 'Register New Store Outlet'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Client-Server Architecture • Updates propagate to all counter terminals online
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowOutletModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveOutletSubmit} className="space-y-4 text-xs overflow-y-auto pr-1 flex-1">
                {/* Basic Identity */}
                <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 space-y-3">
                  <span className="text-[11px] uppercase tracking-wider font-black text-amber-400 block">
                    1. Outlet Identity & Branding
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-slate-300 font-semibold mb-1">Store / Branch Name *</label>
                      <input
                        type="text"
                        required
                        value={outletForm.shopName || ''}
                        onChange={(e) => setOutletForm({ ...outletForm, shopName: e.target.value })}
                        placeholder="e.g. Nayab Masale - Main Market"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl text-white font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Shortcut Code</label>
                      <input
                        type="text"
                        maxLength={5}
                        value={outletForm.shortcutName || ''}
                        onChange={(e) => setOutletForm({ ...outletForm, shortcutName: e.target.value.toUpperCase() })}
                        placeholder="e.g. MM, KP"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl text-amber-300 font-black uppercase text-center"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Tagline / Subtitle</label>
                    <input
                      type="text"
                      value={outletForm.tagline || ''}
                      onChange={(e) => setOutletForm({ ...outletForm, tagline: e.target.value })}
                      placeholder="e.g. Authentic Indian Spices & Daily Groceries"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl text-white"
                    />
                  </div>
                </div>

                {/* Location & Contact */}
                <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 space-y-3">
                  <span className="text-[11px] uppercase tracking-wider font-black text-blue-400 block">
                    2. Location & Contact Details
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Phone Number *</label>
                      <input
                        type="tel"
                        required
                        value={outletForm.phone || ''}
                        onChange={(e) => setOutletForm({ ...outletForm, phone: e.target.value })}
                        placeholder="e.g. 9876543210"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Physical Address / Landmark</label>
                      <input
                        type="text"
                        value={outletForm.address || ''}
                        onChange={(e) => setOutletForm({ ...outletForm, address: e.target.value })}
                        placeholder="e.g. Shop 14, Grain Market, Near Clock Tower"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Payments & Tax */}
                <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 space-y-3">
                  <span className="text-[11px] uppercase tracking-wider font-black text-emerald-400 block">
                    3. Payments, UPI QR & Taxes
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">UPI ID for Dynamic QR *</label>
                      <input
                        type="text"
                        required
                        value={outletForm.upiId || ''}
                        onChange={(e) => setOutletForm({ ...outletForm, upiId: e.target.value.trim() })}
                        placeholder="e.g. nayabmasale@upi"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl text-emerald-300 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">UPI Payee Display Name</label>
                      <input
                        type="text"
                        value={outletForm.upiName || ''}
                        onChange={(e) => setOutletForm({ ...outletForm, upiName: e.target.value })}
                        placeholder="e.g. Nayab Masale Store"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">GSTIN (Optional)</label>
                      <input
                        type="text"
                        value={outletForm.gstin || ''}
                        onChange={(e) => setOutletForm({ ...outletForm, gstin: e.target.value.toUpperCase() })}
                        placeholder="e.g. 24AAAAA0000A1Z5"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl text-white font-mono uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Default Tax Rate (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={outletForm.defaultTaxRate || 0}
                        onChange={(e) => setOutletForm({ ...outletForm, defaultTaxRate: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Staff Assignment */}
                <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider font-black text-indigo-400 block">
                      4. Assigned Staff Accounts
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {assignedStaffForOutlet.length} of {(staffAccounts || storeSettings.staffAccounts || []).length} assigned
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(staffAccounts || storeSettings.staffAccounts || []).map((st) => {
                      const isAssigned = assignedStaffForOutlet.includes(st.id);
                      return (
                        <label
                          key={st.id}
                          className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-pointer ${
                            isAssigned
                              ? 'bg-indigo-950/40 border-indigo-500/50 text-white'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAssignedStaffForOutlet([...assignedStaffForOutlet, st.id]);
                              } else {
                                setAssignedStaffForOutlet(assignedStaffForOutlet.filter((id) => id !== st.id));
                              }
                            }}
                            className="rounded border-slate-700 text-indigo-500 focus:ring-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-xs truncate">{st.name}</div>
                            <div className="text-[10px] text-slate-400 capitalize">{st.role} • PIN: ****</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Flags & Configuration */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(outletForm.isDefault)}
                      onChange={(e) => setOutletForm({ ...outletForm, isDefault: e.target.checked })}
                      className="rounded border-slate-700 text-amber-500 focus:ring-0"
                    />
                    <div>
                      <span className="font-semibold text-white">Mark as Primary / HQ Outlet</span>
                      <p className="text-[10px] text-slate-400">Default fallback branch for centralized billing</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={outletForm.active !== false}
                      onChange={(e) => setOutletForm({ ...outletForm, active: e.target.checked })}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                    />
                    <div>
                      <span className="font-semibold text-white">Active Status</span>
                      <p className="text-[10px] text-slate-400">Accept billing and transactions</p>
                    </div>
                  </label>
                </div>

                {/* Form Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowOutletModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingOutlet}
                    className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black rounded-xl shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    {isSavingOutlet ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Saving Online to Central DB...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                        <span>Save Outlet Live</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: LIVE OUTLET DEEP DIVE BREAKDOWN */}
        {viewingOutletDetails && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
            <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl p-6 w-full max-w-3xl space-y-4 shadow-2xl text-slate-100 my-8 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-base text-white">
                        {viewingOutletDetails.outlet?.shopName}
                      </h3>
                      {viewingOutletDetails.outlet?.shortcutName && (
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-extrabold rounded uppercase">
                          {viewingOutletDetails.outlet.shortcutName}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Live Central Server Breakdown • {viewingOutletDetails.metrics?.billCount || 0} Total Transactions
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingOutletDetails(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
                {/* Financial Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Lifetime Revenue</span>
                    <span className="text-lg font-black text-emerald-400 font-mono">
                      ₹{Number(viewingOutletDetails.metrics?.totalRevenue || 0).toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-slate-500 block">All recorded sales</span>
                  </div>

                  <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Today's Sales</span>
                    <span className="text-lg font-black text-amber-400 font-mono">
                      ₹{Number(viewingOutletDetails.metrics?.todaySales || 0).toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-slate-500 block">{viewingOutletDetails.metrics?.todayBills || 0} bills today</span>
                  </div>

                  <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Digital UPI</span>
                    <span className="text-lg font-black text-blue-400 font-mono">
                      ₹{Number(viewingOutletDetails.metrics?.upiSales || 0).toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-slate-500 block">QR payments</span>
                  </div>

                  <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Customer Udhaar</span>
                    <span className="text-lg font-black text-rose-400 font-mono">
                      ₹{Number(viewingOutletDetails.metrics?.udhaarTotal || 0).toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-slate-500 block">{viewingOutletDetails.customers?.length || 0} customers</span>
                  </div>
                </div>

                {/* Cash Float & Drawer Status (Live Synced from Central Database) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gradient-to-r from-emerald-950/30 via-slate-900 to-amber-950/30 p-3 rounded-2xl border border-emerald-500/30">
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-emerald-500/30">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-emerald-400 block">Opening Cash (आरंभिक रोकड़)</span>
                      <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 text-[9px] font-mono rounded font-bold">
                        DB SYNC
                      </span>
                    </div>
                    <span className="text-base font-black text-emerald-300 font-mono block mt-1">
                      ₹{Number(viewingOutletDetails.metrics?.openingCash || 0).toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-slate-400 block">Morning drawer float</span>
                  </div>

                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-blue-500/30">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-blue-400 block">Added Cash (जोड़ी रोकड़)</span>
                      <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-300 text-[9px] font-mono rounded font-bold">
                        DB SYNC
                      </span>
                    </div>
                    <span className="text-base font-black text-blue-300 font-mono block mt-1">
                      ₹{Number(viewingOutletDetails.metrics?.addedCash || 0).toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-slate-400 block">Midday float addition</span>
                  </div>

                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-amber-500/30">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-amber-400 block">Physical Cash In Hand</span>
                      <Coins className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <span className="text-base font-black text-amber-300 font-mono block mt-1">
                      ₹{Number(viewingOutletDetails.metrics?.cashInHand || 0).toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-slate-400 block">Physical drawer total</span>
                  </div>
                </div>

                {/* Assigned Staff Members */}
                <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                  <h4 className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-400" />
                    Assigned Staff Members ({viewingOutletDetails.assignedStaff?.length || 0})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {(!viewingOutletDetails.assignedStaff || viewingOutletDetails.assignedStaff.length === 0) ? (
                      <span className="text-slate-500 italic">No specific staff assigned</span>
                    ) : (
                      viewingOutletDetails.assignedStaff.map((st: any) => (
                        <div
                          key={st.id}
                          className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl flex items-center gap-2"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="font-semibold text-white">{st.name}</span>
                          <span className="text-[10px] text-slate-400 uppercase">({st.role})</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recent Bills from this Outlet */}
                <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                  <h4 className="font-bold text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-amber-400" />
                    Recent Bills & Invoices ({viewingOutletDetails.transactions?.length || 0})
                  </h4>
                  <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left">
                      <thead className="bg-slate-900 text-[10px] uppercase text-slate-400 sticky top-0">
                        <tr>
                          <th className="p-2">Invoice / Time</th>
                          <th className="p-2">Customer</th>
                          <th className="p-2">Mode</th>
                          <th className="p-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                        {(!viewingOutletDetails.transactions || viewingOutletDetails.transactions.length === 0) ? (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-slate-500">
                              No transactions recorded for this branch yet
                            </td>
                          </tr>
                        ) : (
                          viewingOutletDetails.transactions.slice(0, 15).map((tx: any) => (
                            <tr key={tx.id} className="hover:bg-slate-900/50">
                              <td className="p-2">
                                <div className="font-semibold text-white">{tx.invoiceNumber || tx.id.slice(-6)}</div>
                                <div className="text-[10px] text-slate-500 font-sans">
                                  {tx.timestamp ? new Date(tx.timestamp).toLocaleString('en-IN') : '-'}
                                </div>
                              </td>
                              <td className="p-2 font-sans text-slate-300">
                                {tx.customerName || 'Walk-in'}
                              </td>
                              <td className="p-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold ${
                                  tx.paymentMode === 'cash'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : tx.paymentMode === 'online_upi'
                                    ? 'bg-blue-500/20 text-blue-300'
                                    : 'bg-rose-500/20 text-rose-300'
                                }`}>
                                  {tx.paymentMode || 'cash'}
                                </span>
                              </td>
                              <td className="p-2 text-right font-black text-emerald-400">
                                ₹{Number(tx.amount || 0).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Linked Khata Customers */}
                <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                  <h4 className="font-bold text-slate-300 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-rose-400" />
                    Customer Khata Accounts Linked ({viewingOutletDetails.customers?.length || 0})
                  </h4>
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-800">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2">
                      {(!viewingOutletDetails.customers || viewingOutletDetails.customers.length === 0) ? (
                        <div className="sm:col-span-2 text-center text-slate-500 py-3">
                          No customer khata accounts specifically linked to this outlet
                        </div>
                      ) : (
                        viewingOutletDetails.customers.map((cust: any) => (
                          <div
                            key={cust.id}
                            className="p-2 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between"
                          >
                            <div>
                              <div className="font-semibold text-white">{cust.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{cust.phone || 'No phone'}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-bold text-rose-400">
                                ₹{Number(cust.totalDue || 0).toLocaleString('en-IN')}
                              </div>
                              <div className="text-[9px] text-slate-500">Balance Due</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const o = viewingOutletDetails.outlet;
                    setViewingOutletDetails(null);
                    if (o) handleOpenEditOutlet(o);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl font-bold cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit This Outlet</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewingOutletDetails(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl cursor-pointer"
                >
                  Close Report
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: QUICK CASH FLOAT & OPENING/ADDED CASH SYNC */}
        {cashEditOutlet && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
            <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl text-slate-100 my-8">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-white">
                      Cash Float Management & DB Sync
                    </h3>
                    <p className="text-xs text-slate-400">
                      {cashEditOutlet.shopName} {cashEditOutlet.shortcutName ? `(${cashEditOutlet.shortcutName})` : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCashEditOutlet(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveCashEdit} className="space-y-4 text-xs">
                <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-300">Sync Target: Central Server Database</span>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-mono text-[10px] font-bold">
                      LIVE API & FIRESTORE
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Updating the opening amount and added cash here will immediately synchronize to the Central Server database (/api/db/outlets/:id/cash) and Cloud Firestore for all counter terminals.
                  </p>
                </div>

                {/* Mode Selector: Direct Set vs Add Midday Float */}
                <div className="grid grid-cols-2 gap-2 bg-slate-950/50 p-1.5 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCashEditForm({ ...cashEditForm, mode: 'set' })}
                    className={`py-2 text-center rounded-lg font-bold transition-all cursor-pointer ${
                      cashEditForm.mode === 'set'
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Set Opening / Added Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setCashEditForm({ ...cashEditForm, mode: 'add' })}
                    className={`py-2 text-center rounded-lg font-bold transition-all cursor-pointer ${
                      cashEditForm.mode === 'add'
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    + Quick Add Midday Cash
                  </button>
                </div>

                {cashEditForm.mode === 'set' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Opening Amount (आरंभिक रोकड़) — ₹
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={cashEditForm.openingCash}
                        onChange={(e) =>
                          setCashEditForm({ ...cashEditForm, openingCash: Number(e.target.value) || 0 })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl text-white font-mono text-base font-bold"
                        placeholder="e.g. 1000"
                        required
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        Cash present in drawer when this outlet starts daily billing.
                      </span>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Added Cash (जोड़ी गई रोकड़) — ₹
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={cashEditForm.addedCash}
                        onChange={(e) =>
                          setCashEditForm({ ...cashEditForm, addedCash: Number(e.target.value) || 0 })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-xl text-white font-mono text-base font-bold"
                        placeholder="e.g. 500"
                        required
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        Additional cash injected into drawer for change during the day.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                      <div>
                        <span className="text-slate-400 block">Current Opening Cash:</span>
                        <strong className="text-emerald-400 font-mono text-sm">₹{cashEditForm.openingCash.toLocaleString('en-IN')}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Current Added Cash:</span>
                        <strong className="text-blue-400 font-mono text-sm">₹{cashEditForm.addedCash.toLocaleString('en-IN')}</strong>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Amount of Cash to Add Right Now — ₹
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={cashEditForm.amountToAdd || ''}
                        onChange={(e) =>
                          setCashEditForm({ ...cashEditForm, amountToAdd: Number(e.target.value) || 0 })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-emerald-500 rounded-xl text-white font-mono text-lg font-bold"
                        placeholder="e.g. 500"
                        autoFocus
                        required
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        Will be added to the current Added Cash float (₹{cashEditForm.addedCash} + ₹{cashEditForm.amountToAdd || 0} = ₹{cashEditForm.addedCash + (cashEditForm.amountToAdd || 0)}).
                      </span>
                    </div>

                    {/* Quick Add Presets */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {[100, 200, 500, 1000, 2000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setCashEditForm({ ...cashEditForm, amountToAdd: amt })}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-mono text-xs font-semibold cursor-pointer"
                        >
                          +₹{amt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCashEditOutlet(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingCash}
                    className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black rounded-xl shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    {isSavingCash ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Syncing to Database...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                        <span>Save & Sync Cash to DB</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
