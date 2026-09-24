import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Wallet,
  Calendar,
  IndianRupee,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Printer,
  Receipt,
  Lock,
  Eye,
  EyeOff,
  ShoppingBag,
  Clock,
  ArrowUpRight,
  Filter,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  X,
  Store,
  Building2,
  Calculator,
  Package,
  FileSpreadsheet,
} from 'lucide-react';
import { Transaction, CustomerUdhaar, Product, StoreSettings, StoreProfile, MarketCreditEntry } from '../types';
import { printReceipt, ThermalReceiptData } from '../utils/printer';
import { exportStoreSalesAndAnalyticsToExcel } from '../utils/excelExport';
import { CalculationHistoryReport } from './CalculationHistoryReport';
import { MarketCreditSection } from './MarketCreditSection';
import { DateWiseCalendarReport } from './DateWiseCalendarReport';
import { getStoredCalculationHistory } from '../utils/calcHistory';

interface OwnerReportsTabProps {
  transactions: Transaction[];
  customers: CustomerUdhaar[];
  products: Product[];
  storeSettings: StoreSettings;
  cashFlow?: { openingAmount: number; addedAmount: number };
  marketCredits?: MarketCreditEntry[];
  onUpdateMarketCredits?: (entries: MarketCreditEntry[]) => void;
  onResetShiftCash?: () => void;
  onResetDailyOutletData?: (outletId: string | 'all') => void;
  onOpenBillsManager?: () => void;
}

type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all';

export const OwnerReportsTab: React.FC<OwnerReportsTabProps> = ({
  transactions = [],
  customers = [],
  products = [],
  storeSettings,
  cashFlow,
  marketCredits,
  onUpdateMarketCredits,
  onResetShiftCash,
  onResetDailyOutletData,
  onOpenBillsManager,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('daily');
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>('all');
  const [activeSection, setActiveSection] = useState<'sales_analytics' | 'date_filter' | 'calc_history' | 'market_credit'>('sales_analytics');
  const [showDailyDataResetModal, setShowDailyDataResetModal] = useState<boolean>(false);
  const [dailyResetOutletTarget, setDailyResetOutletTarget] = useState<string | 'all'>('all');
  const [calcCount, setCalcCount] = useState<number>(() => getStoredCalculationHistory().length);
  const [internalMarketCredits, setInternalMarketCredits] = useState<MarketCreditEntry[]>(() => {
    try {
      const saved = localStorage.getItem('nayab_market_credit_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load market credits:', e);
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
  const [sessionUnlocked, setSessionUnlocked] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [printMsg, setPrintMsg] = useState<string>('');
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string>('');

  useEffect(() => {
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

  const activeStaff = storeSettings.activeStaffId
    ? storeSettings.staffAccounts?.find((s) => s.id === storeSettings.activeStaffId)
    : undefined;
  const isOwner = Boolean(activeStaff && (activeStaff.role === 'owner' || activeStaff.role === 'master_admin'));
  const ownerStaff = storeSettings.staffAccounts?.find((s) => s.role === 'owner' || s.role === 'master_admin') || {
    id: 'owner',
    name: 'Nayab Store Owner',
    role: 'owner' as const,
    pin: 'nayab@q6',
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pinInput.trim();
    const isValidPin = cleanPin === 'nayab@q6' || (ownerStaff.pin && ownerStaff.pin === cleanPin);
    if (!isValidPin) {
      setPinError('Incorrect Owner PIN. Access is strictly restricted to store owner.');
      return;
    }
    setSessionUnlocked(true);
    setPinError('');
  };

  // Date boundaries for Daily, Weekly, Monthly, Yearly
  const dateRanges = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

    return { startOfToday, startOfWeek, startOfMonth, startOfYear };
  }, []);

  // Outlets list
  const outlets: StoreProfile[] = useMemo(() => {
    return (storeSettings.stores && storeSettings.stores.length > 0)
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
  }, [storeSettings]);

  // Filtered transactions based on period and selected outlet
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const tTime = new Date(t.timestamp).getTime();
      let matchesPeriod = true;
      if (selectedPeriod === 'daily') matchesPeriod = tTime >= dateRanges.startOfToday;
      else if (selectedPeriod === 'weekly') matchesPeriod = tTime >= dateRanges.startOfWeek;
      else if (selectedPeriod === 'monthly') matchesPeriod = tTime >= dateRanges.startOfMonth;
      else if (selectedPeriod === 'yearly') matchesPeriod = tTime >= dateRanges.startOfYear;

      const matchOutletId = t.outletId || t.storeId;
      const matchesOutlet =
        selectedOutletFilter === 'all' ||
        (matchOutletId
          ? matchOutletId === selectedOutletFilter
          : (selectedOutletFilter === (storeSettings.activeStoreId || 'store-1') || selectedOutletFilter === outlets[0]?.id));

      return matchesPeriod && matchesOutlet;
    });
  }, [transactions, selectedPeriod, dateRanges, selectedOutletFilter, outlets, storeSettings.activeStoreId]);

  // Calculate separate metrics for both outlets side-by-side
  const outletBreakdown = useMemo(() => {
    return outlets.map((outlet) => {
      const outletTxs = transactions.filter((t) => {
        const tTime = new Date(t.timestamp).getTime();
        let matchesPeriod = true;
        if (selectedPeriod === 'daily') matchesPeriod = tTime >= dateRanges.startOfToday;
        else if (selectedPeriod === 'weekly') matchesPeriod = tTime >= dateRanges.startOfWeek;
        else if (selectedPeriod === 'monthly') matchesPeriod = tTime >= dateRanges.startOfMonth;
        else if (selectedPeriod === 'yearly') matchesPeriod = tTime >= dateRanges.startOfYear;

        const tOutlet = t.outletId || t.storeId;
        const isThisStore = tOutlet ? tOutlet === outlet.id : (outlet.isPrimary || outlet.id === outlets[0]?.id);
        return matchesPeriod && isThisStore;
      });

      const sales = outletTxs.filter((t) => t.type === 'sale').reduce((sum, t) => sum + t.amount, 0);
      const expenses = outletTxs.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      const cash = outletTxs.filter((t) => t.type === 'sale' && t.paymentMode === 'cash').reduce((sum, t) => sum + t.amount, 0);
      const upi = outletTxs.filter((t) => t.type === 'sale' && t.paymentMode === 'online_upi').reduce((sum, t) => sum + t.amount, 0);
      const udhaar = outletTxs.filter((t) => t.type === 'sale' && t.paymentMode === 'credit_udhaar').reduce((sum, t) => sum + t.amount, 0);
      const count = outletTxs.filter((t) => t.type === 'sale').length;

      const outletCustomers = customers.filter((c) => {
        const cOutlet = c.outletId || c.storeId;
        return cOutlet ? cOutlet === outlet.id : (outlet.isPrimary || outlet.id === outlets[0]?.id);
      });
      const outletUdhaarDue = outletCustomers.reduce((sum, c) => sum + (c.totalDue || 0), 0);

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
        outletUdhaarDue,
        cashInHand: cash - expenses,
      };
    });
  }, [outlets, transactions, customers, selectedPeriod, dateRanges]);

  // Print Thermal Report Slip specifically for an outlet
  const handlePrintOutletReport = async (outbreak: typeof outletBreakdown[0]) => {
    setPrintMsg(`Printing report for ${outbreak.outlet.shopName}...`);
    const receiptData: ThermalReceiptData = {
      shopName: outbreak.outlet.shopName,
      address: outbreak.outlet.address || storeSettings.address,
      phone: outbreak.outlet.phone || storeSettings.phone,
      gstin: outbreak.outlet.gstin || storeSettings.gstin,
      receiptNumber: `OUTLET-${outbreak.outlet.id.slice(-4)}-${Date.now().toString().slice(-4)}`,
      date: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
      cashierName: `Report: ${selectedPeriod.toUpperCase()}`,
      items: [
        { id: '1', name: `Gross Sales (${outbreak.count} bills)`, quantity: outbreak.count, unit: 'bills' as const, rate: outbreak.sales, total: outbreak.sales },
        { id: '2', name: 'Cash Collection', quantity: 1, unit: 'cash' as const, rate: outbreak.cash, total: outbreak.cash },
        { id: '3', name: 'UPI Online Collection', quantity: 1, unit: 'upi' as const, rate: outbreak.upi, total: outbreak.upi },
        { id: '4', name: 'Udhaar Credit', quantity: 1, unit: 'khata' as const, rate: outbreak.udhaar, total: outbreak.udhaar },
        { id: '5', name: 'Store Expenses', quantity: 1, unit: 'entry' as const, rate: outbreak.expenses, total: outbreak.expenses },
      ],
      subtotal: outbreak.sales,
      taxAmount: 0,
      taxRate: 0,
      grandTotal: outbreak.net,
      paymentMode: 'report',
      upiId: outbreak.outlet.upiId || storeSettings.upiId,
    };
    const res = await printReceipt(receiptData, storeSettings);
    if (res.success) {
      setPrintMsg(`Outlet report for ${outbreak.outlet.shopName} printed successfully!`);
    } else {
      setPrintMsg(res.error || 'Failed to print outlet report.');
    }
    setTimeout(() => setPrintMsg(''), 3500);
  };

  // Aggregated analytics
  const totalSales = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'sale')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  const totalExpenses = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  const netBalance = totalSales - totalExpenses;

  const salesCount = filteredTransactions.filter((t) => t.type === 'sale').length;
  const avgBillValue = salesCount > 0 ? totalSales / salesCount : 0;

  const cashSales = filteredTransactions
    .filter((t) => t.type === 'sale' && t.paymentMode === 'cash')
    .reduce((sum, t) => sum + t.amount, 0);

  const upiSales = filteredTransactions
    .filter((t) => t.type === 'sale' && t.paymentMode === 'online_upi')
    .reduce((sum, t) => sum + t.amount, 0);

  const udhaarSales = filteredTransactions
    .filter((t) => t.type === 'sale' && t.paymentMode === 'credit_udhaar')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalUdhaarPending = useMemo(() => {
    return customers
      .filter((c) => {
        if (selectedOutletFilter === 'all') return true;
        const cOutlet = c.outletId || c.storeId;
        return cOutlet ? cOutlet === selectedOutletFilter : (selectedOutletFilter === (storeSettings.activeStoreId || 'store-1') || selectedOutletFilter === outlets[0]?.id);
      })
      .reduce((sum, c) => sum + (c.totalDue || 0), 0);
  }, [customers, selectedOutletFilter, storeSettings.activeStoreId, outlets]);

  // Top products sold in this period
  const topProducts = useMemo(() => {
    const itemMap: { [name: string]: { name: string; qty: number; unit: string; total: number } } = {};
    filteredTransactions
      .filter((t) => t.type === 'sale' && t.items)
      .forEach((t) => {
        t.items?.forEach((item) => {
          if (!itemMap[item.name]) {
            itemMap[item.name] = { name: item.name, qty: 0, unit: item.unit || 'pcs', total: 0 };
          }
          itemMap[item.name].qty += item.quantity;
          itemMap[item.name].total += item.total;
        });
      });

    return Object.values(itemMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [filteredTransactions]);

  // Print Summary Thermal Receipt Slip for this period
  const handlePrintPeriodReport = async () => {
    setPrintMsg('Printing report summary to thermal slip...');
    const periodTitles: Record<ReportPeriod, string> = {
      daily: 'DAILY SALES & EXPENSE REPORT',
      weekly: 'WEEKLY 7-DAY BUSINESS REPORT',
      monthly: 'MONTHLY FINANCIAL REPORT',
      yearly: 'ANNUAL YEARLY STORE REPORT',
      all: 'ALL-TIME HISTORIC REPORT',
    };

    const receiptData: ThermalReceiptData = {
      shopName: storeSettings.shopName,
      address: storeSettings.address,
      phone: storeSettings.phone,
      gstin: storeSettings.gstin,
      receiptNumber: `REP-${selectedPeriod.toUpperCase()}-${Date.now().toString().slice(-4)}`,
      date: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' }),
      cashierName: `Owner: ${ownerStaff.name}`,
      items: [
        { id: 'r1', name: 'Total Gross Sales', quantity: salesCount, unit: 'bills' as const, rate: totalSales, total: totalSales },
        { id: 'r2', name: 'Total Expenses', quantity: 1, unit: 'entry' as const, rate: totalExpenses, total: totalExpenses },
        { id: 'r3', name: 'Cash Sales', quantity: 1, unit: 'cash' as const, rate: cashSales, total: cashSales },
        { id: 'r4', name: 'UPI Online Sales', quantity: 1, unit: 'upi' as const, rate: upiSales, total: upiSales },
        { id: 'r5', name: 'Udhaar Given', quantity: 1, unit: 'khata' as const, rate: udhaarSales, total: udhaarSales },
      ],
      subtotal: totalSales,
      taxAmount: 0,
      taxRate: 0,
      grandTotal: netBalance,
      paymentMode: 'report',
      upiId: storeSettings.upiId,
    };

    const res = await printReceipt(receiptData, storeSettings);
    if (res.success) {
      setPrintMsg('Report printed successfully!');
      setTimeout(() => setPrintMsg(''), 3500);
    } else {
      setPrintMsg(res.error || 'Failed to print report.');
    }
  };

  const handleConfirmResetShiftCash = () => {
    if (onResetShiftCash) {
      onResetShiftCash();
      setShowResetConfirmModal(false);
      setResetSuccessMsg('Shift cash balance has been reset to ₹0 successfully for the new shift.');
      setTimeout(() => setResetSuccessMsg(''), 5000);
    }
  };

  // If active user is NOT owner and has not unlocked with owner PIN:
  if (!isOwner && !sessionUnlocked) {
    return (
      <div className="bg-slate-900/90 border-2 border-amber-500/40 rounded-3xl p-6 shadow-2xl max-w-lg mx-auto space-y-4 my-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-white">Owner Reports - Restricted Access</h3>
            <p className="text-xs text-amber-300 font-medium">Protected with Owner PIN</p>
          </div>
        </div>

        <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-2">
          <p>
            Daily, Weekly, Monthly, and Yearly sales breakdowns, store expenses, and profits are strictly confidential and restricted to the Store Owner.
          </p>
          <div className="flex justify-between pt-2 border-t border-slate-800 text-slate-400">
            <span>Current Logged Staff:</span>
            <span className="text-white font-semibold">{activeStaff?.name} ({activeStaff?.role})</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Store Owner:</span>
            <span className="text-amber-400 font-bold">{ownerStaff.name}</span>
          </div>
        </div>

        {pinError && (
          <div className="p-2.5 bg-rose-950/70 border border-rose-500/50 rounded-xl text-rose-200 text-xs font-semibold">
            ⚠ {pinError}
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">
              Enter Owner PIN / Password:
            </label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                required
                autoFocus
                placeholder="Enter Owner Password / PIN"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full bg-slate-950 border border-amber-500/50 focus:border-amber-400 rounded-xl pl-3.5 pr-10 py-2 text-white font-mono text-sm tracking-wider focus:outline-none"
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

          <button
            type="submit"
            className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-950/80 transition-all"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Unlock Owner Reports</span>
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Primary Owner Reports View Switcher */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-md">
        <button
          type="button"
          onClick={() => setActiveSection('sales_analytics')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSection === 'sales_analytics'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Store Sales & Analytics</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('date_filter')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSection === 'date_filter'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Date-Wise Branch Filter</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('calc_history')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSection === 'calc_history'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>Full Calculation History</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              activeSection === 'calc_history'
                ? 'bg-emerald-850 text-emerald-100 border border-emerald-400/40'
                : 'bg-slate-800 text-emerald-400 border border-slate-700'
            }`}
          >
            {calcCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('market_credit')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSection === 'market_credit'
              ? 'bg-rose-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Credit in Market (माल बाक़ी)</span>
          {effectiveMarketCredits.filter((e) => e.remainingBaaki > 0).length > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeSection === 'market_credit'
                  ? 'bg-rose-950 text-rose-100 border border-rose-400/40'
                  : 'bg-rose-950/80 text-rose-300 border border-rose-800'
              }`}
            >
              {effectiveMarketCredits.filter((e) => e.remainingBaaki > 0).length}
            </span>
          )}
        </button>
      </div>

      {activeSection === 'date_filter' ? (
        <DateWiseCalendarReport
          transactions={transactions}
          customers={customers}
          storeSettings={storeSettings}
        />
      ) : activeSection === 'calc_history' ? (
        <CalculationHistoryReport storeSettings={storeSettings} />
      ) : activeSection === 'market_credit' ? (
        <MarketCreditSection
          entries={effectiveMarketCredits}
          onUpdateEntries={handleUpdateMarketCredits}
          storeSettings={storeSettings}
          selectedOutletFilter={selectedOutletFilter}
          isOwner={isOwner}
        />
      ) : (
        <>
          {/* Header Bar with Period Selection & Print Report Button for Sales Analytics */}
          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-white text-sm">Owner Business Reports</h4>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/40 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>OWNER ACCESS</span>
                  </span>
                </div>
                <p className="text-slate-400 text-xs">
                  Daily, Weekly, Monthly & Yearly sales, expenses, and net profit ledger
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {onResetDailyOutletData && (
                <button
                  type="button"
                  onClick={() => setShowDailyDataResetModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-rose-600/25 hover:bg-rose-600/35 text-rose-300 border border-rose-500/40 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
                  title="Reset daily sales, expenses, and added cash of outlets to 0"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                  <span>Reset Daily Data (₹0)</span>
                </button>
              )}

              {onResetShiftCash && (
                <button
                  onClick={() => setShowResetConfirmModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-600/25 hover:bg-amber-600/35 text-amber-300 border border-amber-500/40 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                  title="Reset shift opening cash and added cash for a new work shift"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Reset Shift Cash</span>
                </button>
              )}

              {onOpenBillsManager && (
                <button
                  onClick={onOpenBillsManager}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                  title="Search, filter, view and edit sale bills, online UPI and udhaar bills"
                >
                  <Receipt className="w-3.5 h-3.5 text-blue-200" />
                  <span>Manage Bills & Edit</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => exportStoreSalesAndAnalyticsToExcel(filteredTransactions, storeSettings, selectedOutletFilter, selectedPeriod)}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95"
                title="Export Store Sales and Analytics to Microsoft Excel CSV file"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export Excel File</span>
              </button>

              <button
                onClick={handlePrintPeriodReport}
                className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-650 text-white border border-slate-600 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                title="Print report on thermal slip"
              >
                <Printer className="w-3.5 h-3.5 text-cyan-400" />
                <span>Print Report Slip</span>
              </button>
            </div>
          </div>

          {resetSuccessMsg && (
            <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in shadow-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{resetSuccessMsg}</span>
            </div>
          )}

          {printMsg && (
            <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-800 text-cyan-300 text-xs font-semibold text-center">
              {printMsg}
            </div>
          )}
      {/* Multi-Store / Outlet Filter Tabs */}
      <div className="bg-slate-900/90 p-2.5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 text-xs">
          <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Store className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-white text-xs">Select Outlet:</span>
            <span className="text-[11px] text-slate-400 ml-1.5">
              {outlets.length} {outlets.length === 1 ? 'outlet' : 'outlets'} available
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setSelectedOutletFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              selectedOutletFilter === 'all'
                ? 'bg-amber-600 text-white shadow-sm'
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
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Outlet {idx + 1}: {outlet.shopName}</span>
              {outlet.id === storeSettings.activeStoreId && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Active Counter"></span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Period Selection Tabs: Daily, Weekly, Monthly, Yearly, All */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-950/80 rounded-2xl border border-slate-800 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setSelectedPeriod('daily')}
          className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap ${
            selectedPeriod === 'daily'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Daily</span>
        </button>

        <button
          onClick={() => setSelectedPeriod('weekly')}
          className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap ${
            selectedPeriod === 'weekly'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Weekly (7 Days)</span>
        </button>

        <button
          onClick={() => setSelectedPeriod('monthly')}
          className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap ${
            selectedPeriod === 'monthly'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Monthly</span>
        </button>

        <button
          onClick={() => setSelectedPeriod('yearly')}
          className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap ${
            selectedPeriod === 'yearly'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Yearly</span>
        </button>

        <button
          onClick={() => setSelectedPeriod('all')}
          className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap ${
            selectedPeriod === 'all'
              ? 'bg-slate-700 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <span>All-Time</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Sales */}
        <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">Gross Sales</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">
            ₹{totalSales.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400">
            {salesCount} sale bills recorded
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">Store Expenses</span>
            <TrendingDown className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-400">
            ₹{totalExpenses.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400">
            Deducted from daily counter
          </div>
        </div>

        {/* Net Profit / Balance */}
        <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">Net Balance</span>
            <Wallet className="w-4 h-4 text-sky-400" />
          </div>
          <div
            className={`text-xl font-bold font-mono ${
              netBalance >= 0 ? 'text-sky-400' : 'text-rose-400'
            }`}
          >
            ₹{netBalance.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400">
            Avg Bill: ₹{avgBillValue.toFixed(0)}
          </div>
        </div>

        {/* Pending Udhaar in Market */}
        <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">Pending Udhaar</span>
            <IndianRupee className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-400">
            ₹{totalUdhaarPending.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400">
            Total market receivables
          </div>
        </div>
      </div>

      {/* Outlets Separate Breakdown & Side-by-Side Comparison */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-amber-400" />
            <h4 className="font-bold text-white text-sm">
              Separate Outlet Reports & Comparison
            </h4>
          </div>
          <span className="text-[11px] text-slate-400">
            Period: {selectedPeriod.toUpperCase()} • Filter: {selectedOutletFilter === 'all' ? 'All Outlets Combined' : outlets.find(o => o.id === selectedOutletFilter)?.shopName || 'Single Outlet'}
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
                    ? 'bg-slate-850 border-amber-500 shadow-lg shadow-amber-950/40 ring-1 ring-amber-500'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-xs flex items-center justify-center">
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
                <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 text-center mb-3">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Gross Sales</div>
                    <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                      ₹{item.sales.toFixed(0)}
                    </div>
                    <div className="text-[10px] text-slate-500">{item.count} bills</div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Expenses</div>
                    <div className="text-base font-bold font-mono text-rose-400 mt-0.5">
                      ₹{item.expenses.toFixed(0)}
                    </div>
                    <div className="text-[10px] text-slate-500">Kharch</div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Net Profit</div>
                    <div className={`text-base font-bold font-mono mt-0.5 ${item.net >= 0 ? 'text-sky-400' : 'text-rose-400'}`}>
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
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">Drawer Cash (In-Hand):</span>
                    <span className={`font-mono font-semibold ${item.cashInHand >= 0 ? 'text-sky-300' : 'text-rose-300'}`}>
                      ₹{item.cashInHand.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">Branch Market Udhaar:</span>
                    <span className="font-mono font-semibold text-amber-300">
                      ₹{item.outletUdhaarDue.toFixed(2)}
                    </span>
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
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${sharePercent}%` }} />
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
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {selectedOutletFilter === item.outlet.id ? 'Viewing This Outlet' : 'Filter This Outlet'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePrintOutletReport(item)}
                    className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
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

      {/* Payment Modes Breakdown */}
      <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 space-y-2">
        <h5 className="font-bold text-white text-xs uppercase tracking-wider">
          Payment Mode Collection ({selectedPeriod.toUpperCase()})
        </h5>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
            <div>
              <div className="text-slate-400 text-[11px]">Cash Collection:</div>
              <div className="font-mono font-bold text-emerald-400 text-sm">₹{cashSales.toFixed(2)}</div>
            </div>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded">
              {totalSales > 0 ? Math.round((cashSales / totalSales) * 100) : 0}%
            </span>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
            <div>
              <div className="text-slate-400 text-[11px]">UPI QR Scanner:</div>
              <div className="font-mono font-bold text-cyan-400 text-sm">₹{upiSales.toFixed(2)}</div>
            </div>
            <span className="text-[10px] bg-cyan-500/20 text-cyan-300 font-bold px-1.5 py-0.5 rounded">
              {totalSales > 0 ? Math.round((upiSales / totalSales) * 100) : 0}%
            </span>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
            <div>
              <div className="text-slate-400 text-[11px]">Credit Khata:</div>
              <div className="font-mono font-bold text-amber-400 text-sm">₹{udhaarSales.toFixed(2)}</div>
            </div>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded">
              {totalSales > 0 ? Math.round((udhaarSales / totalSales) * 100) : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Shift Cash & Drawer Reconciliation Section */}
      <div className="bg-slate-800/90 p-4 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-slate-900 via-slate-850 to-amber-950/20 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-amber-400" />
            <h5 className="font-bold text-white text-xs uppercase tracking-wider">
              Shift Cash & Counter Drawer Balance
            </h5>
          </div>
          {onResetShiftCash && (
            <button
              onClick={() => setShowResetConfirmModal(true)}
              className="px-2.5 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
              title="Reset shift opening cash & added cash for a new shift"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Reset Shift Cash</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase font-sans">Shift Opening Cash</span>
            <span className="text-sm font-bold text-slate-200">₹{cashFlow?.openingAmount || 0}</span>
          </div>
          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase font-sans">Added Shift Cash</span>
            <span className="text-sm font-bold text-slate-200">₹{cashFlow?.addedAmount || 0}</span>
          </div>
          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase font-sans">Cash Sales ({selectedPeriod})</span>
            <span className="text-sm font-bold text-emerald-400">₹{cashSales.toFixed(2)}</span>
          </div>
          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-amber-500/40 bg-amber-950/20">
            <span className="text-amber-400 block text-[10px] uppercase font-sans font-bold">Total In Drawer</span>
            <span className="text-sm font-bold text-amber-300">
              ₹{((cashFlow?.openingAmount || 0) + (cashFlow?.addedAmount || 0) + cashSales - totalExpenses).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Top Products in this period */}
      {topProducts.length > 0 && (
        <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 space-y-2">
          <h5 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5 text-purple-400" />
            <span>Top Selling Spices & Kirana Items in this Period</span>
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 pt-1">
            {topProducts.map((p, idx) => (
              <div key={idx} className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800 text-xs">
                <div className="font-bold text-sm text-white truncate">{p.name}</div>
                <div className="text-slate-400 text-[10px]">
                  Sold: <strong className="text-white">{p.qty} {p.unit}</strong>
                </div>
                <div className="font-mono font-bold text-emerald-400 text-[11px] mt-0.5">
                  ₹{p.total.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Transactions List for this period with Real-time Date and Time */}
      <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 space-y-2.5">
        <div className="flex items-center justify-between">
          <h5 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Period Transaction Records with Real-time Date & Time ({filteredTransactions.length})</span>
          </h5>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">
            No transactions found for the selected {selectedPeriod} period.
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto border border-slate-800 rounded-xl divide-y divide-slate-800/80 bg-slate-900/60">
            {filteredTransactions.map((t) => {
              const formattedDate = new Date(t.timestamp).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              });
              const formattedTime = new Date(t.timestamp).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              return (
                <div key={t.id} className="p-2.5 hover:bg-slate-800/50 transition-colors flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">{t.receiptNumber}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                          t.type === 'sale'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {t.type}
                      </span>
                      <span className="text-slate-400 text-[10px] uppercase font-semibold">
                        {t.paymentMode.replace('_', ' ')}
                      </span>
                      {t.storeName && (
                        <span className="text-[10px] text-amber-300 bg-amber-950/70 border border-amber-800/60 px-1.5 py-0.2 rounded font-medium flex items-center gap-1">
                          <Store className="w-2.5 h-2.5" />
                          <span>{t.storeName}</span>
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      <span className="text-slate-300">{formattedDate}</span>
                      <span>•</span>
                      <span className="font-mono text-cyan-300 font-semibold">{formattedTime}</span>
                      {t.customerName && (
                        <>
                          <span>•</span>
                          <span className="text-amber-300">Cust: {t.customerName}</span>
                        </>
                      )}
                      {t.staffName && (
                        <>
                          <span>•</span>
                          <span className="text-slate-400">Staff: {t.staffName}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`font-mono font-bold text-sm ${
                        t.type === 'sale' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {t.type === 'sale' ? '+' : '-'}₹{t.amount.toFixed(2)}
                    </div>
                    {t.items && (
                      <div className="text-[10px] text-slate-500">
                        {t.items.length} item(s)
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Calculator Audit Tape Snapshot */}
      <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h5 className="font-bold text-white text-sm">
              POS Calculator History Tape ({calcCount} Recorded)
            </h5>
            <p className="text-slate-400 text-xs">
              Audit every mathematical calculation, timestamp, and evaluated total recorded on (=).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveSection('calc_history')}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950 transition-all cursor-pointer"
        >
          <span>View Full Calculation History →</span>
        </button>
      </div>
      </>
    )}

      {/* Reset Shift Cash Confirmation Modal */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-amber-500/50 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <RotateCcw className="w-5 h-5 text-amber-400" />
                <span>Reset Shift Cash</span>
              </div>
              <button
                onClick={() => setShowResetConfirmModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>
                Are you sure you want to reset the shift cash for the counter?
              </p>
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2 font-mono">
                <div className="flex justify-between text-slate-400">
                  <span className="font-sans">Shift Opening Balance:</span>
                  <span className="text-white font-bold">₹{cashFlow?.openingAmount || 0}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span className="font-sans">Added Shift Cash:</span>
                  <span className="text-white font-bold">₹{cashFlow?.addedAmount || 0}</span>
                </div>
                <div className="border-t border-slate-800 pt-1.5 flex justify-between text-amber-400 font-bold">
                  <span className="font-sans">New Shift Balance:</span>
                  <span>₹0.00</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-600/30 text-amber-200/90 text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>
                  This resets the opening balance and shift cash to ₹0 so you can start fresh for a new shift or cashier change. All past sales, bills, customer udhaar records, and inventory remain completely safe.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResetShiftCash}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-amber-950 cursor-pointer active:scale-95 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Confirm Shift Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily Data Reset Modal (Sales, Expenses, Cash Added to 0) */}
      {showDailyDataResetModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-rose-500/50 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-base">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4 text-rose-400" />
                </div>
                <div>
                  <h4 className="font-extrabold text-white text-sm">Reset Daily Outlet Data to ₹0</h4>
                  <p className="text-[11px] text-rose-300 font-normal">Daily Sales, Expenses & Cash Added</p>
                </div>
              </div>
              <button
                onClick={() => setShowDailyDataResetModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>
                Select which outlet to reset today's daily operations for. All of today's sales and expense records for the selected outlet(s) will be cleared to ₹0.
              </p>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Select Outlet:
                </label>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setDailyResetOutletTarget('all')}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      dailyResetOutletTarget === 'all'
                        ? 'bg-rose-950/60 border-rose-500 text-white shadow-md'
                        : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold">All Outlets Combined</div>
                      <div className="text-[10px] text-slate-400">sy Nayab + kp Nayab</div>
                    </div>
                    {dailyResetOutletTarget === 'all' && (
                      <CheckCircle2 className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    )}
                  </button>

                  {outlets.map((outlet, idx) => (
                    <button
                      key={outlet.id}
                      type="button"
                      onClick={() => setDailyResetOutletTarget(outlet.id)}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        dailyResetOutletTarget === outlet.id
                          ? 'bg-rose-950/60 border-rose-500 text-white shadow-md'
                          : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="font-bold">Outlet #{idx + 1}: {outlet.shopName}</div>
                        <div className="text-[10px] text-slate-400">{outlet.id} {outlet.id === storeSettings.activeStoreId ? '• Active' : ''}</div>
                      </div>
                      {dailyResetOutletTarget === outlet.id && (
                        <CheckCircle2 className="w-4 h-4 text-rose-400 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5 font-mono text-[11px]">
                <div className="text-slate-400 font-sans font-bold text-xs uppercase mb-1">Impact of Daily Reset:</div>
                <div className="flex justify-between text-slate-400">
                  <span className="font-sans">Today's Outlet Sales:</span>
                  <span className="text-emerald-400 font-bold">Reset to ₹0.00</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span className="font-sans">Today's Outlet Expenses:</span>
                  <span className="text-rose-400 font-bold">Reset to ₹0.00</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span className="font-sans">Added Till Cash:</span>
                  <span className="text-indigo-300 font-bold">Reset to ₹0.00</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-600/30 text-amber-200 text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>
                  Past dates' reports, all inventory products, and customer khata balances are untouched and protected.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowDailyDataResetModal(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onResetDailyOutletData) {
                    onResetDailyOutletData(dailyResetOutletTarget);
                    setShowDailyDataResetModal(false);
                    setResetSuccessMsg(`Daily data (sales, expenses, cash) for outlet(s) reset to ₹0.`);
                    setTimeout(() => setResetSuccessMsg(''), 5000);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-950 cursor-pointer active:scale-95 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Confirm Reset to ₹0</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
