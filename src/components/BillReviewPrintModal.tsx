import React, { useState, useEffect, useMemo, useRef } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Receipt,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Minus,
  Trash2,
  Edit2,
  Check,
  QrCode,
  IndianRupee,
  ShoppingBag,
  User,
  Phone,
  Settings,
  ArrowLeft,
  FileText,
  CreditCard,
  Banknote,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { BillItem, CustomerUdhaar, PaymentMode, Product, StoreSettings, Transaction, UnitType } from '../types';
import { playKeySound } from '../utils/audio';
import { printReceipt, ThermalReceiptData } from '../utils/printer';
import { safeConfirm } from '../utils/dialog';

interface BillReviewPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  billItems: BillItem[];
  calculatorAmount?: number;
  storeSettings: StoreSettings;
  customers?: CustomerUdhaar[];
  products?: Product[];
  onUpdateBillItems: (updatedItems: BillItem[]) => void;
  onCompleteSale?: (transaction: Omit<Transaction, 'id' | 'receiptNumber' | 'timestamp'>) => void;
  onClearBill?: () => void;
  onOpenPrinterSettings?: () => void;
}

const COMMON_QUICK_ITEMS = [
  { name: 'Sugar', hindiName: 'चीनी', unit: 'kg' as UnitType, rate: 44 },
  { name: 'Jeera', hindiName: 'जीरा', unit: 'g' as UnitType, rate: 0.6 },
  { name: 'Atta', hindiName: 'आटा', unit: 'kg' as UnitType, rate: 36 },
  { name: 'Basmati Rice', hindiName: 'चावल', unit: 'kg' as UnitType, rate: 65 },
  { name: 'Mustard Oil', hindiName: 'सरसों तेल', unit: 'litre' as UnitType, rate: 155 },
  { name: 'Tea', hindiName: 'चाय', unit: 'packet' as UnitType, rate: 120 },
  { name: 'Tata Salt', hindiName: 'नमक', unit: 'packet' as UnitType, rate: 28 },
  { name: 'Toor Dal', hindiName: 'अरहर दाल', unit: 'kg' as UnitType, rate: 140 },
];

export const BillReviewPrintModal: React.FC<BillReviewPrintModalProps> = ({
  isOpen,
  onClose,
  billItems,
  calculatorAmount = 0,
  storeSettings,
  customers = [],
  products = [],
  onUpdateBillItems,
  onCompleteSale,
  onClearBill,
  onOpenPrinterSettings,
}) => {
  // Local review items state
  const [items, setItems] = useState<BillItem[]>([]);
  const [activeTab, setActiveTab] = useState<'review' | 'preview'>('review');

  // Bill Financials
  const [applyTax, setApplyTax] = useState<boolean>(false);
  const [taxRate, setTaxRate] = useState<number>(storeSettings.defaultTaxRate || 0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');

  // Customer Details
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  // Thermal Print Options
  const [includeQrOnSlip, setIncludeQrOnSlip] = useState<boolean>(
    storeSettings.printerConfig?.printQrCodeOnSlip !== false
  );
  const [paperWidthPreview, setPaperWidthPreview] = useState<'58mm' | '80mm'>(
    storeSettings.printerConfig?.paperWidth || '58mm'
  );
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Inline Item Editing
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'quantity' | 'rate' | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Add Custom Item Form
  const [showAddCustomItem, setShowAddCustomItem] = useState<boolean>(false);
  const [newItemName, setNewItemName] = useState<string>('');
  const [newItemHindi, setNewItemHindi] = useState<string>('');
  const [newItemQuantity, setNewItemQuantity] = useState<string>('1');
  const [newItemUnit, setNewItemUnit] = useState<UnitType>('kg');
  const [newItemRate, setNewItemRate] = useState<string>('');

  // Print Status
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printStatusMsg, setPrintStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [generatedReceiptNo, setGeneratedReceiptNo] = useState<string>('');

  const activeStaff = storeSettings.staffAccounts?.find((s) => s.id === storeSettings.activeStaffId);

  // Initialize or reset review items when modal opens
  useEffect(() => {
    if (!isOpen) {
      setPrintStatusMsg(null);
      return;
    }

    const receiptNo = `NB-${Date.now().toString().slice(-6)}`;
    setGeneratedReceiptNo(receiptNo);

    // Build initial items from billItems plus any standalone calculator amount
    let initialList: BillItem[] = [];
    if (billItems && billItems.length > 0) {
      initialList = billItems.map((it) => ({ ...it }));
    }

    // If calculator has an un-itemized amount, include it as a distinct entry
    if (calculatorAmount > 0) {
      initialList.push({
        id: `calc-entry-${Date.now()}`,
        name: 'Calculator Manual Entry',
        hindiName: 'अतिरिक्त योग',
        rate: calculatorAmount,
        quantity: 1,
        unit: 'item' as UnitType,
        total: calculatorAmount,
      });
    }

    // If completely empty, add a default placeholder item
    if (initialList.length === 0) {
      initialList = [
        {
          id: `item-${Date.now()}`,
          name: 'Kirana Items / Counter Sale',
          hindiName: 'काउंटर सेल',
          rate: 100,
          quantity: 1,
          unit: 'item' as UnitType,
          total: 100,
        },
      ];
    }

    setItems(initialList);
    setApplyTax(storeSettings.defaultTaxRate > 0);
    setTaxRate(storeSettings.defaultTaxRate || 0);
    setIncludeQrOnSlip(storeSettings.printerConfig?.printQrCodeOnSlip !== false);
    setPaperWidthPreview(storeSettings.printerConfig?.paperWidth || '58mm');
    setCustomerName('');
    setCustomerPhone('');
    setSelectedCustomerId('');
    setActiveTab('review');
  }, [isOpen, billItems, calculatorAmount, storeSettings]);

  // Calculations
  const subtotal = useMemo(() => {
    return Math.round(items.reduce((sum, item) => sum + (Number(item.total) || 0), 0) * 100) / 100;
  }, [items]);

  const taxAmount = useMemo(() => {
    if (!applyTax || taxRate <= 0) return 0;
    return Math.round(((subtotal * taxRate) / 100) * 100) / 100;
  }, [subtotal, applyTax, taxRate]);

  const grandTotal = useMemo(() => {
    return Math.round((subtotal + taxAmount) * 100) / 100;
  }, [subtotal, taxAmount]);

  // Generate dynamic QR code for UPI payment on receipt
  useEffect(() => {
    if (!storeSettings.upiId || grandTotal <= 0) {
      setQrDataUrl('');
      return;
    }

    const shopNameClean = encodeURIComponent(storeSettings.shopName || 'Kirana Store');
    const upiString = `upi://pay?pa=${storeSettings.upiId}&pn=${shopNameClean}&am=${grandTotal.toFixed(2)}&cu=INR&tn=Bill-${generatedReceiptNo}`;

    QRCode.toDataURL(upiString, {
      width: 180,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => {
        console.warn('Failed to generate UPI QR for receipt preview:', err);
        setQrDataUrl('');
      });
  }, [storeSettings.upiId, storeSettings.shopName, grandTotal, generatedReceiptNo]);

  // Handle Step Quantity
  const handleStepQuantity = (itemId: string, delta: number) => {
    playKeySound('num');
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;

        let step = delta;
        if (item.unit === 'g') {
          step = delta * 50; // 50g increments
        } else if (item.unit === 'kg' || item.unit === 'litre') {
          step = delta > 0 ? (item.quantity < 1 ? 0.25 : 0.5) : (item.quantity <= 1 ? -0.25 : -0.5);
        } else if (item.unit === 'quintal') {
          step = delta * 0.1;
        }

        const minQty = item.unit === 'g' ? 10 : (item.unit === 'kg' ? 0.05 : 0.1);
        const newQty = Math.max(minQty, Math.round((item.quantity + step) * 1000) / 1000);
        const newTotal = Math.round(newQty * item.rate * 100) / 100;

        return { ...item, quantity: newQty, total: newTotal };
      })
    );
  };

  // Start inline editing
  const handleStartEdit = (itemId: string, field: 'quantity' | 'rate') => {
    playKeySound('action');
    const target = items.find((it) => it.id === itemId);
    if (!target) return;
    setEditingItemId(itemId);
    setEditingField(field);
    setEditValue(field === 'quantity' ? String(target.quantity) : String(target.rate));
  };

  // Commit inline editing
  const handleCommitEdit = () => {
    if (!editingItemId || !editingField) return;
    const parsed = parseFloat(editValue);
    if (isNaN(parsed) || parsed <= 0) {
      setEditingItemId(null);
      setEditingField(null);
      return;
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== editingItemId) return item;
        let newQty = item.quantity;
        let newRate = item.rate;
        if (editingField === 'quantity') {
          newQty = parsed;
        } else if (editingField === 'rate') {
          newRate = parsed;
        }
        const newTotal = Math.round(newQty * newRate * 100) / 100;
        return { ...item, quantity: newQty, rate: newRate, total: newTotal };
      })
    );

    setEditingItemId(null);
    setEditingField(null);
  };

  // Remove item
  const handleRemoveItem = (itemId: string) => {
    playKeySound('clear');
    setItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  // Quick add Kirana staple
  const handleAddQuickItem = (quick: typeof COMMON_QUICK_ITEMS[0]) => {
    playKeySound('action');
    const newItem: BillItem = {
      id: `bi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: quick.name,
      hindiName: quick.hindiName,
      quantity: 1,
      unit: quick.unit,
      rate: quick.rate,
      total: quick.rate,
    };
    setItems((prev) => [...prev, newItem]);
  };

  // Add custom item
  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    const qty = parseFloat(newItemQuantity) || 1;
    const rate = parseFloat(newItemRate) || 0;
    if (rate <= 0) return;

    playKeySound('action');
    const newItem: BillItem = {
      id: `bi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: newItemName.trim(),
      hindiName: newItemHindi.trim() || undefined,
      quantity: qty,
      unit: newItemUnit,
      rate: rate,
      total: Math.round(qty * rate * 100) / 100,
    };

    setItems((prev) => [...prev, newItem]);
    setNewItemName('');
    setNewItemHindi('');
    setNewItemQuantity('1');
    setNewItemRate('');
    setShowAddCustomItem(false);
  };

  // Select existing customer
  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const custId = e.target.value;
    setSelectedCustomerId(custId);
    const found = customers.find((c) => c.id === custId);
    if (found) {
      setCustomerName(found.name);
      setCustomerPhone(found.phone);
    }
  };

  // Build receipt payload
  const buildReceiptData = (): ThermalReceiptData => {
    return {
      shopName: storeSettings.shopName || 'Nayab Masale & Kirana',
      address: storeSettings.address || 'Shop No. 4, Main Bazar',
      phone: storeSettings.phone || '9876543210',
      gstin: storeSettings.gstin,
      receiptNumber: generatedReceiptNo,
      date: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
      cashierName: activeStaff?.name || 'Counter Cashier',
      customerName: customerName.trim() || undefined,
      items: items.length > 0 ? items : [{ id: 'm1', name: 'Counter Sale', quantity: 1, unit: 'item', rate: grandTotal, total: grandTotal }],
      subtotal: subtotal,
      taxAmount: taxAmount,
      taxRate: applyTax ? taxRate : 0,
      grandTotal: grandTotal,
      paymentMode: paymentMode === 'online_upi' ? 'Online UPI' : paymentMode === 'credit_udhaar' ? 'Udhaar / Credit' : 'Cash Bill',
      upiId: storeSettings.upiId,
      qrDataUrl: qrDataUrl || undefined,
      printQrCodeOnSlip: includeQrOnSlip,
    };
  };

  // Execute Thermal Print
  const handlePrintSlipOnly = async () => {
    if (items.length === 0) return;
    setIsPrinting(true);
    setPrintStatusMsg({ text: 'Sending receipt to thermal printer...', type: 'info' });

    try {
      const receiptData = buildReceiptData();
      const res = await printReceipt(receiptData, storeSettings);

      if (res.success) {
        playKeySound('bill');
        setPrintStatusMsg({
          text: `Bill slip printed successfully via ${res.method}!`,
          type: 'success',
        });
        // Sync reviewed items back to active bill so counter stays in sync
        onUpdateBillItems(items);
      } else {
        setPrintStatusMsg({ text: res.error || 'Print failed. Please check printer connection.', type: 'error' });
      }
    } catch (err: any) {
      setPrintStatusMsg({ text: err.message || 'Error occurred during printing.', type: 'error' });
    } finally {
      setIsPrinting(false);
    }
  };

  // Print & Settle Sale
  const handlePrintAndSettleSale = async () => {
    if (items.length === 0) return;

    if (paymentMode === 'credit_udhaar' && !customerName.trim()) {
      alert('Please enter or select a customer name for Udhaar / Credit sale.');
      return;
    }

    setIsPrinting(true);
    setPrintStatusMsg({ text: 'Printing bill slip and settling sale...', type: 'info' });

    try {
      const receiptData = buildReceiptData();
      const res = await printReceipt(receiptData, storeSettings);

      // Record transaction
      if (onCompleteSale) {
        onCompleteSale({
          amount: grandTotal,
          type: 'sale',
          paymentMode: paymentMode,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          customerId: selectedCustomerId || undefined,
          items: items,
          notes: `Receipt ${generatedReceiptNo}${applyTax ? ` (GST ${taxRate}%)` : ''}`,
        });
      }

      playKeySound('bill');

      if (res.success) {
        setPrintStatusMsg({
          text: `Bill printed and sale settled successfully!`,
          type: 'success',
        });
      } else {
        setPrintStatusMsg({
          text: `Sale recorded, but printer error: ${res.error || 'Check printer.'}`,
          type: 'error',
        });
      }

      // Clear counter bill items
      if (onClearBill) {
        onClearBill();
      }

      // Close modal after a short delay so user sees success feedback
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setPrintStatusMsg({ text: err.message || 'Error during print & settle.', type: 'error' });
    } finally {
      setIsPrinting(false);
    }
  };

  // Save reviewed items back to counter bill without printing
  const handleSaveItemsToCounter = () => {
    playKeySound('action');
    onUpdateBillItems(items);
    setPrintStatusMsg({ text: 'Bill items updated and saved to counter!', type: 'success' });
    setTimeout(() => {
      onClose();
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-4xl bg-gradient-to-b from-slate-900 via-slate-925 to-slate-950 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/95 flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 font-bold shadow-inner">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Review Items in Bill Before Printing
                </h3>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full font-bold border border-cyan-500/40 font-mono">
                  Rcpt: {generatedReceiptNo}
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-500/40">
                  {items.length} {items.length === 1 ? 'Item' : 'Items'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Verify items, quantities, and rates before printing receipt
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* View Switcher Tabs */}
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                id="btn-tab-review-items"
                onClick={() => setActiveTab('review')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'review'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Items Review</span>
              </button>
              <button
                type="button"
                id="btn-tab-preview-slip"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'preview'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Thermal Slip Preview</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Feedback Toast */}
        {printStatusMsg && (
          <div
            className={`px-4 py-2 text-xs font-bold flex items-center justify-between gap-2 border-b animate-in fade-in ${
              printStatusMsg.type === 'success'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                : printStatusMsg.type === 'error'
                ? 'bg-red-950/80 text-red-300 border-red-500/50'
                : 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50'
            }`}
          >
            <div className="flex items-center gap-2">
              {printStatusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : printStatusMsg.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              ) : (
                <Printer className="w-4 h-4 text-cyan-400 flex-shrink-0 animate-pulse" />
              )}
              <span>{printStatusMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setPrintStatusMsg(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {activeTab === 'review' ? (
            /* TAB 1: ITEMS REVIEW & DIRECT EDITING */
            <div className="space-y-4">
              {/* Quick Info Alert */}
              <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>
                    Verify quantities and rates before sending to the thermal printer. Use <strong className="text-white">+ / -</strong> to adjust weights, or click any number to type a custom value.
                  </span>
                </div>
                {onClearBill && items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (safeConfirm('Clear all items from this bill?')) {
                        setItems([]);
                      }
                    }}
                    className="text-red-400 hover:text-red-300 font-semibold flex items-center gap-1 flex-shrink-0 text-xs px-2 py-1 rounded-lg hover:bg-red-950/40 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All</span>
                  </button>
                )}
              </div>

              {/* Items Table Card */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-inner">
                <div className="p-3 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between text-xs font-bold text-slate-300">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-cyan-400" />
                    <span>Bill Items ({items.length})</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-normal">
                    Subtotal: <strong className="text-emerald-400 font-mono">₹{subtotal.toFixed(2)}</strong>
                  </div>
                </div>

                {items.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <ShoppingBag className="w-10 h-10 text-slate-700 mx-auto" />
                    <p className="text-sm font-semibold text-slate-400">No items currently in the bill</p>
                    <p className="text-xs text-slate-500">
                      Add items using the quick Kirana buttons below or enter a custom item.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                        <tr>
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">Item Name</th>
                          <th className="p-2.5">Rate</th>
                          <th className="p-2.5 text-center">Quantity</th>
                          <th className="p-2.5 text-right">Amount</th>
                          <th className="p-2.5 text-center w-10">Remove</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {items.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-2.5 text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                            <td className="p-2.5">
                              <div className="font-extrabold text-base sm:text-lg text-white">{item.name}</div>
                              {item.hindiName && (
                                <div className="text-xs sm:text-sm text-amber-300 font-medium">{item.hindiName}</div>
                              )}
                            </td>
                            <td className="p-2.5">
                              {editingItemId === item.id && editingField === 'rate' ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="any"
                                    autoFocus
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleCommitEdit();
                                      if (e.key === 'Escape') setEditingItemId(null);
                                    }}
                                    className="w-16 bg-slate-950 text-emerald-400 font-mono font-bold px-1.5 py-0.5 rounded border border-emerald-500 text-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={handleCommitEdit}
                                    className="p-1 text-emerald-400 hover:text-emerald-300"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(item.id, 'rate')}
                                  className="font-mono text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 group cursor-pointer"
                                  title="Click to edit rate"
                                >
                                  <span>₹{item.rate}/{item.unit}</span>
                                  <Edit2 className="w-2.5 h-2.5 text-slate-600 group-hover:text-amber-400" />
                                </button>
                              )}
                            </td>
                            <td className="p-2.5">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleStepQuantity(item.id, -1)}
                                  className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors active:scale-90 cursor-pointer"
                                  title="Decrease quantity"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>

                                {editingItemId === item.id && editingField === 'quantity' ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      step="any"
                                      min="0.01"
                                      autoFocus
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleCommitEdit();
                                        if (e.key === 'Escape') setEditingItemId(null);
                                      }}
                                      className="w-16 bg-slate-950 text-white font-mono font-bold px-1.5 py-0.5 rounded border border-cyan-500 text-xs text-center"
                                    />
                                    <button
                                      type="button"
                                      onClick={handleCommitEdit}
                                      className="p-1 text-cyan-400 hover:text-cyan-300"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(item.id, 'quantity')}
                                    className="px-2 py-0.5 hover:bg-slate-800 rounded font-mono font-bold text-white text-xs flex items-center gap-1 group cursor-pointer"
                                    title="Click to type exact weight/quantity"
                                  >
                                    <span>
                                      {item.unit === 'kg' && item.quantity < 1
                                        ? `${Math.round(item.quantity * 1000)}g (${item.quantity}kg)`
                                        : `${item.quantity} ${item.unit}`}
                                    </span>
                                    <Edit2 className="w-2.5 h-2.5 text-slate-600 group-hover:text-cyan-400" />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleStepQuantity(item.id, 1)}
                                  className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors active:scale-90 cursor-pointer"
                                  title="Increase quantity"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-sm text-emerald-300">
                              ₹{item.total.toFixed(2)}
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                className="p-1 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Quick Add Kirana Staples & Custom Item */}
              <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Quick Add Kirana Masale & Staples:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomItem(!showAddCustomItem)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{showAddCustomItem ? 'Hide Custom Input' : '+ Add Custom Item'}</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {COMMON_QUICK_ITEMS.map((q) => (
                    <button
                      key={q.name}
                      type="button"
                      onClick={() => handleAddQuickItem(q)}
                      className="px-2.5 py-1 rounded-xl bg-slate-800/90 hover:bg-slate-750 text-slate-200 border border-slate-700 hover:border-cyan-500/50 text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                    >
                      <span>{q.name}</span>
                      <span className="text-emerald-400 font-mono font-bold">₹{q.rate}</span>
                    </button>
                  ))}
                </div>

                {/* Custom Item Form */}
                {showAddCustomItem && (
                  <form
                    onSubmit={handleAddCustomItem}
                    className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs"
                  >
                    <input
                      type="text"
                      placeholder="Item Name (e.g. Garam Masala)"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 sm:col-span-2"
                      required
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="any"
                        placeholder="Qty"
                        value={newItemQuantity}
                        onChange={(e) => setNewItemQuantity(e.target.value)}
                        className="w-16 bg-slate-950 border border-slate-700 rounded-xl px-2 py-1.5 text-white text-center focus:outline-none focus:border-cyan-500"
                        required
                      />
                      <select
                        value={newItemUnit}
                        onChange={(e) => setNewItemUnit(e.target.value as UnitType)}
                        className="bg-slate-950 border border-slate-700 rounded-xl px-2 py-1.5 text-slate-300 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="packet">packet</option>
                        <option value="litre">litre</option>
                        <option value="piece">piece</option>
                        <option value="item">item</option>
                      </select>
                    </div>
                    <input
                      type="number"
                      step="any"
                      placeholder="Rate (₹)"
                      value={newItemRate}
                      onChange={(e) => setNewItemRate(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-emerald-400 font-mono font-bold placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      required
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </form>
                )}
              </div>

              {/* Bill Configurations & Customer Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: Customer & Payment Mode */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3.5 space-y-3">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Customer Details (Optional)</span>
                  </h4>

                  {customers.length > 0 && (
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Select Existing Customer:</label>
                      <select
                        value={selectedCustomerId}
                        onChange={handleCustomerSelect}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="">-- Choose or Enter Below --</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.phone || 'No phone'}) - Balance: ₹{c.totalDue}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Customer Name:</label>
                      <input
                        type="text"
                        placeholder="e.g. Ramesh Kumar"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Phone Number:</label>
                      <input
                        type="tel"
                        placeholder="e.g. 9876543210"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  {/* Payment Mode Selector */}
                  <div className="pt-2 border-t border-slate-800">
                    <label className="text-[10px] text-slate-400 block mb-1.5 font-bold uppercase tracking-wider">
                      Payment Mode:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMode('cash')}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 cursor-pointer ${
                          paymentMode === 'cash'
                            ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <Banknote className="w-4 h-4" />
                        <span>Cash</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMode('online_upi')}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 cursor-pointer ${
                          paymentMode === 'online_upi'
                            ? 'bg-cyan-600 text-white border-cyan-400 shadow-md'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <QrCode className="w-4 h-4" />
                        <span>Online UPI</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMode('credit_udhaar')}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 cursor-pointer ${
                          paymentMode === 'credit_udhaar'
                            ? 'bg-amber-600 text-white border-amber-400 shadow-md'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <BookOpen className="w-4 h-4" />
                        <span>Udhaar Khata</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right: Tax, QR Slip Toggle & Grand Total */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3.5 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold text-white flex items-center justify-between">
                      <span>GST Tax & Thermal Print Options</span>
                      <span className="text-[10px] text-slate-400 font-mono">58mm / 80mm</span>
                    </h4>

                    {/* Tax toggle */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="tax-toggle"
                          checked={applyTax}
                          onChange={(e) => setApplyTax(e.target.checked)}
                          className="w-4 h-4 rounded text-cyan-600 focus:ring-0 cursor-pointer"
                        />
                        <label htmlFor="tax-toggle" className="text-xs text-slate-300 cursor-pointer">
                          Apply GST Tax
                        </label>
                      </div>

                      {applyTax && (
                        <div className="flex items-center gap-1">
                          {[0, 5, 12, 18, 28].map((rateVal) => (
                            <button
                              key={rateVal}
                              type="button"
                              onClick={() => setTaxRate(rateVal)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                taxRate === rateVal
                                  ? 'bg-amber-500 text-slate-950'
                                  : 'bg-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              {rateVal}%
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* QR on Slip toggle */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="qr-on-slip-toggle"
                          checked={includeQrOnSlip}
                          onChange={(e) => setIncludeQrOnSlip(e.target.checked)}
                          className="w-4 h-4 rounded text-cyan-600 focus:ring-0 cursor-pointer"
                        />
                        <label htmlFor="qr-on-slip-toggle" className="text-slate-300 cursor-pointer flex items-center gap-1">
                          <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Print Dynamic UPI QR on Slip</span>
                        </label>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {storeSettings.upiId ? storeSettings.upiId : 'No UPI Set'}
                      </span>
                    </div>
                  </div>

                  {/* Totals Summary */}
                  <div className="pt-2 border-t border-slate-800 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Items Subtotal:</span>
                      <span className="font-mono text-slate-200">₹{subtotal.toFixed(2)}</span>
                    </div>
                    {applyTax && taxRate > 0 && (
                      <div className="flex justify-between text-amber-400">
                        <span>GST ({taxRate}%):</span>
                        <span className="font-mono">+₹{taxAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                      <span className="font-bold text-white text-sm">Grand Total:</span>
                      <span className="font-mono text-2xl font-black text-emerald-400">
                        ₹{grandTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: AUTHENTIC THERMAL SLIP PREVIEW */
            <div className="flex flex-col items-center justify-center py-2">
              <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
                <span>Preview Width:</span>
                <button
                  type="button"
                  onClick={() => setPaperWidthPreview('58mm')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    paperWidthPreview === '58mm'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  58mm (Standard Pocket)
                </button>
                <button
                  type="button"
                  onClick={() => setPaperWidthPreview('80mm')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    paperWidthPreview === '80mm'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  80mm (Wide Desktop)
                </button>
              </div>

              {/* Realistic Thermal Receipt Slip */}
              <div
                className={`bg-white text-slate-900 font-mono text-xs shadow-2xl p-5 border border-slate-300 rounded-sm relative selection:bg-slate-200 ${
                  paperWidthPreview === '58mm' ? 'w-full max-w-[320px]' : 'w-full max-w-[420px]'
                }`}
                style={{
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
                }}
              >
                {/* Paper Header */}
                <div className="text-center pb-2 border-b border-dashed border-slate-800">
                  <div className="font-black text-sm uppercase tracking-wide">
                    {storeSettings.shopName || 'Nayab Masale & Kirana'}
                  </div>
                  <div className="text-[11px] text-slate-700">{storeSettings.address || 'Shop No. 4, Main Bazar'}</div>
                  <div className="text-[11px] text-slate-700">Phone: {storeSettings.phone || '9876543210'}</div>
                  {storeSettings.gstin && (
                    <div className="text-[10px] text-slate-600">GSTIN: {storeSettings.gstin}</div>
                  )}
                </div>

                {/* Receipt Details */}
                <div className="py-2 border-b border-dashed border-slate-800 text-[11px] space-y-0.5">
                  <div className="flex justify-between">
                    <span>Rcpt: {generatedReceiptNo}</span>
                    <span>{new Date().toLocaleDateString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Cashier: {activeStaff?.name || 'Nayab Bhai'}</span>
                    <span>{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {customerName.trim() && (
                    <div className="text-slate-800 font-semibold pt-0.5">
                      Customer: {customerName} {customerPhone ? `(${customerPhone})` : ''}
                    </div>
                  )}
                </div>

                {/* Items Table */}
                <table className="w-full my-2 text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-dashed border-slate-800 font-bold">
                      <th className="text-left py-1">Item</th>
                      <th className="text-center py-1">Qty</th>
                      <th className="text-right py-1">Amt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dotted divide-slate-300">
                    {items.map((item, i) => (
                      <tr key={i} className="py-1">
                        <td className="py-1 pr-1">
                          <div className="font-extrabold text-sm text-black">{item.name}</div>
                          {item.hindiName && (
                            <div className="text-xs text-slate-700 font-medium">{item.hindiName}</div>
                          )}
                          <div className="text-[9px] text-slate-500">₹{item.rate}/{item.unit}</div>
                        </td>
                        <td className="text-center py-1 whitespace-nowrap">
                          {item.quantity}{item.unit}
                        </td>
                        <td className="text-right py-1 font-bold">
                          ₹{item.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div className="pt-1.5 border-t border-dashed border-slate-800 text-[11px] space-y-1">
                  <div className="flex justify-between text-slate-700">
                    <span>Subtotal:</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  {applyTax && taxRate > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>GST Tax ({taxRate}%):</span>
                      <span>+₹{taxAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-sm pt-1 border-t-2 border-slate-900">
                    <span>TOTAL:</span>
                    <span>₹{grandTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-600 pt-0.5">
                    <span>Payment Mode:</span>
                    <span className="font-bold uppercase">
                      {paymentMode === 'online_upi' ? 'Online UPI' : paymentMode === 'credit_udhaar' ? 'Udhaar Khata' : 'Cash'}
                    </span>
                  </div>
                </div>

                {/* Dynamic UPI QR Code on Slip */}
                {includeQrOnSlip && storeSettings.upiId && qrDataUrl && (
                  <div className="my-3 p-2 bg-slate-50 border border-dashed border-slate-400 rounded text-center">
                    <div className="text-[9px] font-bold tracking-wider uppercase text-slate-800 mb-1">
                      Scan & Pay via UPI
                    </div>
                    <img
                      src={qrDataUrl}
                      alt="UPI QR Code"
                      className="w-28 h-28 mx-auto object-contain border border-slate-300"
                    />
                    <div className="text-[10px] font-black text-slate-900 mt-1">
                      ₹{grandTotal.toFixed(2)}
                    </div>
                    <div className="text-[8px] text-slate-500 truncate mt-0.5">
                      {storeSettings.upiId}
                    </div>
                  </div>
                )}

                {/* Paper Footer */}
                <div className="pt-2 border-t border-dashed border-slate-800 text-center text-[10px] text-slate-600 space-y-0.5">
                  <div className="font-bold text-slate-800">Thank You! Visit Again</div>
                  <div className="text-[8px] text-slate-400 pt-1">
                    Powered by NAYAB Kirana POS Smart Biz
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/95 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              type="button"
              id="btn-save-reviewed-items"
              onClick={handleSaveItemsToCounter}
              className="py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              title="Save changes back to counter bill without printing"
            >
              <Check className="w-4 h-4 text-cyan-400" />
              <span>Save Items to Bill</span>
            </button>

            {onOpenPrinterSettings && (
              <button
                type="button"
                onClick={onOpenPrinterSettings}
                className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-750 text-slate-400 hover:text-white border border-slate-700/80 transition-colors cursor-pointer hidden md:flex items-center justify-center"
                title="Printer Hardware Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* Print Bill Slip Only */}
            <button
              type="button"
              id="btn-confirm-print-slip"
              onClick={handlePrintSlipOnly}
              disabled={isPrinting || items.length === 0}
              className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-blue-950/60 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-blue-200" />
              <span>{isPrinting ? 'Printing...' : 'Print Bill Slip'}</span>
            </button>

            {/* Print & Settle Sale */}
            <button
              type="button"
              id="btn-print-settle-sale"
              onClick={handlePrintAndSettleSale}
              disabled={isPrinting || items.length === 0}
              className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-950/80 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              <span>{isPrinting ? 'Processing...' : 'Print & Settle Sale'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
