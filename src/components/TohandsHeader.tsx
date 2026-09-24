import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  BookOpen,
  BarChart3,
  Settings,
  UserCheck,
  Key,
  X,
  Lock,
  Camera,
  ShieldAlert,
  ShieldCheck,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Clock,
  Receipt,
  LogOut,
  Menu,
  ChevronDown,
  CheckCircle2,
  Store,
  Wifi,
  WifiOff,
  UploadCloud,
  DownloadCloud,
  Database,
  RefreshCw,
} from 'lucide-react';
import { StoreSettings, StaffAutoSyncStatus } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface TohandsHeaderProps {
  storeSettings: StoreSettings;
  productsCount: number;
  pendingUdhaarTotal: number;
  themeMode?: 'dark' | 'light';
  onToggleTheme?: () => void;
  onOpenPosCatalog: () => void;
  onOpenBarcodeScanner?: () => void;
  onOpenUdhaarLedger: () => void;
  onOpenReports: () => void;
  onOpenBillsManager?: () => void;
  onOpenMasterAdmin?: () => void;
  onOpenOutletSync?: () => void;
  staffAutoSyncStatus?: StaffAutoSyncStatus;
  onTriggerAutoSync?: () => void;
  onOpenSettings: (tab?: 'upi' | 'inventory' | 'staff' | 'printer' | 'profile' | 'reports' | 'stores' | 'backup' | 'free_apis' | 'pwa') => void;
  onSwitchStaff: (staffId: string) => void;
  onLogout?: () => void;
  isAuthenticated?: boolean;
  isOwner?: boolean;
}

export const TohandsHeader: React.FC<TohandsHeaderProps> = ({
  storeSettings,
  productsCount,
  pendingUdhaarTotal,
  themeMode = 'dark',
  onToggleTheme,
  onOpenPosCatalog,
  onOpenBarcodeScanner,
  onOpenUdhaarLedger,
  onOpenReports,
  onOpenBillsManager,
  onOpenMasterAdmin,
  onOpenOutletSync,
  staffAutoSyncStatus,
  onTriggerAutoSync,
  onOpenSettings,
  onSwitchStaff,
  onLogout,
  isAuthenticated,
  isOwner: propIsOwner,
}) => {
  const [showStaffSwitchModal, setShowStaffSwitchModal] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [inputPin, setInputPin] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  // Owner Access restriction states for Reports, Settings, Bills & Master Admin
  const [showOwnerAuthModal, setShowOwnerAuthModal] = useState(false);
  const [pendingOwnerDestination, setPendingOwnerDestination] = useState<'reports' | 'settings' | 'bills' | 'master_admin'>('reports');
  const [ownerPinInput, setOwnerPinInput] = useState('');
  const [ownerPinError, setOwnerPinError] = useState('');
  const [showOwnerPin, setShowOwnerPin] = useState(false);

  // User Logout Confirmation & Mobile Menu states
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Safely derive active staff without defaulting to owner/admin
  const activeStaff = storeSettings.activeStaffId
    ? storeSettings.staffAccounts.find((s) => s.id === storeSettings.activeStaffId)
    : undefined;

  const isOwner = propIsOwner !== undefined
    ? propIsOwner
    : Boolean(isAuthenticated !== false && activeStaff && (activeStaff.role === 'owner' || activeStaff.role === 'master_admin'));

  const ownerStaff = storeSettings.staffAccounts.find(
    (s) =>
      s.role === 'owner' ||
      s.role === 'master_admin' ||
      s.id === 'faizan-inamdar' ||
      s.serverId === 'faizan-inamdar' ||
      s.name.toLowerCase().includes('faizan')
  ) || {
    id: 'faizan-inamdar',
    serverId: 'faizan-inamdar',
    name: 'Faizan Inamdar (admin)',
    role: 'owner' as const,
    pin: 'nayab@q6',
    active: true,
  };

  const activeStoreOutlet = storeSettings.stores?.find((s) => s.id === storeSettings.activeStoreId) || storeSettings.stores?.[0];
  const activeOutletName = activeStoreOutlet?.shopName || storeSettings.shopName;

  // Real-time Network Status (Online / Offline)
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true;
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Shortcut name of active outlet only (e.g. "Main", "Branch 1", "Counter-A")
  const activeOutletShortcut = useMemo(() => {
    if (activeStoreOutlet?.shortcutName && activeStoreOutlet.shortcutName.trim()) {
      return activeStoreOutlet.shortcutName.trim();
    }
    // If primary or only store
    if (activeStoreOutlet?.isPrimary || !storeSettings.stores || storeSettings.stores.length <= 1) {
      return 'Main';
    }
    // Check if name has a separator like '-' or ':' or '(' e.g. "Nayab Kirana - Station Rd" -> "Station Rd"
    const parts = activeOutletName.split(/[-–—:(]/);
    if (parts.length > 1 && parts[parts.length - 1].trim().replace(/\)/g, '').length > 0) {
      return parts[parts.length - 1].trim().replace(/\)/g, '').slice(0, 14);
    }
    return activeOutletName.length > 14 ? activeOutletName.slice(0, 14).trim() : activeOutletName;
  }, [activeStoreOutlet, activeOutletName, storeSettings.stores]);

  const handleOpenProtectedAction = (destination: 'reports' | 'settings' | 'bills' | 'master_admin') => {
    // SECURITY DIRECTIVE: Master Admin contains sensitive root DB wipe/restore operations.
    // It always requires entering the Master Admin PIN (nayab@q6 or owner PIN) to unlock.
    if (destination === 'master_admin') {
      setPendingOwnerDestination('master_admin');
      setOwnerPinInput('');
      setOwnerPinError('');
      setShowOwnerAuthModal(true);
      return;
    }

    if (isOwner) {
      if (destination === 'reports') onOpenReports();
      else if (destination === 'settings') onOpenSettings();
      else if (destination === 'bills') onOpenBillsManager?.();
    } else {
      setPendingOwnerDestination(destination);
      setOwnerPinInput('');
      setOwnerPinError('');
      setShowOwnerAuthModal(true);
    }
  };

  const handleReportsClick = () => {
    handleOpenProtectedAction('reports');
  };

  const handleVerifyOwnerPinAndOpen = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = ownerPinInput.trim();
    const isMasterAdminPin =
      cleanPin === 'nayab@q6' ||
      (ownerStaff.pin && ownerStaff.pin === cleanPin) ||
      storeSettings.staffAccounts.some(
        (s) =>
          (s.role === 'owner' || s.role === 'master_admin' || s.id === 'faizan-inamdar' || (s.serverId && s.serverId.includes('faizan'))) &&
          s.pin === cleanPin
      );
    if (!isMasterAdminPin) {
      setOwnerPinError('Incorrect PIN. Master Admin and Owner access is restricted.');
      return;
    }

    setShowOwnerAuthModal(false);
    setOwnerPinInput('');
    setOwnerPinError('');

    if (pendingOwnerDestination === 'reports') onOpenReports();
    else if (pendingOwnerDestination === 'settings') onOpenSettings();
    else if (pendingOwnerDestination === 'bills') onOpenBillsManager?.();
    else if (pendingOwnerDestination === 'master_admin') onOpenMasterAdmin?.();
  };

  const handleSwitchToOwnerSession = () => {
    const cleanPin = ownerPinInput.trim();
    const isMasterAdminPin =
      cleanPin === 'nayab@q6' ||
      (ownerStaff.pin && ownerStaff.pin === cleanPin) ||
      storeSettings.staffAccounts.some(
        (s) =>
          (s.role === 'owner' || s.role === 'master_admin' || s.id === 'faizan-inamdar' || (s.serverId && s.serverId.includes('faizan'))) &&
          s.pin === cleanPin
      );
    if (!isMasterAdminPin) {
      setOwnerPinError('Incorrect PIN. Please enter correct Master PIN to switch.');
      return;
    }

    onSwitchStaff(ownerStaff.id);
    setShowOwnerAuthModal(false);
    setOwnerPinInput('');
    setOwnerPinError('');

    if (pendingOwnerDestination === 'reports') onOpenReports();
    else if (pendingOwnerDestination === 'settings') onOpenSettings();
    else if (pendingOwnerDestination === 'bills') onOpenBillsManager?.();
    else if (pendingOwnerDestination === 'master_admin') onOpenMasterAdmin?.();
  };

  const handleConfirmSwitch = (e: React.FormEvent) => {
    e.preventDefault();
    const targetStaff = storeSettings.staffAccounts.find((s) => s.id === selectedStaffId);
    if (!targetStaff) return;

    if (targetStaff.pin && targetStaff.pin !== inputPin.trim()) {
      setPinError('Incorrect PIN / Password. Please re-enter.');
      return;
    }

    onSwitchStaff(targetStaff.id);
    setShowStaffSwitchModal(false);
    setInputPin('');
    setPinError('');
  };

  return (
    <header
      className={`w-full px-2.5 sm:px-4 py-1.5 sm:py-2 flex flex-col gap-1.5 z-30 flex-shrink-0 backdrop-blur-md select-none transition-colors duration-150 relative border-b shadow-xs ${
        themeMode === 'light'
          ? 'bg-white/95 border-slate-200 text-slate-900'
          : 'bg-slate-900/95 border-slate-800 text-white'
      }`}
    >
      {/* 1. Top Row: Dark/Light Mode, Brand Identity, Live Clock, Sales Turnover, User & Logout */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2.5 w-full min-w-0">
        {/* Left: Dark / Light Mode Toggle Button & Brand Identity */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          {onToggleTheme && (
            <button
              id="theme-toggle-btn-top-left"
              onClick={onToggleTheme}
              className={`h-7 px-2 rounded-lg border text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer select-none flex-shrink-0 active:scale-95 ${
                themeMode === 'dark'
                  ? 'bg-slate-800/90 hover:bg-slate-750 text-amber-300 border-amber-500/40 hover:border-amber-400'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
              }`}
              title={`Switch to ${themeMode === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {themeMode === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[10px] font-bold hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-[10px] font-bold hidden sm:inline">Dark</span>
                </>
              )}
            </button>
          )}

          {/* Store Name & Active Outlet Shortcut with Official App Icon */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {/* Official App Icon */}
            <button
              id="header-app-icon-button"
              onClick={() => {
                if (isOwner) onOpenSettings('pwa');
                else handleOpenProtectedAction('settings');
              }}
              className="relative p-0.5 rounded-lg transition-all duration-150 active:scale-95 group focus:outline-none focus:ring-2 focus:ring-emerald-500/50 flex-shrink-0 cursor-pointer"
              title="NAYAB Kirana & POS App Icon • Click to view PWA details & high-res icons"
            >
              <img
                src="/pwa-192x192.png"
                alt="NAYAB POS Icon"
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-md object-cover shadow-sm ring-1 ring-emerald-500/30 group-hover:ring-emerald-400 transition-all"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full ring-1 ring-slate-900" />
            </button>

            <h1
              className={`font-black text-xs xs:text-sm tracking-tight truncate max-w-[110px] xs:max-w-[160px] sm:max-w-[220px] md:max-w-[300px] lg:max-w-none ${
                themeMode === 'light' ? 'text-slate-900' : 'text-white'
              }`}
              title={storeSettings.shopName}
            >
              {storeSettings.shopName}
            </h1>

            {/* Shortcut Name of Active Outlet Only */}
            <button
              id="header-active-outlet-shortcut"
              onClick={() => {
                if (isOwner) onOpenSettings('stores');
                else handleOpenProtectedAction('settings');
              }}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold border transition-all cursor-pointer select-none active:scale-95 flex-shrink-0 ${
                themeMode === 'light'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60'
              }`}
              title={`Active Outlet: ${activeOutletName} (Shortcut: ${activeOutletShortcut}). Click to switch counter or manage outlets.`}
            >
              <Store className="w-3 h-3 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
              <span className="font-extrabold tracking-tight truncate max-w-[65px] xs:max-w-[100px]">
                {activeOutletShortcut}
              </span>
            </button>
          </div>
        </div>

        {/* Right: Network Status (Online / Offline), Active User, PWA Install & Logout */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Status of App Running Offline or Online in Header Bar */}
          <div
            id="header-network-status"
            className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl text-xs font-bold border transition-all select-none flex-shrink-0 ${
              isOnline
                ? themeMode === 'light'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                : themeMode === 'light'
                  ? 'bg-amber-100 text-amber-900 border-amber-400 animate-pulse'
                  : 'bg-amber-950/80 text-amber-300 border-amber-500/60 animate-pulse'
            }`}
            title={
              isOnline
                ? 'App is Online (Connected & live)'
                : 'App is Offline (All billing, local storage & thermal printing work offline)'
            }
          >
            {isOnline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                <span className="text-[11px] font-bold tracking-tight hidden xs:inline">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span className="text-[11px] font-bold tracking-tight hidden xs:inline">Offline</span>
              </>
            )}
          </div>

          {/* Real-time DB Auto-Sync Status Indicator */}
          {onOpenOutletSync && (
            <button
              id="header-db-auto-sync-status"
              onClick={onOpenOutletSync}
              className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl text-xs font-bold border transition-all select-none flex-shrink-0 cursor-pointer active:scale-95 ${
                staffAutoSyncStatus?.isSyncing
                  ? 'bg-blue-950/70 text-blue-300 border-blue-500/50 animate-pulse'
                  : staffAutoSyncStatus?.isAutoSyncEnabled === false
                  ? 'bg-slate-800/80 text-slate-400 border-slate-700'
                  : staffAutoSyncStatus?.lastSyncSuccess === false
                  ? 'bg-rose-950/70 text-rose-300 border-rose-500/50'
                  : themeMode === 'light'
                  ? 'bg-cyan-50 text-cyan-800 border-cyan-300 hover:bg-cyan-100'
                  : 'bg-cyan-950/70 text-cyan-300 border-cyan-500/40 hover:bg-cyan-900/60'
              }`}
              title={
                staffAutoSyncStatus?.isSyncing
                  ? 'Auto-uploading staff bills & data to database...'
                  : staffAutoSyncStatus?.isAutoSyncEnabled === false
                  ? 'Staff DB Auto-Sync is Paused. Click to enable or sync.'
                  : `Automatic Staff DB Sync: Active (Last synced: ${
                      staffAutoSyncStatus?.lastSyncTimestamp
                        ? new Date(staffAutoSyncStatus.lastSyncTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Continuous'
                    }). Click to view details.`
              }
            >
              {staffAutoSyncStatus?.isSyncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin flex-shrink-0" />
                  <span className="text-[11px] font-bold tracking-tight hidden sm:inline">Syncing DB...</span>
                </>
              ) : staffAutoSyncStatus?.isAutoSyncEnabled === false ? (
                <>
                  <Database className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-[11px] font-bold tracking-tight hidden sm:inline">DB Sync Paused</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                  <span className="text-[11px] font-bold tracking-tight hidden sm:inline">DB Auto-Sync</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse hidden xs:inline" />
                </>
              )}
            </button>
          )}

          {/* PWA Install Button in Header */}
          <div className="flex-shrink-0">
            <PWAInstallButton variant="header" />
          </div>

          {/* Active User / Cashier Pill */}
          {activeStaff ? (
            <button
              onClick={() => {
                setSelectedStaffId(activeStaff.id);
                setShowStaffSwitchModal(true);
              }}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl border text-xs transition-colors cursor-pointer active:scale-95 flex-shrink-0 ${
                themeMode === 'light'
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                  : 'bg-slate-800/90 hover:bg-slate-750 text-slate-200 border-slate-700/80'
              }`}
              title={`Active User: ${activeStaff.name} (${activeStaff.role}). Click to switch user account.`}
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
              <span className="font-bold text-xs max-w-[65px] xs:max-w-[85px] sm:max-w-[110px] truncate">
                {activeStaff.name}
              </span>
            </button>
          ) : (
            <button
              onClick={() => onLogout?.()}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl border text-xs bg-amber-500/15 text-amber-400 border-amber-500/30 cursor-pointer"
              title="Session Locked. Click to Login."
            >
              <Lock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="font-bold text-xs">Locked (Sign In)</span>
            </button>
          )}

          {/* Dedicated LOGOUT Option in Header Bar */}
          {onLogout && (
            <button
              id="header-logout-button"
              onClick={() => setShowLogoutConfirmModal(true)}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 border border-rose-500/30 hover:border-rose-500/50 text-xs font-bold transition-all shadow-xs cursor-pointer select-none flex-shrink-0 active:scale-95"
              title="Lock Counter & Log Out Current User"
            >
              <LogOut className="w-3.5 h-3.5 flex-shrink-0 text-rose-500 dark:text-rose-400" />
              <span className="hidden sm:inline font-bold">Logout</span>
            </button>
          )}

          {/* Mobile / Tablet Menu Toggle (< 768px) */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`md:hidden p-1.5 rounded-xl border transition-colors flex-shrink-0 cursor-pointer ${
              isMobileMenuOpen
                ? 'bg-indigo-600 text-white border-indigo-500'
                : themeMode === 'light'
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
            }`}
            title="Open Actions & Settings Menu"
          >
            {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. Bottom Row: Dedicated Navigation Buttons Placed Below (Never overlapping) */}
      <div className="w-full border-t border-slate-200/80 dark:border-slate-800/80 pt-1.5">
        <div
          className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none w-full scroll-smooth select-none px-0.5"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* 1. POS Inventory Catalogue Button */}
          <button
            onClick={onOpenPosCatalog}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/15 hover:bg-purple-600/25 text-purple-700 dark:text-purple-300 border border-purple-400/30 text-xs font-semibold transition-all shadow-xs active:scale-95 whitespace-nowrap flex-shrink-0 cursor-pointer"
            title="Open Kirana & Spice Item Catalog (1,500k Capacity)"
          >
            <ShoppingBag className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
            <span>Items Catalogue</span>
            <span className="bg-purple-500/20 text-purple-700 dark:text-purple-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono">
              {productsCount > 999 ? `${(productsCount / 1000).toFixed(1)}k` : productsCount}
            </span>
          </button>

          {/* 2. Udhaar Khata Button */}
          <button
            onClick={onOpenUdhaarLedger}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600/15 hover:bg-amber-600/25 text-amber-700 dark:text-amber-300 border border-amber-400/30 text-xs font-semibold transition-all shadow-xs active:scale-95 whitespace-nowrap flex-shrink-0 cursor-pointer"
            title="Customer Udhaar Credit Ledger"
          >
            <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span>Udhaar Khata</span>
            {pendingUdhaarTotal > 0 ? (
              <span className="bg-amber-500/25 text-amber-800 dark:text-amber-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono">
                ₹{pendingUdhaarTotal > 999 ? `${(pendingUdhaarTotal / 1000).toFixed(1)}k` : pendingUdhaarTotal.toFixed(0)}
              </span>
            ) : (
              <span className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono">
                Nil
              </span>
            )}
          </button>

          {/* 3. Barcode Scanner Button */}
          {onOpenBarcodeScanner && (
            <button
              onClick={onOpenBarcodeScanner}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30 text-xs font-semibold transition-all shadow-xs active:scale-95 whitespace-nowrap flex-shrink-0 cursor-pointer"
              title="Scan items with Camera Barcode Scanner"
            >
              <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>Barcode Scanner</span>
            </button>
          )}

          {/* 4. Sale Bills Search & Manager */}
          {onOpenBillsManager && (
            <button
              onClick={onOpenBillsManager}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all border whitespace-nowrap flex-shrink-0 active:scale-95 cursor-pointer shadow-xs ${
                isOwner
                  ? 'bg-blue-600/15 hover:bg-blue-600/25 text-blue-700 dark:text-blue-300 border-blue-400/30'
                  : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-400/20'
              }`}
              title="Search Sale Bills by Amount, Online UPI, Item, Customer Name, or Bill No"
            >
              <Receipt className="w-3.5 h-3.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
              <span>Sale Bills & Search</span>
            </button>
          )}

          {/* 5. Dashboard / Reports Button */}
          <button
            onClick={handleReportsClick}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border whitespace-nowrap flex-shrink-0 active:scale-95 cursor-pointer shadow-xs ${
              isOwner
                ? themeMode === 'light'
                  ? 'bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border-cyan-300'
                  : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700'
                : 'bg-amber-950/20 hover:bg-amber-900/30 text-amber-700 dark:text-amber-200 border-amber-600/40'
            }`}
            title="Daily Sales, Expenses & Balance Reports (Owner Access)"
          >
            <BarChart3 className={`w-4 h-4 flex-shrink-0 ${isOwner ? 'text-cyan-600 dark:text-cyan-400' : 'text-amber-500'}`} />
            <span>Reports Dashboard</span>
            {!isOwner && <Lock className="w-3 h-3 text-amber-500 flex-shrink-0" />}
          </button>

          {/* 6. Settings Button */}
          <button
            onClick={() => handleOpenProtectedAction('settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border whitespace-nowrap flex-shrink-0 active:scale-95 cursor-pointer shadow-xs ${
              themeMode === 'light'
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700'
            }`}
            title={isOwner ? "Store Settings & Configuration" : "Store & System Settings (Owner Access Only • Locked for Staff)"}
          >
            <Settings className={`w-4 h-4 flex-shrink-0 ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-300'}`} />
            <span>Store Settings</span>
            {!isOwner && <Lock className="w-3 h-3 text-amber-500 flex-shrink-0" />}
          </button>

          {/* 7. Dedicated Master Admin View & Cloud DB Button */}
          {onOpenMasterAdmin && (
            <button
              id="header-master-admin-button"
              onClick={() => handleOpenProtectedAction('master_admin')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/30 hover:from-amber-500/30 hover:to-amber-600/40 text-amber-400 dark:text-amber-300 border border-amber-500/50 text-xs font-bold transition-all shadow-xs active:scale-95 whitespace-nowrap flex-shrink-0 cursor-pointer"
              title="Dedicated Master Admin: Central Database, Live Cloud Sync, Catalog & Khata Control"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>Master Admin</span>
              <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                Cloud DB
              </span>
            </button>
          )}

          {/* 8. Dedicated Outlet Data Upload / Download Hub */}
          {onOpenOutletSync && (
            <button
              id="header-outlet-sync-button"
              onClick={onOpenOutletSync}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border whitespace-nowrap flex-shrink-0 active:scale-95 cursor-pointer shadow-xs ${
                isOwner
                  ? 'bg-gradient-to-r from-emerald-600/20 to-amber-600/20 hover:from-emerald-600/30 hover:to-amber-600/30 text-emerald-400 border-emerald-500/40'
                  : staffAutoSyncStatus?.isSyncing
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500/50 animate-pulse'
                  : 'bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
              }`}
              title={
                isOwner
                  ? 'Outlet Data Hub: Upload branch data & Download all outlet databases (Owner)'
                  : 'Automatic Outlet Data Sync to Central Server Database (Staff)'
              }
            >
              {isOwner ? (
                <>
                  <Database className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Outlet Data Hub</span>
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                    Upload & Download
                  </span>
                </>
              ) : (
                <>
                  {staffAutoSyncStatus?.isSyncing ? (
                    <RefreshCw className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />
                  ) : (
                    <UploadCloud className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  )}
                  <span>{staffAutoSyncStatus?.isSyncing ? 'Uploading to DB...' : 'Outlet Data Sync'}</span>
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                    {staffAutoSyncStatus?.isAutoSyncEnabled !== false ? 'Auto: Active' : 'Manual'}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Drawer / Dropdown Menu for Full Feature Access on Phone & Tablet */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-slate-900/98 border-b border-slate-800 shadow-2xl p-3 z-50 backdrop-blur-xl animate-in slide-in-from-top-2 duration-150 space-y-2.5">
          {/* Mobile Status Bar */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/70 text-xs">
            <div className="flex items-center gap-1.5 text-slate-300 truncate max-w-[180px]">
              <span className="font-bold text-white truncate">{storeSettings.shopName}</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold border border-emerald-500/30">
                {activeOutletShortcut}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                isOnline ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                {isOnline ? 'Online' : 'Offline'}
              </span>
              {activeStaff && (
                <span className="font-semibold text-slate-300 text-[11px] truncate max-w-[70px]">
                  {activeStaff.name}
                </span>
              )}
            </div>
          </div>

          {/* Quick Action Buttons Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
            {onOpenBarcodeScanner && (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenBarcodeScanner();
                }}
                className="p-2.5 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-2"
              >
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Scan Barcode</span>
              </button>
            )}

            {onOpenBillsManager && (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleOpenProtectedAction('bills');
                }}
                className="p-2.5 rounded-xl bg-blue-600/20 text-blue-300 border border-blue-500/30 flex items-center gap-2"
              >
                <Receipt className="w-4 h-4 text-blue-400" />
                <span>Bills</span>
              </button>
            )}

            {onOpenOutletSync && (
              <button
                id="mobile-btn-outlet-sync"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenOutletSync();
                }}
                className="p-2.5 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-2 font-bold"
              >
                <UploadCloud className="w-4 h-4 text-emerald-400" />
                <span>{isOwner ? 'Outlet Data Hub' : 'Upload Outlet Data'}</span>
              </button>
            )}

            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                handleReportsClick();
              }}
              className="p-2.5 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 flex items-center gap-2"
            >
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <span>Dashboard Reports</span>
            </button>

            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                if (isOwner) {
                  onOpenSettings();
                } else {
                  handleOpenProtectedAction('settings');
                }
              }}
              className="p-2.5 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-amber-400" />
                <span>Store Settings</span>
              </div>
              {!isOwner && <Lock className="w-3.5 h-3.5 text-amber-500" />}
            </button>

            {onOpenMasterAdmin && (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleOpenProtectedAction('master_admin');
                }}
                className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/30 text-amber-300 border border-amber-500/50 flex items-center justify-between font-bold"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Master Admin Portal</span>
                </div>
                <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                  Cloud DB
                </span>
              </button>
            )}
          </div>

          {/* Mobile User & Logout Footer */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-300 truncate">
              <UserCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              {activeStaff ? (
                <>
                  <span className="font-bold truncate">{activeStaff.name}</span>
                  <span className="text-slate-500">({activeStaff.role})</span>
                </>
              ) : (
                <span className="font-bold text-amber-400">Session Locked</span>
              )}
            </div>

            {onLogout && (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setShowLogoutConfirmModal(true);
                }}
                className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Owner Access PIN Authentication Modal (Reports Protection) */}
      {showOwnerAuthModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white">
                    {pendingOwnerDestination === 'settings'
                      ? 'Owner Access Required (Settings)'
                      : pendingOwnerDestination === 'bills'
                      ? 'Owner Access Required (Bills)'
                      : pendingOwnerDestination === 'master_admin'
                      ? 'Master Admin Access Required'
                      : 'Owner Access Required (Dashboard)'}
                  </h4>
                  <p className="text-[11px] text-amber-300/90 font-medium">
                    {pendingOwnerDestination === 'settings'
                      ? 'Account settings are restricted to the owner'
                      : pendingOwnerDestination === 'bills'
                      ? 'Bill management is restricted to the owner'
                      : pendingOwnerDestination === 'master_admin'
                      ? 'Enter Master Admin PIN to continue'
                      : 'Reports are restricted to the owner'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowOwnerAuthModal(false);
                  setOwnerPinError('');
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-950/90 rounded-2xl border border-slate-800/80 text-xs text-slate-300 space-y-1">
              <p>
                {pendingOwnerDestination === 'master_admin'
                  ? 'Accessing Master Admin, Central Cloud DB sync, server ID faizan-inamdar, and cross-store data operations requires Master Admin verification.'
                  : pendingOwnerDestination === 'settings'
                  ? 'Managing store account settings, staff profiles, PINs/passwords, and configs is restricted strictly to the store owner. Cashiers cannot modify accounts.'
                  : pendingOwnerDestination === 'bills'
                  ? 'Searching, modifying, or deleting transaction records and expense receipts requires Owner verification.'
                  : 'Store financial turnover, profit analytics, and audit ledgers are confidential and restricted strictly to the store owner.'}
              </p>
              <div className="pt-1.5 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800">
                <span>Active Cashier:</span>
                <span className="text-white font-semibold">{activeStaff ? `${activeStaff.name} (${activeStaff.role})` : 'Session Locked'}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Store Owner / Server ID:</span>
                <span className="text-amber-400 font-bold">{ownerStaff.name} (faizan-inamdar)</span>
              </div>
            </div>

            {ownerPinError && (
              <div className="p-2.5 bg-red-950/70 border border-red-500/50 rounded-xl text-red-200 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
                <span>⚠ {ownerPinError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOwnerPinAndOpen} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Enter Owner PIN / Password:
                </label>
                <div className="relative">
                  <input
                    type={showOwnerPin ? 'text' : 'password'}
                    required
                    autoFocus
                    placeholder="Enter Owner Password / PIN (nayab@q6)"
                    value={ownerPinInput}
                    onChange={(e) => setOwnerPinInput(e.target.value)}
                    className="w-full bg-slate-950 border border-amber-500/50 focus:border-amber-400 rounded-xl pl-3.5 pr-10 py-2.5 text-white font-mono text-sm tracking-wider focus:outline-none shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOwnerPin(!showOwnerPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showOwnerPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-950/80 transition-all"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{pendingOwnerDestination === 'master_admin' ? 'Unlock Master Admin Portal' : 'Unlock & Proceed'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSwitchToOwnerSession}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold rounded-xl text-[11px] border border-slate-700 transition-colors"
                >
                  Switch Current Session to {ownerStaff.name}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Switch Active Staff Modal */}
      {showStaffSwitchModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <h4 className="font-bold text-sm text-white">Switch Active Cashier</h4>
              </div>
              <button
                onClick={() => {
                  setShowStaffSwitchModal(false);
                  setPinError('');
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pinError && <div className="p-2 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl">{pinError}</div>}

            <form onSubmit={handleConfirmSwitch} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Select Staff Member:</label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                >
                  {storeSettings.staffAccounts.map((s) => {
                    const outletName = s.assignedOutletIds?.includes('store-2') && !s.assignedOutletIds?.includes('store-1')
                      ? 'kp Nayab'
                      : s.assignedOutletIds?.includes('store-1') && !s.assignedOutletIds?.includes('store-2')
                      ? 'sy Nayab'
                      : 'All Outlets';
                    return (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.role.toUpperCase()} • {outletName})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Enter 4-Digit Password / PIN:</label>
                <input
                  type="password"
                  name="nayab_staff_switch_pin"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  required
                  autoFocus
                  maxLength={8}
                  value={inputPin}
                  onChange={(e) => setInputPin(e.target.value)}
                  placeholder="••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-center font-mono text-lg tracking-widest focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowStaffSwitchModal(false);
                    if (isOwner) {
                      onOpenSettings('staff');
                    } else {
                      handleOpenProtectedAction('settings');
                    }
                  }}
                  className="text-xs text-amber-400 hover:underline flex items-center gap-1"
                >
                  <span>Manage Accounts</span>
                  {!isOwner && <Lock className="w-3 h-3 text-amber-400" />}
                  <span>→</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowStaffSwitchModal(false)}
                    className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl"
                  >
                    Login
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Lock Counter & Log Out Confirmation Modal */}
      {showLogoutConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border-2 border-rose-500/40 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <LogOut className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white">Lock Counter & Log Out?</h4>
                  <p className="text-[11px] text-rose-300 font-medium">Lock counter and end current shift</p>
                </div>
              </div>
              <button
                onClick={() => setShowLogoutConfirmModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-950/90 rounded-2xl border border-slate-800/80 text-xs text-slate-300 space-y-2">
              <p>
                Are you sure you want to log out of current session? The billing counter will be locked and will require staff PIN/password to unlock.
              </p>
              <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-800">
                <span className="text-slate-400">Active User:</span>
                <span className="text-white font-bold">{activeStaff ? `${activeStaff.name} (${activeStaff.role})` : 'Session Locked'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowLogoutConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirmModal(false);
                  onLogout?.();
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/60 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Yes, Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
