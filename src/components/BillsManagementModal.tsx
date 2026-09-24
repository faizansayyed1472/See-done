import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Receipt,
  Search,
  Filter,
  SlidersHorizontal,
  ArrowUpDown,
  Edit3,
  Printer,
  Trash2,
  Calendar,
  Clock,
  IndianRupee,
  CreditCard,
  Wallet,
  BookOpen,
  ArrowDownRight,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  User,
  Phone,
  Tag,
  FileText,
  QrCode,
  ShoppingBag,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Lock,
} from 'lucide-react';
import { Transaction, CustomerUdhaar, StoreSettings, PaymentMode } from '../types';
import { playKeySound, triggerHapticFeedback } from '../utils/audio';
import { printReceipt } from '../utils/printer';

interface BillsManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  customers?: CustomerUdhaar[];
  storeSettings: StoreSettings;
  onUpdateTransaction: (updated: Transaction, original?: Transaction) => void;
  onDeleteTransaction: (transactionId: string) => void;
  onPrintTransactionReceipt?: (transaction: Transaction) => void;
  isOwner?: boolean;
  initialTab?: BillFilterTab;
}

type BillFilterTab = 'all' | 'sale' | 'online' | 'cash' | 'udhaar' | 'expense';
type SearchScope = 'all' | 'name' | 'item' | 'amount' | 'receipt';
type AmountRangePreset = 'all' | 'under100' | '100to500' | '500to2000' | 'above2000' | 'custom';
type SortOption = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc';

export const BillsManagementModal: React.FC<BillsManagementModalProps> = ({
  isOpen,
  onClose,
  transactions,
  customers = [],
  storeSettings,
  onUpdateTransaction,
  onDeleteTransaction,
  onPrintTransactionReceipt,
  isOwner = true,
  initialTab = 'all',
}) => {
  const [activeTab, setActiveTab] = useState<BillFilterTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('all');
  const [paymentModeFilter, setPaymentModeFilter] = useState<'all' | 'online_upi' | 'cash' | 'credit_udhaar'>('all');
  const [amountRangePreset, setAmountRangePreset] = useState<AmountRangePreset>('all');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [itemNameFilter, setItemNameFilter] = useState<string>('');
  const [customerNameFilter, setCustomerNameFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Sync initialTab when modal opens or initialTab changes
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Edit form state
  const [editAmount, setEditAmount] = useState<string>('');
  const [editPaymentMode, setEditPaymentMode] = useState<PaymentMode>('cash');
  const [editCustomerName, setEditCustomerName] = useState<string>('');
  const [editCustomerPhone, setEditCustomerPhone] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editSuccessMsg, setEditSuccessMsg] = useState<string>('');

  // Delete & Print modal states
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [transactionToPrint, setTransactionToPrint] = useState<Transaction | null>(null);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState<string>('');
  const [printStatusMsg, setPrintStatusMsg] = useState<string>('');

  // Outlet filter state (defaults to and stays reactive with active counter outlet)
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>(() => storeSettings.activeStoreId || 'all');

  useEffect(() => {
    if (storeSettings?.activeStoreId) {
      setSelectedOutletFilter(storeSettings.activeStoreId);
    }
  }, [storeSettings?.activeStoreId, isOpen]);

  // Check if any custom filter is active
  const hasActiveCustomFilters = useMemo(() => {
    return (
      searchQuery.trim() !== '' ||
      searchScope !== 'all' ||
      paymentModeFilter !== 'all' ||
      amountRangePreset !== 'all' ||
      minAmount.trim() !== '' ||
      maxAmount.trim() !== '' ||
      itemNameFilter.trim() !== '' ||
      customerNameFilter.trim() !== '' ||
      sortBy !== 'newest'
    );
  }, [
    searchQuery,
    searchScope,
    paymentModeFilter,
    amountRangePreset,
    minAmount,
    maxAmount,
    itemNameFilter,
    customerNameFilter,
    sortBy,
  ]);

  const handleResetAllFilters = () => {
    setSearchQuery('');
    setSearchScope('all');
    setPaymentModeFilter('all');
    setAmountRangePreset('all');
    setMinAmount('');
    setMaxAmount('');
    setItemNameFilter('');
    setCustomerNameFilter('');
    setSortBy('newest');
  };

  // Filtered transactions calculation
  const filteredList = useMemo(() => {
    const list = transactions.filter((t) => {
      // 0. Outlet match
      if (selectedOutletFilter !== 'all') {
        const matchOutlet = t.outletId || t.storeId;
        if (matchOutlet) {
          if (matchOutlet !== selectedOutletFilter) return false;
        } else {
          if (selectedOutletFilter !== 'store-1') return false;
        }
      }

      // 1. Tab match
      if (activeTab === 'sale' && t.type !== 'sale') return false;
      if (activeTab === 'online' && (t.type !== 'sale' || t.paymentMode !== 'online_upi')) return false;
      if (activeTab === 'cash' && (t.type !== 'sale' || t.paymentMode !== 'cash')) return false;
      if (activeTab === 'udhaar' && (t.type !== 'sale' || t.paymentMode !== 'credit_udhaar')) return false;
      if (activeTab === 'expense' && t.type !== 'expense') return false;

      // 2. Specific Payment Mode Filter (if applied on top of tab)
      if (paymentModeFilter !== 'all') {
        if (t.paymentMode !== paymentModeFilter) return false;
      }

      // 3. Amount Range Presets
      if (amountRangePreset === 'under100' && t.amount >= 100) return false;
      if (amountRangePreset === '100to500' && (t.amount < 100 || t.amount > 500)) return false;
      if (amountRangePreset === '500to2000' && (t.amount < 500 || t.amount > 2000)) return false;
      if (amountRangePreset === 'above2000' && t.amount <= 2000) return false;

      // 4. Custom Min/Max Amount
      if (minAmount.trim() !== '') {
        const minVal = parseFloat(minAmount);
        if (!isNaN(minVal) && t.amount < minVal) return false;
      }
      if (maxAmount.trim() !== '') {
        const maxVal = parseFloat(maxAmount);
        if (!isNaN(maxVal) && t.amount > maxVal) return false;
      }

      // 5. Dedicated Customer Name Filter
      if (customerNameFilter.trim() !== '') {
        const cQuery = customerNameFilter.toLowerCase().trim();
        const custMatches =
          (t.customerName || '').toLowerCase().includes(cQuery) ||
          (t.customerPhone || '').includes(cQuery) ||
          (t.staffName || '').toLowerCase().includes(cQuery);
        if (!custMatches) return false;
      }

      // 6. Dedicated Item Name Filter
      if (itemNameFilter.trim() !== '') {
        const iQuery = itemNameFilter.toLowerCase().trim();
        const hasMatchingItem = (t.items || []).some(
          (item) =>
            item.name.toLowerCase().includes(iQuery) ||
            (item.hindiName && item.hindiName.toLowerCase().includes(iQuery))
        );
        if (!hasMatchingItem) return false;
      }

      // 7. General / Scoped Search Query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();

        if (searchScope === 'name') {
          return (
            (t.customerName || '').toLowerCase().includes(q) ||
            (t.customerPhone || '').includes(q) ||
            (t.staffName || '').toLowerCase().includes(q)
          );
        }

        if (searchScope === 'item') {
          return (t.items || []).some(
            (item) =>
              item.name.toLowerCase().includes(q) ||
              (item.hindiName && item.hindiName.toLowerCase().includes(q))
          );
        }

        if (searchScope === 'amount') {
          const parsed = parseFloat(q);
          if (!isNaN(parsed)) {
            return Math.abs(t.amount - parsed) < 0.01 || t.amount.toString().includes(q);
          }
          return t.amount.toString().includes(q);
        }

        if (searchScope === 'receipt') {
          return (t.receiptNumber || '').toLowerCase().includes(q);
        }

        // 'all' scope matches any field
        const rcptMatch = (t.receiptNumber || '').toLowerCase().includes(q);
        const custMatch =
          (t.customerName || '').toLowerCase().includes(q) ||
          (t.customerPhone || '').includes(q);
        const staffMatch = (t.staffName || '').toLowerCase().includes(q);
        const noteMatch = (t.notes || '').toLowerCase().includes(q);
        const modeMatch = (t.paymentMode || '').toLowerCase().includes(q);
        const amtMatch = t.amount.toString().includes(q);
        const itemMatch = (t.items || []).some(
          (item) =>
            item.name.toLowerCase().includes(q) ||
            (item.hindiName && item.hindiName.toLowerCase().includes(q))
        );

        return rcptMatch || custMatch || staffMatch || noteMatch || modeMatch || amtMatch || itemMatch;
      }

      return true;
    });

    // Sorting
    return list.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      }
      if (sortBy === 'amount_desc') {
        return b.amount - a.amount;
      }
      if (sortBy === 'amount_asc') {
        return a.amount - b.amount;
      }
      return 0;
    });
  }, [
    transactions,
    activeTab,
    paymentModeFilter,
    amountRangePreset,
    minAmount,
    maxAmount,
    customerNameFilter,
    itemNameFilter,
    searchQuery,
    searchScope,
    sortBy,
  ]);

  // Tab counters and totals
  const stats = useMemo(() => {
    const saleList = transactions.filter((t) => t.type === 'sale');
    const onlineList = saleList.filter((t) => t.paymentMode === 'online_upi');
    const cashList = saleList.filter((t) => t.paymentMode === 'cash');
    const udhaarList = saleList.filter((t) => t.paymentMode === 'credit_udhaar');
    const expenseList = transactions.filter((t) => t.type === 'expense');

    return {
      allCount: transactions.length,
      saleCount: saleList.length,
      saleTotal: saleList.reduce((acc, t) => acc + t.amount, 0),
      onlineCount: onlineList.length,
      onlineTotal: onlineList.reduce((acc, t) => acc + t.amount, 0),
      cashCount: cashList.length,
      cashTotal: cashList.reduce((acc, t) => acc + t.amount, 0),
      udhaarCount: udhaarList.length,
      udhaarTotal: udhaarList.reduce((acc, t) => acc + t.amount, 0),
      expenseCount: expenseList.length,
      expenseTotal: expenseList.reduce((acc, t) => acc + t.amount, 0),
    };
  }, [transactions]);

  const handleOpenEdit = (t: Transaction) => {
    playKeySound('action');
    setEditingTransaction(t);
    setEditAmount(String(t.amount));
    setEditPaymentMode(t.paymentMode);
    setEditCustomerName(t.customerName || '');
    setEditCustomerPhone(t.customerPhone || '');
    setEditNotes(t.notes || '');
    setEditSuccessMsg('');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;

    const parsedAmt = parseFloat(editAmount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      alert('Please enter a valid amount greater than 0.');
      return;
    }

    const updated: Transaction = {
      ...editingTransaction,
      amount: parsedAmt,
      paymentMode: editPaymentMode,
      customerName: editCustomerName.trim() || undefined,
      customerPhone: editCustomerPhone.trim() || undefined,
      notes: editNotes.trim() || undefined,
    };

    onUpdateTransaction(updated, editingTransaction);
    setEditSuccessMsg(`Bill #${updated.receiptNumber} updated successfully!`);
    playKeySound('bill');
    setTimeout(() => {
      setEditSuccessMsg('');
      setEditingTransaction(null);
    }, 1200);
  };

  const handleOpenDeleteConfirm = (t: Transaction) => {
    triggerHapticFeedback(30);
    playKeySound('clear');
    setTransactionToDelete(t);
  };

  const handleConfirmDelete = () => {
    if (!transactionToDelete) return;
    triggerHapticFeedback([40, 50, 70]);
    playKeySound('clear');
    const targetId = transactionToDelete.id;
    const rcptNo = transactionToDelete.receiptNumber;
    onDeleteTransaction(targetId);
    setTransactionToDelete(null);
    if (editingTransaction?.id === targetId) {
      setEditingTransaction(null);
    }
    setDeleteSuccessMsg(`Bill #${rcptNo} deleted successfully.`);
    setTimeout(() => setDeleteSuccessMsg(''), 3500);
  };

  const handleOpenPrintDialog = (t: Transaction) => {
    triggerHapticFeedback(20);
    playKeySound('action');
    setTransactionToPrint(t);
  };

  const handleExecutePrint = async (t: Transaction, withQr: boolean) => {
    triggerHapticFeedback(25);
    playKeySound('action');
    setPrintStatusMsg(
      withQr
        ? `Sending Bill #${t.receiptNumber} (with UPI QR) to printer...`
        : `Sending Bill #${t.receiptNumber} (without QR) to printer...`
    );

    const res = await printReceipt(
      {
        shopName: storeSettings.shopName || 'NAYAB POS',
        address: storeSettings.address || '',
        phone: storeSettings.phone || '',
        gstin: storeSettings.gstin,
        receiptNumber: t.receiptNumber,
        date: new Date(t.timestamp).toLocaleString('en-IN'),
        cashierName: t.staffName || 'Staff',
        customerName: t.customerName,
        items: t.items || [],
        subtotal: t.baseAmount || t.amount,
        taxAmount: t.taxAmount || 0,
        taxRate: t.taxRate || 0,
        grandTotal: t.amount,
        paymentMode: t.paymentMode,
        upiId: storeSettings.upiId,
        printQrCodeOnSlip: withQr,
      },
      storeSettings
    );

    if (res.success) {
      setPrintStatusMsg(`Bill #${t.receiptNumber} printed successfully (${withQr ? 'with QR' : 'without QR'})!`);
    } else {
      setPrintStatusMsg(res.error || 'Print failed.');
    }
    setTimeout(() => setPrintStatusMsg(''), 4000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-5xl bg-gradient-to-b from-slate-900 via-slate-925 to-slate-950 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 font-bold">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">Owner Bills & Ledger Manager</h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
                  Owner Dashboard
                </span>
              </div>
              <p className="text-xs text-slate-400">
                View, search & edit Sale Bills, Cash, Online UPI, and Udhaar transactions
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Filters */}
        <div className="px-4 sm:px-5 pt-3 border-b border-slate-800/80 bg-slate-950/60 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 min-w-max pb-3">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-750'
              }`}
            >
              <span>All Records ({stats.allCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('sale')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'sale'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-750'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
              <span>Sale Bills ({stats.saleCount} • ₹{stats.saleTotal.toFixed(0)})</span>
            </button>

            <button
              onClick={() => setActiveTab('online')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'online'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-750'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-cyan-300" />
              <span>Online UPI Bills ({stats.onlineCount} • ₹{stats.onlineTotal.toFixed(0)})</span>
            </button>

            <button
              onClick={() => setActiveTab('cash')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'cash'
                  ? 'bg-emerald-700 text-white shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-750'
              }`}
            >
              <Wallet className="w-3.5 h-3.5 text-emerald-300" />
              <span>Cash Bills ({stats.cashCount} • ₹{stats.cashTotal.toFixed(0)})</span>
            </button>

            <button
              onClick={() => setActiveTab('udhaar')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'udhaar'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-750'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-300" />
              <span>Udhaar Bills ({stats.udhaarCount} • ₹{stats.udhaarTotal.toFixed(0)})</span>
            </button>

            <button
              onClick={() => setActiveTab('expense')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'expense'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-750'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5 text-rose-300" />
              <span>Expenses ({stats.expenseCount} • ₹{stats.expenseTotal.toFixed(0)})</span>
            </button>

            {/* Outlet Filter Switcher */}
            <div className="flex items-center gap-1.5 ml-auto pl-3 border-l border-slate-800">
              <span className="text-[11px] text-slate-400 font-bold whitespace-nowrap">Outlet:</span>
              <select
                value={selectedOutletFilter}
                onChange={(e) => setSelectedOutletFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 hover:border-amber-500/50 rounded-xl px-2.5 py-1 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="all">All Outlets</option>
                {(storeSettings.stores || [
                  { id: 'store-1', shopName: 'sy Nayab' },
                  { id: 'store-2', shopName: 'kp Nayab' },
                ]).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shopName} {s.id === storeSettings.activeStoreId ? '★ (Active)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Advanced Sale Bill Search & Filters Toolbar */}
        <div className="bg-slate-900 border-b border-slate-800 p-3 sm:px-5 sm:py-3.5 space-y-2.5">
          {/* Main Search Input & Scope Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Search Scope Dropdown */}
            <div className="flex items-center bg-slate-950 border border-slate-750 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 flex-shrink-0">
              <span className="text-slate-500 mr-1 hidden sm:inline">Search:</span>
              <select
                value={searchScope}
                onChange={(e) => setSearchScope(e.target.value as SearchScope)}
                className="bg-transparent text-emerald-400 font-semibold focus:outline-none cursor-pointer text-xs"
              >
                <option value="all" className="bg-slate-900 text-white">🔍 All Fields</option>
                <option value="name" className="bg-slate-900 text-white">👤 Customer Name</option>
                <option value="item" className="bg-slate-900 text-white">🛍️ Item / Spice</option>
                <option value="amount" className="bg-slate-900 text-white">₹ Bill Amount</option>
                <option value="receipt" className="bg-slate-900 text-white">🧾 Receipt #</option>
              </select>
            </div>

            {/* Keyword Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  searchScope === 'name'
                    ? 'Search by Customer Name or Phone...'
                    : searchScope === 'item'
                    ? 'Search by Item / Spice Name (e.g. Sugar, Haldi, Jeera)...'
                    : searchScope === 'amount'
                    ? 'Search by Amount (e.g. 250, 500, 1200)...'
                    : searchScope === 'receipt'
                    ? 'Search by Receipt No (e.g. NB-102)...'
                    : 'Search by Customer, Item name, Amount (₹), Receipt #, or Notes...'
                }
                className="w-full bg-slate-950 border border-slate-750 focus:border-emerald-500 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sort & Advanced Filters Toggle */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="flex items-center bg-slate-950 border border-slate-750 rounded-xl px-2 py-1.5 text-xs text-slate-300">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 mr-1" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer text-xs"
                >
                  <option value="newest" className="bg-slate-900 text-white">Newest First</option>
                  <option value="oldest" className="bg-slate-900 text-white">Oldest First</option>
                  <option value="amount_desc" className="bg-slate-900 text-white">₹ High to Low</option>
                  <option value="amount_asc" className="bg-slate-900 text-white">₹ Low to High</option>
                </select>
              </div>

              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer select-none ${
                  showAdvancedFilters || hasActiveCustomFilters
                    ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/50'
                    : 'bg-slate-950 text-slate-300 border-slate-750 hover:bg-slate-800'
                }`}
                title="Toggle More Filter Options (Custom Amount Range, Dedicated Item & Name)"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Filters</span>
                {showAdvancedFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Quick Filter Chips: Payment Mode & Amount Ranges */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs pt-1">
            {/* Filter by Online / Payment Mode */}
            <span className="text-[11px] text-slate-400 font-semibold mr-0.5">Mode:</span>
            <button
              onClick={() => setPaymentModeFilter('all')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                paymentModeFilter === 'all'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setPaymentModeFilter('online_upi')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                paymentModeFilter === 'online_upi'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'bg-slate-800/80 text-cyan-300 hover:bg-cyan-950/60'
              }`}
            >
              <CreditCard className="w-3 h-3" />
              <span>Online UPI</span>
            </button>
            <button
              onClick={() => setPaymentModeFilter('cash')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                paymentModeFilter === 'cash'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-800/80 text-emerald-300 hover:bg-emerald-950/60'
              }`}
            >
              <Wallet className="w-3 h-3" />
              <span>Cash</span>
            </button>
            <button
              onClick={() => setPaymentModeFilter('credit_udhaar')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                paymentModeFilter === 'credit_udhaar'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-800/80 text-amber-300 hover:bg-amber-950/60'
              }`}
            >
              <BookOpen className="w-3 h-3" />
              <span>Udhaar</span>
            </button>

            <span className="text-slate-600 mx-1">|</span>

            {/* Filter by Amount Presets */}
            <span className="text-[11px] text-slate-400 font-semibold mr-0.5">Amount:</span>
            <button
              onClick={() => {
                setAmountRangePreset('all');
                setMinAmount('');
                setMaxAmount('');
              }}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                amountRangePreset === 'all' && !minAmount && !maxAmount
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              Any
            </button>
            <button
              onClick={() => {
                setAmountRangePreset('under100');
                setMinAmount('');
                setMaxAmount('');
              }}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                amountRangePreset === 'under100'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white'
              }`}
            >
              &lt; ₹100
            </button>
            <button
              onClick={() => {
                setAmountRangePreset('100to500');
                setMinAmount('');
                setMaxAmount('');
              }}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                amountRangePreset === '100to500'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white'
              }`}
            >
              ₹100 - ₹500
            </button>
            <button
              onClick={() => {
                setAmountRangePreset('500to2000');
                setMinAmount('');
                setMaxAmount('');
              }}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                amountRangePreset === '500to2000'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white'
              }`}
            >
              ₹500 - ₹2k
            </button>
            <button
              onClick={() => {
                setAmountRangePreset('above2000');
                setMinAmount('');
                setMaxAmount('');
              }}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                amountRangePreset === 'above2000'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white'
              }`}
            >
              ₹2,000+
            </button>
            <button
              onClick={() => {
                setShowAdvancedFilters(true);
                setAmountRangePreset('custom');
              }}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                amountRangePreset === 'custom' || minAmount || maxAmount
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-800/80 text-amber-400 hover:text-white'
              }`}
            >
              Custom ₹ Range...
            </button>
          </div>

          {/* Advanced Drawer: Custom Min/Max Amount, Dedicated Item & Name Inputs */}
          {showAdvancedFilters && (
            <div className="mt-2 pt-2.5 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-950/60 p-3 rounded-2xl animate-in fade-in">
              {/* Custom Min / Max Amount */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-1">
                  <IndianRupee className="w-3 h-3 text-emerald-400" />
                  <span>Amount Range (Min - Max):</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    placeholder="Min ₹"
                    value={minAmount}
                    onChange={(e) => {
                      setMinAmount(e.target.value);
                      setAmountRangePreset('custom');
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 font-mono"
                  />
                  <span className="text-slate-500 text-xs">-</span>
                  <input
                    type="number"
                    placeholder="Max ₹"
                    value={maxAmount}
                    onChange={(e) => {
                      setMaxAmount(e.target.value);
                      setAmountRangePreset('custom');
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Dedicated Item / Spice Filter */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-1">
                  <ShoppingBag className="w-3 h-3 text-emerald-400" />
                  <span>Filter by Item / Spice:</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sugar, Turmeric, Rice, Ghee..."
                  value={itemNameFilter}
                  onChange={(e) => setItemNameFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500"
                />
              </div>

              {/* Dedicated Customer Name Filter */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-1">
                  <User className="w-3 h-3 text-emerald-400" />
                  <span>Filter by Customer Name:</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh, Suresh, Verma..."
                  value={customerNameFilter}
                  onChange={(e) => setCustomerNameFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Active Filter Tags & Count Result Strip */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-800/60 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-400 font-mono font-semibold text-[11px]">
                Found <strong>{filteredList.length}</strong> matching bills
                {filteredList.length > 0 && (
                  <span className="text-emerald-400 ml-1">
                    (Total: ₹{filteredList.reduce((acc, t) => acc + t.amount, 0).toFixed(2)})
                  </span>
                )}
              </span>

              {/* Active Filter Badges */}
              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] border border-emerald-500/30">
                  Search ({searchScope}): "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="hover:text-white">✕</button>
                </span>
              )}
              {paymentModeFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] border border-cyan-500/30">
                  Mode: {paymentModeFilter === 'online_upi' ? 'Online UPI' : paymentModeFilter === 'cash' ? 'Cash' : 'Udhaar'}
                  <button onClick={() => setPaymentModeFilter('all')} className="hover:text-white">✕</button>
                </span>
              )}
              {amountRangePreset !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] border border-amber-500/30">
                  Amount: {amountRangePreset}
                  <button onClick={() => setAmountRangePreset('all')} className="hover:text-white">✕</button>
                </span>
              )}
              {(minAmount || maxAmount) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] border border-amber-500/30">
                  ₹{minAmount || '0'} - ₹{maxAmount || '∞'}
                  <button onClick={() => { setMinAmount(''); setMaxAmount(''); }} className="hover:text-white">✕</button>
                </span>
              )}
              {itemNameFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] border border-purple-500/30">
                  Item: "{itemNameFilter}"
                  <button onClick={() => setItemNameFilter('')} className="hover:text-white">✕</button>
                </span>
              )}
              {customerNameFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] border border-indigo-500/30">
                  Customer: "{customerNameFilter}"
                  <button onClick={() => setCustomerNameFilter('')} className="hover:text-white">✕</button>
                </span>
              )}
            </div>

            {hasActiveCustomFilters && (
              <button
                onClick={handleResetAllFilters}
                className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 font-bold underline underline-offset-2 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset All Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Notification Status Banners */}
        {deleteSuccessMsg && (
          <div className="mx-3 sm:mx-5 mt-3 p-3 bg-rose-500/15 border border-rose-500/40 rounded-2xl flex items-center justify-between text-xs text-rose-300 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span className="font-semibold">{deleteSuccessMsg}</span>
            </div>
            <button
              onClick={() => setDeleteSuccessMsg('')}
              className="text-rose-400 hover:text-white p-1 rounded-lg"
            >
              ✕
            </button>
          </div>
        )}

        {printStatusMsg && (
          <div className="mx-3 sm:mx-5 mt-3 p-3 bg-blue-500/15 border border-blue-500/40 rounded-2xl flex items-center justify-between text-xs text-blue-300 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span className="font-semibold">{printStatusMsg}</span>
            </div>
            <button
              onClick={() => setPrintStatusMsg('')}
              className="text-blue-400 hover:text-white p-1 rounded-lg"
            >
              ✕
            </button>
          </div>
        )}

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2.5">
          {filteredList.length === 0 ? (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <Receipt className="w-10 h-10 mx-auto text-slate-600 opacity-50" />
              <div className="text-sm font-semibold">No bills or transactions match your search</div>
              <div className="text-xs">Try selecting a different tab or clearing your search term</div>
            </div>
          ) : (
            filteredList.map((t) => {
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

              const isSale = t.type === 'sale';
              const isOnline = t.paymentMode === 'online_upi';
              const isUdhaar = t.paymentMode === 'credit_udhaar';

              return (
                <div
                  key={t.id}
                  className="p-3 sm:p-4 rounded-2xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                >
                  {/* Bill Details */}
                  <div className="space-y-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="font-mono font-black text-white text-sm">
                        {t.receiptNumber}
                      </span>

                      {/* Type Badge */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isSale
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {t.type}
                      </span>

                      {/* Mode Badge */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                          isOnline
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            : isUdhaar
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {isOnline ? 'Online UPI' : isUdhaar ? 'Udhaar / Khata' : 'Cash'}
                      </span>

                      {t.staffName && (
                        <span className="text-[10px] text-slate-400">
                          Staff: <strong className="text-slate-300">{t.staffName}</strong>
                        </span>
                      )}
                    </div>

                    {/* Timestamp & Customer */}
                    <div className="text-xs text-slate-400 flex items-center flex-wrap gap-2">
                      <span className="flex items-center gap-1 text-slate-300">
                        <Calendar className="w-3 h-3 text-cyan-400" />
                        {formattedDate}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-mono text-cyan-300">
                        <Clock className="w-3 h-3" />
                        {formattedTime}
                      </span>

                      {t.customerName && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-amber-300 font-semibold">
                            <User className="w-3 h-3" />
                            {t.customerName}
                            {t.customerPhone ? ` (${t.customerPhone})` : ''}
                          </span>
                        </>
                      )}

                      {t.notes && (
                        <>
                          <span>•</span>
                          <span className="text-slate-400 italic font-normal">"{t.notes}"</span>
                        </>
                      )}
                    </div>

                    {/* Items preview with match highlighting and expansion */}
                    {t.items && t.items.length > 0 && (
                      <div className="text-[11px] pt-1">
                        <div className="flex items-center flex-wrap gap-1.5">
                          <span className="text-slate-500 font-medium">Items ({t.items.length}):</span>
                          {t.items.slice(0, 3).map((item, idx) => {
                            const isSearchMatch =
                              (itemNameFilter &&
                                (item.name.toLowerCase().includes(itemNameFilter.toLowerCase()) ||
                                  (item.hindiName && item.hindiName.toLowerCase().includes(itemNameFilter.toLowerCase())))) ||
                              (searchQuery &&
                                (searchScope === 'item' || searchScope === 'all') &&
                                (item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  (item.hindiName && item.hindiName.toLowerCase().includes(searchQuery.toLowerCase()))));

                            return (
                              <span
                                key={idx}
                                className={`px-1.5 py-0.2 rounded font-medium ${
                                  isSearchMatch
                                    ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 font-bold'
                                    : 'bg-slate-750 text-slate-300'
                                }`}
                              >
                                {item.name} ({item.quantity} {item.unit})
                              </span>
                            );
                          })}

                          {t.items.length > 3 && (
                            <button
                              onClick={() => setExpandedBillId(expandedBillId === t.id ? null : t.id)}
                              className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-semibold cursor-pointer"
                            >
                              {expandedBillId === t.id ? 'Hide items' : `+${t.items.length - 3} more`}
                            </button>
                          )}
                        </div>

                        {/* Full Items Expansion Drawer */}
                        {expandedBillId === t.id && (
                          <div className="mt-2 p-2 bg-slate-900/90 rounded-xl border border-slate-700/60 space-y-1">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                              All Bill Items:
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                              {t.items.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-xs py-0.5 px-1.5 rounded bg-slate-950/40 border border-slate-800"
                                >
                                  <span className="text-slate-200 font-medium">{item.name}</span>
                                  <span className="font-mono text-emerald-400">
                                    {item.quantity} {item.unit} × ₹{item.rate} = ₹{item.total}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Amount & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-700/60 flex-shrink-0">
                    <div className="text-left sm:text-right">
                      <div
                        className={`text-lg sm:text-xl font-black font-mono ${
                          isSale ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isSale ? '+' : '-'}₹{t.amount.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Net Amount
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenPrintDialog(t)}
                        className="px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/30 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                        title="Print receipt slip (With QR or Without QR)"
                      >
                        <Printer className="w-3.5 h-3.5 text-blue-400" />
                        <span className="hidden sm:inline">Print</span>
                      </button>

                      {isOwner ? (
                        <>
                          <button
                            onClick={() => handleOpenEdit(t)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1 border border-slate-700 transition-all cursor-pointer"
                            title="Edit bill details, amount, or payment mode"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>

                          <button
                            onClick={() => handleOpenDeleteConfirm(t)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-800/80 hover:bg-rose-600/20 border border-slate-700 hover:border-rose-500/40 rounded-xl transition-all cursor-pointer"
                            title="Delete / Void bill"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <div
                          className="px-2 py-1 text-[11px] text-slate-500 bg-slate-900 border border-slate-800 rounded-lg flex items-center gap-1"
                          title="Owner access required to edit or delete transactions"
                        >
                          <Lock className="w-3 h-3 text-slate-500" />
                          <span>Owner Lock</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* EDIT BILL DIALOG MODAL */}
        {editingTransaction && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-lg bg-slate-900 border-2 border-purple-500/60 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300 font-bold text-xs">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-white text-sm">
                      Edit Bill #{editingTransaction.receiptNumber}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Update payment mode (Cash, Online UPI, Udhaar) and amount
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setEditingTransaction(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {editSuccessMsg && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{editSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveEdit} className="space-y-4">
                {/* Payment Mode Selector */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">
                    Payment Mode:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditPaymentMode('cash')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                        editPaymentMode === 'cash'
                          ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-750'
                      }`}
                    >
                      <Wallet className="w-4 h-4" />
                      <span>Cash</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditPaymentMode('online_upi')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                        editPaymentMode === 'online_upi'
                          ? 'bg-cyan-600 text-white border-cyan-400 shadow-lg'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-750'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Online UPI</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditPaymentMode('credit_udhaar')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                        editPaymentMode === 'credit_udhaar'
                          ? 'bg-amber-600 text-white border-amber-400 shadow-lg'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-750'
                      }`}
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Udhaar / Credit</span>
                    </button>
                  </div>
                  {editPaymentMode === 'credit_udhaar' && (
                    <div className="text-[11px] text-amber-300/90 mt-1.5 bg-amber-950/40 p-2 rounded-lg border border-amber-500/30">
                      ℹ Changing to Udhaar will automatically add this bill amount to the customer's pending due ledger.
                    </div>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Bill Amount (₹): <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 font-bold text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      required
                      step="any"
                      min="1"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl pl-8 pr-3 py-2 text-white font-mono font-bold text-base"
                    />
                  </div>
                </div>

                {/* Customer Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Customer Name:
                    </label>
                    <input
                      type="text"
                      value={editCustomerName}
                      onChange={(e) => setEditCustomerName(e.target.value)}
                      placeholder="e.g. Ramesh Bhai"
                      className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl px-3 py-2 text-white text-xs sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Phone Number:
                    </label>
                    <input
                      type="tel"
                      value={editCustomerPhone}
                      onChange={(e) => setEditCustomerPhone(e.target.value)}
                      placeholder="10-digit mobile"
                      className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl px-3 py-2 text-white text-xs sm:text-sm"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Remarks / Notes:
                  </label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="e.g. Modified payment mode from cash to online GPay"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl px-3 py-2 text-white text-xs"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      if (editingTransaction) {
                        handleOpenDeleteConfirm(editingTransaction);
                      }
                    }}
                    className="px-3 py-2 rounded-xl text-rose-400 hover:text-white hover:bg-rose-600/20 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Bill</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingTransaction(null)}
                      className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DELETE CONFIRMATION DIALOG MODAL (NON-BLOCKING) */}
        {transactionToDelete && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-md bg-slate-900 border-2 border-rose-500/80 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 flex-shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-white">Delete / Void Bill?</h4>
                  <p className="text-xs text-rose-400 font-semibold">Permanently delete bill</p>
                </div>
              </div>

              <div className="bg-slate-950/90 rounded-2xl p-4 border border-slate-800 space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Receipt No:</span>
                  <span className="font-mono font-bold text-white text-sm">#{transactionToDelete.receiptNumber}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Bill Amount:</span>
                  <span className="font-mono font-bold text-emerald-400 text-base">₹{transactionToDelete.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Payment Mode:</span>
                  <span className="font-bold text-white uppercase">{transactionToDelete.paymentMode.replace('_', ' ')}</span>
                </div>
                {transactionToDelete.customerName && (
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Customer:</span>
                    <span className="text-amber-300 font-semibold">{transactionToDelete.customerName}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-slate-400">
                  <span>Date & Time:</span>
                  <span className="text-slate-300 font-mono text-[11px]">
                    {new Date(transactionToDelete.timestamp).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to permanently delete this {transactionToDelete.type === 'sale' ? 'sale bill' : 'expense record'}? 
                This action cannot be undone and will automatically recalculate today's turnover, cash-in-hand, and udhaar ledgers.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setTransactionToDelete(null)}
                  className="px-4 py-2.5 rounded-xl text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-950 cursor-pointer active:scale-95 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Confirm Delete</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PRINT OPTIONS DIALOG MODAL (WITH QR vs WITHOUT QR) */}
        {transactionToPrint && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-md bg-slate-900 border-2 border-blue-500/80 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-white text-base">Print Thermal Slip</h4>
                    <p className="text-xs text-blue-400 font-mono">Bill #{transactionToPrint.receiptNumber}</p>
                  </div>
                </div>

                <button
                  onClick={() => setTransactionToPrint(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-slate-950/90 rounded-2xl p-4 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Bill Total:</span>
                  <span className="font-mono font-bold text-emerald-400 text-base">₹{transactionToPrint.amount.toFixed(2)}</span>
                </div>
                {transactionToPrint.customerName && (
                  <div className="flex justify-between text-slate-400">
                    <span>Customer:</span>
                    <span className="text-white font-medium">{transactionToPrint.customerName}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400">
                  <span>Payment Mode:</span>
                  <span className="font-bold text-white uppercase">{transactionToPrint.paymentMode.replace('_', ' ')}</span>
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <div className="text-xs font-bold text-slate-300">Choose Printing Format:</div>
                <button
                  type="button"
                  onClick={() => {
                    handleExecutePrint(transactionToPrint, true);
                    setTransactionToPrint(null);
                  }}
                  className="w-full p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold flex items-center justify-between shadow-lg shadow-blue-950 transition-all cursor-pointer active:scale-98"
                >
                  <div className="flex items-center gap-2.5">
                    <QrCode className="w-5 h-5 text-cyan-200" />
                    <div className="text-left">
                      <div className="font-extrabold">Print Slip (With UPI QR Code)</div>
                      <div className="text-[11px] text-blue-200">Includes UPI QR code for fast payment scan</div>
                    </div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-700 font-mono">With QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleExecutePrint(transactionToPrint, false);
                    setTransactionToPrint(null);
                  }}
                  className="w-full p-3 bg-slate-800 hover:bg-slate-750 text-slate-100 border border-slate-700 hover:border-slate-600 rounded-2xl text-xs font-bold flex items-center justify-between shadow-md transition-all cursor-pointer active:scale-98"
                >
                  <div className="flex items-center gap-2.5">
                    <Printer className="w-5 h-5 text-amber-400" />
                    <div className="text-left">
                      <div className="font-extrabold">Print Slip (Without QR Code)</div>
                      <div className="text-[11px] text-slate-400">Standard compact receipt slip with no QR</div>
                    </div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-700 font-mono text-amber-300">No QR</span>
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setTransactionToPrint(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
