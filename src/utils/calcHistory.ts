import { CalcHistoryItem, StoreSettings } from '../types';
import { printReceipt, ThermalReceiptData } from './printer';

export const CALC_HISTORY_STORAGE_KEY = 'nayab_calc_history_v1';
export const CALC_HISTORY_LEGACY_KEY = 'tohands_calc_history_v1';
export const MAX_CALC_HISTORY_RECORDS = 500;

/**
 * Load calculation history from persistent browser storage
 */
export function getStoredCalculationHistory(): CalcHistoryItem[] {
  try {
    const raw = localStorage.getItem(CALC_HISTORY_STORAGE_KEY) || localStorage.getItem(CALC_HISTORY_LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Normalize items to ensure valid timestamps and formatted dates
    return parsed.map((item: any, idx: number) => {
      const timestamp = typeof item.timestamp === 'number' ? item.timestamp : Date.now() - idx * 1000;
      const date = item.date || new Date(timestamp).toLocaleDateString('en-IN');
      const isoDate = item.isoDate || new Date(timestamp).toISOString();
      const time = item.time || new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      return {
        id: item.id || `calc-${timestamp}-${idx}`,
        expression: String(item.expression || ''),
        result: Number(item.result || 0),
        time,
        timestamp,
        date,
        isoDate,
        note: item.note || undefined,
        staffName: item.staffName || undefined,
      };
    });
  } catch (err) {
    console.error('Failed to load calculation history:', err);
    return [];
  }
}

/**
 * Save calculation history back to local storage and broadcast change
 */
export function saveCalculationHistory(items: CalcHistoryItem[]): void {
  try {
    const limited = items.slice(0, MAX_CALC_HISTORY_RECORDS);
    localStorage.setItem(CALC_HISTORY_STORAGE_KEY, JSON.stringify(limited));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nayab_calc_history_updated', { detail: limited }));
    }
  } catch (err) {
    console.error('Failed to save calculation history:', err);
  }
}

/**
 * Record a single completed calculation to history
 */
export function appendCalculationRecord(
  expression: string,
  result: number,
  staffName?: string,
  note?: string
): CalcHistoryItem | null {
  if (!expression || !expression.trim()) return null;
  const cleanExpr = expression.trim().replace(/=$/, '').trim();
  const now = Date.now();
  const nowDate = new Date(now);

  const newItem: CalcHistoryItem = {
    id: `calc-${now}-${Math.random().toString(36).substring(2, 6)}`,
    expression: cleanExpr,
    result,
    time: nowDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    timestamp: now,
    date: nowDate.toLocaleDateString('en-IN'),
    isoDate: nowDate.toISOString(),
    staffName,
    note,
  };

  const existing = getStoredCalculationHistory();
  // Prevent duplicate consecutive entries with identical expression and result within 2 seconds
  if (existing.length > 0 && existing[0].expression === cleanExpr && existing[0].result === result) {
    const timeDiff = now - (existing[0].timestamp || 0);
    if (timeDiff < 2000) {
      return existing[0];
    }
  }

  const updated = [newItem, ...existing].slice(0, MAX_CALC_HISTORY_RECORDS);
  saveCalculationHistory(updated);
  return newItem;
}

/**
 * Clear all calculation history
 */
export function clearAllCalculationHistory(): void {
  try {
    localStorage.removeItem(CALC_HISTORY_STORAGE_KEY);
    localStorage.removeItem(CALC_HISTORY_LEGACY_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nayab_calc_history_updated', { detail: [] }));
    }
  } catch (err) {
    console.error('Failed to clear calculation history:', err);
  }
}

/**
 * Export Calculation History to CSV format for owner download
 */
export function exportCalculationHistoryToCsv(items: CalcHistoryItem[], shopName: string): void {
  const headers = ['ID', 'Date', 'Time', 'Mathematical Formula', 'Evaluated Result (INR)', 'Note', 'Staff'];
  const rows = items.map((item) => [
    `"${item.id}"`,
    `"${item.date || ''}"`,
    `"${item.time || ''}"`,
    `"${item.expression.replace(/"/g, '""')}"`,
    item.result.toFixed(2),
    `"${(item.note || '').replace(/"/g, '""')}"`,
    `"${(item.staffName || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `${shopName.replace(/\s+/g, '_')}_Calculation_History_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Print Calculation Audit Tape Slip on Thermal POS Printer
 */
export async function printCalculationHistoryTape(
  items: CalcHistoryItem[],
  storeSettings: StoreSettings,
  filterLabel: string = 'AUDIT TAPE'
): Promise<{ success: boolean; error?: string }> {
  if (items.length === 0) {
    return { success: false, error: 'No calculation history available to print.' };
  }

  // Group latest items up to 40 for clean slip length
  const printItems = items.slice(0, 40);
  const totalVolume = printItems.reduce((acc, curr) => acc + curr.result, 0);

  const receiptData: ThermalReceiptData = {
    shopName: storeSettings.shopName,
    address: storeSettings.address,
    phone: storeSettings.phone,
    gstin: storeSettings.gstin,
    receiptNumber: `CALC-${filterLabel.toUpperCase().replace(/[^A-Z0-9]/g, '')}-${Date.now().toString().slice(-4)}`,
    date: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' }),
    cashierName: `Owner Audit: ${filterLabel}`,
    items: printItems.map((item, idx) => ({
      id: item.id || `calc-${idx}`,
      name: `${item.expression} =`,
      quantity: 1,
      unit: item.time as any,
      rate: item.result,
      total: item.result,
    })),
    subtotal: totalVolume,
    taxAmount: 0,
    taxRate: 0,
    grandTotal: totalVolume,
    paymentMode: 'calculator_tape',
    upiId: storeSettings.upiId,
  };

  const res = await printReceipt(receiptData, storeSettings);
  return { success: res.success, error: res.error };
}
