import React, { useState } from 'react';
import {
  X,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Wallet,
  Download,
  Upload,
  Calendar,
  IndianRupee,
  Search,
  Settings,
  QrCode,
  Package,
  Users,
  Printer,
  ShoppingBag,
  ArrowUpRight,
  Shield,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Eye,
  EyeOff,
  Store,
  Building2,
  Calculator,
  FileSpreadsheet,
} from 'lucide-react';
import { Transaction, CustomerUdhaar, Product, StoreSettings, StoreProfile, MarketCreditEntry } from '../types';
import { printReceipt, ThermalReceiptData } from '../utils/printer';
import { exportStoreSalesAndAnalyticsToExcel } from '../utils/excelExport';
import { CalculationHistoryReport } from './CalculationHistoryReport';
import { MarketCreditSection } from './MarketCreditSection';
import { DateWiseCalendarReport } from './DateWiseCalendarReport';
import { getStoredCalculationHistory } from '../utils/calcHistory';

interface ReportsDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  customers: CustomerUdhaar[];
  products: Product[];
  storeSettings: StoreSettings;
  marketCredits?: MarketCreditEntry[];
  onUpdateMarketCredits?: (entries: MarketCreditEntry[]) => void;
  onImportBackup: (data: any) => void;
  onOpenSettings: (tab?: 'upi' | 'inventory' | 'staff' | 'printer' | 'profile') => void;
}

export const ReportsDashboardModal: React.FC<ReportsDashboardModalProps> = ({
  isOpen,
  onClose,
  transactions,
  customers,
  products,
  storeSettings,
  marketCredits,
  onUpdateMarketCredits,
  onImportBackup,
  onOpenSettings,
}) => {
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('today');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('all');
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>(() => storeSettings.activeStoreId || 'all');

  React.useEffect(() => {
    if (storeSettings?.activeStoreId) {
      setSelectedOutletFilter(storeSettings.activeStoreId);
    }
  }, [storeSettings?.activeStoreId, isOpen]);

  const [reprintStatus, setReprintStatus] = useState<string>('');
  const [dashboardView, setDashboardView] = useState<'analytics' | 'date_filter' | 'calc_history' | 'market_credit'>('analytics');
  const [calcCount, setCalcCount] = useState<number>(() => getStoredCalculationHistory().length);
  const [internalMarketCredits, setInternalMarketCredits] = useState<MarketCreditEntry[]>(() => {
    try {
      const saved = localStorage.getItem('nayab_market_credit_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load market credits in reports modal:', e);
    }
    return [];
  });

  const effectiveMarketCredits = marketCredits !== undefined ? marketCredits : internalMarketCredits;

  const handleUpdateMarketCredits = (updated: MarketCreditEntry[]) => {
    setInternalMarketCredits(updated);
    try {
      localStorage.setItem('nayab_market_credit_v1', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to persist market credits:', e);
    }
    if (onUpdateMarketCredits) {
      onUpdateMarketCredits(updated);
    }
  };

  React.useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setCalcCount(e.detail.length);
      } else {
        setCalcCount(getStoredCalculationHistory().length);
      }
    };
    window.addEventListener('nayab_calc_history_updated', handleUpdate);
    return () => window.removeEventListener('nayab_calc_history_updated', handleUpdate);
  }, []);

  // Owner authentication lock
  const activeStaff = storeSettings.activeStaffId
    ? storeSettings.staffAccounts?.find((s) => s.id === storeSettings.activeStaffId)
    : undefined;
  const isOwner = Boolean(activeStaff && (activeStaff.role === 'owner' || activeStaff.role === 'master_admin'));
  const ownerAccount = storeSettings.staffAccounts?.find((s) => s.role === 'owner' || s.role === 'master_admin') ||
    { id: 'owner', name: 'Store Owner', role: 'owner' as const, pin: 'nayab@q6', active: true };

  const [sessionUnlocked, setSessionUnlocked] = useState(false);
  const [modalPinInput, setModalPinInput] = useState('');
  const [modalPinError, setModalPinError] = useState('');
  const [showPin, setShowPin] = useState(false);

  if (!isOpen) return null;

  // If active user is not owner and hasn't unlocked with owner PIN, show access lock
  if (!isOwner && !sessionUnlocked) {
    const handleUnlockWithPin = (e: React.FormEvent) => {
      e.preventDefault();
      const cleanPin = modalPinInput.trim();
      const isValidPin = cleanPin === 'nayab@q6' || (ownerAccount.pin && ownerAccount.pin === cleanPin);
      if (!isValidPin) {
        setModalPinError('Incorrect Owner PIN. Access is strictly restricted to store owner.');
        return;
      }
      setSessionUnlocked(true);
      setModalPinError('');
    };

    return (
      <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
        <div className="w-full max-w-md bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex items-start justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white">Owner Access Restricted</h3>
                <p className="text-xs text-amber-300/90 font-medium">Reports are protected with owner PIN</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-2">
            <p>
              Financial reports, profit analytics, sales breakdown, and cash balances can only be accessed by the Store Owner.
            </p>
            <div className="pt-2 flex items-center justify-between text-slate-400 border-t border-slate-800/80">
              <span>Current Cashier:</span>
              <span className="text-white font-semibold">{activeStaff?.name} ({activeStaff?.role})</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Authorized Owner:</span>
              <span className="text-amber-400 font-bold">{ownerAccount.name}</span>
            </div>
          </div>

          {modalPinError && (
            <div className="p-3 bg-red-950/70 border border-red-500/50 rounded-xl text-red-200 text-xs font-semibold">
              ⚠ {modalPinError}
            </div>
          )}

          <form onSubmit={handleUnlockWithPin} className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Enter Store Owner PIN / Password:
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  required
                  autoFocus
                  placeholder="Enter Owner Password / PIN"
                  value={modalPinInput}
                  onChange={(e) => setModalPinInput(e.target.value)}
                  className="w-full bg-slate-950 border border-amber-500/50 focus:border-amber-400 rounded-xl pl-3.5 pr-10 py-2.5 text-white font-mono text-sm tracking-wider focus:outline-none shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-400 hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-950/80"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Unlock Reports</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

  // Outlets list
  const outlets: StoreProfile[] = (storeSettings.stores && storeSettings.stores.length > 0)
    ? storeSettings.stores
    : [{
        id: storeSettings.activeStoreId || 'store-1',
        shopName: storeSettings.shopName,
        phone: storeSettings.phone || '',
        upiId: storeSettings.upiId || '',
        upiName: storeSettings.upiName || storeSettings.shopName,
        address: storeSettings.address || '',
        gstin: storeSettings.gstin,
        defaultTaxRate: storeSettings.defaultTaxRate || 0,
        isPrimary: true,
        isDefault: true,
      }];

  const filteredTransactions = transactions.filter((t) => {
    const tTime = new Date(t.timestamp).getTime();
    let matchesTime = true;
    if (timeFilter === 'today') matchesTime = tTime >= startOfToday;
    else if (timeFilter === 'week') matchesTime = tTime >= startOfWeek;
    else if (timeFilter === 'month') matchesTime = tTime >= startOfMonth;
    else if (timeFilter === 'year') matchesTime = tTime >= startOfYear;

    const matchesSearch =
      t.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.customerName && t.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.remarks && t.remarks.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStaff =
      selectedStaffFilter === 'all' ||
      t.staffId === selectedStaffFilter ||
      (t.staffName && t.staffName.toLowerCase() === selectedStaffFilter.toLowerCase());

    const matchOutletId = t.outletId || t.storeId;
    const matchesOutlet =
      selectedOutletFilter === 'all' ||
      (matchOutletId ? matchOutletId === selectedOutletFilter : (selectedOutletFilter === (storeSettings.activeStoreId || 'store-1') || selectedOutletFilter === outlets[0]?.id));

    return matchesTime && matchesSearch && matchesStaff && matchesOutlet;
  });

  // Calculate separate metrics for each outlet for side-by-side comparison
  const outletBreakdown = outlets.map((outlet) => {
    const outletTxs = transactions.filter((t) => {
      const tTime = new Date(t.timestamp).getTime();
      let matchesTime = true;
      if (timeFilter === 'today') matchesTime = tTime >= startOfToday;
      else if (timeFilter === 'week') matchesTime = tTime >= startOfWeek;
      else if (timeFilter === 'month') matchesTime = tTime >= startOfMonth;
      else if (timeFilter === 'year') matchesTime = tTime >= startOfYear;

      const tOutlet = t.outletId || t.storeId;
      const isThisStore = tOutlet ? tOutlet === outlet.id : (outlet.isPrimary || outlet.id === outlets[0]?.id);
      return matchesTime && isThisStore;
    });

    const sales = outletTxs.filter((t) => t.type === 'sale').reduce((sum, t) => sum + t.amount, 0);
    const expenses = outletTxs.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const cash = outletTxs.filter((t) => t.type === 'sale' && t.paymentMode === 'cash').reduce((sum, t) => sum + t.amount, 0);
    const upi = outletTxs.filter((t) => t.type === 'sale' && t.paymentMode === 'online_upi').reduce((sum, t) => sum + t.amount, 0);
    const udhaar = outletTxs.filter((t) => t.type === 'sale' && t.paymentMode === 'credit_udhaar').reduce((sum, t) => sum + t.amount, 0);
    const count = outletTxs.filter((t) => t.type === 'sale').length;

    return {
      outlet,
      sales,
      expenses,
      net: sales - expenses,
      cash,
      upi,
      udhaar,
      count,
      txCount: outletTxs.length,
    };
  });

  // Print Thermal Report Slip specifically for an outlet
  const handlePrintOutletSummary = async (outbreak: typeof outletBreakdown[0]) => {
    setReprintStatus(`Printing outlet report for ${outbreak.outlet.shopName}...`);
    const summaryReceiptData: ThermalReceiptData = {
      shopName: outbreak.outlet.shopName,
      address: outbreak.outlet.address || storeSettings.address,
      phone: outbreak.outlet.phone || storeSettings.phone,
      gstin: outbreak.outlet.gstin || storeSettings.gstin,
      receiptNumber: `OUTLET-${outbreak.outlet.id.slice(-4)}-${Date.now().toString().slice(-4)}`,
      date: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
      cashierName: `Report: ${timeFilter.toUpperCase()}`,
      items: [
        { id: '1', name: `Gross Sales (${outbreak.count} bills)`, quantity: outbreak.count, unit: 'bills', rate: outbreak.sales, total: outbreak.sales },
        { id: '2', name: 'Cash Collection', quantity: 1, unit: 'cash', rate: outbreak.cash, total: outbreak.cash },
        { id: '3', name: 'UPI Online Collection', quantity: 1, unit: 'upi', rate: outbreak.upi, total: outbreak.upi },
        { id: '4', name: 'Udhaar Credit', quantity: 1, unit: 'khata', rate: outbreak.udhaar, total: outbreak.udhaar },
        { id: '5', name: 'Store Expenses', quantity: 1, unit: 'exp', rate: outbreak.expenses, total: outbreak.expenses },
      ],
      subtotal: outbreak.sales,
      taxAmount: 0,
      taxRate: 0,
      grandTotal: outbreak.net,
      paymentMode: 'report',
      upiId: outbreak.outlet.upiId || storeSettings.upiId,
    };
    const res = await printReceipt(summaryReceiptData, storeSettings);
    if (res.success) {
      setReprintStatus(`Outlet report for ${outbreak.outlet.shopName} printed successfully!`);
    } else {
      setReprintStatus(res.error || 'Failed to print outlet report.');
    }
    setTimeout(() => setReprintStatus(''), 4000);
  };

  const totalSales = filteredTransactions
    .filter((t) => t.type === 'sale')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = filteredTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalSales - totalExpenses;

  const cashSales = filteredTransactions
    .filter((t) => t.type === 'sale' && t.paymentMode === 'cash')
    .reduce((sum, t) => sum + t.amount, 0);

  const upiSales = filteredTransactions
    .filter((t) => t.type === 'sale' && t.paymentMode === 'online_upi')
    .reduce((sum, t) => sum + t.amount, 0);

  const udhaarSales = filteredTransactions
    .filter((t) => t.type === 'sale' && t.paymentMode === 'credit_udhaar')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalUdhaarPending = customers.reduce((sum, c) => sum + c.totalDue, 0);

  // Top selling products calculation
  const productSalesMap: { [prodName: string]: { qty: number; total: number; unit: string } } = {};
  filteredTransactions.forEach((t) => {
    if (t.items) {
      t.items.forEach((item) => {
        if (!productSalesMap[item.name]) {
          productSalesMap[item.name] = { qty: 0, total: 0, unit: item.unit };
        }
        productSalesMap[item.name].qty += item.quantity;
        productSalesMap[item.name].total += item.total;
      });
    }
  });

  const topSellingItems = Object.entries(productSalesMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5);

  // Staff breakdown
  const staffSalesMap: { [staffName: string]: number } = {};
  filteredTransactions
    .filter((t) => t.type === 'sale')
    .forEach((t) => {
      const name = t.staffName || 'Default Counter';
      staffSalesMap[name] = (staffSalesMap[name] || 0) + t.amount;
    });

  // Re-print specific past receipt
  const handleReprintReceipt = async (t: Transaction) => {
    setReprintStatus(`Printing receipt #${t.receiptNumber}...`);
    const receiptData: ThermalReceiptData = {
      shopName: storeSettings.shopName,
      address: storeSettings.address,
      phone: storeSettings.phone,
      gstin: storeSettings.gstin,
      receiptNumber: t.receiptNumber,
      date: new Date(t.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
      cashierName: t.staffName || 'Counter',
      customerName: t.customerName,
      items: t.items || [{ id: 'm1', name: 'Counter Sale', quantity: 1, unit: 'piece', rate: t.amount, total: t.amount }],
      subtotal: t.baseAmount || t.amount,
      taxAmount: t.taxAmount || 0,
      taxRate: t.taxRate || 0,
      grandTotal: t.amount,
      paymentMode: t.paymentMode,
      upiId: storeSettings.upiId,
    };

    const res = await printReceipt(receiptData, storeSettings);
    if (res.success) {
      setReprintStatus(`Receipt #${t.receiptNumber} printed via ${res.method}!`);
    } else {
      setReprintStatus(res.error || 'Print failed.');
    }
    setTimeout(() => setReprintStatus(''), 4000);
  };

  // Export Transactions as CSV
  const handleExportCsv = () => {
    if (transactions.length === 0) return;
    let csv = 'Receipt,Date,Type,Amount,PaymentMode,Cashier,Customer_Party,Remarks\n';
    transactions.forEach((t) => {
      csv += `"${t.receiptNumber}","${new Date(t.timestamp).toLocaleString()}","${t.type}","${t.amount}","${t.paymentMode}","${t.staffName || ''}","${t.customerName || ''}","${t.remarks || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nayab-sales-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export full JSON backup
  const handleExportBackup = () => {
    const backup = {
      version: '2.0',
      exportDate: new Date().toISOString(),
      storeSettings,
      transactions,
      customers,
      products,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nayab-pos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        onImportBackup(parsed);
        alert('Store data backup restored successfully!');
      } catch (err) {
        alert('Invalid backup JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Store Analytics & Financial Dashboard</h3>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Owner: {ownerAccount.name}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">Live Sales, Udhaar Khata, Cashflow & Quick Settings</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => exportStoreSalesAndAnalyticsToExcel(filteredTransactions, storeSettings, selectedOutletFilter, timeFilter)}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold border border-emerald-400/30 text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer active:scale-95"
              title="Export Store Sales & Analytics Report to Microsoft Excel (.csv)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="px-2.5 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Export Raw Transactions CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </button>

            <button
              onClick={handleExportBackup}
              className="px-2.5 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Full System Backup"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Backup</span>
            </button>

            <label className="px-2.5 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Restore</span>
              <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
            </label>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Settings Shortcut Banner */}
        <div className="bg-slate-950/90 border-b border-slate-800 p-2.5 px-4 sm:px-6 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Settings className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-white">Quick Settings:</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => {
                onClose();
                onOpenSettings('upi');
              }}
              className="px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700/60 text-emerald-300 text-[11px] font-semibold flex items-center gap-1"
            >
              <QrCode className="w-3 h-3" />
              <span>1. Edit UPI ID ({storeSettings.upiId || 'Not Set'})</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onOpenSettings('inventory');
              }}
              className="px-2.5 py-1 rounded-lg bg-purple-950/60 hover:bg-purple-900/80 border border-purple-700/60 text-purple-300 text-[11px] font-semibold flex items-center gap-1"
            >
              <Package className="w-3 h-3" />
              <span>2. Manage Inventory ({products.length})</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onOpenSettings('staff');
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-950/60 hover:bg-amber-900/80 border border-amber-700/60 text-amber-300 text-[11px] font-semibold flex items-center gap-1"
            >
              <Users className="w-3 h-3" />
              <span>3. Staff Passwords ({storeSettings.staffAccounts.length})</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onOpenSettings('printer');
              }}
              className="px-2.5 py-1 rounded-lg bg-blue-950/60 hover:bg-blue-900/80 border border-blue-700/60 text-blue-300 text-[11px] font-semibold flex items-center gap-1"
            >
              <Printer className="w-3 h-3" />
              <span>4. Thermal Printer</span>
            </button>
          </div>
        </div>

        {/* View Switcher: Store Analytics vs Full Calculation History */}
        <div className="bg-slate-950 px-4 sm:px-6 pt-3 pb-1 border-b border-slate-800 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDashboardView('analytics')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              dashboardView === 'analytics'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Store Financial & Sales Analytics</span>
          </button>

          <button
            type="button"
            onClick={() => setDashboardView('date_filter')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              dashboardView === 'date_filter'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Date-Wise Branch Filter</span>
          </button>

          <button
            type="button"
            onClick={() => setDashboardView('calc_history')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              dashboardView === 'calc_history'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Full Calculation History</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                dashboardView === 'calc_history'
                  ? 'bg-emerald-850 text-emerald-100 border border-emerald-400/40'
                  : 'bg-slate-800 text-emerald-400 border border-slate-700'
              }`}
            >
              {calcCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setDashboardView('market_credit')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              dashboardView === 'market_credit'
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Credit in Market (माल बाक़ी)</span>
            {effectiveMarketCredits.filter((e) => e.remainingBaaki > 0).length > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  dashboardView === 'market_credit'
                    ? 'bg-rose-950 text-rose-100 border border-rose-400/40'
                    : 'bg-rose-950/80 text-rose-300 border border-rose-800'
                }`}
              >
                {effectiveMarketCredits.filter((e) => e.remainingBaaki > 0).length}
              </span>
            )}
          </button>
        </div>

        {/* Scrollable Dashboard Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {dashboardView === 'date_filter' ? (
            <DateWiseCalendarReport
              transactions={transactions}
              customers={customers}
              storeSettings={storeSettings}
            />
          ) : dashboardView === 'calc_history' ? (
            <CalculationHistoryReport storeSettings={storeSettings} />
          ) : dashboardView === 'market_credit' ? (
            <MarketCreditSection
              entries={effectiveMarketCredits}
              onUpdateEntries={handleUpdateMarketCredits}
              storeSettings={storeSettings}
              selectedOutletFilter={selectedOutletFilter}
              isOwner={true}
            />
          ) : (
            <>
          {/* Notification banner for reprint */}
          {reprintStatus && (
            <div className="p-3 bg-blue-950 border border-blue-800 rounded-2xl text-blue-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <Printer className="w-4 h-4 text-blue-400" />
              <span>{reprintStatus}</span>
            </div>
          )}

          {/* Multi-Store / Outlet Filter Tabs */}
          <div className="bg-slate-800/40 p-2.5 rounded-2xl border border-slate-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-7 h-7 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <Store className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-white text-xs">Select Outlet:</span>
                <span className="text-[11px] text-slate-400 ml-1.5">
                  {outlets.length} {outlets.length === 1 ? 'outlet' : 'outlets'} available
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 overflow-x-auto w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setSelectedOutletFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  selectedOutletFilter === 'all'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>All Outlets Combined</span>
              </button>

              {outlets.map((outlet, idx) => (
                <button
                  key={outlet.id}
                  type="button"
                  onClick={() => setSelectedOutletFilter(outlet.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    selectedOutletFilter === outlet.id
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>Outlet {idx + 1}: {outlet.shopName}</span>
                  {outlet.id === storeSettings.activeStoreId && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Currently Active Counter"></span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Time Filter Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/80 text-xs overflow-x-auto">
              {(['today', 'week', 'month', 'year', 'all'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTimeFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg font-bold capitalize transition-all whitespace-nowrap ${
                    timeFilter === filter
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {filter === 'today'
                    ? 'Today'
                    : filter === 'week'
                    ? 'This Week'
                    : filter === 'month'
                    ? 'This Month'
                    : filter === 'year'
                    ? 'This Year'
                    : 'All Time'}
                </button>
              ))}
            </div>

            {/* Staff Filter Selector */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Cashier:</span>
              <select
                value={selectedStaffFilter}
                onChange={(e) => setSelectedStaffFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none"
              >
                <option value="all">All Cashiers / Staff</option>
                {storeSettings.staffAccounts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 1. Core Financial KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total Sales */}
            <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Total Sales</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">
                ₹{totalSales.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Cash: ₹{cashSales.toFixed(0)} | UPI: ₹{upiSales.toFixed(0)}
              </div>
            </div>

            {/* Total Expenses */}
            <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Total Expenses</span>
                <TrendingDown className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-amber-400">
                ₹{totalExpenses.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Wholesale, stock, tea</div>
            </div>

            {/* Net Cashflow */}
            <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Net Cash In-Hand</span>
                <Wallet className="w-4 h-4 text-cyan-400" />
              </div>
              <div
                className={`text-xl sm:text-2xl font-bold font-mono ${
                  netBalance >= 0 ? 'text-cyan-400' : 'text-red-400'
                }`}
              >
                ₹{netBalance.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Sales minus Expenses</div>
            </div>

            {/* Pending Udhaar Khata */}
            <div className="bg-slate-800/80 p-4 rounded-2xl border border-amber-500/30">
              <div className="flex items-center justify-between text-amber-300 text-xs mb-1">
                <span>Pending Udhaar</span>
                <Users className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-amber-400">
                ₹{totalUdhaarPending.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Across {customers.length} customers</div>
            </div>
          </div>

          {/* Outlets Separate Breakdown & Side-by-Side Comparison */}
          <div className="bg-slate-800/50 border border-slate-700/80 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-700/60 pb-2.5">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-cyan-400" />
                <h4 className="font-bold text-white text-sm">
                  Separate Outlet Reports & Comparison
                </h4>
              </div>
              <span className="text-[11px] text-slate-400">
                Period: {timeFilter.toUpperCase()} • Filter: {selectedOutletFilter === 'all' ? 'All Outlets Combined' : outlets.find(o => o.id === selectedOutletFilter)?.shopName || 'Single Outlet'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
              {outletBreakdown.map((item, idx) => {
                const isCurrentActive = item.outlet.id === storeSettings.activeStoreId;
                const totalAllSales = outletBreakdown.reduce((sum, o) => sum + o.sales, 0);
                const sharePercent = totalAllSales > 0 ? Math.round((item.sales / totalAllSales) * 100) : 0;

                return (
                  <div
                    key={item.outlet.id}
                    className={`rounded-2xl p-4 border transition-all ${
                      selectedOutletFilter === item.outlet.id
                        ? 'bg-slate-800 border-cyan-500 shadow-md shadow-cyan-950/40 ring-1 ring-cyan-500'
                        : 'bg-slate-900/80 border-slate-700/80 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-300 font-bold text-xs flex items-center justify-center">
                            #{idx + 1}
                          </span>
                          <h5 className="font-bold text-white text-sm">{item.outlet.shopName}</h5>
                        </div>
                        {item.outlet.address && (
                          <p className="text-[11px] text-slate-400 mt-0.5">{item.outlet.address}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {isCurrentActive && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            Active Counter
                          </span>
                        )}
                        {item.outlet.isPrimary && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/40">
                            Main Store
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Sales & Financial metrics */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-950/70 rounded-xl border border-slate-800 text-center mb-3">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase">Gross Sales</div>
                        <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                          ₹{item.sales.toFixed(0)}
                        </div>
                        <div className="text-[10px] text-slate-500">{item.count} bills</div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-400 uppercase">Expenses</div>
                        <div className="text-base font-bold font-mono text-amber-400 mt-0.5">
                          ₹{item.expenses.toFixed(0)}
                        </div>
                        <div className="text-[10px] text-slate-500">Kharch</div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-400 uppercase">Net Profit</div>
                        <div className={`text-base font-bold font-mono mt-0.5 ${item.net >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                          ₹{item.net.toFixed(0)}
                        </div>
                        <div className="text-[10px] text-slate-500">In-hand</div>
                      </div>
                    </div>

                    {/* Collection Breakdown */}
                    <div className="space-y-1 text-xs text-slate-300 mb-3">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400">Cash Collection:</span>
                        <span className="font-mono font-semibold text-emerald-300">₹{item.cash.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400">UPI Online:</span>
                        <span className="font-mono font-semibold text-cyan-300">₹{item.upi.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400">Udhaar Given:</span>
                        <span className="font-mono font-semibold text-amber-300">₹{item.udhaar.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Business share progress bar */}
                    {totalAllSales > 0 && (
                      <div className="mb-3">
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                          <span>Business Share</span>
                          <span className="font-bold text-white">{sharePercent}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${sharePercent}%` }} />
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => setSelectedOutletFilter(item.outlet.id)}
                        className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition-colors ${
                          selectedOutletFilter === item.outlet.id
                            ? 'bg-cyan-600 text-white'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        {selectedOutletFilter === item.outlet.id ? 'Viewing This Outlet' : 'Filter This Outlet'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePrintOutletSummary(item)}
                        className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Print separate thermal report slip for this outlet"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print Slip</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Payment Channel Breakdown & Cashier Performance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Payment Mode Distribution */}
            <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/80 space-y-3">
              <h4 className="font-bold text-white text-xs flex items-center justify-between">
                <span>Payment Mode Breakdown</span>
                <span className="text-slate-400 font-normal">₹{totalSales.toFixed(0)}</span>
              </h4>

              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Cash
                    </span>
                    <span className="font-mono font-bold text-emerald-400">₹{cashSales.toFixed(2)}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${totalSales > 0 ? (cashSales / totalSales) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-cyan-400"></span> Online UPI QR
                    </span>
                    <span className="font-mono font-bold text-cyan-400">₹{upiSales.toFixed(2)}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 rounded-full transition-all"
                      style={{ width: `${totalSales > 0 ? (upiSales / totalSales) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span> Udhaar Credit
                    </span>
                    <span className="font-mono font-bold text-amber-400">₹{udhaarSales.toFixed(2)}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${totalSales > 0 ? (udhaarSales / totalSales) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Top Selling Items */}
            <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/80 space-y-3">
              <h4 className="font-bold text-white text-xs flex items-center justify-between">
                <span>Top Selling Kirana & Spices</span>
                <ShoppingBag className="w-3.5 h-3.5 text-purple-400" />
              </h4>

              {topSellingItems.length === 0 ? (
                <div className="text-slate-500 text-xs py-4 text-center">
                  Items will rank here as bills are rung up from POS inventory.
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  {topSellingItems.map(([name, data], idx) => (
                    <div key={name} className="flex items-center justify-between py-1 border-b border-slate-800 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-white font-medium truncate max-w-[140px]">{name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-purple-300">₹{data.total.toFixed(0)}</span>
                        <span className="text-[10px] text-slate-400 ml-1">
                          ({data.qty} {data.unit})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 3. Chronological Audit Transaction Tape */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-white text-sm">Detailed Transaction History Tape</h4>
                <p className="text-slate-400 text-xs">Audit log with 1-click thermal receipt re-printing</p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter by receipt, name, note..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/60 divide-y divide-slate-800/80 max-h-96 overflow-y-auto">
              {filteredTransactions.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-center">
                  <Calendar className="w-8 h-8 text-slate-700 mb-2" />
                  <p className="text-xs text-slate-400">No transactions recorded for this period.</p>
                </div>
              ) : (
                filteredTransactions.map((t) => (
                  <div key={t.id} className="p-3 hover:bg-slate-800/40 flex items-center justify-between gap-3 text-xs transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-white">{t.receiptNumber}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                            t.type === 'sale'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {t.type}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {t.paymentMode.toUpperCase()}
                        </span>
                        {t.staffName && (
                          <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.2 rounded">
                            Staff: {t.staffName}
                          </span>
                        )}
                        {t.storeName && (
                          <span className="text-[10px] text-cyan-300 bg-cyan-950/80 border border-cyan-800/60 px-1.5 py-0.2 rounded font-medium flex items-center gap-1">
                            <Store className="w-2.5 h-2.5" />
                            <span>{t.storeName}</span>
                          </span>
                        )}
                      </div>

                      <div className="text-slate-400 text-[11px] mt-0.5 truncate">
                        {t.customerName && <span className="text-slate-200 mr-2">Customer: {t.customerName}</span>}
                        {t.remarks && <span className="italic mr-2">"{t.remarks}"</span>}
                        {t.items && t.items.length > 0 && (
                          <span className="text-slate-500">
                            ({t.items.length} items: {t.items.map((i) => `${i.name} x${i.quantity}`).join(', ')})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div
                          className={`font-mono font-bold text-sm ${
                            t.type === 'sale' ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {t.type === 'sale' ? '+' : '-'}₹{t.amount.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      {t.type === 'sale' && (
                        <button
                          onClick={() => handleReprintReceipt(t)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-600/40 text-slate-400 hover:text-blue-300 border border-slate-700 transition-colors"
                          title="Print Thermal Receipt Slip"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
};
