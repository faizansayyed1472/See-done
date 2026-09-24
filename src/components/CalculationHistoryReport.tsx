import React, { useState, useEffect, useMemo } from 'react';
import {
  Calculator,
  Search,
  Printer,
  Download,
  Trash2,
  Clock,
  Calendar,
  IndianRupee,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  ArrowUpDown,
  Filter,
  FileSpreadsheet,
  Receipt,
  Eye,
  Hash,
  Activity,
  Layers,
} from 'lucide-react';
import { CalcHistoryItem, StoreSettings } from '../types';
import {
  getStoredCalculationHistory,
  saveCalculationHistory,
  clearAllCalculationHistory,
  exportCalculationHistoryToCsv,
  printCalculationHistoryTape,
} from '../utils/calcHistory';
import { copyToClipboard } from '../utils/clipboard';

interface CalculationHistoryReportProps {
  storeSettings: StoreSettings;
  onRecallFormula?: (formula: string, result: number) => void;
  className?: string;
  isEmbedded?: boolean;
}

type PeriodFilter = 'today' | 'week' | 'month' | 'all';
type SortOption = 'newest' | 'oldest' | 'highest' | 'lowest';
type ViewFormat = 'tape' | 'table';

export const CalculationHistoryReport: React.FC<CalculationHistoryReportProps> = ({
  storeSettings,
  onRecallFormula,
  className = '',
  isEmbedded = false,
}) => {
  const [historyItems, setHistoryItems] = useState<CalcHistoryItem[]>(() => getStoredCalculationHistory());
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('today');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [viewFormat, setViewFormat] = useState<ViewFormat>('tape');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Sync state if external changes occur or window event fires
  const reloadHistory = () => {
    setHistoryItems(getStoredCalculationHistory());
    setStatusMessage('Calculation history refreshed');
    setTimeout(() => setStatusMessage(''), 2500);
  };

  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setHistoryItems(e.detail);
      } else {
        setHistoryItems(getStoredCalculationHistory());
      }
    };
    window.addEventListener('nayab_calc_history_updated', handleUpdate);
    return () => window.removeEventListener('nayab_calc_history_updated', handleUpdate);
  }, []);

  // Compute date thresholds
  const dateRanges = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return { startOfToday, startOfWeek, startOfMonth };
  }, []);

  // Filter items based on period, search query, and sorting
  const filteredItems = useMemo(() => {
    return historyItems.filter((item) => {
      const itemTimestamp = item.timestamp || (item.isoDate ? new Date(item.isoDate).getTime() : 0);

      // Period filter
      if (periodFilter === 'today' && itemTimestamp < dateRanges.startOfToday) {
        return false;
      }
      if (periodFilter === 'week' && itemTimestamp < dateRanges.startOfWeek) {
        return false;
      }
      if (periodFilter === 'month' && itemTimestamp < dateRanges.startOfMonth) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const exprMatches = item.expression.toLowerCase().includes(query);
        const resMatches = item.result.toString().includes(query);
        const timeMatches = (item.time || '').toLowerCase().includes(query);
        const dateMatches = (item.date || '').toLowerCase().includes(query);
        const noteMatches = (item.note || '').toLowerCase().includes(query);
        if (!exprMatches && !resMatches && !timeMatches && !dateMatches && !noteMatches) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      const aTime = a.timestamp || 0;
      const bTime = b.timestamp || 0;

      if (sortOption === 'newest') return bTime - aTime;
      if (sortOption === 'oldest') return aTime - bTime;
      if (sortOption === 'highest') return b.result - a.result;
      if (sortOption === 'lowest') return a.result - b.result;
      return 0;
    });
  }, [historyItems, periodFilter, searchQuery, sortOption, dateRanges]);

  // Key KPI metrics for owner review
  const metrics = useMemo(() => {
    const count = filteredItems.length;
    const totalVolume = filteredItems.reduce((acc, curr) => acc + curr.result, 0);
    const avgValue = count > 0 ? totalVolume / count : 0;
    const highestValue = count > 0 ? Math.max(...filteredItems.map((i) => i.result)) : 0;
    return { count, totalVolume, avgValue, highestValue };
  }, [filteredItems]);

  const handleCopy = async (text: string, id: string) => {
    await copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePrintTape = async () => {
    if (filteredItems.length === 0) return;
    setIsPrinting(true);
    setStatusMessage('Printing calculation audit tape on thermal printer...');
    const periodLabel = periodFilter === 'today' ? 'TODAY' : periodFilter === 'week' ? 'LAST 7 DAYS' : periodFilter === 'month' ? 'THIS MONTH' : 'ALL TIME';
    const res = await printCalculationHistoryTape(filteredItems, storeSettings, periodLabel);
    setIsPrinting(false);
    if (res.success) {
      setStatusMessage('Calculation audit slip printed successfully!');
    } else {
      setStatusMessage(res.error || 'Failed to print calculation slip.');
    }
    setTimeout(() => setStatusMessage(''), 3500);
  };

  const handleExportCsv = () => {
    if (filteredItems.length === 0) return;
    exportCalculationHistoryToCsv(filteredItems, storeSettings.shopName || 'Nayab_Store');
    setStatusMessage(`Exported ${filteredItems.length} calculation records to CSV`);
    setTimeout(() => setStatusMessage(''), 3000);
  };

  const handleConfirmClear = () => {
    clearAllCalculationHistory();
    setHistoryItems([]);
    setShowClearConfirm(false);
    setStatusMessage('All calculation history has been cleared.');
    setTimeout(() => setStatusMessage(''), 3000);
  };

  const handleDeleteSingle = (id: string) => {
    const updated = historyItems.filter((i) => i.id !== id);
    setHistoryItems(updated);
    saveCalculationHistory(updated);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Top Banner with Stats & Controls */}
      <div className="bg-slate-850/90 border border-slate-750 p-4 rounded-2xl shadow-md space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-750">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-sm">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-white text-base tracking-tight">
                  Full Calculation History
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/40 font-mono">
                  {metrics.count} Recorded
                </span>
              </div>
              <p className="text-slate-400 text-xs">
                Permanent audit trail of math expressions, totals, and calculation timestamps recorded when equals (=) is pressed
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={reloadHistory}
              title="Refresh History Tape"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-slate-600 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={handleExportCsv}
              disabled={filteredItems.length === 0}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 hover:border-slate-600 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Download calculations as CSV spreadsheet"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handlePrintTape}
              disabled={filteredItems.length === 0 || isPrinting}
              className="px-3 py-1.5 rounded-xl bg-cyan-600/25 hover:bg-cyan-600/35 text-cyan-200 border border-cyan-500/40 disabled:opacity-40 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Print calculation history tape to thermal POS slip"
            >
              <Printer className="w-3.5 h-3.5 text-cyan-300" />
              <span>{isPrinting ? 'Printing...' : 'Print Audit Tape'}</span>
            </button>

            {historyItems.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="px-2.5 py-1.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                title="Clear all recorded calculation history"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
          </div>
        </div>

        {statusMessage && (
          <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in">
            <span>{statusMessage}</span>
          </div>
        )}

        {/* 4 Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
              <span>Total Calculations</span>
              <Hash className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {metrics.count}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Entries in selected filter
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
              <span>Calculation Volume</span>
              <IndianRupee className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-xl font-bold font-mono text-cyan-300">
              ₹{metrics.totalVolume.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Sum of evaluated totals
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
              <span>Average Calculation</span>
              <Activity className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold font-mono text-amber-300">
              ₹{metrics.avgValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Mean value per entry
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
              <span>Highest Calculation</span>
              <Layers className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-xl font-bold font-mono text-purple-300">
              ₹{metrics.highestValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Max single calculation
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-800">
          {/* Period Pills */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto text-xs font-semibold">
            <button
              onClick={() => setPeriodFilter('today')}
              className={`px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
                periodFilter === 'today'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setPeriodFilter('week')}
              className={`px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
                periodFilter === 'week'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setPeriodFilter('month')}
              className={`px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
                periodFilter === 'month'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setPeriodFilter('all')}
              className={`px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
                periodFilter === 'all'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All History
            </button>
          </div>

          {/* Search and Layout Toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search formula, amount..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs font-bold"
                >
                  ×
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/60 cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="highest">Highest Amount</option>
              <option value="lowest">Lowest Amount</option>
            </select>

            {/* View Format Toggle (Tape vs Table) */}
            <div className="flex items-center bg-slate-950 border border-slate-800 p-0.5 rounded-xl">
              <button
                onClick={() => setViewFormat('tape')}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  viewFormat === 'tape'
                    ? 'bg-slate-800 text-emerald-300 font-bold'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
                title="Tape Ledger View"
              >
                <Receipt className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewFormat('table')}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  viewFormat === 'table'
                    ? 'bg-slate-800 text-emerald-300 font-bold'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
                title="Detailed Table View"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredItems.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-10 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-3xl bg-slate-800/80 border border-slate-750 flex items-center justify-center text-slate-500">
            <Calculator className="w-7 h-7" />
          </div>
          <div>
            <h4 className="text-white font-bold text-sm">No Calculations Found</h4>
            <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No calculations match your search query "${searchQuery}". Try a different keyword.`
                : 'Calculations will appear here automatically every time the equals (=) button is pressed on the POS calculator.'}
            </p>
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-emerald-400 hover:underline font-semibold"
            >
              Clear Search Query
            </button>
          )}
        </div>
      ) : viewFormat === 'tape' ? (
        /* Digital Audit Tape Layout */
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>Showing {filteredItems.length} calculation tape records</span>
            <span>Tap any entry to copy or recall formula</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[520px] overflow-y-auto pr-1">
            {filteredItems.map((item, idx) => {
              const isCopied = copiedId === item.id;
              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/50 transition-all group flex flex-col justify-between shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="w-5 h-5 rounded-md bg-slate-800 border border-slate-700 font-mono font-bold text-[10px] text-slate-300 flex items-center justify-center">
                        #{filteredItems.length - idx}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-cyan-300 font-semibold">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        {item.time}
                      </span>
                      {item.date && (
                        <span className="text-slate-400 flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5 text-slate-500" />
                          {item.date}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleCopy(`${item.expression} = ${item.result}`, item.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Copy formula & result"
                      >
                        {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                      {onRecallFormula && (
                        <button
                          onClick={() => onRecallFormula(item.expression, item.result)}
                          className="px-2 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 font-semibold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                          title="Load into Calculator"
                        >
                          <Calculator className="w-2.5 h-2.5" />
                          <span>Load</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteSingle(item.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Delete this calculation record"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Formula Bar in Digital Font */}
                  <div className="my-2.5 p-2.5 rounded-xl bg-slate-950/90 border border-slate-800/90 font-['Share_Tech_Mono',monospace]">
                    <div className="text-xs text-slate-400 tracking-wider truncate" title={item.expression}>
                      {item.expression}
                    </div>
                    <div className="flex items-baseline justify-between mt-1 pt-1 border-t border-slate-900">
                      <span className="text-[11px] font-sans font-bold text-emerald-500">EVALUATED:</span>
                      <span className="text-xl font-black text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]">
                        = ₹{item.result.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {item.note && (
                    <div className="text-[11px] text-amber-300/80 bg-amber-950/30 px-2 py-1 rounded-lg border border-amber-800/30">
                      Note: {item.note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Detailed Table View */
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto max-h-[520px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 sticky top-0 z-10 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3">Date & Time</th>
                  <th className="py-3 px-3">Full Formula Expression</th>
                  <th className="py-3 px-3 text-right">Result (₹)</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 font-mono">
                {filteredItems.map((item, idx) => {
                  const isCopied = copiedId === item.id;
                  return (
                    <tr key={item.id} className="hover:bg-slate-850/80 transition-colors">
                      <td className="py-2.5 px-3 text-slate-500">
                        {filteredItems.length - idx}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                        <div className="font-semibold text-cyan-300">{item.time}</div>
                        <div className="text-[10px] text-slate-500 font-sans">{item.date}</div>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-white max-w-xs truncate" title={item.expression}>
                        <span className="bg-slate-950 px-2 py-1 rounded-md border border-slate-800 font-['Share_Tech_Mono',monospace] text-emerald-300">
                          {item.expression}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-emerald-400 text-sm whitespace-nowrap">
                        ₹{item.result.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 font-sans">
                          <button
                            onClick={() => handleCopy(`${item.expression} = ${item.result}`, item.id)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                            title="Copy"
                          >
                            {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                          {onRecallFormula && (
                            <button
                              onClick={() => onRecallFormula(item.expression, item.result)}
                              className="px-2 py-0.5 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 font-semibold text-[10px]"
                            >
                              Load
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteSingle(item.id)}
                            className="p-1 rounded bg-slate-800 hover:bg-rose-950 text-slate-500 hover:text-rose-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-rose-500/50 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-rose-400 font-bold text-sm border-b border-slate-800 pb-3">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <span>Clear Calculation Audit History?</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete all <span className="font-bold text-white">{historyItems.length}</span> calculation audit entries?
              This will erase all past mathematical formulas and calculation timestamps. All sales bills, customer udhaar khata, and inventory will remain completely intact.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-950 cursor-pointer active:scale-95 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete All</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
