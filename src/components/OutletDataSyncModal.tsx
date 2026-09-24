import React, { useState, useEffect, useMemo } from 'react';
import {
  UploadCloud,
  DownloadCloud,
  Store,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  RefreshCw,
  X,
  User,
  ShieldAlert,
  ArrowRight,
  Database,
  Calendar,
  IndianRupee,
  Layers,
  Sparkles,
  Lock,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import {
  Transaction,
  CustomerUdhaar,
  Product,
  StoreSettings,
  StaffAccount,
  StoreProfile,
  StaffAutoSyncStatus,
} from '../types';
import {
  uploadStaffOutletData,
  downloadOwnerOutletPackage,
  triggerOutletFileDownload,
  fetchOutletUploadMetadata,
  resetDailyOutletData,
} from '../utils/centralSync';
import { uploadOutletDataToFirestore } from '../firebase';

interface OutletDataSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOwner?: boolean;
  activeStaff?: StaffAccount;
  storeSettings: StoreSettings;
  transactions: Transaction[];
  customers: CustomerUdhaar[];
  products: Product[];
  autoSyncStatus?: StaffAutoSyncStatus;
  onToggleAutoSync?: (enabled: boolean) => void;
  onTriggerAutoSync?: () => Promise<boolean> | void;
  themeMode?: 'light' | 'dark';
  initialTab?: 'staff_upload' | 'owner_download' | 'upload' | 'download';
  onApplyDownloadedData?: (data: {
    transactions?: Transaction[];
    customers?: CustomerUdhaar[];
    products?: Product[];
  }) => void;
  onDataImported?: () => Promise<void> | void;
  onResetDailyOutletData?: (outletId: string | 'all') => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const OutletDataSyncModal: React.FC<OutletDataSyncModalProps> = ({
  isOpen,
  onClose,
  isOwner = false,
  activeStaff,
  storeSettings,
  transactions,
  customers,
  products,
  autoSyncStatus,
  onToggleAutoSync,
  onTriggerAutoSync,
  themeMode = 'dark',
  initialTab,
  onApplyDownloadedData,
  onDataImported,
  onResetDailyOutletData,
  showToast,
}) => {
  const getTabFromInitial = (): 'upload' | 'download' => {
    if (initialTab === 'owner_download' || initialTab === 'download') return 'download';
    if (initialTab === 'staff_upload' || initialTab === 'upload') return 'upload';
    return isOwner ? 'download' : 'upload';
  };

  // Tabs: 'upload' (Staff terminal) vs 'download' (Owner export)
  const [activeTab, setActiveTab] = useState<'upload' | 'download'>(getTabFromInitial);

  const notify = (msg: string, type?: 'success' | 'error' | 'info') => {
    if (showToast) {
      showToast(msg, type);
    }
  };

  // Selected outlet for operation
  const currentOutletId = storeSettings.activeStoreId || storeSettings.stores?.[0]?.id || 'store-1';
  const [selectedOutletId, setSelectedOutletId] = useState<string>(currentOutletId);

  // Upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccessSummary, setUploadSuccessSummary] = useState<any | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [includeTransactions, setIncludeTransactions] = useState(true);
  const [includeUdhaar, setIncludeUdhaar] = useState(true);
  const [includeInventory, setIncludeInventory] = useState(true);

  // Download states
  const [downloadTargetOutlet, setDownloadTargetOutlet] = useState<string>('all');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSummary, setDownloadSummary] = useState<any | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Owner authentication guard for download tab
  const [ownerUnlocked, setOwnerUnlocked] = useState(isOwner);
  const [ownerPinInput, setOwnerPinInput] = useState('');
  const [ownerPinError, setOwnerPinError] = useState('');

  // Outlet upload metadata from central server
  const [uploadMetadata, setUploadMetadata] = useState<Record<string, any>>({});
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);

  // Active store outlet profile
  const activeStoreOutlet = useMemo(() => {
    return (
      storeSettings.stores?.find((s) => s.id === selectedOutletId) ||
      storeSettings.stores?.[0] || {
        id: 'store-1',
        shopName: storeSettings.shopName || 'sy Nayab',
        phone: storeSettings.phone || '9876543210',
        address: storeSettings.address || '',
        defaultTaxRate: 0,
      }
    );
  }, [storeSettings.stores, storeSettings.shopName, storeSettings.phone, storeSettings.address, selectedOutletId]);

  // Filter local transactions for selected outlet
  const outletTransactions = useMemo(() => {
    return transactions.filter(
      (t) =>
        t.outletId === selectedOutletId ||
        t.storeId === selectedOutletId ||
        (!t.outletId && !t.storeId && selectedOutletId === 'store-1')
    );
  }, [transactions, selectedOutletId]);

  // Filter local customers for selected outlet
  const outletCustomers = useMemo(() => {
    return customers.filter(
      (c) =>
        c.outletId === selectedOutletId ||
        c.storeId === selectedOutletId ||
        (!c.outletId && !c.storeId && selectedOutletId === 'store-1')
    );
  }, [customers, selectedOutletId]);

  // Calculate local statistics for selected outlet
  const localStats = useMemo(() => {
    const totalSales = outletTransactions
      .filter((t) => !t.voided && t.type === 'sale')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const totalUdhaarDue = outletCustomers.reduce((sum, c) => sum + (Number(c.totalDue) || 0), 0);
    return {
      billsCount: outletTransactions.length,
      totalSales,
      customersCount: outletCustomers.length,
      totalUdhaarDue,
      productsCount: products.length,
    };
  }, [outletTransactions, outletCustomers, products.length]);

  // Sync state on open
  useEffect(() => {
    if (isOpen) {
      setActiveTab(getTabFromInitial());
      setSelectedOutletId(currentOutletId);
      setOwnerUnlocked(isOwner);
      loadMetadata();
      setUploadSuccessSummary(null);
      setUploadError(null);
      setDownloadSummary(null);
      setDownloadError(null);
    }
  }, [isOpen, isOwner, currentOutletId, initialTab]);

  const loadMetadata = async () => {
    setIsLoadingMeta(true);
    const res = await fetchOutletUploadMetadata();
    if (res.success && res.metadata) {
      setUploadMetadata(res.metadata);
    }
    setIsLoadingMeta(false);
  };

  // Handle Owner PIN verification
  const handleVerifyOwnerPin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = ownerPinInput.trim();
    const ownerAccount = storeSettings.staffAccounts?.find(
      (s) => s.role === 'owner' || s.role === 'master_admin'
    );
    const validOwnerPin = ownerAccount?.pin || 'nayab@q6';

    if (cleanPin === validOwnerPin || cleanPin === 'nayab@q6') {
      setOwnerUnlocked(true);
      setOwnerPinError('');
      notify('Owner access granted for outlet downloads', 'success');
    } else {
      setOwnerPinError('Incorrect Owner PIN. Please enter Master Admin PIN.');
    }
  };

  // Staff Action: Upload outlet data to server DB
  const handleStaffUpload = async () => {
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccessSummary(null);

    const staffName = activeStaff?.name || 'Counter Staff';
    const staffRole = activeStaff?.role || 'Staff';

    try {
      const payload = {
        outletId: selectedOutletId,
        outletName: activeStoreOutlet.shopName,
        products: includeInventory ? products : [],
        transactions: includeTransactions ? outletTransactions : [],
        customers: includeUdhaar ? outletCustomers : [],
        staff: storeSettings.staffAccounts,
        outlet: activeStoreOutlet,
        uploadedBy: staffName,
        role: staffRole,
      };

      // 1. Upload to Central Server Express DB
      const result = await uploadStaffOutletData(payload);

      if (!result.success) {
        throw new Error(result.error || 'Server upload failed');
      }

      // 2. Dual-sync to Cloud Firestore in background
      uploadOutletDataToFirestore(
        selectedOutletId,
        {
          transactions: includeTransactions ? outletTransactions : [],
          customers: includeUdhaar ? outletCustomers : [],
          outlet: activeStoreOutlet,
        },
        staffName
      ).catch((fsErr) => console.warn('Firestore sync warning:', fsErr));

      setUploadSuccessSummary({
        outletName: activeStoreOutlet.shopName,
        billsCount: outletTransactions.length,
        totalSales: localStats.totalSales,
        customersCount: outletCustomers.length,
        productsCount: includeInventory ? products.length : 0,
        uploadedAt: result.lastUploadedAt || new Date().toISOString(),
        uploadedBy: staffName,
      });

      notify(
        `Outlet "${activeStoreOutlet.shopName}" data uploaded to server database!`,
        'success'
      );
      // Refresh metadata
      loadMetadata();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload outlet data to server database.');
      notify(`Upload failed: ${err.message}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Owner Action: Download data file (JSON or CSV)
  const handleOwnerFileDownload = (format: 'json' | 'csv') => {
    try {
      triggerOutletFileDownload(downloadTargetOutlet, format);
      notify(
        `Downloading ${format.toUpperCase()} data for ${downloadTargetOutlet === 'all' ? 'All Outlets' : downloadTargetOutlet}...`,
        'info'
      );
    } catch (err: any) {
      notify(`Download failed: ${err.message}`, 'error');
    }
  };

  // Owner Action: Pull and inspect data package from server database
  const handleOwnerPullData = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    setDownloadSummary(null);

    try {
      const result = await downloadOwnerOutletPackage(downloadTargetOutlet);
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to download data package from server');
      }

      setDownloadSummary(result.data);
      notify(
        `Downloaded server dataset (${result.data.summary?.totalBills || 0} bills, ₹${result.data.summary?.totalRevenue?.toFixed(0) || 0})`,
        'success'
      );
    } catch (err: any) {
      setDownloadError(err.message || 'Failed to pull outlet data from server database.');
      notify(`Download error: ${err.message}`, 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  // Owner Action: Merge server data into active terminal state
  const handleApplyServerData = () => {
    if (!downloadSummary) return;

    if (onApplyDownloadedData) {
      onApplyDownloadedData({
        transactions: downloadSummary.transactions || [],
        customers: downloadSummary.customers || [],
        products: downloadSummary.products || [],
      });
    }
    if (onDataImported) {
      onDataImported();
    }
    notify('Merged server outlet records into counter terminal state!', 'success');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      id="outlet-data-sync-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className={`w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden ${
          themeMode === 'light'
            ? 'bg-white border-slate-200 text-slate-800'
            : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 flex items-center justify-between border-b ${
            themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-850 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-600 to-cyan-500 text-white shadow-md">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight">Outlet Server Data Hub</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Client-Server DB
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Staff Outlet Data Upload & Owner Central Download
              </p>
            </div>
          </div>

          <button
            id="close-outlet-sync-modal"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div
          className={`flex border-b text-xs font-semibold px-5 pt-2 gap-2 ${
            themeMode === 'light' ? 'bg-slate-100/70 border-slate-200' : 'bg-slate-900/60 border-slate-800'
          }`}
        >
          <button
            id="tab-staff-upload"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl border-b-2 transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/80 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-4 h-4 text-emerald-400" />
            <span>1. Staff Upload to Server</span>
            <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold">
              Branch Terminal
            </span>
          </button>

          <button
            id="tab-owner-download"
            onClick={() => setActiveTab('download')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl border-b-2 transition-all cursor-pointer ${
              activeTab === 'download'
                ? 'border-amber-500 text-amber-400 bg-slate-800/80 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <DownloadCloud className="w-4 h-4 text-amber-400" />
            <span>2. Owner Download from Server</span>
            <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-extrabold">
              Admin Only
            </span>
            {!ownerUnlocked && !isOwner && <Lock className="w-3 h-3 text-amber-400 ml-1" />}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* ======================================================== */}
          {/* TAB 1: STAFF UPLOAD TO SERVER DATABASE                   */}
          {/* ======================================================== */}
          {activeTab === 'upload' && (
            <div className="space-y-5">
              {/* Automatic Staff Database Sync Status & Settings Card */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 to-cyan-950/40 border border-emerald-500/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300">
                      <RefreshCw className={`w-5 h-5 ${autoSyncStatus?.isSyncing ? 'animate-spin text-blue-400' : 'text-emerald-400'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-white">Automatic Staff Database Sync</h4>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            autoSyncStatus?.isSyncing
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-400/40 animate-pulse'
                              : autoSyncStatus?.isAutoSyncEnabled !== false
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {autoSyncStatus?.isSyncing
                            ? 'Syncing in background...'
                            : autoSyncStatus?.isAutoSyncEnabled !== false
                            ? '🟢 Auto-Sync ACTIVE'
                            : '⏸️ Auto-Sync Paused'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Continuous background upload of every sale bill, Udhaar Khata ledger, and stock update to Central Server & Cloud Firestore.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:self-center">
                    {onToggleAutoSync && (
                      <button
                        id="btn-toggle-auto-sync"
                        type="button"
                        onClick={() => onToggleAutoSync(!(autoSyncStatus?.isAutoSyncEnabled !== false))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          autoSyncStatus?.isAutoSyncEnabled !== false
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                        }`}
                      >
                        {autoSyncStatus?.isAutoSyncEnabled !== false ? 'Auto-Sync: ON' : 'Auto-Sync: OFF'}
                      </button>
                    )}

                    {onTriggerAutoSync && (
                      <button
                        id="btn-trigger-instant-auto-sync"
                        type="button"
                        onClick={() => onTriggerAutoSync()}
                        disabled={autoSyncStatus?.isSyncing}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600/80 hover:bg-cyan-500 text-white transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Sync Now</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-500/20 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Frequency:</span>
                    <span className="font-semibold text-emerald-300">Instant on sale + every 30s</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Last Auto-Upload:</span>
                    <span className="font-semibold text-white font-mono">
                      {autoSyncStatus?.lastSyncTimestamp
                        ? new Date(autoSyncStatus.lastSyncTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : 'Continuous'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Destination:</span>
                    <span className="font-semibold text-cyan-300">Express DB + Firestore</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Status:</span>
                    <span className="font-semibold text-emerald-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Live & Connected
                    </span>
                  </div>
                </div>
              </div>

              {/* Outlet Selector & Active Staff Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Active Outlet / Branch
                  </label>
                  <select
                    id="staff-upload-outlet-select"
                    value={selectedOutletId}
                    onChange={(e) => setSelectedOutletId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm font-semibold text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {storeSettings.stores && storeSettings.stores.length > 0 ? (
                      storeSettings.stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.shopName} {s.isPrimary ? '(HQ / Main)' : `(${s.id})`}
                        </option>
                      ))
                    ) : (
                      <option value="store-1">{storeSettings.shopName || 'sy Nayab'}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Logged-In Staff Terminal
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm">
                    <User className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-white">
                      {activeStaff?.name || 'Staff User'}
                    </span>
                    <span className="ml-auto text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold uppercase">
                      {activeStaff?.role || 'Staff'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Data Summary Cards to be Uploaded */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Outlet Records Ready to Upload</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Card 1: Bills */}
                  <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 relative overflow-hidden">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span>Sales Bills</span>
                      <FileText className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="text-xl font-black text-white font-mono">
                      {localStats.billsCount}
                    </div>
                    <div className="text-xs text-emerald-400 font-semibold font-mono mt-0.5">
                      ₹{localStats.totalSales.toLocaleString('en-IN')} Total
                    </div>
                  </div>

                  {/* Card 2: Udhaar Ledger */}
                  <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 relative overflow-hidden">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span>Udhaar Accounts</span>
                      <IndianRupee className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-xl font-black text-white font-mono">
                      {localStats.customersCount}
                    </div>
                    <div className="text-xs text-amber-400 font-semibold font-mono mt-0.5">
                      ₹{localStats.totalUdhaarDue.toLocaleString('en-IN')} Due
                    </div>
                  </div>

                  {/* Card 3: Inventory Products */}
                  <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 relative overflow-hidden">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span>Inventory Catalog</span>
                      <Store className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-xl font-black text-white font-mono">
                      {localStats.productsCount}
                    </div>
                    <div className="text-xs text-purple-400 font-semibold mt-0.5">
                      Products & Rates
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload Scope Checkboxes */}
              <div className="p-3.5 rounded-xl bg-slate-800/30 border border-slate-700/50 space-y-2 text-xs">
                <span className="font-bold text-slate-300 block mb-1">Data Upload Scope:</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={includeTransactions}
                      onChange={(e) => setIncludeTransactions(e.target.checked)}
                      className="rounded text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>Sales Invoices & Bills</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={includeUdhaar}
                      onChange={(e) => setIncludeUdhaar(e.target.checked)}
                      className="rounded text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>Udhaar Khata Balances</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={includeInventory}
                      onChange={(e) => setIncludeInventory(e.target.checked)}
                      className="rounded text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>Current Inventory Rates</span>
                  </label>
                </div>
              </div>

              {/* Last Upload Info */}
              {uploadMetadata[selectedOutletId] && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>
                      Last Server Upload:{' '}
                      <strong className="text-white font-mono">
                        {new Date(uploadMetadata[selectedOutletId].lastUploadedAt).toLocaleString('en-IN')}
                      </strong>
                    </span>
                  </div>
                  <span className="text-slate-400 text-[11px]">
                    By: {uploadMetadata[selectedOutletId].uploadedBy} ({uploadMetadata[selectedOutletId].uploadedRole})
                  </span>
                </div>
              )}

              {/* Upload Success Banner */}
              {uploadSuccessSummary && (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/50 space-y-2 animate-in zoom-in-95">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Outlet Data Successfully Uploaded to Central Server!</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Uploaded <strong>{uploadSuccessSummary.billsCount} bills</strong> (₹
                    {uploadSuccessSummary.totalSales.toLocaleString('en-IN')}) and{' '}
                    <strong>{uploadSuccessSummary.customersCount} udhaar records</strong> for{' '}
                    <span className="text-white font-semibold">{uploadSuccessSummary.outletName}</span>.
                    The owner can now view and download these records remotely from anywhere.
                  </p>
                </div>
              )}

              {/* Upload Error Banner */}
              {uploadError && (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/50 flex items-start gap-2.5 text-xs text-rose-300">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
                  <div>
                    <div className="font-bold text-rose-200">Upload Failed</div>
                    <div>{uploadError}</div>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2">
                <button
                  id="btn-upload-outlet-data"
                  onClick={handleStaffUpload}
                  disabled={isUploading}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/30 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Uploading Outlet Data to Central Server...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-5 h-5" />
                      <span>Upload "{activeStoreOutlet.shopName}" Data to Server Database</span>
                    </>
                  )}
                </button>
                <p className="text-center text-[11px] text-slate-400 mt-2">
                  Staff can safely upload data after each shift or daily close. Data is saved in the central server database and mirrored to Cloud Firestore.
                </p>

                <div className="pt-3 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!isOwner) {
                        const enteredPin = window.prompt(
                          'Owner Authorization Required:\nResetting daily outlet data is locked for staff.\nEnter Owner PIN (Faizan Inamdar) or Master Admin PIN to proceed:'
                        );
                        const ownerAccount = storeSettings?.staffAccounts?.find((s) => s.role === 'owner' || s.role === 'master_admin');
                        if (!enteredPin || (enteredPin.trim() !== 'nayab@q6' && (!ownerAccount?.pin || enteredPin.trim() !== ownerAccount.pin))) {
                          notify('Access Denied: Incorrect PIN. Only the Store Owner or Master Admin can reset daily outlet data.', 'error');
                          return;
                        }
                      }
                      if (
                        window.confirm(
                          `Reset today's sales, expenses & added cash for "${activeStoreOutlet.shopName}" to ₹0?\n\nPast days' sales and customer udhaar khata remain 100% safe.`
                        )
                      ) {
                        if (onResetDailyOutletData) {
                          onResetDailyOutletData(selectedOutletId);
                        } else {
                          await resetDailyOutletData(selectedOutletId, activeStaff?.name || 'Staff');
                        }
                        notify(`Today's daily operations for ${activeStoreOutlet.shopName} reset to ₹0!`, 'success');
                      }
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-xl transition-all cursor-pointer border border-rose-800/40"
                    title={isOwner ? "Zero out today's sales, expenses, and cash for this outlet" : "Reset Daily Data (Owner Access Only • Locked for Staff)"}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Today's Outlet Data to ₹0</span>
                    {!isOwner && <Lock className="w-3.5 h-3.5 text-amber-400 ml-1" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: OWNER DOWNLOAD FROM SERVER DATABASE               */}
          {/* ======================================================== */}
          {activeTab === 'download' && (
            <div className="space-y-5">
              {/* Owner Authentication Guard */}
              {!ownerUnlocked ? (
                <div className="p-6 rounded-2xl bg-slate-800/80 border border-amber-500/40 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Owner Authorization Required</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                      Downloading server-wide financial balances, complete bill registers, and branch metrics requires Admin Owner credentials.
                    </p>
                  </div>

                  <form onSubmit={handleVerifyOwnerPin} className="max-w-xs mx-auto space-y-3">
                    <input
                      id="owner-unlock-pin-input"
                      type="password"
                      placeholder="Enter Owner PIN (nayab@q6)"
                      value={ownerPinInput}
                      onChange={(e) => setOwnerPinInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-center text-sm font-mono text-white tracking-widest focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />

                    {ownerPinError && (
                      <p className="text-xs text-rose-400 font-semibold">{ownerPinError}</p>
                    )}

                    <button
                      id="btn-unlock-owner-download"
                      type="submit"
                      className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Unlock Owner Download
                    </button>
                  </form>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Outlet Selection for Download */}
                  <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Store className="w-4 h-4 text-amber-400" />
                        <span>Select Outlet to Download</span>
                      </label>
                      <button
                        onClick={loadMetadata}
                        disabled={isLoadingMeta}
                        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMeta ? 'animate-spin' : ''}`} />
                        <span>Refresh Server Status</span>
                      </button>
                    </div>

                    <select
                      id="owner-download-outlet-select"
                      value={downloadTargetOutlet}
                      onChange={(e) => setDownloadTargetOutlet(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm font-semibold text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="all">
                        ⭐ All Outlets Consolidated (Company-Wide Master Export)
                      </option>
                      {storeSettings.stores?.map((s) => (
                        <option key={s.id} value={s.id}>
                          Outlet: {s.shopName} ({s.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Registered Outlets Live Server Status */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-amber-400" />
                      <span>Live Server Outlet Telemetry (Uploaded by Staff)</span>
                    </h4>

                    <div className="space-y-2">
                      {storeSettings.stores && storeSettings.stores.length > 0 ? (
                        storeSettings.stores.map((outlet) => {
                          const meta = uploadMetadata[outlet.id];
                          return (
                            <div
                              key={outlet.id}
                              className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white text-sm">
                                    {outlet.shopName}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-mono text-[10px]">
                                    {outlet.id}
                                  </span>
                                  {outlet.isPrimary && (
                                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                                      HQ
                                    </span>
                                  )}
                                </div>
                                <div className="text-slate-400 text-[11px] mt-0.5">
                                  {meta ? (
                                    <>
                                      Last Staff Upload:{' '}
                                      <span className="text-emerald-400 font-semibold">
                                        {new Date(meta.lastUploadedAt).toLocaleString('en-IN')}
                                      </span>{' '}
                                      by {meta.uploadedBy}
                                    </>
                                  ) : (
                                    <span className="text-amber-400">No staff upload recorded yet</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-auto">
                                <button
                                  onClick={() => {
                                    setDownloadTargetOutlet(outlet.id);
                                    triggerOutletFileDownload(outlet.id, 'json');
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Download JSON File for this Outlet"
                                >
                                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>JSON</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setDownloadTargetOutlet(outlet.id);
                                    triggerOutletFileDownload(outlet.id, 'csv');
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Download CSV Spreadsheet for this Outlet"
                                >
                                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>CSV</span>
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-3 text-center text-xs text-slate-400 bg-slate-800/30 rounded-xl">
                          No outlets registered.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Owner Download Options Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {/* Option 1: File Download (JSON Backup) */}
                    <button
                      id="btn-download-outlet-json"
                      onClick={() => handleOwnerFileDownload('json')}
                      className="p-4 rounded-xl bg-slate-800 hover:bg-slate-750 border border-cyan-500/40 text-left transition-all hover:border-cyan-400 cursor-pointer shadow-md group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 group-hover:scale-110 transition-transform">
                          <FileText className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] uppercase font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
                          Direct File Download
                        </span>
                      </div>
                      <div className="font-bold text-sm text-white">Download as JSON File</div>
                      <p className="text-xs text-slate-400 mt-1">
                        Full machine-readable backup of transactions, customers, and inventory.
                      </p>
                    </button>

                    {/* Option 2: File Download (CSV Spreadsheet) */}
                    <button
                      id="btn-download-outlet-csv"
                      onClick={() => handleOwnerFileDownload('csv')}
                      className="p-4 rounded-xl bg-slate-800 hover:bg-slate-750 border border-emerald-500/40 text-left transition-all hover:border-emerald-400 cursor-pointer shadow-md group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
                          <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                          Excel / Sheets
                        </span>
                      </div>
                      <div className="font-bold text-sm text-white">Download as CSV Spreadsheet</div>
                      <p className="text-xs text-slate-400 mt-1">
                        Sales invoices and Udhaar registers formatted for Microsoft Excel & Google Sheets.
                      </p>
                    </button>
                  </div>

                  {/* Option 3: Pull into Terminal & Inspect */}
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-1.5">
                          <RefreshCw className="w-4 h-4 text-amber-400" />
                          <span>Pull Server Data into Terminal</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Fetch and preview latest server dataset, with option to merge into current device state.
                        </p>
                      </div>

                      <button
                        id="btn-pull-inspect-server-data"
                        onClick={handleOwnerPullData}
                        disabled={isDownloading}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isDownloading ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Pulling...</span>
                          </>
                        ) : (
                          <>
                            <DownloadCloud className="w-4 h-4" />
                            <span>Pull from Server</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Pull Summary Card */}
                    {downloadSummary && (
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700 space-y-3 animate-in fade-in">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="p-2 rounded-lg bg-slate-800">
                            <span className="text-slate-400 block text-[10px]">Total Invoices</span>
                            <span className="font-bold text-white font-mono text-sm">
                              {downloadSummary.summary?.totalBills || 0}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-800">
                            <span className="text-slate-400 block text-[10px]">Total Revenue</span>
                            <span className="font-bold text-emerald-400 font-mono text-sm">
                              ₹{(downloadSummary.summary?.totalRevenue || 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-800">
                            <span className="text-slate-400 block text-[10px]">Udhaar Balance</span>
                            <span className="font-bold text-amber-400 font-mono text-sm">
                              ₹{(downloadSummary.summary?.totalUdhaarDue || 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-800">
                            <span className="text-slate-400 block text-[10px]">Catalog Products</span>
                            <span className="font-bold text-purple-400 font-mono text-sm">
                              {downloadSummary.summary?.totalProducts || 0}
                            </span>
                          </div>
                        </div>

                        {onApplyDownloadedData && (
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-xs text-slate-300">
                              Load these server records into this device's active counter terminal?
                            </span>
                            <button
                              id="btn-apply-server-data-to-terminal"
                              onClick={handleApplyServerData}
                              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                              <span>Merge into Local POS</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`px-5 py-3 border-t flex items-center justify-between text-xs ${
            themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-850 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-1.5 text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Dual Sync: Express Central Server & Cloud Firestore</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
