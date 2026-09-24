import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Search,
  Printer,
  Download,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Wallet,
  Building2,
  Store,
  FileSpreadsheet,
  Receipt,
  ArrowRight,
  Filter,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  CreditCard,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { Transaction, CustomerUdhaar, StoreSettings, StoreProfile, OutletDailySnapshot } from '../types';
import { printReceipt, ThermalReceiptData } from '../utils/printer';
import { fetchOutletDailySnapshots, getLocalDailySnapshots } from '../utils/centralSync';

interface DateWiseCalendarReportProps {
  transactions: Transaction[];
  customers: CustomerUdhaar[];
  storeSettings: StoreSettings;
  className?: string;
  isEmbedded?: boolean;
}

type QuickRange = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'all';

export const DateWiseCalendarReport: React.FC<DateWiseCalendarReportProps> = ({
  transactions,
  customers,
  storeSettings,
  className = '',
  isEmbedded = false,
}) => {
  // Today's date string YYYY-MM-DD in local time
  const getLocalDateStr = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = useMemo(() => getLocalDateStr(), []);

  // Quick range state
  const [quickRange, setQuickRange] = useState<QuickRange>('today');
  const [fromDate, setFromDate] = useState<string>(todayStr);
  const [toDate, setToDate] = useState<string>(todayStr);
  const [selectedOutlet, setSelectedOutlet] = useState<string>('all');
  const [compareBranches, setCompareBranches] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'summary' | 'daily' | 'transactions'>('summary');
  const [snapshots, setSnapshots] = useState<OutletDailySnapshot[]>(() => getLocalDailySnapshots());
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Available outlets list
  const outlets: StoreProfile[] = useMemo(() => {
    if (storeSettings.stores && storeSettings.stores.length > 0) {
      return storeSettings.stores;
    }
    return [
      {
        id: 'store-1',
        shopName: storeSettings.shopName || 'sy Nayab (Main)',
        isPrimary: true,
        address: storeSettings.address || '',
        phone: storeSettings.phone || '',
        upiId: storeSettings.upiId || '',
        defaultTaxRate: storeSettings.defaultTaxRate || 0,
      },
      {
        id: 'store-2',
        shopName: 'kp Nayab (Branch 2)',
        isPrimary: false,
        address: '',
        phone: '',
        upiId: storeSettings.upiId || '',
        defaultTaxRate: storeSettings.defaultTaxRate || 0,
      },
    ];
  }, [storeSettings]);

  // Sync snapshots from server and listen for updates
  useEffect(() => {
    fetchOutletDailySnapshots().then((res) => {
      if (res.success && res.snapshots) {
        setSnapshots(res.snapshots);
      }
    });

    const handleUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setSnapshots(e.detail);
      } else {
        setSnapshots(getLocalDailySnapshots());
      }
    };

    window.addEventListener('nayab_daily_snapshots_updated', handleUpdate);
    return () => window.removeEventListener('nayab_daily_snapshots_updated', handleUpdate);
  }, []);

  // Set dates from quick range
  const handleSelectQuickRange = (range: QuickRange) => {
    setQuickRange(range);
    const now = new Date();

    if (range === 'today') {
      const d = getLocalDateStr(now);
      setFromDate(d);
      setToDate(d);
    } else if (range === 'yesterday') {
      const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const d = getLocalDateStr(y);
      setFromDate(d);
      setToDate(d);
    } else if (range === 'last7') {
      const past = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      setFromDate(getLocalDateStr(past));
      setToDate(getLocalDateStr(now));
    } else if (range === 'last30') {
      const past = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
      setFromDate(getLocalDateStr(past));
      setToDate(getLocalDateStr(now));
    } else if (range === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(getLocalDateStr(start));
      setToDate(getLocalDateStr(now));
    } else if (range === 'lastMonth') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setFromDate(getLocalDateStr(start));
      setToDate(getLocalDateStr(end));
    } else if (range === 'thisYear') {
      const start = new Date(now.getFullYear(), 0, 1);
      setFromDate(getLocalDateStr(start));
      setToDate(getLocalDateStr(now));
    } else if (range === 'all') {
      setFromDate('2024-01-01');
      setToDate(getLocalDateStr(now));
    }
  };

  // Safe merge of transactions: combines live active transactions AND archived transactions from snapshots
  // Deduplicates by transaction ID so no data is double-counted or lost when counters are reset
  const effectiveTransactions = useMemo(() => {
    const txMap = new Map<string, Transaction>();

    // 1. Add all live transactions
    for (const t of transactions) {
      if (t && t.id) {
        txMap.set(t.id, t);
      }
    }

    // 2. Add archived transactions from snapshots within the date range
    for (const snap of snapshots) {
      if (snap.archivedTransactions && Array.isArray(snap.archivedTransactions)) {
        for (const archTx of snap.archivedTransactions) {
          if (archTx && archTx.id && !txMap.has(archTx.id)) {
            txMap.set(archTx.id, archTx);
          }
        }
      }
    }

    return Array.from(txMap.values());
  }, [transactions, snapshots]);

  // Filter transactions by selected Date Range and Outlet
  const filteredData = useMemo(() => {
    return effectiveTransactions.filter((t) => {
      if (!t.timestamp || t.voided) return false;

      // Check date
      const tDate = t.timestamp.slice(0, 10);
      if (fromDate && tDate < fromDate) return false;
      if (toDate && tDate > toDate) return false;

      // Check outlet
      const tOutlet = t.outletId || t.storeId;
      if (selectedOutlet !== 'all') {
        if (tOutlet) {
          if (tOutlet !== selectedOutlet) return false;
        } else {
          // Fallback to active store or primary store
          const fallbackId = storeSettings.activeStoreId || outlets[0]?.id || 'store-1';
          if (selectedOutlet !== fallbackId) return false;
        }
      }

      // Check search query if present
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchReceipt = t.receiptNumber?.toLowerCase().includes(q);
        const matchCustomer = t.customerName?.toLowerCase().includes(q);
        const matchStaff = t.staffName?.toLowerCase().includes(q);
        const matchRemarks = t.remarks?.toLowerCase().includes(q);
        if (!matchReceipt && !matchCustomer && !matchStaff && !matchRemarks) {
          return false;
        }
      }

      return true;
    });
  }, [effectiveTransactions, fromDate, toDate, selectedOutlet, searchQuery, storeSettings.activeStoreId, outlets]);

  // Aggregated KPIs across the filtered range
  const kpis = useMemo(() => {
    let grossSales = 0;
    let salesCount = 0;
    let totalExpenses = 0;
    let expenseCount = 0;
    let cashSales = 0;
    let upiSales = 0;
    let udhaarSales = 0;

    for (const t of filteredData) {
      const amt = Number(t.amount) || 0;
      if (t.type === 'sale') {
        grossSales += amt;
        salesCount++;
        if (t.paymentMode === 'cash') cashSales += amt;
        else if (t.paymentMode === 'online_upi') upiSales += amt;
        else if (t.paymentMode === 'credit_udhaar') udhaarSales += amt;
      } else if (t.type === 'expense') {
        totalExpenses += amt;
        expenseCount++;
      }
    }

    const netProfit = grossSales - totalExpenses;
    const avgBillValue = salesCount > 0 ? grossSales / salesCount : 0;

    // Filter pending udhaar from customers
    const relevantCustomers = customers.filter((c) => {
      if (selectedOutlet === 'all') return true;
      const cOutlet = c.outletId || c.storeId;
      return cOutlet ? cOutlet === selectedOutlet : (selectedOutlet === (storeSettings.activeStoreId || 'store-1') || selectedOutlet === outlets[0]?.id);
    });
    const totalPendingUdhaar = relevantCustomers.reduce((sum, c) => sum + (Number(c.totalDue) || 0), 0);

    return {
      grossSales,
      salesCount,
      totalExpenses,
      expenseCount,
      netProfit,
      cashSales,
      upiSales,
      udhaarSales,
      avgBillValue,
      totalPendingUdhaar,
    };
  }, [filteredData, customers, selectedOutlet, storeSettings.activeStoreId, outlets]);

  // Per-Outlet Breakdown for the selected Date Range
  const perOutletBreakdown = useMemo(() => {
    return outlets.map((outlet) => {
      const outletTxs = filteredData.filter((t) => {
        const tOutlet = t.outletId || t.storeId;
        return tOutlet ? tOutlet === outlet.id : (outlet.isPrimary || outlet.id === outlets[0]?.id);
      });

      const salesTxs = outletTxs.filter((t) => t.type === 'sale');
      const expenseTxs = outletTxs.filter((t) => t.type === 'expense');

      const grossSales = salesTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const expenses = expenseTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const cash = salesTxs.filter((t) => t.paymentMode === 'cash').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const upi = salesTxs.filter((t) => t.paymentMode === 'online_upi').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const udhaar = salesTxs.filter((t) => t.paymentMode === 'credit_udhaar').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

      const outletCusts = customers.filter((c) => {
        const cOutlet = c.outletId || c.storeId;
        return cOutlet ? cOutlet === outlet.id : (outlet.isPrimary || outlet.id === outlets[0]?.id);
      });
      const pendingUdhaar = outletCusts.reduce((sum, c) => sum + (Number(c.totalDue) || 0), 0);

      return {
        outlet,
        grossSales,
        salesCount: salesTxs.length,
        expenses,
        expenseCount: expenseTxs.length,
        cash,
        upi,
        udhaar,
        netProfit: grossSales - expenses,
        cashInHand: cash - expenses,
        pendingUdhaar,
        customerCount: outletCusts.length,
        txCount: outletTxs.length,
      };
    });
  }, [outlets, filteredData, customers]);

  // Day-by-day aggregated report table
  const dailyBreakdown = useMemo(() => {
    const dayMap = new Map<
      string,
      {
        date: string;
        dayName: string;
        grossSales: number;
        salesCount: number;
        expenses: number;
        cash: number;
        upi: number;
        udhaar: number;
        net: number;
        outletBreakdown: Record<string, { sales: number; bills: number; expenses: number; cash: number }>;
      }
    >();

    for (const t of filteredData) {
      const date = t.timestamp.slice(0, 10);
      if (!dayMap.has(date)) {
        const dObj = new Date(t.timestamp);
        const dayName = dObj.toLocaleDateString('en-IN', { weekday: 'short' });
        dayMap.set(date, {
          date,
          dayName,
          grossSales: 0,
          salesCount: 0,
          expenses: 0,
          cash: 0,
          upi: 0,
          udhaar: 0,
          net: 0,
          outletBreakdown: {},
        });
      }

      const item = dayMap.get(date)!;
      const amt = Number(t.amount) || 0;
      const tOutlet = t.outletId || t.storeId || outlets[0]?.id || 'store-1';

      if (!item.outletBreakdown[tOutlet]) {
        item.outletBreakdown[tOutlet] = { sales: 0, bills: 0, expenses: 0, cash: 0 };
      }

      if (t.type === 'sale') {
        item.grossSales += amt;
        item.salesCount++;
        item.outletBreakdown[tOutlet].sales += amt;
        item.outletBreakdown[tOutlet].bills++;

        if (t.paymentMode === 'cash') {
          item.cash += amt;
          item.outletBreakdown[tOutlet].cash += amt;
        } else if (t.paymentMode === 'online_upi') {
          item.upi += amt;
        } else if (t.paymentMode === 'credit_udhaar') {
          item.udhaar += amt;
        }
      } else if (t.type === 'expense') {
        item.expenses += amt;
        item.outletBreakdown[tOutlet].expenses += amt;
      }

      item.net = item.grossSales - item.expenses;
    }

    return Array.from(dayMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredData, outlets]);

  // Thermal Print Report Slip
  const handlePrintDateWiseReport = async () => {
    setIsPrinting(true);
    setStatusMsg('Printing Date-Wise Report slip...');

    const outletName =
      selectedOutlet === 'all'
        ? 'All Branches (Combined)'
        : outlets.find((o) => o.id === selectedOutlet)?.shopName || selectedOutlet;

    const receiptData: ThermalReceiptData = {
      shopName: storeSettings.shopName || 'Nayab Kirana & Spices',
      address: storeSettings.address || '',
      phone: storeSettings.phone || '',
      gstin: storeSettings.gstin,
      receiptNumber: `DATE-REP-${Date.now().toString().slice(-5)}`,
      date: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
      cashierName: `Range: ${fromDate} to ${toDate}`,
      customerName: `Branch: ${outletName}`,
      items: [
        {
          id: '1',
          name: `Total Sales (${kpis.salesCount} bills)`,
          quantity: kpis.salesCount,
          unit: 'bills',
          rate: kpis.grossSales,
          total: kpis.grossSales,
        },
        {
          id: '2',
          name: 'Cash Collection',
          quantity: 1,
          unit: 'cash',
          rate: kpis.cashSales,
          total: kpis.cashSales,
        },
        {
          id: '3',
          name: 'UPI Online Payments',
          quantity: 1,
          unit: 'upi',
          rate: kpis.upiSales,
          total: kpis.upiSales,
        },
        {
          id: '4',
          name: 'Udhaar Credit Given',
          quantity: 1,
          unit: 'khata',
          rate: kpis.udhaarSales,
          total: kpis.udhaarSales,
        },
        {
          id: '5',
          name: `Store Expenses (${kpis.expenseCount} entries)`,
          quantity: 1,
          unit: 'exp',
          rate: kpis.totalExpenses,
          total: kpis.totalExpenses,
        },
      ],
      subtotal: kpis.grossSales,
      taxAmount: 0,
      taxRate: 0,
      grandTotal: kpis.netProfit,
      paymentMode: 'report',
      upiId: storeSettings.upiId,
    };

    const res = await printReceipt(receiptData, storeSettings);
    if (res.success) {
      setStatusMsg('Date-wise report slip printed successfully!');
    } else {
      setStatusMsg(res.error || 'Failed to print report slip.');
    }
    setIsPrinting(false);
    setTimeout(() => setStatusMsg(''), 4000);
  };

  // Export Date-wise breakdown to CSV
  const handleExportCsv = () => {
    let csv = `Nayab Kirana & Spices - Date-Wise Report (${fromDate} to ${toDate})\n`;
    csv += `Branch: ${selectedOutlet === 'all' ? 'All Branches' : outlets.find((o) => o.id === selectedOutlet)?.shopName || selectedOutlet}\n\n`;

    // Summary section
    csv += 'Summary Metric,Value\n';
    csv += `Gross Sales,₹${kpis.grossSales.toFixed(2)}\n`;
    csv += `Total Bills,${kpis.salesCount}\n`;
    csv += `Total Expenses,₹${kpis.totalExpenses.toFixed(2)}\n`;
    csv += `Net Profit / In-Hand,₹${kpis.netProfit.toFixed(2)}\n`;
    csv += `Cash Collection,₹${kpis.cashSales.toFixed(2)}\n`;
    csv += `UPI Online,₹${kpis.upiSales.toFixed(2)}\n`;
    csv += `Udhaar Given,₹${kpis.udhaarSales.toFixed(2)}\n`;
    csv += `Pending Market Udhaar,₹${kpis.totalPendingUdhaar.toFixed(2)}\n\n`;

    // Day-by-Day Table
    csv += 'Date,Day,Gross Sales (Rs),Bills,Expenses (Rs),Cash (Rs),UPI (Rs),Udhaar (Rs),Net Profit (Rs)\n';
    dailyBreakdown.forEach((row) => {
      csv += `"${row.date}","${row.dayName}",${row.grossSales.toFixed(2)},${row.salesCount},${row.expenses.toFixed(2)},${row.cash.toFixed(2)},${row.upi.toFixed(2)},${row.udhaar.toFixed(2)},${row.net.toFixed(2)}\n`;
    });

    csv += '\nDetailed Transactions:\n';
    csv += 'Receipt,Date Time,Branch,Type,Amount,Payment Mode,Cashier,Customer / Party,Remarks\n';
    filteredData.forEach((t) => {
      const bName = outlets.find((o) => o.id === (t.outletId || t.storeId))?.shopName || 'Main Store';
      csv += `"${t.receiptNumber}","${new Date(t.timestamp).toLocaleString()}","${bName}","${t.type}",${t.amount},"${t.paymentMode}","${t.staffName || ''}","${t.customerName || ''}","${t.remarks || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nayab-date-report-${fromDate}-to-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Top Filter Bar: Date Range Pickers, Quick Ranges & Outlet Selector */}
      <div className="bg-slate-850/90 border border-slate-700/80 rounded-2xl p-4 space-y-3.5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm flex items-center gap-2">
                <span>Date-Wise Filter & Branch Comparison</span>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono">
                  BOTH BRANCHES
                </span>
              </h4>
              <p className="text-slate-400 text-xs">
                Select custom From–To date range with complete safe-merge history
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow cursor-pointer active:scale-95"
              title="Export date-wise report to Excel CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>

            <button
              type="button"
              onClick={handlePrintDateWiseReport}
              disabled={isPrinting}
              className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-650 text-white border border-slate-600 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Print thermal report slip"
            >
              <Printer className="w-3.5 h-3.5 text-cyan-400" />
              <span>Print Slip</span>
            </button>
          </div>
        </div>

        {statusMsg && (
          <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-700 text-cyan-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Quick Range Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-semibold text-[11px] whitespace-nowrap mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3 text-amber-400" /> Quick:
          </span>
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'last7', label: 'Last 7 Days' },
            { id: 'last30', label: 'Last 30 Days' },
            { id: 'thisMonth', label: 'This Month' },
            { id: 'lastMonth', label: 'Last Month' },
            { id: 'thisYear', label: 'This Year' },
            { id: 'all', label: 'All-Time' },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => handleSelectQuickRange(pill.id as QuickRange)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                quickRange === pill.id
                  ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-400'
                  : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Date Inputs & Branch Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {/* From Date */}
          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
            <span className="text-slate-400 text-xs font-bold whitespace-nowrap">From Date:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setQuickRange('all');
              }}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-amber-400 cursor-pointer"
            />
          </div>

          {/* To Date */}
          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
            <span className="text-slate-400 text-xs font-bold whitespace-nowrap">To Date:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setQuickRange('all');
              }}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-amber-400 cursor-pointer"
            />
          </div>

          {/* Branch Filter */}
          <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
            <span className="text-slate-400 text-xs font-bold whitespace-nowrap flex items-center gap-1">
              <Store className="w-3.5 h-3.5 text-amber-400" /> Branch:
            </span>
            <select
              value={selectedOutlet}
              onChange={(e) => setSelectedOutlet(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-semibold focus:outline-none focus:border-amber-400 cursor-pointer w-full max-w-[180px]"
            >
              <option value="all">Both Branches (Combined)</option>
              {outlets.map((out, idx) => (
                <option key={out.id} value={out.id}>
                  #{idx + 1} {out.shopName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Gross Sales */}
        <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 to-emerald-950/20 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">Gross Sales</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">
            ₹{kpis.grossSales.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            {kpis.salesCount} bills in range
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-rose-500/30 bg-gradient-to-br from-slate-900 to-rose-950/20 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">Expenses</span>
            <TrendingDown className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-400">
            ₹{kpis.totalExpenses.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            {kpis.expenseCount} entries recorded
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-sky-500/30 bg-gradient-to-br from-slate-900 to-sky-950/20 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">Net Balance</span>
            <Wallet className="w-4 h-4 text-sky-400" />
          </div>
          <div className={`text-xl font-bold font-mono ${kpis.netProfit >= 0 ? 'text-sky-400' : 'text-rose-400'}`}>
            ₹{kpis.netProfit.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Avg Bill: ₹{kpis.avgBillValue.toFixed(0)}
          </div>
        </div>

        {/* Pending Udhaar */}
        <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-slate-900 to-amber-950/20 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">Market Udhaar</span>
            <IndianRupee className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-400">
            ₹{kpis.totalPendingUdhaar.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Receivables from customers
          </div>
        </div>
      </div>

      {/* Side-by-Side Branch Comparison (sy Nayab vs kp Nayab) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-amber-400" />
            <h5 className="font-bold text-white text-xs uppercase tracking-wider">
              Branch Side-by-Side Comparison ({fromDate} to {toDate})
            </h5>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            {outlets.length} active branches
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {perOutletBreakdown.map((item, idx) => {
            const totalAllSales = perOutletBreakdown.reduce((sum, o) => sum + o.grossSales, 0);
            const sharePercent = totalAllSales > 0 ? Math.round((item.grossSales / totalAllSales) * 100) : 0;
            const isSelected = selectedOutlet === item.outlet.id;

            return (
              <div
                key={item.outlet.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-slate-850 border-amber-500 ring-1 ring-amber-500'
                    : 'bg-slate-950/70 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-xs flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <h6 className="font-bold text-white text-sm">{item.outlet.shopName}</h6>
                      {item.outlet.address && (
                        <p className="text-[10px] text-slate-400">{item.outlet.address}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {item.outlet.isPrimary && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold">
                        Main Branch
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedOutlet(selectedOutlet === item.outlet.id ? 'all' : item.outlet.id)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      {isSelected ? 'Filtered' : 'Filter Branch'}
                    </button>
                  </div>
                </div>

                {/* Metrics 3-box */}
                <div className="grid grid-cols-3 gap-2 p-2 bg-slate-900 rounded-lg border border-slate-800 text-center mb-2.5">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Sales</span>
                    <span className="text-sm font-bold font-mono text-emerald-400">
                      ₹{item.grossSales.toFixed(0)}
                    </span>
                    <span className="text-[10px] text-slate-500 block">{item.salesCount} bills</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Expenses</span>
                    <span className="text-sm font-bold font-mono text-rose-400">
                      ₹{item.expenses.toFixed(0)}
                    </span>
                    <span className="text-[10px] text-slate-500 block">{item.expenseCount} entries</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">In-Hand Cash</span>
                    <span className={`text-sm font-bold font-mono ${item.cashInHand >= 0 ? 'text-sky-400' : 'text-rose-400'}`}>
                      ₹{item.cashInHand.toFixed(0)}
                    </span>
                    <span className="text-[10px] text-slate-500 block">Cash - Exp</span>
                  </div>
                </div>

                {/* Collection Breakdown */}
                <div className="grid grid-cols-3 gap-1.5 text-[11px] mb-2.5">
                  <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">Cash:</span>
                    <span className="font-mono font-bold text-emerald-300">₹{item.cash.toFixed(1)}</span>
                  </div>
                  <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">UPI:</span>
                    <span className="font-mono font-bold text-cyan-300">₹{item.upi.toFixed(1)}</span>
                  </div>
                  <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">Udhaar:</span>
                    <span className="font-mono font-bold text-amber-300">₹{item.udhaar.toFixed(1)}</span>
                  </div>
                </div>

                {/* Market credit due */}
                <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-800 text-slate-300">
                  <span className="text-slate-400 text-[11px]">Branch Market Udhaar:</span>
                  <span className="font-mono font-bold text-amber-400">₹{item.pendingUdhaar.toFixed(2)}</span>
                </div>

                {/* Business Share */}
                {totalAllSales > 0 && (
                  <div className="mt-2 pt-1.5 border-t border-slate-800/80">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>Volume Share</span>
                      <span className="font-bold text-white">{sharePercent}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${sharePercent}%` }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sub Tabs: Daily Aggregate vs Full Transactions */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('summary')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'summary'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Payment Breakdown & Summary</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('daily')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'daily'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <CalendarIcon className="w-3.5 h-3.5" />
          <span>Day-by-Day Aggregate ({dailyBreakdown.length} days)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('transactions')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'transactions'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Detailed Bills Log ({filteredData.length})</span>
        </button>
      </div>

      {/* Tab 1: Payment Breakdown Summary */}
      {activeTab === 'summary' && (
        <div className="space-y-3">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h5 className="font-bold text-white text-xs uppercase tracking-wider">
              Payment Channels Distribution ({fromDate} to {toDate})
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                <div>
                  <div className="text-slate-400 text-xs">Cash Collection:</div>
                  <div className="text-lg font-bold font-mono text-emerald-400">
                    ₹{kpis.cashSales.toFixed(2)}
                  </div>
                </div>
                <span className="text-[11px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded">
                  {kpis.grossSales > 0 ? Math.round((kpis.cashSales / kpis.grossSales) * 100) : 0}%
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                <div>
                  <div className="text-slate-400 text-xs">UPI Online Payments:</div>
                  <div className="text-lg font-bold font-mono text-cyan-400">
                    ₹{kpis.upiSales.toFixed(2)}
                  </div>
                </div>
                <span className="text-[11px] bg-cyan-500/20 text-cyan-300 font-bold px-2 py-0.5 rounded">
                  {kpis.grossSales > 0 ? Math.round((kpis.upiSales / kpis.grossSales) * 100) : 0}%
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                <div>
                  <div className="text-slate-400 text-xs">Credit Khata (Udhaar):</div>
                  <div className="text-lg font-bold font-mono text-amber-400">
                    ₹{kpis.udhaarSales.toFixed(2)}
                  </div>
                </div>
                <span className="text-[11px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded">
                  {kpis.grossSales > 0 ? Math.round((kpis.udhaarSales / kpis.grossSales) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Day-by-Day Aggregate Breakdown Table */}
      {activeTab === 'daily' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
            <h5 className="font-bold text-white text-xs uppercase tracking-wider">
              Day-by-Day Financial Breakdown ({dailyBreakdown.length} active dates)
            </h5>
            <span className="text-[11px] text-slate-400">
              Safe-merged historical totals
            </span>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-950 text-slate-400 sticky top-0 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-2.5 font-semibold">Date & Day</th>
                  <th className="p-2.5 font-semibold text-right">Gross Sales</th>
                  <th className="p-2.5 font-semibold text-center">Bills</th>
                  <th className="p-2.5 font-semibold text-right">Expenses</th>
                  <th className="p-2.5 font-semibold text-right">Cash</th>
                  <th className="p-2.5 font-semibold text-right">UPI</th>
                  <th className="p-2.5 font-semibold text-right">Udhaar</th>
                  <th className="p-2.5 font-semibold text-right">Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {dailyBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400 font-sans">
                      No sales or expenses found in the selected date range ({fromDate} to {toDate}).
                    </td>
                  </tr>
                ) : (
                  dailyBreakdown.map((row) => (
                    <tr key={row.date} className="hover:bg-slate-850 transition-colors">
                      <td className="p-2.5 font-sans font-bold text-white whitespace-nowrap">
                        <span>{row.date}</span>
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                          {row.dayName}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-bold text-emerald-400">
                        ₹{row.grossSales.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-center text-slate-300">
                        {row.salesCount}
                      </td>
                      <td className="p-2.5 text-right font-semibold text-rose-400">
                        ₹{row.expenses.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right text-emerald-300">
                        ₹{row.cash.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right text-cyan-300">
                        ₹{row.upi.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right text-amber-300">
                        ₹{row.udhaar.toFixed(2)}
                      </td>
                      <td className={`p-2.5 text-right font-bold ${row.net >= 0 ? 'text-sky-400' : 'text-rose-400'}`}>
                        ₹{row.net.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Detailed Transactions Log */}
      {activeTab === 'transactions' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-3 p-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search bills by receipt #, customer name, cashier or remarks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
            <span className="text-[11px] text-slate-400 font-semibold self-center whitespace-nowrap">
              Showing {filteredData.length} records
            </span>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-950 text-slate-400 sticky top-0 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-2 font-semibold">Receipt</th>
                  <th className="p-2 font-semibold">Date & Time</th>
                  <th className="p-2 font-semibold">Branch</th>
                  <th className="p-2 font-semibold">Type</th>
                  <th className="p-2 font-semibold">Mode</th>
                  <th className="p-2 font-semibold">Party / Cashier</th>
                  <th className="p-2 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-slate-400 font-sans">
                      No matching records found.
                    </td>
                  </tr>
                ) : (
                  filteredData.slice(0, 150).map((t) => {
                    const bName =
                      outlets.find((o) => o.id === (t.outletId || t.storeId))?.shopName || 'Main Store';
                    return (
                      <tr key={t.id} className="hover:bg-slate-850 transition-colors">
                        <td className="p-2 font-bold text-white whitespace-nowrap font-sans">
                          {t.receiptNumber}
                        </td>
                        <td className="p-2 text-slate-400 text-[11px] whitespace-nowrap">
                          {new Date(t.timestamp).toLocaleString('en-IN', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="p-2 text-slate-300 font-sans text-[11px] whitespace-nowrap">
                          {bName}
                        </td>
                        <td className="p-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase font-sans ${
                              t.type === 'sale'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {t.type}
                          </span>
                        </td>
                        <td className="p-2 text-slate-300 text-[11px] font-sans">
                          {t.paymentMode === 'cash'
                            ? 'Cash'
                            : t.paymentMode === 'online_upi'
                            ? 'UPI QR'
                            : 'Udhaar'}
                        </td>
                        <td className="p-2 text-slate-300 font-sans text-[11px] truncate max-w-[140px]">
                          {t.customerName || t.staffName || 'Counter'}
                        </td>
                        <td
                          className={`p-2 text-right font-bold ${
                            t.type === 'sale' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          ₹{t.amount.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
