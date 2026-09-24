import React, { useState } from 'react';
import { BillItem } from '../types';
import {
  Trash2,
  ShoppingBag,
  Plus,
  Minus,
  Receipt,
  ArrowRight,
  Edit3,
  Check,
  Printer,
  Camera,
  Barcode,
} from 'lucide-react';
import { playKeySound } from '../utils/audio';

interface ActiveBillTapeProps {
  items: BillItem[];
  onRemoveItem: (id: string) => void;
  onUpdateItemQuantity: (id: string, newQty: number) => void;
  onUpdateItemRate?: (id: string, newRate: number) => void;
  onClearBill: () => void;
  onOpenPosCatalog: () => void;
  onOpenBarcodeScanner?: () => void;
  onProceedToSale: () => void;
  onPrintBill?: () => void;
  taxRate: number;
}

export const ActiveBillTape: React.FC<ActiveBillTapeProps> = ({
  items,
  onRemoveItem,
  onUpdateItemQuantity,
  onUpdateItemRate,
  onClearBill,
  onOpenPosCatalog,
  onOpenBarcodeScanner,
  onProceedToSale,
  onPrintBill,
  taxRate,
}) => {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [customQty, setCustomQty] = useState<string>('');

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const grandTotal = Math.round((subtotal + taxAmount) * 100) / 100;

  if (items.length === 0) {
    return (
      <div className="bg-slate-900/60 rounded-3xl p-5 border border-slate-800 text-center flex flex-col items-center justify-center min-h-[160px]">
        <ShoppingBag className="w-8 h-8 text-slate-700 mb-2" />
        <h4 className="text-sm font-semibold text-slate-300">Active Bill is Empty</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          Use the NAYAB keypad for quick manual amounts, or select spices & groceries from the POS inventory.
        </p>
        <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
          {onOpenBarcodeScanner && (
            <button
              onClick={onOpenBarcodeScanner}
              className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-400" />
              <span>Scan Barcode</span>
            </button>
          )}
          <button
            onClick={onOpenPosCatalog}
            className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>POS Inventory</span>
          </button>
        </div>
      </div>
    );
  }

  const handleStepQuantity = (item: BillItem, delta: number) => {
    playKeySound('num');
    let step = 1;
    if (item.unit === 'g') {
      step = 50; // 50g increments
    } else if (item.unit === 'kg' || item.unit === 'litre') {
      step = 0.25; // 250g increments
    } else if (item.unit === 'quintal') {
      step = 0.1;
    }

    const minQty = item.unit === 'g' ? 10 : (item.unit === 'kg' ? 0.05 : 0.1);
    const newQty = Math.max(minQty, Math.round((item.quantity + delta * step) * 1000) / 1000);
    onUpdateItemQuantity(item.id, newQty);
  };

  const handleCommitCustomQty = (itemId: string) => {
    const parsed = parseFloat(customQty);
    if (!isNaN(parsed) && parsed > 0) {
      onUpdateItemQuantity(itemId, parsed);
    }
    setEditingItemId(null);
    setCustomQty('');
  };

  return (
    <div className="bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-800 shadow-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-white uppercase tracking-wider">
            Current Bill Tape ({items.length} {items.length === 1 ? 'item' : 'items'})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onOpenBarcodeScanner && (
            <button
              onClick={onOpenBarcodeScanner}
              className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors shadow-sm"
              title="Trigger camera to scan barcodes"
            >
              <Camera className="w-3 h-3 text-emerald-400" />
              <span>Scan</span>
            </button>
          )}
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Edit Qty with +/- or click number
          </span>
          <button
            onClick={onClearBill}
            className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 font-medium transition-colors"
            title="Clear all bill items"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Items Scrollable List with Quantity Editing */}
      <div className="max-h-60 sm:max-h-72 overflow-y-auto divide-y divide-slate-800/80 my-2 pr-1">
        {items.map((item, idx) => (
          <div key={item.id || idx} className="py-2.5 flex items-center justify-between gap-2 text-xs">
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-sm sm:text-base text-white truncate leading-tight">{item.name}</span>
                {item.hindiName && (
                  <span className="text-xs text-amber-300 font-medium">({item.hindiName})</span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                <span>₹{item.rate}/{item.unit}</span>
              </div>
            </div>

            {/* Quantity Stepper & Inline Editor */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 py-1 px-2 rounded-xl border border-slate-700/80">
              <button
                onClick={() => handleStepQuantity(item, -1)}
                className="w-5 h-5 rounded-md bg-slate-700 hover:bg-slate-650 text-slate-200 flex items-center justify-center transition-colors active:scale-90"
                title="Decrease quantity"
              >
                <Minus className="w-3 h-3" />
              </button>

              {editingItemId === item.id ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    autoFocus
                    value={customQty}
                    onChange={(e) => setCustomQty(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCommitCustomQty(item.id);
                      if (e.key === 'Escape') setEditingItemId(null);
                    }}
                    className="w-14 bg-slate-950 text-emerald-300 font-mono text-center font-bold px-1 py-0.5 rounded border border-emerald-500 focus:outline-none text-xs"
                  />
                  <button
                    onClick={() => handleCommitCustomQty(item.id)}
                    className="p-1 text-emerald-400 hover:text-emerald-300"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditingItemId(item.id);
                    setCustomQty(String(item.quantity));
                  }}
                  className="px-1.5 py-0.5 hover:bg-slate-700 rounded font-mono font-bold text-white text-xs flex items-center gap-1 group"
                  title="Click to type custom weight/quantity"
                >
                  <span>
                    {item.unit === 'kg' && item.quantity < 1
                      ? `${Math.round(item.quantity * 1000)}g (${item.quantity}kg)`
                      : `${item.quantity} ${item.unit}`}
                  </span>
                  <Edit3 className="w-2.5 h-2.5 text-slate-500 group-hover:text-amber-400" />
                </button>
              )}

              <button
                onClick={() => handleStepQuantity(item, 1)}
                className="w-5 h-5 rounded-md bg-slate-700 hover:bg-slate-650 text-slate-200 flex items-center justify-center transition-colors active:scale-90"
                title="Increase quantity"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {/* Line Total & Remove */}
            <div className="flex items-center gap-2 flex-shrink-0 text-right">
              <span className="font-mono font-bold text-sm text-emerald-300 min-w-[60px]">
                ₹{item.total.toFixed(2)}
              </span>
              <button
                onClick={() => onRemoveItem(item.id)}
                className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                title="Remove item"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Bill Totals Summary */}
      <div className="pt-3 border-t border-slate-800 space-y-1.5 text-xs">
        <div className="flex justify-between text-slate-400">
          <span>Items Subtotal:</span>
          <span className="font-mono text-slate-200">₹{subtotal.toFixed(2)}</span>
        </div>

        {taxRate > 0 && (
          <div className="flex justify-between text-amber-400/90">
            <span>GST Tax ({taxRate}%):</span>
            <span className="font-mono">+₹{taxAmount.toFixed(2)}</span>
          </div>
        )}

        <div className="flex justify-between text-sm sm:text-base font-bold text-white pt-1 border-t border-slate-800">
          <span>Grand Total:</span>
          <span className="font-mono text-emerald-400 text-lg">₹{grandTotal.toFixed(2)}</span>
        </div>
      </div>

      {/* Dedicated Print & Review Button Below the Bill */}
      {onPrintBill && (
        <button
          id="btn-print-active-bill"
          onClick={() => {
            playKeySound('action');
            onPrintBill();
          }}
          className="w-full mt-3 py-2.5 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-750 text-cyan-300 hover:text-cyan-200 border border-cyan-500/40 hover:border-cyan-400 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm group cursor-pointer"
          title="Review all items, quantities, rates and preview slip before printing"
        >
          <Printer className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
          <span>Review Items & Print Bill</span>
        </button>
      )}

      {/* Bottom Actions */}
      <div className="grid grid-cols-2 gap-2 mt-2 pt-1">
        <button
          onClick={onOpenPosCatalog}
          className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add More Items</span>
        </button>

        <button
          onClick={onProceedToSale}
          className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-1.5 transition-all"
        >
          <span>Settle Bill</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
