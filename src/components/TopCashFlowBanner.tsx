import React, { useState } from 'react';
import { Plus, Edit2, Wallet, TrendingUp, ArrowUpRight, Check, X, Sparkles, CreditCard, RotateCcw, AlertTriangle, Store, Lock, ShieldAlert, Key, Coins } from 'lucide-react';
import { safeConfirm } from '../utils/dialog';

interface TopCashFlowBannerProps {
  openingAmount: number;
  addedAmount: number;
  todaySalesTotal: number;
  todayOnlineSalesTotal?: number;
  todayUdhaarSalesTotal?: number;
  todayExpensesTotal?: number;
  themeMode?: 'dark' | 'light';
  outlets?: { id: string; shopName: string }[];
  activeOutletId?: string;
  isOwner?: boolean;
  ownerStaffPin?: string;
  onUpdateOpeningAmount: (newAmount: number) => void;
  onAddCashAmount: (added: number) => void;
  onOpenExpenseModal?: () => void;
  onResetDailyCash: () => void;
  onResetDailyOutletData?: (outletId: string | 'all') => void;
  onOpenBillsSearch?: (tab: 'all' | 'sale' | 'online' | 'cash' | 'udhaar' | 'expense') => void;
}

export const TopCashFlowBanner: React.FC<TopCashFlowBannerProps> = ({
  openingAmount,
  addedAmount,
  todaySalesTotal,
  todayOnlineSalesTotal = 0,
  todayUdhaarSalesTotal = 0,
  todayExpensesTotal = 0,
  themeMode = 'dark',
  outlets = [],
  activeOutletId = 'store-1',
  isOwner = false,
  ownerStaffPin = 'nayab@q6',
  onUpdateOpeningAmount,
  onAddCashAmount,
  onOpenExpenseModal,
  onResetDailyCash,
  onResetDailyOutletData,
  onOpenBillsSearch,
}) => {
  const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false);
  const [isAddCashModalOpen, setIsAddCashModalOpen] = useState(false);
  const [isResetDailyModalOpen, setIsResetDailyModalOpen] = useState(false);
  const [resetTargetOutlet, setResetTargetOutlet] = useState<string | 'all'>('all');
  const [openingInput, setOpeningInput] = useState<string>(String(openingAmount || ''));
  const [cashToAddInput, setCashToAddInput] = useState<string>('');

  // Owner lock state for Reset Daily & Shift Cash actions
  const [isOwnerUnlockedForReset, setIsOwnerUnlockedForReset] = useState(false);
  const [showOwnerPinPromptModal, setShowOwnerPinPromptModal] = useState(false);
  const [pendingResetAction, setPendingResetAction] = useState<'reset_daily' | 'shift_cash' | null>(null);
  const [ownerPinInput, setOwnerPinInput] = useState('');
  const [ownerPinError, setOwnerPinError] = useState('');

  const isResetAuthorized = isOwner || isOwnerUnlockedForReset;

  const handleTriggerResetDaily = () => {
    if (isResetAuthorized) {
      setIsResetDailyModalOpen(true);
    } else {
      setPendingResetAction('reset_daily');
      setOwnerPinInput('');
      setOwnerPinError('');
      setShowOwnerPinPromptModal(true);
    }
  };

  const handleTriggerShiftCash = () => {
    if (isResetAuthorized) {
      if (safeConfirm('Reset Opening and Added cash balances for a new shift? (Today sales transactions will remain safe in reports)')) {
        onResetDailyCash();
      }
    } else {
      setPendingResetAction('shift_cash');
      setOwnerPinInput('');
      setOwnerPinError('');
      setShowOwnerPinPromptModal(true);
    }
  };

  const handleVerifyResetOwnerPin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = ownerPinInput.trim();
    const isMasterAdminPin = cleanPin === 'nayab@q6' || (ownerStaffPin && cleanPin === ownerStaffPin);

    if (!isMasterAdminPin) {
      setOwnerPinError('Incorrect Owner PIN. Resetting daily counters is restricted to the Store Owner (Faizan Inamdar) / Master Admin.');
      return;
    }

    setIsOwnerUnlockedForReset(true);
    setShowOwnerPinPromptModal(false);
    setOwnerPinInput('');
    setOwnerPinError('');

    if (pendingResetAction === 'reset_daily') {
      setIsResetDailyModalOpen(true);
    } else if (pendingResetAction === 'shift_cash') {
      if (safeConfirm('Reset Opening and Added cash balances for a new shift? (Today sales transactions will remain safe in reports)')) {
        onResetDailyCash();
      }
    }
    setPendingResetAction(null);
  };

  // Physical Cash sales: total sales minus online UPI sales and udhaar (credit) sales
  const physicalCashSales = Math.max(0, todaySalesTotal - todayOnlineSalesTotal - todayUdhaarSalesTotal);

  // Cash in Hand: Starting Opening + Added Cash + Cash Collected - Expenses
  const totalCashInHand = Math.max(
    0,
    Math.round((openingAmount + addedAmount + physicalCashSales - todayExpensesTotal) * 100) / 100
  );

  const handleSaveOpening = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(openingInput);
    onUpdateOpeningAmount(isNaN(val) ? 0 : Math.max(0, val));
    setIsOpeningModalOpen(false);
  };

  const handleSaveAddCash = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(cashToAddInput);
    if (!isNaN(val) && val > 0) {
      onAddCashAmount(val);
      setCashToAddInput('');
      setIsAddCashModalOpen(false);
    }
  };

  const handleQuickAdd = (amount: number) => {
    onAddCashAmount(amount);
    setIsAddCashModalOpen(false);
  };

  return (
    <div
      className={`w-full border-b px-2.5 sm:px-5 py-1.5 z-20 select-none transition-colors duration-150 ${
        themeMode === 'light'
          ? 'bg-slate-50/95 border-slate-200 text-slate-900'
          : 'bg-slate-900/95 border-slate-800/90 text-slate-100'
      }`}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-1.5 sm:gap-2">
        {/* Cash Flow Interactive Button Group - Compact, sleek, and fills empty space */}
        <div className="flex-1 flex flex-wrap items-center gap-1 sm:gap-1.5">
          {/* 1. Opening Amount Button */}
          <button
            type="button"
            onClick={() => {
              setOpeningInput(String(openingAmount || ''));
              setIsOpeningModalOpen(true);
            }}
            className={`group flex-1 min-w-[110px] sm:min-w-[125px] h-7 sm:h-8 flex items-center justify-between gap-1.5 border px-2 sm:px-2.5 rounded-lg transition-all shadow-2xs hover:shadow-xs active:scale-98 cursor-pointer ${
              themeMode === 'light'
                ? 'bg-white hover:bg-sky-50 border-sky-200 hover:border-sky-300 text-slate-800'
                : 'bg-slate-850 hover:bg-slate-800 border-sky-500/30 hover:border-sky-400 text-slate-100'
            }`}
            title="Click to Edit Opening Balance (आरंभिक रोकड़)"
          >
            <span className="text-[11px] font-medium text-sky-600 dark:text-sky-400 truncate">
              Opening:
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className={`font-mono font-black text-xs ${themeMode === 'light' ? 'text-amber-600' : 'text-amber-400'} dark:text-amber-400`}>
                ₹{openingAmount.toFixed(0)}
              </span>
              <Edit2 className="w-3 h-3 text-sky-400 group-hover:scale-110 transition-transform" />
            </div>
          </button>

          {/* 2. Added Amount Button */}
          <button
            type="button"
            onClick={() => setIsAddCashModalOpen(true)}
            className={`group flex-1 min-w-[110px] sm:min-w-[125px] h-7 sm:h-8 flex items-center justify-between gap-1.5 border px-2 sm:px-2.5 rounded-lg transition-all shadow-2xs hover:shadow-xs active:scale-98 cursor-pointer ${
              themeMode === 'light'
                ? 'bg-white hover:bg-indigo-50 border-indigo-200 hover:border-indigo-300 text-slate-800'
                : 'bg-slate-850 hover:bg-slate-800 border-indigo-500/30 hover:border-indigo-400 text-slate-100'
            }`}
            title="Click to Add Midday Cash (जोड़ी गई रोकड़)"
          >
            <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 truncate">
              + Added:
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className={`font-mono font-black text-xs ${themeMode === 'light' ? 'text-amber-600' : 'text-amber-400'} dark:text-amber-400`}>
                ₹{addedAmount.toFixed(0)}
              </span>
              <Plus className="w-3 h-3 text-indigo-400 group-hover:scale-110 transition-transform" />
            </div>
          </button>

          {/* 3. Total Sale Amount Button */}
          <button
            type="button"
            onClick={() => onOpenBillsSearch?.('sale')}
            className={`group flex-1 min-w-[120px] sm:min-w-[135px] h-7 sm:h-8 flex items-center justify-between gap-1.5 border-2 px-2 sm:px-2.5 rounded-lg transition-all shadow-2xs hover:shadow-xs active:scale-98 cursor-pointer ${
              themeMode === 'light'
                ? 'bg-emerald-50 hover:bg-emerald-100/90 border-emerald-400 hover:border-emerald-500 text-slate-800'
                : 'bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-500/50 hover:border-emerald-400 text-emerald-200'
            }`}
            title="Click to Search & Filter Today's Sale Bills"
          >
            <div className="flex items-center gap-1 truncate">
              <TrendingUp className="w-3 h-3 text-emerald-500 flex-shrink-0" />
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 truncate">
                + Sale:
              </span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="font-mono font-bold text-xs text-emerald-800 dark:text-emerald-300">
                ₹{todaySalesTotal.toFixed(0)}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">🔍</span>
            </div>
          </button>

          {/* 4. Expense Button */}
          <div
            className={`group flex-1 min-w-[115px] sm:min-w-[130px] h-7 sm:h-8 flex items-center justify-between gap-1 border px-2 sm:px-2.5 rounded-lg transition-all shadow-2xs hover:shadow-xs ${
              themeMode === 'light'
                ? 'bg-rose-50/70 hover:bg-rose-100/80 border-rose-200 hover:border-rose-300 text-slate-800'
                : 'bg-slate-850 hover:bg-slate-800 border-rose-500/30 hover:border-rose-400 text-rose-200'
            }`}
          >
            <button
              type="button"
              onClick={() => onOpenBillsSearch?.('expense')}
              className="flex items-center justify-between gap-1 cursor-pointer flex-1 min-w-0"
              title="Click to View & Search Today's Expense Bills"
            >
              <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 truncate">
                − Exp:
              </span>
              <span className="font-mono font-bold text-xs text-rose-700 dark:text-rose-300 flex-shrink-0">
                ₹{todayExpensesTotal.toFixed(0)}
              </span>
            </button>
            {onOpenExpenseModal && (
              <button
                type="button"
                onClick={onOpenExpenseModal}
                className="p-0.5 rounded hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 transition-colors cursor-pointer active:scale-95 flex-shrink-0"
                title="Record New Store Expense (दुकान खर्च)"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* 5. Online Sale Amount Button */}
          <button
            type="button"
            onClick={() => onOpenBillsSearch?.('online')}
            className={`group flex-1 min-w-[110px] sm:min-w-[125px] h-7 sm:h-8 flex items-center justify-between gap-1.5 border px-2 sm:px-2.5 rounded-lg transition-all shadow-2xs hover:shadow-xs active:scale-98 cursor-pointer ${
              themeMode === 'light'
                ? 'bg-cyan-50/70 hover:bg-cyan-100/80 border-cyan-200 hover:border-cyan-300 text-cyan-900'
                : 'bg-slate-850 hover:bg-slate-800 border-cyan-500/30 hover:border-cyan-400 text-cyan-200'
            }`}
            title="Click to Filter Online UPI Bills (Deducted from counter cash)"
          >
            <div className="flex items-center gap-1 truncate">
              <CreditCard className="w-3 h-3 text-cyan-500 flex-shrink-0" />
              <span className="text-[11px] font-medium text-cyan-700 dark:text-cyan-400 truncate">
                − Online:
              </span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="font-mono font-bold text-xs text-cyan-800 dark:text-cyan-300">
                ₹{todayOnlineSalesTotal.toFixed(0)}
              </span>
              <span className="text-[9px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/15 px-1 py-0.2 rounded font-mono">
                UPI
              </span>
            </div>
          </button>

          {/* Optional 6. Udhaar (Credit) Button */}
          {todayUdhaarSalesTotal > 0 && (
            <button
              type="button"
              onClick={() => onOpenBillsSearch?.('udhaar')}
              className={`group flex-1 min-w-[110px] sm:min-w-[125px] h-7 sm:h-8 flex items-center justify-between gap-1.5 border px-2 sm:px-2.5 rounded-lg transition-all shadow-2xs hover:shadow-xs active:scale-98 cursor-pointer ${
                themeMode === 'light'
                  ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900'
                  : 'bg-amber-950/20 hover:bg-amber-950/40 border-amber-500/30 text-amber-300'
              }`}
              title="Click to Search Today's Udhaar Bills (Pending collection)"
            >
              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 truncate">
                − Udhaar:
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="font-mono font-bold text-xs text-amber-700 dark:text-amber-300">
                  ₹{todayUdhaarSalesTotal.toFixed(0)}
                </span>
                <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 px-1 py-0.2 rounded">
                  Cr
                </span>
              </div>
            </button>
          )}

          {/* 7. Total Cash in Hand Result Button / Card */}
          <div
            className={`flex-1 min-w-[125px] sm:min-w-[145px] h-7 sm:h-8 flex items-center justify-between gap-1.5 border-2 px-2 sm:px-2.5 rounded-lg shadow-2xs transition-all ${
              themeMode === 'light'
                ? 'bg-emerald-50 border-emerald-500 text-slate-900'
                : 'bg-gradient-to-r from-emerald-950/80 via-slate-900 to-amber-950/30 border-emerald-400/80 text-white'
            }`}
            title={`Cash in Hand = Opening (₹${openingAmount}) + Added (₹${addedAmount}) + Cash Sales (₹${physicalCashSales.toFixed(0)}) - Expenses (₹${todayExpensesTotal})`}
          >
            <div className="flex items-center gap-1 truncate">
              <Coins className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300 truncate">
                = In Hand:
              </span>
            </div>
            <span className="font-mono font-black text-xs text-emerald-800 dark:text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.4)] flex-shrink-0">
              ₹{totalCashInHand.toFixed(0)}
            </span>
          </div>
        </div>

        {/* Quick Reset / Day Shift Action */}
        <div className="flex items-center gap-1.5 flex-shrink-0 self-center">
          {onResetDailyOutletData && (
            <button
              type="button"
              onClick={handleTriggerResetDaily}
              className="h-7 sm:h-8 flex items-center gap-1 px-2 sm:px-2.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/40 text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer whitespace-nowrap"
              title={isResetAuthorized ? "Reset today's daily data (sales, expenses, added cash) of outlets to 0" : "Reset Daily Data (Owner Access Only • Locked for Staff)"}
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Reset</span>
              <span>(₹0)</span>
              {!isResetAuthorized && (
                <Lock className="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleTriggerShiftCash}
            className="h-7 sm:h-8 px-2 rounded-lg border border-slate-700/60 hover:border-slate-600 bg-slate-800/60 hover:bg-slate-800 text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-all cursor-pointer inline-flex items-center gap-1 whitespace-nowrap active:scale-95"
            title={isResetAuthorized ? "Reset Daily Opening and Added Cash" : "Reset Shift Cash (Owner Access Only • Locked for Staff)"}
          >
            <span>Shift Cash</span>
            {!isResetAuthorized && (
              <Lock className="w-2.5 h-2.5 text-amber-500" />
            )}
          </button>
        </div>
      </div>

      {/* MODAL 1: Set Opening Amount */}
      {isOpeningModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-sky-500/40 rounded-3xl p-5 shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-sky-400" />
                <h4 className="font-bold text-sm text-white">Opening Cash Amount</h4>
              </div>
              <button
                onClick={() => setIsOpeningModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Enter the starting cash / change in your cash drawer at the start of today's business.
            </p>

            <form onSubmit={handleSaveOpening} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Opening Balance Amount (₹):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-400 font-bold text-base">₹</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    autoFocus
                    required
                    value={openingInput}
                    onChange={(e) => setOpeningInput(e.target.value)}
                    placeholder="e.g. 2000"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-sky-500 rounded-xl pl-8 pr-3 py-2 text-white font-mono font-bold text-lg"
                  />
                </div>
              </div>

              {/* Quick Suggestion Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[500, 1000, 2000, 3000, 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setOpeningInput(String(amt))}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-mono font-semibold transition-colors"
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsOpeningModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-400 hover:text-white text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs shadow-lg transition-all"
                >
                  Save Opening Amount
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Cash In */}
      {isAddCashModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-indigo-500/40 rounded-3xl p-5 shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                <h4 className="font-bold text-sm text-white">Add Cash to Galla</h4>
              </div>
              <button
                onClick={() => setIsAddCashModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Add cash received from owner deposit, change exchange, or additional cash into the cash register.
            </p>

            <form onSubmit={handleSaveAddCash} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Cash Amount to Add (₹):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 font-bold text-base">₹</span>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    autoFocus
                    required
                    value={cashToAddInput}
                    onChange={(e) => setCashToAddInput(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl pl-8 pr-3 py-2 text-white font-mono font-bold text-lg"
                  />
                </div>
              </div>

              {/* Quick Add Presets */}
              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 font-medium">Quick One-Tap Add:</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[100, 200, 500, 1000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleQuickAdd(amt)}
                      className="py-1.5 px-2 bg-slate-800 hover:bg-indigo-600 hover:text-white text-indigo-300 font-mono text-xs font-bold rounded-xl border border-slate-700 transition-all text-center"
                    >
                      +₹{amt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddCashModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-400 hover:text-white text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg transition-all"
                >
                  Add Cash to Till
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Reset Daily Data of Outlets to 0 */}
      {isResetDailyModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-white">Reset Daily Data to ₹0</h4>
                  <p className="text-xs text-amber-300">Sales, Expenses & Added Cash</p>
                </div>
              </div>
              <button
                onClick={() => setIsResetDailyModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>
                Select which outlet(s) to reset for today. This resets today's sales, expenses, and cash added to ₹0 for a clean new business day.
              </p>

              {/* Outlet Selector */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-amber-400" />
                  <span>Target Outlet for Reset:</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setResetTargetOutlet('all')}
                    className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                      resetTargetOutlet === 'all'
                        ? 'bg-amber-600 text-white border-amber-500 shadow-md ring-1 ring-amber-400'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div>All Outlets Combined</div>
                    <div className="text-[10px] opacity-80 font-normal">sy Nayab + kp Nayab</div>
                  </button>

                  {outlets.map((outlet) => (
                    <button
                      key={outlet.id}
                      type="button"
                      onClick={() => setResetTargetOutlet(outlet.id)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                        resetTargetOutlet === outlet.id
                          ? 'bg-amber-600 text-white border-amber-500 shadow-md ring-1 ring-amber-400'
                          : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="truncate">{outlet.shopName}</div>
                      <div className="text-[10px] opacity-80 font-normal">
                        {outlet.id === activeOutletId ? 'Active Counter' : outlet.id}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview of Changes */}
              <div className="bg-slate-950/90 rounded-2xl border border-slate-800 p-3.5 space-y-2 font-mono">
                <div className="text-[11px] font-sans font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Today's Metrics After Reset:
                </div>
                <div className="flex justify-between text-slate-400 text-xs">
                  <span className="font-sans">Daily Gross Sales:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="line-through text-slate-500">₹{todaySalesTotal.toFixed(0)}</span>
                    <span className="text-emerald-400 font-bold">→ ₹0</span>
                  </div>
                </div>
                <div className="flex justify-between text-slate-400 text-xs">
                  <span className="font-sans">Daily Expenses:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="line-through text-slate-500">₹{todayExpensesTotal.toFixed(0)}</span>
                    <span className="text-rose-400 font-bold">→ ₹0</span>
                  </div>
                </div>
                <div className="flex justify-between text-slate-400 text-xs">
                  <span className="font-sans">Cash Added to Till:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="line-through text-slate-500">₹{addedAmount.toFixed(0)}</span>
                    <span className="text-indigo-300 font-bold">→ ₹0</span>
                  </div>
                </div>
                <div className="flex justify-between text-slate-400 text-xs">
                  <span className="font-sans">Opening Amount:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="line-through text-slate-500">₹{openingAmount.toFixed(0)}</span>
                    <span className="text-sky-300 font-bold">→ ₹0</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-600/30 text-amber-200 text-[11px] space-y-1.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>
                    All past days' records, catalog products, and customer udhaar khata remain 100% secure. Only today's counter metrics are reset to 0.
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium pt-1 border-t border-amber-600/20">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>Next-Day Auto-Reset is active: counters also reset automatically to ₹0 every midnight.</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsResetDailyModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onResetDailyOutletData) {
                    onResetDailyOutletData(resetTargetOutlet);
                  }
                  setIsResetDailyModalOpen(false);
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-950 transition-all active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset to ₹0 Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Owner PIN Security Verification for Resetting Daily Data / Shift Cash */}
      {showOwnerPinPromptModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-amber-500/50 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white">Owner Authorization Required</h4>
                  <p className="text-xs text-amber-300">
                    {pendingResetAction === 'reset_daily' ? 'Reset Daily Counters' : 'Reset Shift Cash'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowOwnerPinPromptModal(false);
                  setPendingResetAction(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>
                Resetting daily counters is restricted for staff accounts. Only the Store Owner (<span className="text-amber-300 font-bold">Faizan Inamdar</span>) or Master Admin can perform daily resets.
              </p>

              <form onSubmit={handleVerifyResetOwnerPin} className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Enter Owner / Master Admin PIN:
                  </label>
                  <input
                    type="password"
                    maxLength={30}
                    value={ownerPinInput}
                    onChange={(e) => {
                      setOwnerPinInput(e.target.value);
                      setOwnerPinError('');
                    }}
                    placeholder="Enter Owner PIN (e.g. nayab@q6)"
                    className="w-full bg-slate-950 border border-amber-500/50 rounded-xl px-3 py-2.5 text-center text-white font-mono tracking-widest text-base font-bold outline-none focus:ring-2 focus:ring-amber-500"
                    autoFocus
                  />
                  {ownerPinError && (
                    <p className="text-rose-400 text-xs font-semibold mt-1.5">{ownerPinError}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowOwnerPinPromptModal(false);
                      setPendingResetAction(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Authorize</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
