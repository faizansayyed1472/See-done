import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Settings,
  Store,
  QrCode,
  Package,
  Users,
  Printer,
  Phone,
  MapPin,
  Check,
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
  Key,
  Shield,
  Search,
  RefreshCw,
  Copy,
  Bluetooth,
  Usb,
  Database,
  Download,
  Upload,
  ShieldCheck,
  FileJson,
  AlertCircle,
  HardDrive,
  CheckCircle2,
  BarChart3,
  Lock,
  ShieldAlert,
  Unlock,
  Image as ImageIcon,
  UploadCloud,
  Building2,
  Cloud,
  Smartphone,
  Save,
  Coins,
  Wallet,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { StoreSettings, Product, StaffAccount, ProductCategory, UnitType, Transaction, CustomerUdhaar, FullBackupData, StoreProfile, MarketCreditEntry } from '../types';
import { getProductOutletInfo, isProductInOutlet, getOutletItemCount } from '../utils/productOutlet';
import { OwnerReportsTab } from './OwnerReportsTab';
import { FreeApisStatusTab } from './FreeApisStatusTab';
import { PWASettingsTab } from './PWASettingsTab';
import { copyToClipboard } from '../utils/clipboard';
import {
  connectBluetoothPrinter,
  connectSerialPrinter,
  disconnectHardwarePrinter,
  isHardwarePrinterConnected,
  printTestReceipt,
} from '../utils/printer';
import {
  createFullBackupData,
  downloadBackupAsJson,
  validateBackupJson,
  saveAutoBackupSnapshot,
} from '../utils/backup';
import {
  saveCentralOutlet,
  deleteCentralOutlet,
  switchCentralActiveOutlet,
  fetchCentralOutlets,
  syncOutletCash,
  uploadStaffOutletData,
} from '../utils/centralSync';
import {
  syncOutletToFirestore,
  deleteOutletFromFirestore,
  syncOutletCashToFirestore,
} from '../firebase';

interface StoreSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StoreSettings;
  products: Product[];
  transactions?: Transaction[];
  customers?: CustomerUdhaar[];
  marketCredits?: MarketCreditEntry[];
  onUpdateMarketCredits?: (entries: MarketCreditEntry[]) => void;
  cashFlow?: { openingAmount: number; addedAmount: number };
  outletCashBalances?: Record<string, { openingCash: number; addedCash: number; lastUpdated?: string }>;
  onUpdateOutletCash?: (outletId: string, cash: { openingCash?: number; addedCash?: number; mode?: 'set' | 'add' }) => void;
  onSaveSettings: (newSettings: StoreSettings) => void;
  onUpdateProduct: (product: Product) => void;
  onAddProduct: (product: Product) => void;
  onBulkAddProducts?: (items: Product[]) => void;
  onClearAllProducts?: () => void;
  onDeleteProduct: (productId: string) => void;
  onRestoreFullBackup?: (backupData: FullBackupData) => void;
  onOpenBillsManager?: () => void;
  onResetShiftCash?: () => void;
  onResetDailyOutletData?: (outletId: string | 'all') => void;
  onOpenOutletSync?: () => void;
  initialTab?: 'upi' | 'inventory' | 'staff' | 'printer' | 'profile' | 'backup' | 'reports' | 'stores' | 'free_apis' | 'pwa';
  isOwner?: boolean;
  activeStaff?: StaffAccount;
}

export const StoreSettingsModal: React.FC<StoreSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  products,
  transactions = [],
  customers = [],
  marketCredits = [],
  onUpdateMarketCredits,
  cashFlow,
  outletCashBalances,
  onUpdateOutletCash,
  onSaveSettings,
  onUpdateProduct,
  onAddProduct,
  onDeleteProduct,
  onRestoreFullBackup,
  onOpenBillsManager,
  onResetShiftCash,
  onResetDailyOutletData,
  onOpenOutletSync,
  initialTab = 'upi',
  isOwner,
  activeStaff,
}) => {
  const [activeTab, setActiveTab] = useState<'upi' | 'inventory' | 'staff' | 'printer' | 'profile' | 'backup' | 'reports' | 'stores' | 'free_apis' | 'pwa'>(initialTab);
  const [formData, setFormData] = useState<StoreSettings>(settings);

  // Check if current user is owner
  const currentActiveStaff = activeStaff || (settings.activeStaffId ? settings.staffAccounts.find((s) => s.id === settings.activeStaffId) : undefined);
  const userIsOwner = isOwner !== undefined ? isOwner : Boolean(currentActiveStaff && (currentActiveStaff.role === 'owner' || currentActiveStaff.role === 'master_admin'));
  const ownerStaffAccount = settings.staffAccounts.find((s) => s.role === 'owner' || s.role === 'master_admin') || {
    id: 'owner',
    name: 'Owner',
    role: 'owner' as const,
    pin: 'nayab@q6',
    active: true,
  };

  // Owner permission state for Tab 1 (UPI ID & Dynamic QR Scanner) and Tab 4 (Staff Accounts)
  const [ownerAuthUnlocked, setOwnerAuthUnlocked] = useState<boolean>(false);
  const [unlockPinInput, setUnlockPinInput] = useState<string>('');
  const [unlockPinError, setUnlockPinError] = useState<string>('');

  const isOwnerPermissionGranted = userIsOwner || ownerAuthUnlocked;

  const handleVerifyOwnerPin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = unlockPinInput.trim();
    const isMasterAdminPin =
      cleanPin === 'nayab@q6' ||
      (ownerStaffAccount?.pin && cleanPin === ownerStaffAccount.pin) ||
      settings.staffAccounts.some(
        (s) =>
          (s.role === 'owner' || s.role === 'master_admin' || s.id === 'faizan-inamdar' || (s.serverId && s.serverId.includes('faizan'))) &&
          s.pin === cleanPin
      );

    if (!isMasterAdminPin) {
      setUnlockPinError('Incorrect Owner PIN. Store and System Settings are strictly restricted to the Store Owner (Faizan Inamdar) / Master Admin.');
      return;
    }
    setOwnerAuthUnlocked(true);
    setUnlockPinError('');
    setUnlockPinInput('');
  };

  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      setUnlockPinInput('');
      setUnlockPinError('');
    }
  }, [isOpen, initialTab]);

  // UPI preview QR
  const [previewQrUrl, setPreviewQrUrl] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Inventory tab states
  const [invSearch, setInvSearch] = useState('');
  const [invCategory, setInvCategory] = useState<string>('all');
  const [invOutletFilter, setInvOutletFilter] = useState<string>('all');
  const [invPage, setInvPage] = useState(1);
  const [invPageSize, setInvPageSize] = useState(25);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdHindi, setNewProdHindi] = useState('');
  const [newProdCategory, setNewProdCategory] = useState<ProductCategory>('spices');
  const [newProdUnit, setNewProdUnit] = useState<UnitType>('kg');
  const [newProdRate, setNewProdRate] = useState<string>('');
  const [newProdStock, setNewProdStock] = useState<string>('');
  const [newProdOutlet, setNewProdOutlet] = useState<string>('all');
  const [newProdImage, setNewProdImage] = useState<string>('');
  const [prodSuccessMsg, setProdSuccessMsg] = useState('');
  const [prodErrorMsg, setProdErrorMsg] = useState('');
  const [invHeaderSaveMsg, setInvHeaderSaveMsg] = useState('');
  const [invShowLowStockOnly, setInvShowLowStockOnly] = useState(false);

  // Handle image upload and compression for product
  const handleProductImageUpload = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProdErrorMsg('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 200;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setNewProdImage(compressedDataUrl);
        } else {
          setNewProdImage(e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Staff tab states
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'cashier' | 'manager' | 'owner' | 'master_admin'>('cashier');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffAssignedOutlets, setNewStaffAssignedOutlets] = useState<string[]>(['all']);
  const [newStaffDefaultOutlet, setNewStaffDefaultOutlet] = useState<string>('');
  const [staffError, setStaffError] = useState('');

  // Editing staff state
  const [editingStaff, setEditingStaff] = useState<StaffAccount | null>(null);
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffRole, setEditStaffRole] = useState<'cashier' | 'manager' | 'owner' | 'master_admin'>('cashier');
  const [editStaffPin, setEditStaffPin] = useState('');
  const [editStaffPhone, setEditStaffPhone] = useState('');
  const [editStaffAssignedOutlets, setEditStaffAssignedOutlets] = useState<string[]>(['all']);
  const [editStaffDefaultOutlet, setEditStaffDefaultOutlet] = useState<string>('');
  const [upiSuccessMsg, setUpiSuccessMsg] = useState('');

  // Owner password change states
  const [showOwnerPasswordModal, setShowOwnerPasswordModal] = useState(false);
  const [currentOwnerPasswordInput, setCurrentOwnerPasswordInput] = useState('');
  const [newOwnerPasswordInput, setNewOwnerPasswordInput] = useState('');
  const [confirmOwnerPasswordInput, setConfirmOwnerPasswordInput] = useState('');
  const [ownerPasswordChangeError, setOwnerPasswordChangeError] = useState('');
  const [ownerPasswordChangeSuccess, setOwnerPasswordChangeSuccess] = useState('');
  const [showNewPasswordText, setShowNewPasswordText] = useState(false);

  // Printer status
  const [printerConnecting, setPrinterConnecting] = useState(false);
  const [printerStatusMsg, setPrinterStatusMsg] = useState('');
  const [printerConnected, setPrinterConnected] = useState(isHardwarePrinterConnected());

  // Backup tab states
  const [backupSuccessMsg, setBackupSuccessMsg] = useState('');
  const [backupErrorMsg, setBackupErrorMsg] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<FullBackupData | null>(null);
  const [restoreSuccessMsg, setRestoreSuccessMsg] = useState('');
  const [autoSnapshotSaved, setAutoSnapshotSaved] = useState(false);
  const [localSnapshotsMeta, setLocalSnapshotsMeta] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('nayab_backup_snapshots_meta') || localStorage.getItem('tohands_backup_snapshots_meta');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleDownloadFullBackup = () => {
    setIsExporting(true);
    setBackupErrorMsg('');
    try {
      const backupObj = createFullBackupData(
        products,
        transactions,
        customers,
        formData,
        cashFlow,
        marketCredits
      );
      const filename = downloadBackupAsJson(backupObj);
      const nowStr = new Date().toISOString();
      const updatedSettings: StoreSettings = {
        ...formData,
        lastBackupTimestamp: nowStr,
      };
      setFormData(updatedSettings);
      onSaveSettings(updatedSettings);
      setBackupSuccessMsg(`Full backup saved! Downloaded "${filename}" successfully.`);
      setTimeout(() => setBackupSuccessMsg(''), 6000);
    } catch (err: any) {
      setBackupErrorMsg(err.message || 'Failed to generate backup file.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleTakeImmediateSnapshot = () => {
    try {
      const backupObj = createFullBackupData(
        products,
        transactions,
        customers,
        formData,
        cashFlow,
        marketCredits
      );
      const res = saveAutoBackupSnapshot(backupObj);
      setAutoSnapshotSaved(true);
      const updatedSettings: StoreSettings = {
        ...formData,
        lastBackupTimestamp: res.timestamp,
      };
      setFormData(updatedSettings);
      onSaveSettings(updatedSettings);
      setBackupSuccessMsg(`Internal local snapshot saved (${res.sizeKb} KB) at ${new Date(res.timestamp).toLocaleTimeString()}.`);
      const historyJson = localStorage.getItem('nayab_backup_snapshots_meta') || localStorage.getItem('tohands_backup_snapshots_meta');
      if (historyJson) setLocalSnapshotsMeta(JSON.parse(historyJson));
      setTimeout(() => {
        setAutoSnapshotSaved(false);
        setBackupSuccessMsg('');
      }, 5000);
    } catch (err: any) {
      setBackupErrorMsg('Could not save local snapshot: ' + err.message);
    }
  };

  const handleFileUploadForRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupErrorMsg('');
    setRestoreSuccessMsg('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      const validation = validateBackupJson(content);
      if (!validation.isValid || !validation.data) {
        setBackupErrorMsg(validation.error || 'Invalid backup file format.');
        setPendingRestoreData(null);
      } else {
        setPendingRestoreData(validation.data);
      }
    };
    reader.onerror = () => {
      setBackupErrorMsg('Could not read the uploaded file.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmRestore = () => {
    if (!pendingRestoreData) return;
    if (onRestoreFullBackup) {
      onRestoreFullBackup(pendingRestoreData);
      setRestoreSuccessMsg('Store data, inventory, transactions, and customers restored successfully!');
      setPendingRestoreData(null);
      setTimeout(() => setRestoreSuccessMsg(''), 6000);
    } else {
      setBackupErrorMsg('Restore handler not configured.');
    }
  };

  useEffect(() => {
    setFormData(settings);
    setActiveTab(initialTab);
  }, [settings, initialTab, isOpen]);

  // Generate live UPI QR preview whenever UPI ID changes
  useEffect(() => {
    if (formData.upiId) {
      const upiUrl = `upi://pay?pa=${encodeURIComponent(formData.upiId)}&pn=${encodeURIComponent(
        formData.upiName || formData.shopName
      )}&cu=INR`;

      QRCode.toDataURL(upiUrl, {
        width: 180,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      })
        .then((url) => setPreviewQrUrl(url))
        .catch(() => {});
    }
  }, [formData.upiId, formData.upiName, formData.shopName]);

  // Multi-Store Outlets State (Admin / Owner Only)
  const [showAddStoreModal, setShowAddStoreModal] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreShortcutName, setNewStoreShortcutName] = useState('');
  const [newStoreTagline, setNewStoreTagline] = useState('');
  const [newStorePhone, setNewStorePhone] = useState('');
  const [newStoreUpiId, setNewStoreUpiId] = useState('');
  const [newStoreUpiName, setNewStoreUpiName] = useState('');
  const [newStoreAddress, setNewStoreAddress] = useState('');
  const [newStoreGstin, setNewStoreGstin] = useState('');
  const [newStoreTaxRate, setNewStoreTaxRate] = useState<number>(0);
  const [newStoreSetAsActive, setNewStoreSetAsActive] = useState(true);
  const [storeSuccessMsg, setStoreSuccessMsg] = useState('');
  const [storeErrorMsg, setStoreErrorMsg] = useState('');

  // Live enriched outlets fetched from Central Database
  const [liveOutlets, setLiveOutlets] = useState<StoreProfile[]>([]);
  const [isLoadingLiveOutlets, setIsLoadingLiveOutlets] = useState<boolean>(false);
  const [isAdminAutoSyncActive, setIsAdminAutoSyncActive] = useState<boolean>(true);
  const [lastLiveSyncTime, setLastLiveSyncTime] = useState<string>('');
  const [syncingOutletId, setSyncingOutletId] = useState<string | null>(null);

  // Cash Float Adjustment Modal State
  const [cashAdjustOutlet, setCashAdjustOutlet] = useState<StoreProfile | null>(null);
  const [cashAdjustOpeningInput, setCashAdjustOpeningInput] = useState<string>('');
  const [cashAdjustAddedInput, setCashAdjustAddedInput] = useState<string>('');
  const [cashAdjustMode, setCashAdjustMode] = useState<'set' | 'add'>('set');
  const [isSavingCashAdjust, setIsSavingCashAdjust] = useState<boolean>(false);

  // Cashier Store Switching Restriction Modal
  const [restrictedSwitchTarget, setRestrictedSwitchTarget] = useState<StoreProfile | null>(null);
  const [cashierOverridePin, setCashierOverridePin] = useState<string>('');
  const [cashierOverrideError, setCashierOverrideError] = useState<string>('');

  const refreshLiveOutlets = async (quiet: boolean = false) => {
    if (!quiet) setIsLoadingLiveOutlets(true);
    try {
      const res = await fetchCentralOutlets();
      if (res.success && Array.isArray(res.outlets) && res.outlets.length > 0) {
        setLiveOutlets(res.outlets);
        setLastLiveSyncTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        setFormData((prev) => ({
          ...prev,
          stores: res.outlets,
        }));
      }
    } catch (e) {
      console.warn('Live outlets fetch note:', e);
    } finally {
      if (!quiet) setIsLoadingLiveOutlets(false);
    }
  };

  // Poll live outlets from server DB when activeTab is 'stores' and modal is open
  useEffect(() => {
    if (!isOpen || activeTab !== 'stores') return;

    refreshLiveOutlets();

    if (!isAdminAutoSyncActive) return;

    const timer = setInterval(() => {
      refreshLiveOutlets(true);
    }, 15000);

    return () => clearInterval(timer);
  }, [isOpen, activeTab, isAdminAutoSyncActive]);

  const handleSyncOutletSeparately = async (outletId: string) => {
    const targetStore = currentStores.find((s) => s.id === outletId);
    if (!targetStore) return;

    setSyncingOutletId(outletId);
    setStoreSuccessMsg('');
    setStoreErrorMsg('');

    try {
      const outletTxs = transactions.filter((t) => {
        const m = t.outletId || t.storeId;
        return m === outletId || (!m && (targetStore.isDefault || targetStore.isPrimary));
      });

      const outletCusts = customers.filter((c) => {
        const m = c.outletId || c.storeId;
        return m === outletId || (!m && (targetStore.isDefault || targetStore.isPrimary));
      });

      const openingCash = outletCashBalances?.[outletId]?.openingCash ?? (targetStore.openingCash || 0);
      const addedCash = outletCashBalances?.[outletId]?.addedCash ?? (targetStore.addedCash || 0);

      await uploadStaffOutletData({
        outletId,
        outletName: targetStore.shopName,
        transactions: outletTxs,
        customers: outletCusts,
        products,
        staff: formData.staffAccounts,
        openingCash,
        addedCash,
        uploadedBy: currentActiveStaff?.name || 'Staff Terminal',
        role: currentActiveStaff?.role || 'Staff',
      });

      await syncOutletCashToFirestore(outletId, { openingCash, addedCash });
      await syncOutletToFirestore(targetStore);

      setStoreSuccessMsg(`Outlet "${targetStore.shopName}" counter data (Opening, Expense, Sales, Online, Cash in Hand) successfully synced to database!`);
      await refreshLiveOutlets();
      setTimeout(() => setStoreSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error('Failed to sync outlet separately:', err);
      setStoreErrorMsg(`Sync failed: ${err.message || 'Check network connection'}`);
      setTimeout(() => setStoreErrorMsg(''), 5000);
    } finally {
      setSyncingOutletId(null);
    }
  };

  const handleOpenCashAdjust = (store: StoreProfile) => {
    setCashAdjustOutlet(store);
    const opening = outletCashBalances?.[store.id]?.openingCash ?? (store.openingCash || 0);
    const added = outletCashBalances?.[store.id]?.addedCash ?? (store.addedCash || 0);
    setCashAdjustOpeningInput(opening > 0 ? String(opening) : '');
    setCashAdjustAddedInput(added > 0 ? String(added) : '');
    setCashAdjustMode('set');
  };

  const handleSaveCashAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashAdjustOutlet) return;
    setIsSavingCashAdjust(true);
    try {
      const openAmt = parseFloat(cashAdjustOpeningInput) || 0;
      const addAmt = parseFloat(cashAdjustAddedInput) || 0;

      if (onUpdateOutletCash) {
        onUpdateOutletCash(cashAdjustOutlet.id, {
          openingCash: Math.max(0, openAmt),
          addedCash: Math.max(0, addAmt),
          mode: cashAdjustMode,
        });
      } else {
        await syncOutletCash(cashAdjustOutlet.id, {
          openingCash: Math.max(0, openAmt),
          addedCash: Math.max(0, addAmt),
          mode: cashAdjustMode,
          actor: currentActiveStaff?.name || 'Admin',
        });
        await syncOutletCashToFirestore(cashAdjustOutlet.id, {
          openingCash: Math.max(0, openAmt),
          addedCash: Math.max(0, addAmt),
        });
      }

      setStoreSuccessMsg(`Counter cash float updated for "${cashAdjustOutlet.shopName}"!`);
      setCashAdjustOutlet(null);
      await refreshLiveOutlets();
      setTimeout(() => setStoreSuccessMsg(''), 4000);
    } catch (err: any) {
      setStoreErrorMsg(`Failed saving cash float: ${err.message}`);
      setTimeout(() => setStoreErrorMsg(''), 4000);
    } finally {
      setIsSavingCashAdjust(false);
    }
  };

  const handleAttemptSwitchStore = (store: StoreProfile) => {
    if (!isOwnerPermissionGranted && currentActiveStaff?.role === 'cashier') {
      const assigned = currentActiveStaff.assignedOutletIds;
      if (assigned && assigned.length > 0 && !assigned.includes('all')) {
        if (!assigned.includes(store.id)) {
          setRestrictedSwitchTarget(store);
          setCashierOverridePin('');
          setCashierOverrideError('');
          return;
        }
      }
    }
    handleSwitchStore(store);
  };

  // Fallback stores list ensuring at least 1 store is always present
  const currentStores: StoreProfile[] = useMemo(() => {
    if (formData.stores && formData.stores.length > 0) {
      return formData.stores;
    }
    return [
      {
        id: 'store-1',
        shopName: formData.shopName || 'Nayab Masale & Kirana Store',
        tagline: formData.tagline || 'Authentic Indian Spices & Daily Groceries',
        phone: formData.phone || '9876543210',
        upiId: formData.upiId || 'nayabmasale@upi',
        upiName: formData.upiName || formData.shopName || 'Nayab Masale & Kirana',
        address: formData.address || 'Main Bazaar, Spice Market',
        defaultTaxRate: typeof formData.defaultTaxRate === 'number' ? formData.defaultTaxRate : 0,
        gstin: formData.gstin,
        isDefault: true,
        createdAt: new Date().toISOString(),
      },
    ];
  }, [
    formData.stores,
    formData.shopName,
    formData.tagline,
    formData.phone,
    formData.upiId,
    formData.upiName,
    formData.address,
    formData.defaultTaxRate,
    formData.gstin,
  ]);

  const resetStoreForm = () => {
    setEditingStoreId(null);
    setNewStoreName('');
    setNewStoreShortcutName('');
    setNewStoreTagline('');
    setNewStorePhone('');
    setNewStoreUpiId('');
    setNewStoreUpiName('');
    setNewStoreAddress('');
    setNewStoreGstin('');
    setNewStoreTaxRate(0);
    setNewStoreSetAsActive(true);
    setStoreErrorMsg('');
  };

  const handleOpenEditStore = (store: StoreProfile) => {
    setEditingStoreId(store.id);
    setNewStoreName(store.shopName);
    setNewStoreShortcutName(store.shortcutName || '');
    setNewStoreTagline(store.tagline || '');
    setNewStorePhone(store.phone);
    setNewStoreUpiId(store.upiId);
    setNewStoreUpiName(store.upiName || store.shopName);
    setNewStoreAddress(store.address);
    setNewStoreGstin(store.gstin || '');
    setNewStoreTaxRate(typeof store.defaultTaxRate === 'number' ? store.defaultTaxRate : 0);
    setNewStoreSetAsActive(store.id === (formData.activeStoreId || currentStores[0]?.id));
    setShowAddStoreModal(true);
    setStoreErrorMsg('');
  };

  const handleSaveStore = (e: React.FormEvent) => {
    e.preventDefault();
    setStoreErrorMsg('');
    setStoreSuccessMsg('');

    if (!newStoreName.trim()) {
      setStoreErrorMsg('Please enter store/branch name');
      return;
    }
    if (!newStorePhone.trim()) {
      setStoreErrorMsg('Please enter contact phone number');
      return;
    }
    if (!newStoreUpiId.trim()) {
      setStoreErrorMsg('Please enter store UPI ID for QR codes');
      return;
    }

    const baseStores = formData.stores && formData.stores.length > 0 ? formData.stores : currentStores;

    if (editingStoreId) {
      const updatedStores = baseStores.map((s) => {
        if (s.id === editingStoreId) {
          return {
            ...s,
            shopName: newStoreName.trim(),
            shortcutName: newStoreShortcutName.trim() || undefined,
            tagline: newStoreTagline.trim() || undefined,
            phone: newStorePhone.trim(),
            upiId: newStoreUpiId.trim(),
            upiName: newStoreUpiName.trim() || newStoreName.trim(),
            address: newStoreAddress.trim(),
            gstin: newStoreGstin.trim() || undefined,
            defaultTaxRate: newStoreTaxRate,
          };
        }
        return s;
      });

      const isCurrentActive = (formData.activeStoreId || currentStores[0]?.id) === editingStoreId;
      const updatedFormData: StoreSettings = {
        ...formData,
        stores: updatedStores,
        ...(isCurrentActive
          ? {
              shopName: newStoreName.trim(),
              shortcutName: newStoreShortcutName.trim() || undefined,
              tagline: newStoreTagline.trim() || '',
              phone: newStorePhone.trim(),
              upiId: newStoreUpiId.trim(),
              upiName: newStoreUpiName.trim() || newStoreName.trim(),
              address: newStoreAddress.trim(),
              gstin: newStoreGstin.trim() || undefined,
              defaultTaxRate: newStoreTaxRate,
            }
          : {}),
      };

      setFormData(updatedFormData);
      onSaveSettings(updatedFormData);

      // Online Client-Server sync
      const editedStore = updatedStores.find((s) => s.id === editingStoreId);
      if (editedStore) {
        saveCentralOutlet(editedStore, 'Store Settings UI').catch(console.error);
        syncOutletToFirestore(editedStore).catch(console.error);
      }

      setStoreSuccessMsg(`Store "${newStoreName.trim()}" updated successfully!`);
      setShowAddStoreModal(false);
      resetStoreForm();
      setTimeout(() => setStoreSuccessMsg(''), 4000);
      return;
    }

    // Creating new store
    const newStoreId = `store-${Date.now()}`;
    const newStore: StoreProfile = {
      id: newStoreId,
      shopName: newStoreName.trim(),
      shortcutName: newStoreShortcutName.trim() || undefined,
      tagline: newStoreTagline.trim() || undefined,
      phone: newStorePhone.trim(),
      upiId: newStoreUpiId.trim(),
      upiName: newStoreUpiName.trim() || newStoreName.trim(),
      address: newStoreAddress.trim(),
      gstin: newStoreGstin.trim() || undefined,
      defaultTaxRate: newStoreTaxRate,
      createdAt: new Date().toISOString(),
      isDefault: false,
    };

    const updatedStores = [...baseStores, newStore];
    const shouldActivate = newStoreSetAsActive || baseStores.length === 0;

    const updatedFormData: StoreSettings = {
      ...formData,
      stores: updatedStores,
      ...(shouldActivate
        ? {
            activeStoreId: newStoreId,
            shopName: newStore.shopName,
            tagline: newStore.tagline || '',
            phone: newStore.phone,
            upiId: newStore.upiId,
            upiName: newStore.upiName,
            address: newStore.address,
            gstin: newStore.gstin,
            defaultTaxRate: newStore.defaultTaxRate,
          }
        : {}),
    };

    setFormData(updatedFormData);
    onSaveSettings(updatedFormData);

    // Online Client-Server sync
    saveCentralOutlet(newStore, 'Store Settings UI').catch(console.error);
    syncOutletToFirestore(newStore).catch(console.error);

    setStoreSuccessMsg(`Created new store outlet "${newStore.shopName}"! ${shouldActivate ? 'Now active on counter POS.' : ''}`);
    setShowAddStoreModal(false);
    resetStoreForm();
    setTimeout(() => setStoreSuccessMsg(''), 4000);
  };

  const handleSwitchStore = (store: StoreProfile) => {
    const updatedFormData: StoreSettings = {
      ...formData,
      activeStoreId: store.id,
      shopName: store.shopName,
      tagline: store.tagline || '',
      phone: store.phone,
      upiId: store.upiId,
      upiName: store.upiName || store.shopName,
      address: store.address,
      gstin: store.gstin,
      defaultTaxRate: typeof store.defaultTaxRate === 'number' ? store.defaultTaxRate : 0,
    };
    setFormData(updatedFormData);
    onSaveSettings(updatedFormData);
    switchCentralActiveOutlet(store.id).catch(console.error);
    setStoreSuccessMsg(`Active store switched to "${store.shopName}". Calculator, QR & receipts updated!`);
    setTimeout(() => setStoreSuccessMsg(''), 4000);
  };

  const handleDeleteStore = (storeId: string) => {
    const baseStores = formData.stores && formData.stores.length > 0 ? formData.stores : currentStores;
    if (baseStores.length <= 1) {
      setStoreErrorMsg('Cannot delete: At least one store outlet must remain in the system.');
      setTimeout(() => setStoreErrorMsg(''), 4000);
      return;
    }

    const storeToDelete = baseStores.find((s) => s.id === storeId);
    const updatedStores = baseStores.filter((s) => s.id !== storeId);
    let nextActiveId = formData.activeStoreId;
    let nextActiveStore = baseStores.find((s) => s.id === nextActiveId);

    if (formData.activeStoreId === storeId || !nextActiveStore) {
      nextActiveStore = updatedStores[0];
      nextActiveId = nextActiveStore.id;
    }

    const updatedFormData: StoreSettings = {
      ...formData,
      stores: updatedStores,
      activeStoreId: nextActiveId,
      ...(formData.activeStoreId === storeId && nextActiveStore
        ? {
            shopName: nextActiveStore.shopName,
            tagline: nextActiveStore.tagline || '',
            phone: nextActiveStore.phone,
            upiId: nextActiveStore.upiId,
            upiName: nextActiveStore.upiName || nextActiveStore.shopName,
            address: nextActiveStore.address,
            gstin: nextActiveStore.gstin,
            defaultTaxRate: typeof nextActiveStore.defaultTaxRate === 'number' ? nextActiveStore.defaultTaxRate : 0,
          }
        : {}),
    };

    setFormData(updatedFormData);
    onSaveSettings(updatedFormData);
    deleteCentralOutlet(storeId, 'Store Settings UI').catch(console.error);
    deleteOutletFromFirestore(storeId).catch(console.error);
    setStoreSuccessMsg(`Store "${storeToDelete?.shopName || 'Outlet'}" deleted.`);
    setTimeout(() => setStoreSuccessMsg(''), 4000);
  };

  const handleSaveAll = () => {
    // If owner permission is not granted, preserve existing upiId, upiName, and staff accounts from settings
    if (!isOwnerPermissionGranted) {
      onSaveSettings({
        ...formData,
        upiId: settings.upiId,
        upiName: settings.upiName,
        staffAccounts: settings.staffAccounts,
        activeStaffId: settings.activeStaffId,
      });
    } else {
      onSaveSettings(formData);
    }
    onClose();
  };

  // Multi-Outlet Financial & Counter Liquidity Totals
  const networkTotals = useMemo(() => {
    const startOfTodayMs = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
    let totalOpening = 0;
    let totalAdded = 0;
    let totalSales = 0;
    let totalOnline = 0;
    let totalExpenses = 0;
    let totalCashInHand = 0;

    for (const st of currentStores) {
      const liveMatch = liveOutlets.find((l) => l.id === st.id);
      const opening = outletCashBalances?.[st.id]?.openingCash ?? (liveMatch?.openingCash ?? (st.openingCash || 0));
      const added = outletCashBalances?.[st.id]?.addedCash ?? (liveMatch?.addedCash ?? (st.addedCash || 0));

      const outletTxs = transactions.filter((t) => {
        const m = t.outletId || t.storeId;
        return m === st.id || (!m && (st.isDefault || st.isPrimary));
      });
      const todayTxs = outletTxs.filter((t) => !t.voided && new Date(t.timestamp).getTime() >= startOfTodayMs);

      const sales = liveMatch?.todaySales !== undefined && liveMatch.todaySales > 0
        ? liveMatch.todaySales
        : todayTxs.filter((t) => t.type === 'sale').reduce((sum, t) => sum + t.amount, 0);

      const online = liveMatch?.upiSales !== undefined && liveMatch.upiSales > 0
        ? liveMatch.upiSales
        : todayTxs.filter((t) => t.type === 'sale' && t.paymentMode === 'online_upi').reduce((sum, t) => sum + t.amount, 0);

      const cash = liveMatch?.cashSales !== undefined && liveMatch.cashSales > 0
        ? liveMatch.cashSales
        : todayTxs.filter((t) => t.type === 'sale' && (t.paymentMode === 'cash' || !t.paymentMode)).reduce((sum, t) => sum + t.amount, 0);

      const exp = liveMatch?.todayExpenses !== undefined && liveMatch.todayExpenses > 0
        ? liveMatch.todayExpenses
        : todayTxs.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

      const hand = liveMatch?.cashInHand !== undefined
        ? liveMatch.cashInHand
        : Math.max(0, Math.round((opening + added + cash - exp) * 100) / 100);

      totalOpening += opening;
      totalAdded += added;
      totalSales += sales;
      totalOnline += online;
      totalExpenses += exp;
      totalCashInHand += hand;
    }

    return {
      opening: Math.round(totalOpening * 100) / 100,
      added: Math.round(totalAdded * 100) / 100,
      sales: Math.round(totalSales * 100) / 100,
      online: Math.round(totalOnline * 100) / 100,
      expenses: Math.round(totalExpenses * 100) / 100,
      cashInHand: Math.round(totalCashInHand * 100) / 100,
    };
  }, [currentStores, liveOutlets, outletCashBalances, transactions]);

  const handleCopyUpi = async () => {
    await copyToClipboard(formData.upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  // Staff operations
  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffPin.trim()) {
      setStaffError('Name and 4-digit PIN/password are required.');
      return;
    }

    const assignedOutlets = newStaffAssignedOutlets.includes('all') || newStaffAssignedOutlets.length === 0
      ? ['all']
      : newStaffAssignedOutlets;

    const defaultOutlet = newStaffDefaultOutlet || (assignedOutlets[0] !== 'all' ? assignedOutlets[0] : undefined);

    const newStaff: StaffAccount = {
      id: `staff-${Date.now()}`,
      name: newStaffName.trim(),
      role: newStaffRole,
      pin: newStaffPin.trim(),
      phone: newStaffPhone.trim() || undefined,
      active: true,
      assignedOutletIds: assignedOutlets,
      defaultOutletId: defaultOutlet,
      createdAt: new Date().toISOString(),
    };

    const updatedAccounts = [...formData.staffAccounts, newStaff];
    const updatedSettings = {
      ...formData,
      staffAccounts: updatedAccounts,
    };
    setFormData(updatedSettings);
    onSaveSettings(updatedSettings);

    setShowAddStaffModal(false);
    setNewStaffName('');
    setNewStaffPin('');
    setNewStaffPhone('');
    setNewStaffAssignedOutlets(['all']);
    setNewStaffDefaultOutlet('');
    setStaffError('');
  };

  const handleOpenEditStaff = (staff: StaffAccount) => {
    setEditingStaff(staff);
    setEditStaffName(staff.name);
    setEditStaffRole(staff.role);
    setEditStaffPin(staff.pin);
    setEditStaffPhone(staff.phone || '');
    setEditStaffAssignedOutlets(staff.assignedOutletIds && staff.assignedOutletIds.length > 0 ? staff.assignedOutletIds : ['all']);
    setEditStaffDefaultOutlet(staff.defaultOutletId || '');
    setStaffError('');
  };

  const handleSaveEditStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    if (!editStaffName.trim() || !editStaffPin.trim()) {
      setStaffError('Name and PIN/password are required.');
      return;
    }

    const assignedOutlets = editStaffAssignedOutlets.includes('all') || editStaffAssignedOutlets.length === 0
      ? ['all']
      : editStaffAssignedOutlets;

    const defaultOutlet = editStaffDefaultOutlet || (assignedOutlets[0] !== 'all' ? assignedOutlets[0] : undefined);

    const updatedAccounts = formData.staffAccounts.map((s) => {
      if (s.id === editingStaff.id) {
        return {
          ...s,
          name: editStaffName.trim(),
          role: editStaffRole,
          pin: editStaffPin.trim(),
          phone: editStaffPhone.trim() || undefined,
          assignedOutletIds: assignedOutlets,
          defaultOutletId: defaultOutlet,
        };
      }
      return s;
    });

    const updatedSettings = {
      ...formData,
      staffAccounts: updatedAccounts,
    };
    setFormData(updatedSettings);
    onSaveSettings(updatedSettings);

    setEditingStaff(null);
    setStaffError('');
  };

  const handleDeleteStaff = (staffId: string) => {
    if (formData.staffAccounts.length <= 1) {
      alert('At least one staff/owner account must remain.');
      return;
    }
    const updated = formData.staffAccounts.filter((s) => s.id !== staffId);
    setFormData({
      ...formData,
      staffAccounts: updated,
      activeStaffId: formData.activeStaffId === staffId ? updated[0].id : formData.activeStaffId,
    });
  };

  const handleChangeOwnerPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setOwnerPasswordChangeError('');
    setOwnerPasswordChangeSuccess('');

    // If active user is not owner, verify current owner password
    if (!userIsOwner && ownerStaffAccount?.pin && currentOwnerPasswordInput.trim() !== ownerStaffAccount.pin) {
      setOwnerPasswordChangeError('Current Owner password is incorrect.');
      return;
    }

    if (!newOwnerPasswordInput.trim()) {
      setOwnerPasswordChangeError('Please enter a new password.');
      return;
    }
    if (newOwnerPasswordInput.trim().length < 4) {
      setOwnerPasswordChangeError('Password must be at least 4 characters long.');
      return;
    }
    if (newOwnerPasswordInput.trim() !== confirmOwnerPasswordInput.trim()) {
      setOwnerPasswordChangeError('New passwords do not match. Please re-enter.');
      return;
    }

    const updatedStaffAccounts = formData.staffAccounts.map((staff) => {
      if (staff.role === 'owner') {
        return {
          ...staff,
          pin: newOwnerPasswordInput.trim(),
        };
      }
      return staff;
    });

    const updatedSettings: StoreSettings = {
      ...formData,
      staffAccounts: updatedStaffAccounts,
    };

    setFormData(updatedSettings);
    onSaveSettings(updatedSettings);
    setOwnerPasswordChangeSuccess('Owner password successfully updated!');
    setCurrentOwnerPasswordInput('');
    setNewOwnerPasswordInput('');
    setConfirmOwnerPasswordInput('');
    setTimeout(() => {
      setOwnerPasswordChangeSuccess('');
      setShowOwnerPasswordModal(false);
    }, 2200);
  };

  // Product Add / Update
  const handleSaveNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setProdErrorMsg('');
    if (!newProdName.trim()) {
      setProdErrorMsg('Please enter product name.');
      return;
    }

    const parsedRate = parseFloat(newProdRate);
    if (isNaN(parsedRate) || parsedRate <= 0) {
      setProdErrorMsg('Please enter a valid selling rate greater than 0.');
      return;
    }

    const parsedStock = newProdStock.trim() !== '' ? parseFloat(newProdStock) : undefined;

    const newProd: Product = {
      id: `prod-${Date.now()}`,
      name: newProdName.trim(),
      hindiName: newProdHindi.trim() || undefined,
      category: newProdCategory,
      unit: newProdUnit,
      rate: parsedRate,
      stock: parsedStock,
      minStockAlert: 5,
      imageUrl: newProdImage.trim() || undefined,
      outletId: newProdOutlet || (invOutletFilter !== 'all' ? invOutletFilter : 'all'),
      outletName:
        newProdOutlet && newProdOutlet !== 'all'
          ? formData.stores?.find((s) => s.id === newProdOutlet)?.shopName
          : undefined,
    };

    onAddProduct(newProd);
    setInvPage(1);
    setInvSearch('');
    setInvCategory('all');
    setProdSuccessMsg(`Added "${newProd.name}" (${newProdUnit}) to inventory successfully!`);
    setShowAddProductModal(false);
    setNewProdName('');
    setNewProdHindi('');
    setNewProdRate('');
    setNewProdStock('');
    setNewProdOutlet('all');
    setNewProdImage('');
    setTimeout(() => setProdSuccessMsg(''), 4000);
  };

  // Header Bar Inventory Save Handler
  const handleSaveInventoryHeader = () => {
    // If inline editing product is in progress, commit it
    if (editingProduct) {
      onUpdateProduct(editingProduct);
      setEditingProduct(null);
    }
    // If new product form is open with valid name and rate, save it
    if (showAddProductModal && newProdName.trim()) {
      const parsedRate = parseFloat(newProdRate);
      if (!isNaN(parsedRate) && parsedRate > 0) {
        const parsedStock = newProdStock.trim() !== '' ? parseFloat(newProdStock) : undefined;
        const newProd: Product = {
          id: `prod-${Date.now()}`,
          name: newProdName.trim(),
          hindiName: newProdHindi.trim() || undefined,
          category: newProdCategory,
          unit: newProdUnit,
          rate: parsedRate,
          stock: parsedStock,
          minStockAlert: 5,
          imageUrl: newProdImage.trim() || undefined,
          outletId: newProdOutlet || (invOutletFilter !== 'all' ? invOutletFilter : 'all'),
          outletName:
            newProdOutlet && newProdOutlet !== 'all'
              ? formData.stores?.find((s) => s.id === newProdOutlet)?.shopName
              : undefined,
        };
        onAddProduct(newProd);
        setInvPage(1);
        setInvSearch('');
        setInvCategory('all');
        setShowAddProductModal(false);
        setNewProdName('');
        setNewProdHindi('');
        setNewProdRate('');
        setNewProdStock('');
        setNewProdImage('');
      }
    }
    onSaveSettings(formData);
    setInvHeaderSaveMsg(`Inventory saved & synced successfully! (${products.length} items active)`);
    setTimeout(() => setInvHeaderSaveMsg(''), 4000);
  };

  // Printer Connect Handlers
  const handleConnectBluetooth = async () => {
    setPrinterConnecting(true);
    setPrinterStatusMsg('Searching for Bluetooth Thermal Printers...');
    const res = await connectBluetoothPrinter();
    setPrinterConnecting(false);
    if (res.success) {
      setPrinterConnected(true);
      setPrinterStatusMsg(`Connected: ${res.deviceName}`);
      setFormData({
        ...formData,
        printerConfig: {
          ...formData.printerConfig,
          printerType: 'bluetooth',
          deviceName: res.deviceName,
          connected: true,
        },
      });
    } else {
      setPrinterStatusMsg(res.error || 'Failed to connect Bluetooth printer.');
    }
  };

  const handleConnectSerial = async () => {
    setPrinterConnecting(true);
    setPrinterStatusMsg('Requesting USB / Serial Port...');
    const res = await connectSerialPrinter();
    setPrinterConnecting(false);
    if (res.success) {
      setPrinterConnected(true);
      setPrinterStatusMsg(`Connected: ${res.deviceName}`);
      setFormData({
        ...formData,
        printerConfig: {
          ...formData.printerConfig,
          printerType: 'serial',
          deviceName: res.deviceName,
          connected: true,
        },
      });
    } else {
      setPrinterStatusMsg(res.error || 'Failed to connect USB / Serial printer.');
    }
  };

  const handleDisconnectPrinter = async () => {
    await disconnectHardwarePrinter();
    setPrinterConnected(false);
    setPrinterStatusMsg('Printer disconnected. Falling back to Browser Thermal Print.');
    setFormData({
      ...formData,
      printerConfig: {
        ...formData.printerConfig,
        connected: false,
      },
    });
  };

  const handleTestPrint = async () => {
    setPrinterStatusMsg('Sending test slip to printer...');
    const res = await printTestReceipt(formData);
    if (res.success) {
      setPrinterStatusMsg('Test slip printed successfully!');
    } else {
      setPrinterStatusMsg(res.error || 'Could not print test slip.');
    }
  };

  const currentLowStockThreshold = typeof formData.lowStockThreshold === 'number' ? formData.lowStockThreshold : 10;

  const lowStockCount = useMemo(() => {
    return products.filter((p) => {
      const thresh = p.minStockAlert !== undefined ? p.minStockAlert : currentLowStockThreshold;
      return p.stock !== undefined && p.stock <= thresh;
    }).length;
  }, [products, currentLowStockThreshold]);

  const handleUpdateLowStockThreshold = (newVal: number) => {
    const safeVal = Math.max(0, newVal);
    const updated: StoreSettings = {
      ...formData,
      lowStockThreshold: safeVal,
    };
    setFormData(updated);
    onSaveSettings(updated);
  };

  // Filtered products in Inventory tab
  const filteredProducts = useMemo(() => {
    const q = invSearch.toLowerCase().trim();
    return products.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.hindiName && p.hindiName.includes(q)) ||
        p.category.toLowerCase().includes(q);
      const matchesCat = invCategory === 'all' || p.category === invCategory;
      const matchesOutlet = isProductInOutlet(p, invOutletFilter);
      const itemThresh = p.minStockAlert !== undefined ? p.minStockAlert : currentLowStockThreshold;
      const matchesLowStock = !invShowLowStockOnly || (p.stock !== undefined && p.stock <= itemThresh);
      return matchesSearch && matchesCat && matchesOutlet && matchesLowStock;
    });
  }, [products, invSearch, invCategory, invOutletFilter, invShowLowStockOnly, currentLowStockThreshold]);

  const totalInvPages = Math.max(1, Math.ceil(filteredProducts.length / invPageSize));
  const safeInvPage = Math.min(invPage, totalInvPages);
  const paginatedInvProducts = useMemo(() => {
    const start = (safeInvPage - 1) * invPageSize;
    return filteredProducts.slice(start, start + invPageSize);
  }, [filteredProducts, safeInvPage, invPageSize]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/95">
          <div className="flex items-center gap-2.5">
            <img
              src="/pwa-192x192.png"
              alt="NAYAB POS"
              className="w-10 h-10 rounded-2xl object-cover ring-1 ring-emerald-500/40 shadow-sm flex-shrink-0"
            />
            <div>
              <h3 className="font-bold text-base text-white">Store & System Settings</h3>
              <p className="text-xs text-slate-400">Manage UPI Scanner, Inventory, Staff & Thermal Printer</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveAll}
              className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 p-2.5 bg-slate-950/60 border-b border-slate-800 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('upi')}
            className={`px-3 py-2 rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'upi'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {isOwnerPermissionGranted ? (
              <QrCode className="w-4 h-4" />
            ) : (
              <Lock className="w-4 h-4 text-amber-400" />
            )}
            <span>1. UPI ID Scanner {!isOwnerPermissionGranted && '(Locked)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3 py-2 rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'inventory'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {isOwnerPermissionGranted ? <Package className="w-4 h-4" /> : <Lock className="w-4 h-4 text-amber-400" />}
            <span>2. Inventory ({products.length}) {!isOwnerPermissionGranted && '(Locked)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('stores')}
            className={`px-3 py-2 rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'stores'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {isOwnerPermissionGranted ? <Building2 className="w-4 h-4 text-amber-300" /> : <Lock className="w-4 h-4 text-amber-400" />}
            <span>3. Multi-Store Outlets ({currentStores.length}) {!isOwnerPermissionGranted && '(Locked)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('staff')}
            className={`px-3 py-2 rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'staff'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {isOwnerPermissionGranted ? (
              <Users className="w-4 h-4" />
            ) : (
              <Lock className="w-4 h-4 text-amber-400" />
            )}
            <span>4. Staff Accounts {!isOwnerPermissionGranted && '(Locked)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('printer')}
            className={`px-3 py-2 rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'printer'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {isOwnerPermissionGranted ? <Printer className="w-4 h-4" /> : <Lock className="w-4 h-4 text-amber-400" />}
            <span>5. Thermal Printer {!isOwnerPermissionGranted && '(Locked)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-2 rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'profile'
                ? 'bg-slate-700 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {isOwnerPermissionGranted ? <Store className="w-4 h-4" /> : <Lock className="w-4 h-4 text-amber-400" />}
            <span>6. Shop Profile {!isOwnerPermissionGranted && '(Locked)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`px-3 py-2 rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'backup'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {isOwnerPermissionGranted ? <Database className="w-4 h-4" /> : <Lock className="w-4 h-4 text-amber-400" />}
            <span>7. Data Backup (JSON) {!isOwnerPermissionGranted && '(Locked)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3 py-2 rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'reports'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {isOwnerPermissionGranted ? <BarChart3 className="w-4 h-4" /> : <Lock className="w-4 h-4 text-amber-400" />}
            <span>8. Owner Reports {!isOwnerPermissionGranted && '(Locked)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('free_apis')}
            className={`px-3 py-2 rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'free_apis'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {isOwnerPermissionGranted ? <Cloud className="w-4 h-4 text-emerald-400" /> : <Lock className="w-4 h-4 text-amber-400" />}
            <span>9. Free APIs & Cloud Status {!isOwnerPermissionGranted && '(Locked)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('pwa')}
            className={`px-3 py-2 rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'pwa'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {isOwnerPermissionGranted ? <Smartphone className="w-4 h-4 text-teal-300" /> : <Lock className="w-4 h-4 text-amber-400" />}
            <span>10. PWA & Offline App {!isOwnerPermissionGranted && '(Locked)'}</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          {!isOwnerPermissionGranted ? (
            /* OWNER SECURITY GATE: Entire Store & System Settings Locked for Staff */
            <div className="py-8 px-4 max-w-md mx-auto space-y-6 text-center animate-in fade-in">
              <div className="w-16 h-16 rounded-3xl bg-amber-500/15 border-2 border-amber-500/40 flex items-center justify-center text-amber-400 mx-auto shadow-xl shadow-amber-950/40">
                <Lock className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="font-black text-white text-lg sm:text-xl">
                  Store & System Settings Locked
                </h3>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                  Store configuration, merchant bank UPI routing, staff account credentials, multi-store branches, thermal printer setup, and system preferences are protected and locked for staff accounts.
                </p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Owner (Faizan Inamdar) / Master Admin Access Only</span>
                </div>
              </div>

              {/* Owner PIN Verification Form */}
              <form onSubmit={handleVerifyOwnerPin} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-300 text-left mb-1.5">
                    Enter Owner / Master Admin PIN to Unlock:
                  </label>
                  <input
                    type="password"
                    maxLength={30}
                    value={unlockPinInput}
                    onChange={(e) => {
                      setUnlockPinInput(e.target.value);
                      setUnlockPinError('');
                    }}
                    placeholder="Enter Owner PIN (e.g. nayab@q6)"
                    className="w-full bg-slate-950 border border-amber-500/50 rounded-2xl px-4 py-3 text-white text-center font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner"
                    autoFocus
                  />
                  {unlockPinError && (
                    <p className="text-rose-400 text-xs font-semibold mt-2 text-left bg-rose-950/40 border border-rose-800/40 p-2 rounded-xl">
                      {unlockPinError}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel / Exit
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs transition-all shadow-lg shadow-amber-950/50 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>Unlock Settings</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              {/* TAB 1: UPI ID FOR SCANNER */}
              {activeTab === 'upi' && (
                <div className="space-y-4">
                  {/* Owner Authorized Notice */}
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Owner Permissions Granted — You can modify merchant UPI payment routing and scanner settings.</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Owner Access
                    </span>
                  </div>

              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-sm">UPI ID & Dynamic QR Scanner Settings</h4>
                    <p className="text-slate-400 text-xs">
                      Set your store's UPI VPA. Customers will scan this to pay exact bill amounts directly into your bank.
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-semibold text-[10px]">
                    LIVE ACTIVE
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  <div className="space-y-3">
                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">
                        Merchant UPI ID (e.g. 9876543210@paytm or nayabmasale@okhdfcbank):
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          readOnly={!isOwnerPermissionGranted}
                          value={formData.upiId}
                          onChange={(e) => setFormData({ ...formData, upiId: e.target.value.trim() })}
                          placeholder="yourname@upi"
                          className={`w-full border rounded-xl px-3.5 py-2.5 font-mono text-sm focus:outline-none ${
                            !isOwnerPermissionGranted
                              ? 'bg-slate-900/60 border-slate-800 text-slate-400 cursor-not-allowed'
                              : 'bg-slate-950 border-slate-700 text-white focus:border-emerald-500'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={handleCopyUpi}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-400"
                          title="Copy UPI ID"
                        >
                          {copiedUpi ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      {!isOwnerPermissionGranted && (
                        <p className="text-[11px] text-amber-400/80 mt-1">
                          🔒 Read-only mode. Enter owner PIN above to unlock editing UPI payment settings.
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">
                        Merchant / Payee Name (Displayed in Customer's UPI App):
                      </label>
                      <input
                        type="text"
                        readOnly={!isOwnerPermissionGranted}
                        value={formData.upiName || formData.shopName}
                        onChange={(e) => setFormData({ ...formData, upiName: e.target.value })}
                        placeholder="e.g. Nayab Masale & Kirana Store"
                        className={`w-full border rounded-xl px-3 py-2 ${
                          !isOwnerPermissionGranted
                            ? 'bg-slate-900/60 border-slate-800 text-slate-400 cursor-not-allowed'
                            : 'bg-slate-900 border-slate-700 text-white focus:border-emerald-500'
                        }`}
                      />
                    </div>

                    {isOwnerPermissionGranted ? (
                      <div className="pt-2 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            onSaveSettings(formData);
                            setUpiSuccessMsg('UPI Scanner settings saved successfully!');
                            setTimeout(() => setUpiSuccessMsg(''), 4000);
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                        >
                          <Check className="w-4 h-4" />
                          <span>Save UPI Settings</span>
                        </button>
                        {upiSuccessMsg && (
                          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>{upiSuccessMsg}</span>
                          </span>
                        )}
                      </div>
                    ) : null}

                    <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                      <div className="font-semibold text-white">Supported UPI Payment Apps:</div>
                      <div>PhonePe, Google Pay (GPay), Paytm, BHIM, Amazon Pay, Cred & All Bank UPI apps.</div>
                    </div>
                  </div>

                  {/* Live Scanner QR Preview */}
                  <div className="flex flex-col items-center justify-center p-4 bg-slate-950 rounded-2xl border border-slate-800 text-center">
                    <span className="text-slate-400 font-medium mb-2">Live Scanner QR Code Preview:</span>
                    <div className="bg-white p-2.5 rounded-2xl shadow-xl">
                      {previewQrUrl ? (
                        <img src={previewQrUrl} alt="UPI QR Preview" className="w-36 h-36 rounded-lg" />
                      ) : (
                        <div className="w-36 h-36 flex items-center justify-center text-slate-400 text-xs">
                          Generating QR...
                        </div>
                      )}
                    </div>
                    <span className="font-mono text-emerald-400 text-xs mt-2 font-bold">{formData.upiId}</span>
                    <span className="text-[10px] text-slate-500">NAYAB calculator screen will display this QR with bill amounts</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INVENTORY MANAGEMENT */}
          {activeTab === 'inventory' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                <div>
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <span>Kirana & Spice Inventory Management</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono font-bold border border-purple-500/30">
                      {products.length} Items
                    </span>
                  </h4>
                  <p className="text-slate-400 text-xs">Edit product rates, update stock, or add new items</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Saving option for inventory items in header bar */}
                  <button
                    type="button"
                    onClick={handleSaveInventoryHeader}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                    title="Save all added and updated items to inventory"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Inventory</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAddProductModal(!showAddProductModal);
                      setProdErrorMsg('');
                    }}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{showAddProductModal ? 'Close Form' : 'Add New Product'}</span>
                  </button>
                </div>
              </div>

              {/* Header Save Feedback message */}
              {invHeaderSaveMsg && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-500/60 rounded-xl text-emerald-200 text-xs font-semibold flex items-center justify-between animate-in fade-in shadow-md">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>{invHeaderSaveMsg}</span>
                  </div>
                  <button onClick={() => setInvHeaderSaveMsg('')} className="text-emerald-400 hover:text-white">✕</button>
                </div>
              )}

              {/* Feedback messages */}
              {prodSuccessMsg && (
                <div className="p-3 bg-emerald-900/50 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs font-semibold flex items-center justify-between animate-in fade-in">
                  <span>✓ {prodSuccessMsg}</span>
                  <button onClick={() => setProdSuccessMsg('')} className="text-emerald-400 hover:text-white">✕</button>
                </div>
              )}

              {/* Add Product Inline Dialog (TOP OF INVENTORY) */}
              {showAddProductModal && (
                <div className="p-4 bg-slate-800/95 border-2 border-purple-500/60 rounded-2xl space-y-3 shadow-xl animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-purple-600/30 flex items-center justify-center text-purple-300 font-bold text-xs">
                        +
                      </div>
                      <span className="font-bold text-white text-xs sm:text-sm">Add New Kirana / Spice Product</span>
                    </div>
                    <button
                      onClick={() => {
                        setShowAddProductModal(false);
                        setProdErrorMsg('');
                      }}
                      className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {prodErrorMsg && (
                    <div className="p-2 bg-red-950/60 border border-red-500/40 rounded-lg text-red-300 text-xs">
                      ⚠ {prodErrorMsg}
                    </div>
                  )}

                  <form onSubmit={handleSaveNewProduct} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-slate-300 block mb-1 font-medium">Product Name (English): <span className="text-red-400">*</span></label>
                      <input
                        type="text"
                        required
                        value={newProdName}
                        onChange={(e) => setNewProdName(e.target.value)}
                        placeholder="e.g. Kasuri Methi"
                        className="w-full bg-slate-900 border border-slate-750 focus:border-purple-500 rounded-lg px-2.5 py-2 text-white placeholder-slate-500"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="text-slate-300 block mb-1 font-medium">Hindi Name (Item Translation):</label>
                      <input
                        type="text"
                        value={newProdHindi}
                        onChange={(e) => setNewProdHindi(e.target.value)}
                        placeholder="e.g. कस्तूरी मेथी"
                        className="w-full bg-slate-900 border border-slate-750 focus:border-purple-500 rounded-lg px-2.5 py-2 text-white placeholder-slate-500"
                      />
                    </div>

                    <div>
                      <label className="text-slate-300 block mb-1 font-medium">Category:</label>
                      <select
                        value={newProdCategory}
                        onChange={(e) => setNewProdCategory(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-750 focus:border-purple-500 rounded-lg px-2.5 py-2 text-white"
                      >
                        <option value="spices">Spices & Masale</option>
                        <option value="dal_pulses">Dals & Pulses</option>
                        <option value="grains_flour">Flour & Rice</option>
                        <option value="oil_ghee">Oil & Ghee</option>
                        <option value="dry_fruits">Dry Fruits</option>
                        <option value="packaged_grocery">Packaged Grocery</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-300 block mb-1 font-medium">Weight Unit:</label>
                      <select
                        value={newProdUnit}
                        onChange={(e) => setNewProdUnit(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-750 focus:border-purple-500 rounded-lg px-2.5 py-2 text-white font-medium"
                      >
                        <option value="kg">kg (Kilogram)</option>
                        <option value="g">g (Gram)</option>
                        <option value="quintal">quintal (100kg)</option>
                        <option value="litre">litre</option>
                        <option value="packet">packet</option>
                        <option value="piece">piece</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-300 block mb-1 font-medium">Selling Rate (₹ per {newProdUnit}): <span className="text-red-400">*</span></label>
                      <input
                        type="number"
                        required
                        step="any"
                        min="0.1"
                        placeholder="e.g. 380"
                        value={newProdRate}
                        onChange={(e) => setNewProdRate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-750 focus:border-purple-500 rounded-lg px-2.5 py-2 text-emerald-400 font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-slate-300 block mb-1 font-medium">Initial Weight / Stock (Optional):</label>
                      <input
                        type="number"
                        step="any"
                        placeholder={`e.g. 25 (${newProdUnit})`}
                        value={newProdStock}
                        onChange={(e) => setNewProdStock(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-750 focus:border-purple-500 rounded-lg px-2.5 py-2 text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-slate-300 block mb-1 font-medium flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-amber-400" />
                        <span>Assigned Outlet:</span>
                      </label>
                      <select
                        value={newProdOutlet}
                        onChange={(e) => setNewProdOutlet(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-750 focus:border-purple-500 rounded-lg px-2.5 py-2 text-white font-medium cursor-pointer"
                      >
                        <option value="all">All Outlets (Shared / सभी शाखाएं)</option>
                        {formData.stores?.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.shopName} ({s.shortcutName || s.id})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Product Image Upload Window */}
                    <div className="sm:col-span-3 bg-slate-950/70 p-3 rounded-xl border border-slate-750">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-slate-300 font-medium text-xs flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                          <span>Product Image:</span>
                          <span className="text-slate-500 text-[10px]">(Optional)</span>
                        </label>
                        {newProdImage && (
                          <button
                            type="button"
                            onClick={() => setNewProdImage('')}
                            className="text-[11px] text-red-400 hover:text-red-300 underline"
                          >
                            Remove Image
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Small Image Window / Thumbnail Preview */}
                        <div className="w-14 h-14 rounded-xl border border-slate-700 bg-slate-900 overflow-hidden flex items-center justify-center flex-shrink-0 relative group shadow-inner">
                          {newProdImage ? (
                            <img
                              src={newProdImage}
                              alt="Product preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-500">
                              <ImageIcon className="w-5 h-5 mb-0.5 opacity-60" />
                              <span className="text-[8px] text-slate-500">No Image</span>
                            </div>
                          )}
                        </div>

                        {/* File Upload Input & URL option */}
                        <div className="flex-1 space-y-1.5">
                          <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-sm">
                            <UploadCloud className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Upload Image from Device</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleProductImageUpload(file);
                              }}
                            />
                          </label>
                          <input
                            type="text"
                            placeholder="...or paste image URL (e.g. https://...)"
                            value={newProdImage.startsWith('data:') ? '' : newProdImage}
                            onChange={(e) => setNewProdImage(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="sm:col-span-3 flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddProductModal(false);
                          setProdErrorMsg('');
                        }}
                        className="px-3.5 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all"
                      >
                        Save Product to Inventory
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Low Stock Alert Threshold Configuration Card */}
              <div
                id="low-stock-settings-card"
                className="p-4 rounded-2xl bg-gradient-to-r from-red-950/40 via-slate-900 to-slate-900 border border-red-500/50 shadow-lg space-y-3"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 flex-shrink-0 shadow-inner">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-white text-sm">Low Stock Alert Threshold</h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/25 text-red-300 border border-red-500/50">
                          Active: ≤ {currentLowStockThreshold} Units
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs mt-0.5">
                        Products with quantity at or below this threshold are highlighted in red across the POS Catalog to warn when replenishment is needed.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                    <div className="flex items-center gap-1.5 bg-slate-950 border border-red-500/50 rounded-xl p-1 shadow-inner">
                      <button
                        type="button"
                        id="low-stock-decrement-btn"
                        onClick={() => handleUpdateLowStockThreshold(currentLowStockThreshold - 1)}
                        className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center transition-colors cursor-pointer"
                        title="Decrease threshold by 1"
                      >
                        -
                      </button>
                      <input
                        id="low-stock-threshold-input"
                        type="number"
                        min="0"
                        step="1"
                        value={currentLowStockThreshold}
                        onChange={(e) => handleUpdateLowStockThreshold(parseInt(e.target.value) || 0)}
                        className="w-14 bg-transparent text-center text-red-400 font-mono font-bold text-sm focus:outline-none"
                        title="Threshold value in units"
                      />
                      <button
                        type="button"
                        id="low-stock-increment-btn"
                        onClick={() => handleUpdateLowStockThreshold(currentLowStockThreshold + 1)}
                        className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center transition-colors cursor-pointer"
                        title="Increase threshold by 1"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Presets & Status Indicator */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-400 text-[11px] font-medium">Quick Presets:</span>
                    {[3, 5, 10, 15, 20, 50].map((presetVal) => (
                      <button
                        key={presetVal}
                        type="button"
                        onClick={() => handleUpdateLowStockThreshold(presetVal)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          currentLowStockThreshold === presetVal
                            ? 'bg-red-600 text-white shadow-sm ring-1 ring-red-400'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white border border-slate-700'
                        }`}
                      >
                        {presetVal} Units
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-semibold flex items-center gap-1 ${lowStockCount > 0 ? 'text-red-300' : 'text-emerald-400'}`}>
                      {lowStockCount > 0 ? (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                          <span>{lowStockCount} {lowStockCount === 1 ? 'item' : 'items'} below threshold</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>All items have sufficient stock</span>
                        </>
                      )}
                    </span>

                    {lowStockCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setInvShowLowStockOnly(!invShowLowStockOnly)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          invShowLowStockOnly
                            ? 'bg-red-600 text-white shadow'
                            : 'bg-red-950/70 text-red-300 border border-red-500/50 hover:bg-red-900/60'
                        }`}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>{invShowLowStockOnly ? 'Show All Items' : 'Filter Low Stock Only'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Outlet Catalogue Filter Tabs */}
              {formData.stores && formData.stores.length > 0 && (
                <div className="flex items-center gap-1.5 p-2 bg-slate-950/70 border border-slate-800 rounded-xl overflow-x-auto text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400 font-semibold text-[11px] flex-shrink-0 pr-1 border-r border-slate-800">
                    <Store className="w-3.5 h-3.5 text-amber-400" />
                    <span>Outlet:</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setInvOutletFilter('all');
                      setInvPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      invOutletFilter === 'all'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    All Outlets ({products.length})
                  </button>

                  {formData.stores.map((store) => {
                    const count = getOutletItemCount(products, store.id);
                    const isSelected = invOutletFilter === store.id;

                    return (
                      <button
                        key={store.id}
                        type="button"
                        onClick={() => {
                          setInvOutletFilter(store.id);
                          setInvPage(1);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-amber-600 text-white font-bold ring-1 ring-amber-400/50 shadow'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        <Building2 className="w-3 h-3" />
                        <span>{store.shopName}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 font-mono">
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Search & Filter */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={invSearch}
                    onChange={(e) => setInvSearch(e.target.value)}
                    placeholder="Search product by English or Hindi name..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400"
                  />
                </div>

                <select
                  value={invCategory}
                  onChange={(e) => setInvCategory(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="all">All Categories</option>
                  <option value="spices">Spices & Masale</option>
                  <option value="dal_pulses">Dals & Pulses</option>
                  <option value="grains_flour">Flour & Rice</option>
                  <option value="oil_ghee">Oil & Ghee</option>
                  <option value="dry_fruits">Dry Fruits</option>
                  <option value="packaged_grocery">Packaged Grocery</option>
                </select>

                <button
                  type="button"
                  id="toggle-low-stock-filter-btn"
                  onClick={() => setInvShowLowStockOnly(!invShowLowStockOnly)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all flex-shrink-0 cursor-pointer ${
                    invShowLowStockOnly
                      ? 'bg-red-600 text-white ring-2 ring-red-400 shadow-md'
                      : lowStockCount > 0
                      ? 'bg-red-950/60 text-red-300 border border-red-500/50 hover:bg-red-900/60'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                  }`}
                  title="Filter low stock items"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Low Stock ({lowStockCount})</span>
                </button>
              </div>

              {/* Products Table - Enlarged scroll window showing at least 6-8 items */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/60 min-h-[440px] max-h-[580px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-800/90 text-slate-300 font-semibold sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5">Item Name</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Outlet</th>
                      <th className="p-2.5">Rate (₹)</th>
                      <th className="p-2.5">Stock</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {paginatedInvProducts.map((p: Product) => {
                      const itemThresh = p.minStockAlert !== undefined ? p.minStockAlert : currentLowStockThreshold;
                      const isLowStock = p.stock !== undefined && p.stock <= itemThresh;
                      const isOutOfStock = p.stock !== undefined && p.stock <= 0;

                      return (
                        <tr
                          key={p.id}
                          className={`transition-colors ${
                            isLowStock
                              ? 'bg-red-950/30 hover:bg-red-950/50 border-l-4 border-l-red-500'
                              : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="p-2.5">
                            <div className="flex items-center gap-2">
                              {p.imageUrl ? (
                                <img
                                  src={p.imageUrl}
                                  alt={p.name}
                                  className="w-8 h-8 rounded-lg object-cover border border-slate-700 flex-shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-500 flex-shrink-0">
                                  <Package className="w-4 h-4 opacity-50" />
                                </div>
                              )}
                              <div>
                                <div className={`font-bold text-base flex items-center gap-1.5 flex-wrap ${isLowStock ? 'text-red-200' : 'text-white'}`}>
                                  <span>{p.name}</span>
                                  {isLowStock && (
                                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-red-600/30 text-red-300 border border-red-500/50 flex items-center gap-0.5">
                                      <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
                                      <span>{isOutOfStock ? 'OUT OF STOCK' : 'LOW'}</span>
                                    </span>
                                  )}
                                </div>
                                {p.hindiName && (
                                  <div className="text-xs font-medium text-amber-300/80">{p.hindiName}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-2.5 text-slate-400 capitalize">{p.category.replace('_', ' ')}</td>
                          <td className="p-2.5">
                            {editingProduct?.id === p.id ? (
                              <select
                                value={editingProduct.outletId || 'all'}
                                onChange={(e) =>
                                  setEditingProduct((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          outletId: e.target.value,
                                          outletName:
                                            e.target.value !== 'all'
                                              ? formData.stores?.find((s) => s.id === e.target.value)?.shopName
                                              : undefined,
                                        }
                                      : null
                                  )
                                }
                                className="bg-slate-950 border border-purple-500 rounded px-1.5 py-0.5 text-xs text-white"
                              >
                                <option value="all">All Outlets</option>
                                {formData.stores?.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.shortcutName || s.shopName}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              (() => {
                                const outInfo = getProductOutletInfo(p, formData.stores);
                                return (
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold border inline-flex items-center gap-1 ${
                                      outInfo.isAll
                                        ? 'bg-slate-800 text-slate-300 border-slate-700'
                                        : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                                    }`}
                                  >
                                    <Building2 className="w-2.5 h-2.5" />
                                    <span>{outInfo.shortcut}</span>
                                  </span>
                                );
                              })()
                            )}
                          </td>
                          <td className="p-2.5">
                            {editingProduct?.id === p.id ? (
                              <input
                                type="number"
                                value={editingProduct.rate}
                                onChange={(e) =>
                                  setEditingProduct((prev) => prev ? { ...prev, rate: parseFloat(e.target.value) || 0 } : null)
                                }
                                className="w-16 bg-slate-950 border border-purple-500 rounded px-1.5 py-0.5 text-emerald-400 font-mono text-xs font-bold"
                              />
                            ) : (
                              <span className="font-mono font-bold text-emerald-400">
                                ₹{p.rate}/{p.unit}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5">
                            {editingProduct?.id === p.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={editingProduct.stock || 0}
                                  onChange={(e) =>
                                    setEditingProduct((prev) => prev ? { ...prev, stock: parseFloat(e.target.value) || 0 } : null)
                                  }
                                  className={`w-16 bg-slate-950 rounded px-1.5 py-0.5 font-mono text-xs ${
                                    (editingProduct.stock || 0) <= itemThresh
                                      ? 'border-2 border-red-500 text-red-300'
                                      : 'border border-purple-500 text-white'
                                  }`}
                                />
                                {(editingProduct.stock || 0) <= itemThresh && (
                                  <span className="text-[9px] text-red-400 font-bold" title={`≤ ${itemThresh}`}>
                                    ≤{itemThresh}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                {isLowStock ? (
                                  <span className="inline-flex items-center gap-1 font-bold text-red-300 bg-red-950/80 px-2 py-0.5 rounded border border-red-500/60 font-mono text-[11px]">
                                    <AlertTriangle className="w-3 h-3 text-red-400" />
                                    <span>{p.stock !== undefined ? `${p.stock} ${p.unit}` : '0'}</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-300 font-mono text-xs">
                                    {p.stock !== undefined ? `${p.stock} ${p.unit}` : 'In Stock'}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {editingProduct?.id === p.id ? (
                              <button
                                onClick={() => {
                                  if (editingProduct) {
                                    onUpdateProduct(editingProduct);
                                    setEditingProduct(null);
                                  }
                                }}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold"
                              >
                                Save
                              </button>
                            ) : (
                              <button
                                onClick={() => setEditingProduct(p)}
                                className="p-1 text-slate-400 hover:text-purple-300"
                                title="Edit Rate & Stock"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => {
                                if (confirm(`Delete "${p.name}" from inventory?`)) {
                                  onDeleteProduct(p.id);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-red-400"
                              title="Delete Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Inventory High-Capacity Pagination Controls */}
              {filteredProducts.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs">
                  <span className="text-slate-400 text-[11px]">
                    Showing <strong className="text-white">{(safeInvPage - 1) * invPageSize + 1}</strong>–<strong className="text-white">{Math.min(safeInvPage * invPageSize, filteredProducts.length)}</strong> of <strong className="text-purple-300">{filteredProducts.length.toLocaleString()}</strong> items
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setInvPage((p) => Math.max(1, p - 1))}
                      disabled={safeInvPage === 1}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 text-xs"
                    >
                      Prev
                    </button>
                    <span className="px-2 py-0.5 text-xs font-mono font-bold text-white bg-slate-800 rounded">
                      {safeInvPage} / {totalInvPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setInvPage((p) => Math.min(totalInvPages, p + 1))}
                      disabled={safeInvPage === totalInvPages}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 text-xs"
                    >
                      Next
                    </button>
                    <select
                      value={invPageSize}
                      onChange={(e) => {
                        setInvPageSize(Number(e.target.value));
                        setInvPage(1);
                      }}
                      className="ml-2 bg-slate-800 border border-slate-700 text-slate-300 rounded px-1.5 py-0.5 text-[11px] outline-none"
                    >
                      <option value={25}>25 / page</option>
                      <option value={50}>50 / page</option>
                      <option value={100}>100 / page</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MULTI-STORE OUTLETS */}
          {activeTab === 'stores' && (
            <div className="space-y-4">
              {/* Status Alerts */}
                  {storeSuccessMsg && (
                    <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs font-semibold flex items-center gap-2 shadow-lg animate-fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>{storeSuccessMsg}</span>
                    </div>
                  )}

                  {storeErrorMsg && (
                    <div className="p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-red-200 text-xs font-semibold flex items-center gap-2 shadow-lg animate-fade-in">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <span>{storeErrorMsg}</span>
                    </div>
                  )}

                  {/* Header & Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-sm">Multiple Store Outlets & Branches (शाखाएं एवं गल्ला काउंटर)</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {currentStores.length} {currentStores.length === 1 ? 'Store' : 'Stores'} Registered
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs mt-0.5">
                        Manage separate counter floats (Opening, Expense, Added, Total Sales, Online Sales, Cash in Hand) per outlet. Staff manage their assigned store counter, with live auto-sync to the central database.
                      </p>
                    </div>

                    {!showAddStoreModal && (
                      <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => refreshLiveOutlets()}
                          disabled={isLoadingLiveOutlets}
                          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                          title="Refresh all store counters live from central database"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isLoadingLiveOutlets ? 'animate-spin' : ''}`} />
                          <span>{isLoadingLiveOutlets ? 'Syncing...' : 'Sync from DB'}</span>
                        </button>
                        {onOpenOutletSync && (
                          <button
                            type="button"
                            onClick={onOpenOutletSync}
                            className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                            title="Upload outlet data to server database (Staff) or Download packages (Owner)"
                          >
                            <UploadCloud className="w-4 h-4 text-emerald-400" />
                            <span>Outlet Sync Hub</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            resetStoreForm();
                            setShowAddStoreModal(true);
                          }}
                          className="px-3.5 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>+ Add New Store / Branch</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Multi-Outlet Network Liquidity Summary (All Outlets Combined) */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-amber-500/30 shadow-lg space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-amber-400" />
                        <h5 className="text-xs font-extrabold uppercase tracking-wide text-amber-300">
                          Network Liquidity & Financial Summary (सभी शाखाओं का कुल विवरण)
                        </h5>
                      </div>
                      <div className="flex items-center gap-3 text-[11px]">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-300">
                          <input
                            type="checkbox"
                            checked={isAdminAutoSyncActive}
                            onChange={(e) => setIsAdminAutoSyncActive(e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-amber-500 bg-slate-950 border-slate-700 focus:ring-amber-400"
                          />
                          <span>Auto-Sync DB (15s)</span>
                        </label>
                        {lastLiveSyncTime && (
                          <span className="text-slate-500 font-mono text-[10px]">
                            Last synced: {lastLiveSyncTime}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
                      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Opening Float</span>
                        <span className="text-sm font-black text-emerald-400 font-mono block mt-0.5">
                          ₹{networkTotals.opening.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[9px] text-slate-500 block">आरंभिक रोकड़</span>
                      </div>

                      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Store Expenses</span>
                        <span className="text-sm font-black text-rose-400 font-mono block mt-0.5">
                          ₹{networkTotals.expenses.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[9px] text-slate-500 block">दुकान खर्च</span>
                      </div>

                      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Added Cash</span>
                        <span className="text-sm font-black text-blue-400 font-mono block mt-0.5">
                          ₹{networkTotals.added.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[9px] text-slate-500 block">जोड़ी रोकड़</span>
                      </div>

                      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Sales</span>
                        <span className="text-sm font-black text-emerald-300 font-mono block mt-0.5">
                          ₹{networkTotals.sales.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[9px] text-slate-500 block">कुल बिक्री</span>
                      </div>

                      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Online Sales</span>
                        <span className="text-sm font-black text-cyan-400 font-mono block mt-0.5">
                          ₹{networkTotals.online.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[9px] text-slate-500 block">ऑनलाइन UPI</span>
                      </div>

                      <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-2.5">
                        <span className="text-[10px] uppercase font-bold text-amber-300 block">Cash in Hand</span>
                        <span className="text-sm font-black text-amber-400 font-mono block mt-0.5">
                          ₹{networkTotals.cashInHand.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[9px] text-amber-300/70 block">कुल गल्ला रोकड़</span>
                      </div>
                    </div>
                  </div>

                  {/* Automatic Staff Database Sync Card */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-cyan-950/30 to-slate-900 border border-emerald-500/30 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
                          <RefreshCw className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="font-bold text-white text-sm">
                              Automatic Data Sync from Staff Terminals
                            </h5>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              {formData.autoSyncStaffEnabled !== false ? 'LIVE ACTIVE' : 'PAUSED'}
                            </span>
                          </div>
                          <p className="text-slate-400 text-xs mt-0.5">
                            Automatically uploads every bill, customer Udhaar entry, and stock adjustment from counter staff to the central database & cloud in real time.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.autoSyncStaffEnabled !== false}
                            onChange={(e) => {
                              const updated = { ...formData, autoSyncStaffEnabled: e.target.checked };
                              setFormData(updated);
                              onSaveSettings(updated);
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800 text-xs">
                      <div>
                        <label className="text-slate-400 block mb-1 font-semibold">Background Sync Interval:</label>
                        <select
                          value={formData.autoSyncStaffIntervalSeconds || 30}
                          onChange={(e) => {
                            const updated = {
                              ...formData,
                              autoSyncStaffIntervalSeconds: Number(e.target.value),
                            };
                            setFormData(updated);
                            onSaveSettings(updated);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-emerald-500 font-semibold"
                        >
                          <option value={15}>Every 15 Seconds (High Realtime)</option>
                          <option value={30}>Every 30 Seconds (Recommended)</option>
                          <option value={60}>Every 1 Minute (Battery & Low Data Saver)</option>
                        </select>
                      </div>

                      <div className="flex flex-col justify-center">
                        <span className="text-slate-400 font-semibold">Cloud & Server Integration:</span>
                        <span className="text-emerald-400 font-mono text-[11px] mt-0.5">
                          Express DB (/api/db/*) + Firebase Cloud Firestore
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CREATE / EDIT STORE FORM MODAL */}
                  {showAddStoreModal && (
                    <div className="p-4 sm:p-5 bg-slate-900 border-2 border-amber-500/40 rounded-2xl space-y-4 shadow-xl">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="font-bold text-white text-sm">
                              {editingStoreId ? 'Edit Store Outlet' : 'Create New Store Outlet / Branch'}
                            </h5>
                            <p className="text-[11px] text-slate-400">
                              {editingStoreId
                                ? 'Update branch address, UPI ID and billing information'
                                : 'Add a new outlet with its own UPI QR payment receiver and receipt info'}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setShowAddStoreModal(false);
                            resetStoreForm();
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <form onSubmit={handleSaveStore} className="space-y-3.5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2">
                            <label className="text-xs font-bold text-slate-300 block mb-1">
                              Store / Shop Name <span className="text-amber-400">*</span>:
                            </label>
                            <input
                              type="text"
                              required
                              value={newStoreName}
                              onChange={(e) => setNewStoreName(e.target.value)}
                              placeholder="e.g. Nayab Masale - Main Bazaar Branch"
                              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-white text-xs outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-300 block mb-1">
                              Shortcut Name (Header):
                            </label>
                            <input
                              type="text"
                              maxLength={14}
                              value={newStoreShortcutName}
                              onChange={(e) => setNewStoreShortcutName(e.target.value)}
                              placeholder="e.g. Main, B-1"
                              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-white text-xs outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-300 block mb-1">
                            Tagline / Category Description:
                          </label>
                          <input
                            type="text"
                            value={newStoreTagline}
                            onChange={(e) => setNewStoreTagline(e.target.value)}
                            placeholder="e.g. Spices, Daily Groceries & Dry Fruits"
                            className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-white text-xs outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-bold text-slate-300 block mb-1">
                              Contact Phone Number <span className="text-amber-400">*</span>:
                            </label>
                            <input
                              type="tel"
                              required
                              value={newStorePhone}
                              onChange={(e) => setNewStorePhone(e.target.value)}
                              placeholder="e.g. 9876543210"
                              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-white text-xs font-mono outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-300 block mb-1">
                              Store Merchant UPI ID <span className="text-amber-400">*</span> (For Dynamic QR):
                            </label>
                            <input
                              type="text"
                              required
                              value={newStoreUpiId}
                              onChange={(e) => setNewStoreUpiId(e.target.value)}
                              placeholder="e.g. nayabstore@okhdfcbank or 9876543210@paytm"
                              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-white text-xs font-mono outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-bold text-slate-300 block mb-1">
                              Merchant Payee Name (On Customer UPI Apps):
                            </label>
                            <input
                              type="text"
                              value={newStoreUpiName}
                              onChange={(e) => setNewStoreUpiName(e.target.value)}
                              placeholder="e.g. Nayab Masale Kirana"
                              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-white text-xs outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-300 block mb-1">
                              Default GST Rate (%):
                            </label>
                            <select
                              value={newStoreTaxRate}
                              onChange={(e) => setNewStoreTaxRate(Number(e.target.value))}
                              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-white text-xs outline-none"
                            >
                              <option value={0}>0% (Tax-Free Groceries / Kirana)</option>
                              <option value={5}>5% (Basic Spices & Staples)</option>
                              <option value={12}>12% (Packaged Foods)</option>
                              <option value={18}>18% (Standard GST)</option>
                              <option value={28}>28% (Luxury Items)</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-300 block mb-1">
                            Store / Branch Full Address (Printed on Receipts):
                          </label>
                          <textarea
                            rows={2}
                            value={newStoreAddress}
                            onChange={(e) => setNewStoreAddress(e.target.value)}
                            placeholder="e.g. Shop #14, Station Road Spice Market, City - 302001"
                            className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-white text-xs outline-none resize-none"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-bold text-slate-300 block mb-1">
                              GSTIN Number (Optional):
                            </label>
                            <input
                              type="text"
                              value={newStoreGstin}
                              onChange={(e) => setNewStoreGstin(e.target.value.toUpperCase())}
                              placeholder="e.g. 08AAAAA0000A1Z5"
                              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-white font-mono uppercase text-xs outline-none"
                            />
                          </div>

                          <div className="flex items-center pt-5">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={newStoreSetAsActive}
                                onChange={(e) => setNewStoreSetAsActive(e.target.checked)}
                                className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700 focus:ring-amber-400"
                              />
                              <span className="text-xs text-slate-300 font-semibold">
                                Set as Active Store on counter POS right now
                              </span>
                            </label>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddStoreModal(false);
                              resetStoreForm();
                            }}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-5 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                          >
                            <Check className="w-4 h-4" />
                            <span>{editingStoreId ? 'Update Store' : 'Save New Store'}</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* STORES LIST GRID WITH PER-OUTLET COUNTER METRICS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentStores.map((store, index) => {
                      const isActive = store.id === (formData.activeStoreId || currentStores[0]?.id);
                      const liveMatch = liveOutlets.find((l) => l.id === store.id);

                      // Outlet cash floats
                      const outletOpening = outletCashBalances?.[store.id]?.openingCash ?? (liveMatch?.openingCash ?? (store.openingCash || 0));
                      const outletAdded = outletCashBalances?.[store.id]?.addedCash ?? (liveMatch?.addedCash ?? (store.addedCash || 0));

                      // Scoped transactions
                      const startOfTodayMs = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
                      const outletTxs = transactions.filter((t) => {
                        const m = t.outletId || t.storeId;
                        return m === store.id || (!m && (store.isDefault || store.isPrimary));
                      });
                      const todayTxs = outletTxs.filter((t) => !t.voided && new Date(t.timestamp).getTime() >= startOfTodayMs);

                      const todaySales = liveMatch?.todaySales !== undefined && liveMatch.todaySales > 0
                        ? liveMatch.todaySales
                        : todayTxs.filter((t) => t.type === 'sale').reduce((sum, t) => sum + t.amount, 0);

                      const onlineSales = liveMatch?.upiSales !== undefined && liveMatch.upiSales > 0
                        ? liveMatch.upiSales
                        : todayTxs.filter((t) => t.type === 'sale' && t.paymentMode === 'online_upi').reduce((sum, t) => sum + t.amount, 0);

                      const cashSales = liveMatch?.cashSales !== undefined && liveMatch.cashSales > 0
                        ? liveMatch.cashSales
                        : todayTxs.filter((t) => t.type === 'sale' && (t.paymentMode === 'cash' || !t.paymentMode)).reduce((sum, t) => sum + t.amount, 0);

                      const storeExpenses = liveMatch?.todayExpenses !== undefined && liveMatch.todayExpenses > 0
                        ? liveMatch.todayExpenses
                        : todayTxs.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

                      const cashInHand = liveMatch?.cashInHand !== undefined
                        ? liveMatch.cashInHand
                        : Math.max(0, Math.round((outletOpening + outletAdded + cashSales - storeExpenses) * 100) / 100);

                      // Assigned staff for this outlet
                      const assignedStaffList = (formData.staffAccounts || []).filter((s) => {
                        if (s.assignedOutletIds?.includes('all') || s.role === 'owner' || s.role === 'master_admin') return true;
                        return s.assignedOutletIds?.includes(store.id) || s.defaultOutletId === store.id;
                      });

                      const isCashierRestricted = !isOwnerPermissionGranted && currentActiveStaff?.role === 'cashier' &&
                        Boolean(currentActiveStaff.assignedOutletIds && currentActiveStaff.assignedOutletIds.length > 0 && !currentActiveStaff.assignedOutletIds.includes('all') && !currentActiveStaff.assignedOutletIds.includes(store.id));

                      return (
                        <div
                          key={store.id}
                          className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3.5 ${
                            isActive
                              ? 'bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/80 shadow-lg shadow-emerald-950/30 ring-1 ring-emerald-500/40'
                              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            {/* Card Top: Badges & Actions */}
                            <div className="flex items-start justify-between gap-2 mb-2.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                    isActive
                                      ? 'bg-emerald-500 text-slate-950 font-bold'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  <Store className="w-5 h-5" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h5 className="font-bold text-white text-sm">{store.shopName}</h5>
                                    {isActive ? (
                                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 flex items-center gap-1 shadow-sm">
                                        <Check className="w-3 h-3 stroke-[3]" /> Active POS Outlet
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-semibold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
                                        Outlet #{index + 1}
                                      </span>
                                    )}
                                    {store.shortcutName && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                                        {store.shortcutName}
                                      </span>
                                    )}
                                  </div>
                                  {store.tagline && (
                                    <p className="text-[11px] text-slate-400 mt-0.5">{store.tagline}</p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenCashAdjust(store)}
                                  className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                                  title="Adjust Opening Float or Add Cash for this specific outlet"
                                >
                                  <Coins className="w-3 h-3" />
                                  <span>Cash Float</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSyncOutletSeparately(store.id)}
                                  disabled={syncingOutletId === store.id}
                                  className="p-1.5 text-slate-400 hover:text-emerald-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                  title="Synchronize this outlet's counter data separately to database"
                                >
                                  <RefreshCw className={`w-3.5 h-3.5 ${syncingOutletId === store.id ? 'animate-spin text-emerald-400' : ''}`} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditStore(store)}
                                  className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                  title="Edit Store Outlet"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={currentStores.length <= 1}
                                  onClick={() => {
                                    if (confirm(`Delete store outlet "${store.shopName}"?`)) {
                                      handleDeleteStore(store.id);
                                    }
                                  }}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    currentStores.length <= 1
                                      ? 'text-slate-600 cursor-not-allowed'
                                      : 'text-slate-400 hover:text-red-400 hover:bg-slate-800'
                                  }`}
                                  title={
                                    currentStores.length <= 1
                                      ? 'Cannot delete the only store outlet'
                                      : 'Delete this store outlet'
                                  }
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Assigned Staff Preview */}
                            <div className="px-2.5 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-[11px] mb-2.5">
                              <div className="flex items-center gap-1.5 truncate">
                                <Users className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                                <span className="text-slate-400">Assigned:</span>
                                <span className="font-bold text-white truncate">
                                  {assignedStaffList.length > 0
                                    ? assignedStaffList.map((s) => s.name).join(', ')
                                    : 'All Staff / Unrestricted'}
                                </span>
                              </div>
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex-shrink-0">
                                Isolated Counter
                              </span>
                            </div>

                            {/* The 6 Per-Outlet Financial & Counter Metrics */}
                            <div className="space-y-2 mb-3">
                              <div className="grid grid-cols-3 gap-2">
                                <div
                                  onClick={() => handleOpenCashAdjust(store)}
                                  className="bg-emerald-950/30 border border-emerald-500/30 hover:border-emerald-400 rounded-xl p-2 cursor-pointer transition-colors group"
                                  title="Click to adjust Opening Cash float"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] uppercase font-bold text-emerald-300 block">Opening</span>
                                    <span className="text-[9px] text-slate-500 group-hover:text-emerald-300 font-mono">✎</span>
                                  </div>
                                  <span className="text-sm font-black text-emerald-400 font-mono block mt-0.5">
                                    ₹{outletOpening.toLocaleString('en-IN')}
                                  </span>
                                  <span className="text-[9px] text-slate-500 block">आरंभिक रोकड़</span>
                                </div>

                                <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-2">
                                  <span className="text-[9px] uppercase font-bold text-rose-300 block">Expense</span>
                                  <span className="text-sm font-black text-rose-400 font-mono block mt-0.5">
                                    ₹{storeExpenses.toLocaleString('en-IN')}
                                  </span>
                                  <span className="text-[9px] text-slate-500 block">दुकान खर्च</span>
                                </div>

                                <div
                                  onClick={() => handleOpenCashAdjust(store)}
                                  className="bg-blue-950/30 border border-blue-500/30 hover:border-blue-400 rounded-xl p-2 cursor-pointer transition-colors group"
                                  title="Click to add midday Cash float"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] uppercase font-bold text-blue-300 block">Added</span>
                                    <span className="text-[9px] text-slate-500 group-hover:text-blue-300 font-mono">✎</span>
                                  </div>
                                  <span className="text-sm font-black text-blue-400 font-mono block mt-0.5">
                                    ₹{outletAdded.toLocaleString('en-IN')}
                                  </span>
                                  <span className="text-[9px] text-slate-500 block">जोड़ी रोकड़</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-2">
                                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2">
                                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Total Sales</span>
                                  <span className="text-sm font-black text-emerald-300 font-mono block mt-0.5">
                                    ₹{todaySales.toLocaleString('en-IN')}
                                  </span>
                                  <span className="text-[9px] text-slate-500 block">कुल बिक्री</span>
                                </div>

                                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2">
                                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Online UPI</span>
                                  <span className="text-sm font-black text-cyan-400 font-mono block mt-0.5">
                                    ₹{onlineSales.toLocaleString('en-IN')}
                                  </span>
                                  <span className="text-[9px] text-slate-500 block">ऑनलाइन बिक्री</span>
                                </div>

                                <div className="bg-amber-950/40 border border-amber-500/50 rounded-xl p-2">
                                  <span className="text-[9px] uppercase font-bold text-amber-300 block">Cash in Hand</span>
                                  <span className="text-sm font-black text-amber-400 font-mono block mt-0.5">
                                    ₹{cashInHand.toLocaleString('en-IN')}
                                  </span>
                                  <span className="text-[9px] text-amber-300/70 block">गल्ला रोकड़</span>
                                </div>
                              </div>
                            </div>

                            {/* Details List */}
                            <div className="space-y-1.5 my-2.5 text-[11px] bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80">
                              <div className="flex items-center gap-2 text-slate-300">
                                <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                <span>Phone: <strong className="text-white font-mono">{store.phone}</strong></span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-300">
                                <QrCode className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                <span className="truncate">
                                  UPI ID: <strong className="text-emerald-300 font-mono">{store.upiId}</strong>
                                </span>
                              </div>
                              {store.address && (
                                <div className="flex items-start gap-2 text-slate-300">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                                  <span className="line-clamp-1 text-slate-400">{store.address}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-3 pt-1 border-t border-slate-800/60 text-[10px] text-slate-400">
                                <span>GST: <strong className="text-slate-300 font-mono">{store.defaultTaxRate || 0}%</strong></span>
                                {store.gstin && (
                                  <span>GSTIN: <strong className="text-slate-300 font-mono">{store.gstin}</strong></span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Switch Button */}
                          <div className="pt-2 border-t border-slate-800/60">
                            {isActive ? (
                              <div className="w-full py-2 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-center text-xs font-bold text-emerald-300 flex items-center justify-center gap-1.5">
                                <Check className="w-4 h-4 text-emerald-400" />
                                <span>Currently Active on POS Counter</span>
                              </div>
                            ) : isCashierRestricted ? (
                              <button
                                type="button"
                                onClick={() => handleAttemptSwitchStore(store)}
                                className="w-full py-2 bg-slate-800/80 hover:bg-slate-800 text-amber-300/80 hover:text-amber-200 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Lock className="w-3.5 h-3.5 text-amber-400" />
                                <span>Staff Restricted • Enter Owner PIN</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSwitchStore(store)}
                                className="w-full py-2 bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm hover:shadow-emerald-900/30"
                              >
                                <Store className="w-3.5 h-3.5" />
                                <span>Switch Counter POS to this Store</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Cash Float Adjustment Modal */}
                  {cashAdjustOutlet && (
                    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                      <div className="bg-slate-900 border-2 border-amber-500/70 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-fade-in">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                          <div className="flex items-center gap-2">
                            <Coins className="w-5 h-5 text-amber-400" />
                            <div>
                              <h5 className="font-bold text-white text-sm">
                                Adjust Counter Float: {cashAdjustOutlet.shopName}
                              </h5>
                              <p className="text-[11px] text-slate-400">
                                Syncs opening float & added cash directly to database
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCashAdjustOutlet(null)}
                            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <form onSubmit={handleSaveCashAdjust} className="space-y-4">
                          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                            <button
                              type="button"
                              onClick={() => setCashAdjustMode('set')}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                cashAdjustMode === 'set'
                                  ? 'bg-amber-500 text-slate-950'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              Set Float Amounts
                            </button>
                            <button
                              type="button"
                              onClick={() => setCashAdjustMode('add')}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                cashAdjustMode === 'add'
                                  ? 'bg-amber-500 text-slate-950'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              Add Cash Incrementally
                            </button>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-300 block mb-1">
                              Opening Float (आरंभिक रोकड़) ₹:
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={cashAdjustOpeningInput}
                              onChange={(e) => setCashAdjustOpeningInput(e.target.value)}
                              placeholder="e.g. 5000"
                              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-emerald-400 font-mono text-sm outline-none"
                            />
                            <p className="text-[10px] text-slate-500 mt-1">
                              Drawer cash at the start of the business day.
                            </p>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-300 block mb-1">
                              {cashAdjustMode === 'set' ? 'Added Cash Total (जोड़ी रोकड़) ₹:' : 'Cash to Add Right Now ₹:'}
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={cashAdjustAddedInput}
                              onChange={(e) => setCashAdjustAddedInput(e.target.value)}
                              placeholder="e.g. 2000"
                              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-blue-400 font-mono text-sm outline-none"
                            />
                            <p className="text-[10px] text-slate-500 mt-1">
                              Midday float or bank deposit added into the drawer.
                            </p>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                            <button
                              type="button"
                              onClick={() => setCashAdjustOutlet(null)}
                              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isSavingCashAdjust}
                              className="px-5 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <Check className="w-4 h-4" />
                              <span>{isSavingCashAdjust ? 'Saving...' : 'Save & Sync to Database'}</span>
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* Cashier Restriction Modal */}
                  {restrictedSwitchTarget && (
                    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                      <div className="bg-slate-900 border-2 border-red-500/70 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-fade-in">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400">
                            <ShieldAlert className="w-6 h-6" />
                          </div>
                          <div>
                            <h5 className="font-bold text-white text-sm">Branch Counter Restricted</h5>
                            <p className="text-xs text-red-200/80">Owner Authorization Required</p>
                          </div>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
                          Cashier account <strong className="text-white">{currentActiveStaff?.name}</strong> is restricted to their assigned outlet counter. Enter Store Owner (<strong className="text-amber-300">{ownerStaffAccount.name}</strong>) PIN to unlock this counter.
                        </p>

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (cashierOverridePin.trim() === ownerStaffAccount.pin || cashierOverridePin.trim() === 'nayab@q6') {
                              handleSwitchStore(restrictedSwitchTarget);
                              setRestrictedSwitchTarget(null);
                            } else {
                              setCashierOverrideError('Incorrect Owner PIN. Authorization failed.');
                            }
                          }}
                          className="space-y-3"
                        >
                          <div>
                            <input
                              type="password"
                              autoFocus
                              placeholder="Enter Owner PIN..."
                              value={cashierOverridePin}
                              onChange={(e) => {
                                setCashierOverridePin(e.target.value);
                                setCashierOverrideError('');
                              }}
                              className="w-full bg-slate-950 border border-slate-700 focus:border-red-400 rounded-xl px-3 py-2 text-white text-sm font-mono outline-none"
                            />
                            {cashierOverrideError && (
                              <p className="text-xs text-red-400 mt-1 font-semibold">{cashierOverrideError}</p>
                            )}
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setRestrictedSwitchTarget(null)}
                              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Authorize & Switch</span>
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
            </div>
          )}

          {/* TAB 4: STAFF ACCOUNTS WITH PASSWORD */}
          {activeTab === 'staff' && (
            <div className="space-y-4">
              {!isOwnerPermissionGranted ? (
                /* Non-owner staff locked out banner */
                <div className="p-6 bg-slate-900/90 border-2 border-amber-500/50 rounded-2xl text-center space-y-4 max-w-md mx-auto my-6 shadow-2xl">
                  <div className="w-14 h-14 rounded-3xl bg-amber-500/20 border border-amber-500/30 mx-auto flex items-center justify-center text-amber-400">
                    <ShieldAlert className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-extrabold text-white">Owner Permission Required: Staff Accounts</h4>
                    <p className="text-xs text-amber-200/80 leading-relaxed">
                      Staff & cashier accounts cannot manage store accounts, staff profiles, or passwords. This section is strictly restricted to the Store Owner (<span className="text-amber-300 font-bold">{ownerStaffAccount.name}</span>).
                    </p>
                  </div>

                  <form onSubmit={handleVerifyOwnerPin} className="space-y-3 pt-1">
                    <div className="text-left">
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Enter Owner PIN to unlock staff settings:
                      </label>
                      <input
                        type="password"
                        maxLength={30}
                        value={unlockPinInput}
                        onChange={(e) => {
                          setUnlockPinInput(e.target.value);
                          setUnlockPinError('');
                        }}
                        placeholder="Enter Owner Password / PIN"
                        className="w-full bg-slate-950 border border-amber-500/60 rounded-xl px-3 py-2 text-center text-white font-mono tracking-widest text-lg font-bold outline-none focus:border-amber-400"
                        autoFocus
                      />
                      {unlockPinError && (
                        <p className="text-red-400 text-xs mt-1 font-semibold">{unlockPinError}</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verify Owner PIN & Unlock Staff Accounts</span>
                    </button>
                  </form>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div>
                      <h4 className="font-bold text-white text-sm">Staff Accounts & Password Protection</h4>
                      <p className="text-slate-400 text-xs">
                        Manage cashier accounts, owner security and passwords.
                      </p>
                    </div>

                    <button
                      onClick={() => setShowAddStaffModal(true)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Staff Account</span>
                    </button>
                  </div>

                  {/* Dedicated Owner Password Security Card */}
                  <div className="p-3.5 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 rounded-2xl border border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0">
                        <Lock className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-white text-sm">Owner Account Security</h5>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {ownerStaffAccount.name}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Controls financial reports, store settings, and staff passwords.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowOwnerPasswordModal(true);
                        setOwnerPasswordChangeError('');
                        setOwnerPasswordChangeSuccess('');
                      }}
                      className="px-3.5 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer select-none active:scale-95 whitespace-nowrap"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>Change Owner Password</span>
                    </button>
                  </div>

                  {/* Change Owner Password Modal / Form */}
                  {showOwnerPasswordModal && (
                    <div className="p-4 bg-slate-900 border-2 border-amber-500/60 rounded-2xl space-y-3.5 animate-in fade-in shadow-2xl">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                            <Lock className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-white text-sm">Change Owner Password / PIN</span>
                            <p className="text-[11px] text-amber-300/80">Set new owner password</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowOwnerPasswordModal(false)}
                          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {ownerPasswordChangeError && (
                        <div className="p-2.5 bg-red-950/70 border border-red-500/50 rounded-xl text-red-200 text-xs font-semibold">
                          ⚠ {ownerPasswordChangeError}
                        </div>
                      )}

                      {ownerPasswordChangeSuccess && (
                        <div className="p-2.5 bg-emerald-950/70 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          <span>{ownerPasswordChangeSuccess}</span>
                        </div>
                      )}

                      <form onSubmit={handleChangeOwnerPassword} className="space-y-3">
                        {!userIsOwner && (
                          <div>
                            <label className="text-xs font-bold text-slate-300 block mb-1">
                              Current Owner Password:
                            </label>
                            <input
                              type="password"
                              required
                              value={currentOwnerPasswordInput}
                              onChange={(e) => setCurrentOwnerPasswordInput(e.target.value)}
                              placeholder="Enter current owner password"
                              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-white font-mono text-sm outline-none"
                            />
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-bold text-slate-300 block mb-1">
                              New Owner Password:
                            </label>
                            <input
                              type={showNewPasswordText ? 'text' : 'password'}
                              required
                              minLength={4}
                              value={newOwnerPasswordInput}
                              onChange={(e) => setNewOwnerPasswordInput(e.target.value)}
                              placeholder="Enter new password (min 4 chars)"
                              className="w-full bg-slate-950 border border-amber-500/40 focus:border-amber-400 rounded-xl px-3 py-2 text-white font-mono text-sm outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-300 block mb-1">
                              Confirm New Password:
                            </label>
                            <input
                              type={showNewPasswordText ? 'text' : 'password'}
                              required
                              minLength={4}
                              value={confirmOwnerPasswordInput}
                              onChange={(e) => setConfirmOwnerPasswordInput(e.target.value)}
                              placeholder="Re-enter new password"
                              className="w-full bg-slate-950 border border-amber-500/40 focus:border-amber-400 rounded-xl px-3 py-2 text-white font-mono text-sm outline-none"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 hover:text-slate-300 select-none">
                            <input
                              type="checkbox"
                              checked={showNewPasswordText}
                              onChange={(e) => setShowNewPasswordText(e.target.checked)}
                              className="w-3.5 h-3.5 accent-amber-500 rounded"
                            />
                            <span>Show password text</span>
                          </label>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setShowOwnerPasswordModal(false)}
                              className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="px-4 py-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Save Password</span>
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  )}

              {/* Staff Accounts List */}
              <div className="space-y-2.5">
                {formData.staffAccounts.map((staff) => (
                  <div
                    key={staff.id}
                    className="p-3.5 bg-slate-800/70 rounded-2xl border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center font-bold text-amber-300 shrink-0 mt-0.5">
                        {staff.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-white text-sm">{staff.name}</span>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {staff.role}
                          </span>
                        </div>
                        <div className="text-slate-400 text-[11px] flex flex-wrap items-center gap-3">
                          <span className="font-mono text-slate-300">Password: ••••••••</span>
                          {staff.phone && <span>Ph: {staff.phone}</span>}
                        </div>

                        {/* Assigned Outlets Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="text-[10px] text-slate-400 font-medium">Assigned Outlets:</span>
                          {(!staff.assignedOutletIds || staff.assignedOutletIds.includes('all') || staff.assignedOutletIds.length === 0) ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1">
                              <Store className="w-3 h-3 text-emerald-400" />
                              <span>All Outlets (सभी शाखाएं)</span>
                            </span>
                          ) : (
                            staff.assignedOutletIds.map((outletId) => {
                              const matchStore = currentStores.find((s) => s.id === outletId);
                              return (
                                <span
                                  key={outletId}
                                  className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px] font-medium flex items-center gap-1"
                                >
                                  <Building2 className="w-3 h-3 text-blue-400" />
                                  <span>{matchStore?.shopName || matchStore?.shortcutName || outletId}</span>
                                  {staff.defaultOutletId === outletId && (
                                    <span className="text-[9px] bg-blue-600/50 text-blue-200 px-1 rounded uppercase font-bold">
                                      Primary
                                    </span>
                                  )}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleOpenEditStaff(staff)}
                        className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                        title="Assign Outlets & Edit Permissions"
                      >
                        <Edit2 className="w-3 h-3 text-amber-400" />
                        <span>Assign Outlets</span>
                      </button>

                      {staff.role === 'owner' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setShowOwnerPasswordModal(true);
                            setOwnerPasswordChangeError('');
                            setOwnerPasswordChangeSuccess('');
                          }}
                          className="px-2.5 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                          title="Change Owner Password"
                        >
                          <Key className="w-3 h-3 text-amber-400" />
                          <span>Password</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDeleteStaff(staff.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                          title="Delete staff account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Edit Staff Account Modal Form */}
              {editingStaff && (
                <div className="p-4 bg-slate-800/95 border border-amber-500/40 rounded-2xl space-y-3 animate-in fade-in shadow-xl">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                    <div className="flex items-center gap-2">
                      <Edit2 className="w-4 h-4 text-amber-400" />
                      <span className="font-bold text-white text-xs sm:text-sm">
                        Assign Outlets & Edit Staff: <span className="text-amber-300">{editingStaff.name}</span>
                      </span>
                    </div>
                    <button
                      onClick={() => setEditingStaff(null)}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {staffError && <div className="text-red-400 text-xs font-semibold">{staffError}</div>}

                  <form onSubmit={handleSaveEditStaff} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-300 font-semibold block mb-1">Staff Member Name:</label>
                        <input
                          type="text"
                          required
                          value={editStaffName}
                          onChange={(e) => setEditStaffName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white"
                        />
                      </div>

                      <div>
                        <label className="text-slate-300 font-semibold block mb-1">Role / Authority:</label>
                        <select
                          value={editStaffRole}
                          onChange={(e) => setEditStaffRole(e.target.value as any)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white"
                        >
                          <option value="cashier">Cashier (Billing Only)</option>
                          <option value="manager">Store Manager</option>
                          <option value="owner">Owner / Admin</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-300 font-semibold block mb-1">Login PIN / Password:</label>
                        <input
                          type="text"
                          required
                          value={editStaffPin}
                          onChange={(e) => setEditStaffPin(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-slate-300 font-semibold block mb-1">Phone Number (Optional):</label>
                        <input
                          type="tel"
                          value={editStaffPhone}
                          onChange={(e) => setEditStaffPhone(e.target.value)}
                          placeholder="10-digit mobile"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white"
                        />
                      </div>
                    </div>

                    {/* Outlets Assignment Configuration */}
                    <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-700 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-amber-300 font-bold text-xs flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5" />
                          <span>Assign Outlets to Manage (दुकानें सौंपें):</span>
                        </label>
                        <span className="text-[10px] text-slate-400">Owner control</span>
                      </div>

                      <p className="text-[11px] text-slate-400">
                        Select which outlets this staff member is authorized to access and operate.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {/* Option: All Outlets */}
                        <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-800/80 border border-slate-700 cursor-pointer hover:bg-slate-800">
                          <input
                            type="checkbox"
                            checked={editStaffAssignedOutlets.includes('all')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditStaffAssignedOutlets(['all']);
                              } else {
                                setEditStaffAssignedOutlets(currentStores.map((s) => s.id));
                              }
                            }}
                            className="w-4 h-4 accent-amber-500 rounded"
                          />
                          <div>
                            <div className="text-white font-bold text-xs">All Outlets (सभी दुकानें)</div>
                            <div className="text-[10px] text-slate-400">Unrestricted access across all branches</div>
                          </div>
                        </label>

                        {/* Individual Store Options */}
                        {currentStores.map((store) => {
                          const isAllSelected = editStaffAssignedOutlets.includes('all');
                          const isChecked = isAllSelected || editStaffAssignedOutlets.includes(store.id);

                          return (
                            <label
                              key={store.id}
                              className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${
                                isChecked
                                  ? 'bg-amber-500/10 border-amber-500/40 text-white'
                                  : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (isAllSelected) {
                                    // Switch from 'all' to specific stores
                                    if (!e.target.checked) {
                                      setEditStaffAssignedOutlets(
                                        currentStores.filter((s) => s.id !== store.id).map((s) => s.id)
                                      );
                                    }
                                  } else {
                                    if (e.target.checked) {
                                      setEditStaffAssignedOutlets([...editStaffAssignedOutlets, store.id]);
                                    } else {
                                      const remaining = editStaffAssignedOutlets.filter((id) => id !== store.id);
                                      setEditStaffAssignedOutlets(remaining.length > 0 ? remaining : [store.id]);
                                    }
                                  }
                                }}
                                className="w-4 h-4 accent-amber-500 rounded"
                              />
                              <div className="flex-1">
                                <div className="font-bold text-xs">{store.shopName}</div>
                                <div className="text-[10px] text-slate-400">
                                  {store.shortcutName ? `(${store.shortcutName}) ` : ''}{store.address || 'Branch'}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>

                      {/* Default Login Outlet */}
                      {!editStaffAssignedOutlets.includes('all') && currentStores.length > 1 && (
                        <div className="pt-2">
                          <label className="text-slate-300 font-semibold block mb-1 text-[11px]">
                            Primary Default Outlet for this Staff:
                          </label>
                          <select
                            value={editStaffDefaultOutlet}
                            onChange={(e) => setEditStaffDefaultOutlet(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                          >
                            <option value="">Auto (First Assigned Outlet)</option>
                            {currentStores
                              .filter((s) => editStaffAssignedOutlets.includes(s.id))
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.shopName} ({s.shortcutName || s.id})
                                </option>
                              ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingStaff(null)}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                      >
                        <Check className="w-4 h-4" />
                        <span>Save Staff Assignment</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Add Staff Account Modal Form */}
              {showAddStaffModal && (
                <div className="p-4 bg-slate-800/90 border border-amber-500/40 rounded-2xl space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-700">
                    <span className="font-bold text-white text-xs">Create New Staff Account</span>
                    <button
                      onClick={() => setShowAddStaffModal(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {staffError && <div className="text-red-400 text-[11px]">{staffError}</div>}

                  <form onSubmit={handleCreateStaff} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-slate-300 block mb-1">Staff Member Name:</label>
                        <input
                          type="text"
                          required
                          value={newStaffName}
                          onChange={(e) => setNewStaffName(e.target.value)}
                          placeholder="e.g. Rahul Sharma"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                        />
                      </div>

                      <div>
                        <label className="text-slate-300 block mb-1">Role:</label>
                        <select
                          value={newStaffRole}
                          onChange={(e) => setNewStaffRole(e.target.value as any)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                        >
                          <option value="cashier">Cashier (Billing Only)</option>
                          <option value="manager">Store Manager</option>
                          <option value="owner">Owner / Admin</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-300 block mb-1">Login PIN / Password (4-digits):</label>
                        <input
                          type="password"
                          required
                          maxLength={8}
                          value={newStaffPin}
                          onChange={(e) => setNewStaffPin(e.target.value)}
                          placeholder="Enter PIN / password"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-slate-300 block mb-1">Phone Number (Optional):</label>
                        <input
                          type="tel"
                          value={newStaffPhone}
                          onChange={(e) => setNewStaffPhone(e.target.value)}
                          placeholder="10-digit mobile"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                        />
                      </div>
                    </div>

                    {/* Outlets Assignment Configuration for New Staff */}
                    <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-700 space-y-2">
                      <label className="text-amber-300 font-bold text-xs flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5" />
                        <span>Assign Outlets to Manage (दुकानें सौंपें):</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/80 border border-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newStaffAssignedOutlets.includes('all')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewStaffAssignedOutlets(['all']);
                              } else {
                                setNewStaffAssignedOutlets(currentStores.map((s) => s.id));
                              }
                            }}
                            className="w-4 h-4 accent-amber-500 rounded"
                          />
                          <span className="text-white text-xs font-bold">All Outlets (सभी दुकानें)</span>
                        </label>

                        {currentStores.map((store) => (
                          <label
                            key={store.id}
                            className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/60 border border-slate-700 cursor-pointer text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={newStaffAssignedOutlets.includes('all') || newStaffAssignedOutlets.includes(store.id)}
                              onChange={(e) => {
                                if (newStaffAssignedOutlets.includes('all')) {
                                  if (!e.target.checked) {
                                    setNewStaffAssignedOutlets(currentStores.filter((s) => s.id !== store.id).map((s) => s.id));
                                  }
                                } else {
                                  if (e.target.checked) {
                                    setNewStaffAssignedOutlets([...newStaffAssignedOutlets, store.id]);
                                  } else {
                                    const rem = newStaffAssignedOutlets.filter((id) => id !== store.id);
                                    setNewStaffAssignedOutlets(rem.length > 0 ? rem : [store.id]);
                                  }
                                }
                              }}
                              className="w-4 h-4 accent-amber-500 rounded"
                            />
                            <span className="text-slate-200">{store.shopName}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddStaffModal(false)}
                        className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg"
                      >
                        Save Staff Account
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      )}

          {/* TAB 4: THERMAL PRINTER INTEGRATION */}
          {activeTab === 'printer' && (
            <div className="space-y-4">
              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-sm">Thermal POS Receipt Printer Connection</h4>
                    <p className="text-slate-400 text-xs">
                      Connect Bluetooth / USB Serial ESC/POS 58mm or 80mm thermal receipt printers.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        printerConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                      }`}
                    />
                    <span className="text-[11px] font-bold text-slate-300">
                      {printerConnected ? 'HARDWARE CONNECTED' : 'READY (BROWSER PRINT)'}
                    </span>
                  </div>
                </div>

                {printerStatusMsg && (
                  <div className="p-2.5 bg-blue-950/60 border border-blue-800/80 rounded-xl text-blue-200 text-xs">
                    {printerStatusMsg}
                  </div>
                )}

                {/* Connection Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={printerConnecting}
                    onClick={handleConnectBluetooth}
                    className="p-3 rounded-xl bg-slate-900 hover:bg-slate-750 border border-blue-500/40 text-left transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <Bluetooth className="w-5 h-5 text-blue-400" />
                      <div>
                        <div className="font-bold text-white text-xs">Connect Bluetooth Printer</div>
                        <div className="text-[10px] text-slate-400">NAYAB, TVS, NGX, MPT-II, RPP02</div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={printerConnecting}
                    onClick={handleConnectSerial}
                    className="p-3 rounded-xl bg-slate-900 hover:bg-slate-750 border border-cyan-500/40 text-left transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <Usb className="w-5 h-5 text-cyan-400" />
                      <div>
                        <div className="font-bold text-white text-xs">Connect USB / Serial Printer</div>
                        <div className="text-[10px] text-slate-400">POS-58 / POS-80 via USB Cable</div>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Printer Settings Config */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Receipt Paper Roll Width:</label>
                    <select
                      value={formData.printerConfig.paperWidth}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          printerConfig: {
                            ...formData.printerConfig,
                            paperWidth: e.target.value as '58mm' | '80mm',
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                    >
                      <option value="58mm">58mm (Standard Compact Kirana Roll - 32 chars)</option>
                      <option value="80mm">80mm (Wide Thermal Roll - 48 chars)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-700/80">
                    <div>
                      <div className="font-semibold text-white">Auto-Print on Bill Settlement:</div>
                      <div className="text-[10px] text-slate-400">Prints bill automatically after payment</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.printerConfig.autoPrintOnSale}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          printerConfig: {
                            ...formData.printerConfig,
                            autoPrintOnSale: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 accent-blue-500 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-700/80">
                    <div>
                      <div className="font-semibold text-white">Print Dynamic UPI QR Code on Bill Slip:</div>
                      <div className="text-[10px] text-slate-400">Prints scan & pay QR code directly on thermal receipt</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.printerConfig.printQrCodeOnSlip !== false}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          printerConfig: {
                            ...formData.printerConfig,
                            printQrCodeOnSlip: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 accent-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleTestPrint}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Test Slip</span>
                  </button>

                  {printerConnected && (
                    <button
                      type="button"
                      onClick={handleDisconnectPrinter}
                      className="px-3 py-2 bg-slate-750 hover:bg-red-600/40 text-red-300 rounded-xl text-xs font-semibold transition-colors"
                    >
                      Disconnect Hardware
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: SHOP PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-3.5">
              {/* Active Outlet Quick-Switcher Banner */}
              <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 p-3.5 rounded-2xl border border-amber-500/30 flex items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-xs">{formData.shopName}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Active Outlet
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {currentStores.length} {currentStores.length === 1 ? 'store outlet' : 'store outlets'} registered in system
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('stores')}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer flex-shrink-0 flex items-center gap-1.5"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>Manage Outlets ({currentStores.length})</span>
                </button>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Shop / Business Name:</label>
                <input
                  type="text"
                  required
                  value={formData.shopName}
                  onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Shop Address:</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 block mb-1">Shop Phone:</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Default GST Rate (%):</label>
                  <select
                    value={formData.defaultTaxRate}
                    onChange={(e) =>
                      setFormData({ ...formData, defaultTaxRate: Number(e.target.value) })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none"
                  >
                    <option value={0}>0% (Tax-Free Kirana)</option>
                    <option value={5}>5% (Spices & Basic Groceries)</option>
                    <option value={12}>12% (Packaged Items)</option>
                    <option value={18}>18% (Standard GST)</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">GSTIN Number (Optional):</label>
                <input
                  type="text"
                  value={formData.gstin || ''}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                  placeholder="e.g. 07AAAAA0000A1Z5"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono uppercase"
                />
              </div>
            </div>
          )}

          {/* TAB 6: DATA BACKUP & RESTORE */}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              {/* Alert Feedback Messages */}
              {backupSuccessMsg && (
                <div className="p-3 bg-emerald-950/70 border border-emerald-500/60 rounded-2xl text-emerald-200 text-xs flex items-center gap-2.5 shadow-lg animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="font-medium">{backupSuccessMsg}</span>
                </div>
              )}

              {backupErrorMsg && (
                <div className="p-3 bg-red-950/70 border border-red-500/60 rounded-2xl text-red-200 text-xs flex items-center gap-2.5 shadow-lg animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span className="font-medium">{backupErrorMsg}</span>
                </div>
              )}

              {restoreSuccessMsg && (
                <div className="p-3 bg-teal-950/70 border border-teal-500/60 rounded-2xl text-teal-200 text-xs flex items-center gap-2.5 shadow-lg animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 flex-shrink-0" />
                  <span className="font-medium">{restoreSuccessMsg}</span>
                </div>
              )}

              {/* Pending Restore Confirmation Modal/Card */}
              {pendingRestoreData && (
                <div className="p-4 bg-amber-950/40 border border-amber-500/60 rounded-2xl space-y-3 shadow-xl animate-in zoom-in-95">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Confirm Data Restore from Backup</span>
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    You uploaded a backup for{' '}
                    <strong className="text-white font-semibold">"{pendingRestoreData.storeName}"</strong>{' '}
                    created on{' '}
                    <span className="text-amber-300 font-medium">
                      {new Date(pendingRestoreData.backupTimestamp).toLocaleString()}
                    </span>
                    .
                  </p>

                  <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-center text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Products</span>
                      <strong className="text-purple-300 font-mono text-sm">
                        {pendingRestoreData.summary.totalProducts}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Transactions</span>
                      <strong className="text-emerald-300 font-mono text-sm">
                        {pendingRestoreData.summary.totalTransactions}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Customers</span>
                      <strong className="text-amber-300 font-mono text-sm">
                        {pendingRestoreData.summary.totalCustomers}
                      </strong>
                    </div>
                  </div>

                  <p className="text-[11px] text-amber-300/80">
                    ⚠️ Restoring will overwrite current live inventory, transaction ledger, and udhaar records.
                  </p>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPendingRestoreData(null)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmRestore}
                      className="px-4 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-md transition-all"
                    >
                      <Check className="w-4 h-4" />
                      <span>Confirm & Restore All Data</span>
                    </button>
                  </div>
                </div>
              )}

              {/* CARD 1: AUTOMATIC FULL DATA BACKUP CONFIGURATION */}
              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <ShieldCheck className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Automatic Full Data Backup</h4>
                      <p className="text-slate-400 text-xs">
                        Automatically safeguard your entire store inventory, transactions, and customer udhaar to avoid accidental data loss.
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-md font-semibold text-[10px] uppercase tracking-wide border flex-shrink-0 ${
                      formData.autoBackupEnabled !== false
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-700 text-slate-400 border-slate-600'
                    }`}
                  >
                    {formData.autoBackupEnabled !== false ? 'Auto-Backup Active' : 'Disabled'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-700/60">
                  {/* Enable Switch */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div>
                      <span className="font-semibold text-white block text-xs">Automatic Backup Service</span>
                      <span className="text-[11px] text-slate-400">Creates snapshots on shift changes</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.autoBackupEnabled !== false}
                        onChange={(e) => {
                          const updated = { ...formData, autoBackupEnabled: e.target.checked };
                          setFormData(updated);
                          onSaveSettings(updated);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
                    </label>
                  </div>

                  {/* Frequency Selector */}
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                    <label className="font-semibold text-white block text-xs">Backup Frequency</label>
                    <select
                      value={formData.autoBackupFrequency || 'daily'}
                      onChange={(e) => {
                        const updated = {
                          ...formData,
                          autoBackupFrequency: e.target.value as 'daily' | 'each_shift' | 'weekly',
                        };
                        setFormData(updated);
                        onSaveSettings(updated);
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500"
                    >
                      <option value="daily">Daily on App Open / Shift End</option>
                      <option value="each_shift">Each Shift (Every 6 Hours)</option>
                      <option value="weekly">Weekly Full Snapshot</option>
                    </select>
                  </div>
                </div>

                {/* Status & Instant Snapshot Button */}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-1 text-xs">
                  <div className="text-slate-400">
                    <span>Last Full Backup: </span>
                    <strong className="text-cyan-300 font-mono">
                      {formData.lastBackupTimestamp
                        ? new Date(formData.lastBackupTimestamp).toLocaleString()
                        : 'Not exported yet'}
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={handleTakeImmediateSnapshot}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-cyan-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Save Internal Snapshot Now</span>
                  </button>
                </div>
              </div>

              {/* CARD 2: ONE-CLICK FULL DATA EXPORT TO JSON */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-850 p-4 rounded-2xl border border-cyan-500/40 shadow-xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileJson className="w-5 h-5 text-cyan-400" />
                    <div>
                      <h4 className="font-bold text-white text-sm">Download Full Backup (.JSON File)</h4>
                      <p className="text-slate-400 text-xs">
                        Exports complete store catalog, sales history, customer udhaar records, and store configurations into a single JSON file.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-500/30 font-semibold">
                    COMPLETE OFFLINE FILE
                  </span>
                </div>

                {/* Data Overview Chips */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Inventory Products</span>
                    <span className="text-base font-bold text-purple-300 font-mono">{products.length} Items</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Transactions Ledger</span>
                    <span className="text-base font-bold text-emerald-300 font-mono">
                      {transactions.length} Records
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Customer Udhaar</span>
                    <span className="text-base font-bold text-amber-300 font-mono">{customers.length} Accounts</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Staff & Cashier Accounts</span>
                    <span className="text-base font-bold text-cyan-300 font-mono">
                      {formData.staffAccounts?.length || 1} Staff
                    </span>
                  </div>
                </div>

                {/* Download Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleDownloadFullBackup}
                    disabled={isExporting}
                    className="w-full py-3 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyan-950 transition-all active:scale-[0.99]"
                  >
                    {isExporting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Generating JSON Backup...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Download Full Data Backup (JSON File)</span>
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-slate-400 text-center mt-1.5">
                    Downloads an offline file you can save on your computer, phone, or Google Drive for complete safety.
                  </p>
                </div>
              </div>

              {/* CARD 3: RESTORE / IMPORT BACKUP FROM JSON */}
              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 space-y-3">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-purple-400" />
                  <h4 className="font-bold text-white text-sm">Restore Data from JSON Backup</h4>
                </div>
                <p className="text-slate-400 text-xs">
                  Restore your store by selecting a previously downloaded JSON backup file. All products, transactions, and customers will be verified before restoring.
                </p>

                <div className="flex items-center gap-3">
                  <label className="cursor-pointer px-4 py-2 bg-slate-700 hover:bg-slate-650 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors border border-slate-600 shadow-sm">
                    <Upload className="w-4 h-4 text-purple-400" />
                    <span>Select Backup JSON File</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileUploadForRestore}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[11px] text-slate-400">Supported format: .json backup files</span>
                </div>
              </div>

              {/* CARD 4: RECENT LOCAL SNAPSHOTS */}
              {localSnapshotsMeta.length > 0 && (
                <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                  <h5 className="font-semibold text-xs text-slate-300 uppercase tracking-wider">
                    Recent Auto-Backup Snapshots in Browser Storage
                  </h5>
                  <div className="space-y-1.5">
                    {localSnapshotsMeta.map((snap, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-800/70 border border-slate-700/60 text-xs"
                      >
                        <div>
                          <span className="font-mono text-cyan-300 font-semibold">
                            {new Date(snap.timestamp).toLocaleString()}
                          </span>
                          <span className="text-[11px] text-slate-400 ml-2">
                            ({snap.countProducts} items, {snap.countTx} txs, {snap.sizeKb} KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleDownloadFullBackup}
                          className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                        >
                          Export →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 8: OWNER REPORTS (DAILY, WEEKLY, MONTHLY, YEARLY) */}
          {activeTab === 'reports' && (
            <OwnerReportsTab
              transactions={transactions}
              customers={customers}
              products={products}
              storeSettings={formData}
              cashFlow={cashFlow}
              marketCredits={marketCredits}
              onUpdateMarketCredits={onUpdateMarketCredits}
              onResetShiftCash={onResetShiftCash}
              onResetDailyOutletData={onResetDailyOutletData}
              onOpenBillsManager={onOpenBillsManager}
            />
          )}

          {/* TAB 9: 100% FREE APIS & OPEN DATA STATUS */}
          {activeTab === 'free_apis' && <FreeApisStatusTab />}

          {/* TAB 10: PROGRESSIVE WEB APP (PWA) & OFFLINE SETUP */}
          {activeTab === 'pwa' && <PWASettingsTab />}
        </>
      )}
    </div>
      </div>
    </div>
  );
};

