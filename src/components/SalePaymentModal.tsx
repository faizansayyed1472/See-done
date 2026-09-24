import React, { useState, useEffect, useMemo, useRef } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Receipt,
  CheckCircle,
  Banknote,
  QrCode,
  BookOpen,
  User,
  Phone,
  Printer,
  Share2,
  AlertCircle,
  Plus,
  Trash2,
  Minus,
  PackagePlus,
  Tag,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  IndianRupee,
  Edit2,
  Check,
  RefreshCw,
  Vault,
} from 'lucide-react';
import { BillItem, PaymentMode, StoreSettings, CustomerUdhaar, Transaction, UnitType } from '../types';
import { playKeySound } from '../utils/audio';
import { printReceipt, kickCashDrawer, ThermalReceiptData } from '../utils/printer';
import { safeConfirm } from '../utils/dialog';

interface SalePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAmount: number;
  billItems: BillItem[];
  storeSettings: StoreSettings;
  customers: CustomerUdhaar[];
  onCompleteSale: (transaction: Omit<Transaction, 'id' | 'receiptNumber' | 'timestamp'>) => void;
}

const QUICK_ITEM_SUGGESTIONS = [
  { name: 'Sugar', hindiName: 'चीनी', unit: 'kg', defaultRate: 44 },
  { name: 'Jeera', hindiName: 'जीरा', unit: 'g', defaultRate: 0.6 },
  { name: 'Atta', hindiName: 'आटा', unit: 'kg', defaultRate: 36 },
  { name: 'Basmati Rice', hindiName: 'चावल', unit: 'kg', defaultRate: 65 },
  { name: 'Mustard Oil', hindiName: 'सरसों तेल', unit: 'litre', defaultRate: 155 },
  { name: 'Tea', hindiName: 'चाय पत्ती', unit: 'packet', defaultRate: 120 },
  { name: 'Tata Salt', hindiName: 'नमक', unit: 'packet', defaultRate: 28 },
  { name: 'Toor Dal', hindiName: 'अरहर दाल', unit: 'kg', defaultRate: 140 },
  { name: 'Haldi Powder', hindiName: 'हल्दी', unit: 'packet', defaultRate: 45 },
  { name: 'Dhaniya Powder', hindiName: 'धनिया', unit: 'packet', defaultRate: 50 },
  { name: 'Desi Ghee', hindiName: 'शुद्ध घी', unit: 'kg', defaultRate: 590 },
  { name: 'Loose Spice', hindiName: 'मसाला', unit: 'g', defaultRate: 1 },
];

export const SalePaymentModal: React.FC<SalePaymentModalProps> = ({
  isOpen,
  onClose,
  initialAmount,
  billItems,
  storeSettings,
  customers,
  onCompleteSale,
}) => {
  // Local items state allows adding/editing manual items inside the sale popup
  const [items, setItems] = useState<BillItem[]>([]);
  const [amount, setAmount] = useState<number>(initialAmount);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [cashTendered, setCashTendered] = useState<number>(initialAmount);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [savedReceiptNo, setSavedReceiptNo] = useState<string>('');
  const [printStatus, setPrintStatus] = useState<string>('');
  const [includeQrCodeOnSlip, setIncludeQrCodeOnSlip] = useState<boolean>(
    storeSettings.printerConfig?.printQrCodeOnSlip !== false
  );

  // Manual Item Form State (collapsed by default if items exist, so items review is primary)
  const [isManualSectionOpen, setIsManualSectionOpen] = useState<boolean>(false);
  const [manualName, setManualName] = useState<string>('');
  const [manualHindiName, setManualHindiName] = useState<string>('');
  const [manualQuantity, setManualQuantity] = useState<string>('1');
  const [manualUnit, setManualUnit] = useState<UnitType>('pcs');
  const [manualRate, setManualRate] = useState<string>('');
  const [manualAmount, setManualAmount] = useState<string>('');
  const [extraAmountInput, setExtraAmountInput] = useState<string>('');

  // Item In-line Editing State (price / rate & quantity direct editing)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemField, setEditingItemField] = useState<'quantity' | 'rate' | null>(null);
  const [editingItemValue, setEditingItemValue] = useState<string>('');

  // Direct Total Adjustment State
  const [isEditingTotalDirectly, setIsEditingTotalDirectly] = useState<boolean>(false);
  const [directTotalInput, setDirectTotalInput] = useState<string>('');

  const activeStaff = storeSettings.staffAccounts.find((s) => s.id === storeSettings.activeStaffId);
  const hasInitializedRef = useRef<boolean>(false);

  // Initialize or reset items and amount when the modal opens
  useEffect(() => {
    if (!isOpen) {
      hasInitializedRef.current = false;
      return;
    }

    if (hasInitializedRef.current) {
      return;
    }
    hasInitializedRef.current = true;

    let initialList: BillItem[] = [];
    if (billItems && billItems.length > 0) {
      initialList = [...billItems];
      // If initialAmount exceeds sum of billItems, capture the calculator entry
      const sum = billItems.reduce((acc, it) => acc + (Number(it.total) || 0), 0);
      const diff = Math.round((initialAmount - sum) * 100) / 100;
      if (diff > 0.05) {
        const hasCalcItem = billItems.some(
          (it) => it.name.includes('Calculator') || it.name.includes('Manual Entry')
        );
        if (!hasCalcItem) {
          initialList.push({
            id: `calc-entry-${Date.now()}`,
            name: 'Calculator / Extra Entry',
            quantity: 1,
            unit: 'item',
            rate: diff,
            total: diff,
          });
        }
      }
    } else if (initialAmount > 0) {
      initialList = [
        {
          id: `init-sale-${Date.now()}`,
          name: 'Counter Sale / Keypad Item',
          quantity: 1,
          unit: 'pcs',
          rate: initialAmount,
          total: initialAmount,
        },
      ];
    }

    setItems(initialList);
    const computedTotal = Math.round(initialList.reduce((acc, it) => acc + (Number(it.total) || 0), 0) * 100) / 100;
    const finalAmt = computedTotal > 0 ? computedTotal : initialAmount;
    setAmount(finalAmt);
    setCashTendered(finalAmt);
    setIsCompleted(false);
    setPrintStatus('');
    setIsEditingTotalDirectly(false);
    setEditingItemId(null);
    setEditingItemField(null);

    // If items exist, focus on reviewing them; if empty, open manual addition
    setIsManualSectionOpen(initialList.length === 0);

    // Reset manual input fields
    setManualName('');
    setManualQuantity('1');
    setManualUnit('pcs');
    setManualRate('');
    setManualAmount('');
    setExtraAmountInput('');
  }, [isOpen, initialAmount, billItems]);

  // Generate dynamic UPI QR Code whenever UPI payment mode or amount is active
  useEffect(() => {
    if (paymentMode === 'online_upi' && amount > 0) {
      const receiptNo = `NB-${Date.now().toString().slice(-6)}`;
      const upiUrl = `upi://pay?pa=${encodeURIComponent(
        storeSettings.upiId || 'nayabmasale@upi'
      )}&pn=${encodeURIComponent(
        storeSettings.upiName || storeSettings.shopName
      )}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Bill ' + receiptNo)}`;

      QRCode.toDataURL(upiUrl, {
        width: 240,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR generation error:', err));
    }
  }, [paymentMode, amount, storeSettings]);

  // Helper to compute any pending manual item currently typed in the inputs
  const getPendingItem = (): BillItem | null => {
    const qty = parseFloat(manualQuantity);
    let parsedAmt = parseFloat(manualAmount);
    let parsedRate = parseFloat(manualRate);

    if (isNaN(qty) || qty <= 0) return null;

    if (isNaN(parsedAmt) && !isNaN(parsedRate) && parsedRate > 0) {
      parsedAmt = Math.round(qty * parsedRate * 100) / 100;
    } else if (!isNaN(parsedAmt) && (isNaN(parsedRate) || parsedRate <= 0)) {
      parsedRate = Math.round((parsedAmt / qty) * 100) / 100;
    }

    if (!isNaN(parsedAmt) && parsedAmt > 0) {
      const name = manualName.trim() || `Kirana Item #${items.length + 1}`;
      return {
        id: `man-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        hindiName: manualHindiName || undefined,
        quantity: qty,
        unit: manualUnit,
        rate: parsedRate > 0 ? parsedRate : parsedAmt,
        total: parsedAmt,
      };
    }
    return null;
  };

  // Helper to compute any pending custom extra amount
  const getPendingExtraAmount = (): number => {
    const val = parseFloat(extraAmountInput);
    return !isNaN(val) && val > 0 ? val : 0;
  };

  const pendingItem = getPendingItem();
  const pendingExtra = getPendingExtraAmount();
  const pendingAdditions = (pendingItem ? pendingItem.total : 0) + pendingExtra;
  const liveDisplayTotal = Math.round((amount + pendingAdditions) * 100) / 100;

  const totalItemQuantitySum = useMemo(() => {
    return Math.round(items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0) * 1000) / 1000;
  }, [items]);

  if (!isOpen) return null;

  const changeDue = Math.max(0, Math.round((cashTendered - liveDisplayTotal) * 100) / 100);

  // Sync rate and amount automatically when typing quantity or rate
  const handleQuantityChange = (val: string) => {
    setManualQuantity(val);
    const qty = parseFloat(val);
    const rate = parseFloat(manualRate);
    const amt = parseFloat(manualAmount);

    if (!isNaN(qty) && qty > 0) {
      if (!isNaN(rate) && rate >= 0) {
        setManualAmount((Math.round(qty * rate * 100) / 100).toString());
      } else if (!isNaN(amt) && amt > 0) {
        setManualRate((Math.round((amt / qty) * 100) / 100).toString());
      }
    }
  };

  const handleRateChange = (val: string) => {
    setManualRate(val);
    const qty = parseFloat(manualQuantity) || 1;
    const rate = parseFloat(val);
    if (!isNaN(qty) && qty > 0 && !isNaN(rate) && rate >= 0) {
      setManualAmount((Math.round(qty * rate * 100) / 100).toString());
    }
  };

  const handleAmountChange = (val: string) => {
    setManualAmount(val);
    const qty = parseFloat(manualQuantity) || 1;
    const amt = parseFloat(val);
    if (!isNaN(qty) && qty > 0 && !isNaN(amt) && amt >= 0) {
      setManualRate((Math.round((amt / qty) * 100) / 100).toString());
    }
  };

  const handleSelectQuickSuggestion = (sug: typeof QUICK_ITEM_SUGGESTIONS[0]) => {
    setManualName(sug.name);
    setManualHindiName(sug.hindiName || '');
    setManualUnit(sug.unit as UnitType);
    const qty = parseFloat(manualQuantity) || 1;
    setManualRate(sug.defaultRate.toString());
    setManualAmount((Math.round(qty * sug.defaultRate * 100) / 100).toString());
  };

  // Add Item manually with quantity and amount
  const handleAddManualItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const pending = getPendingItem();

    if (!pending) {
      alert('Please enter a valid rate (₹) or total amount (₹) for the item.');
      return;
    }

    playKeySound('action');
    const updated = [...items, pending];
    setItems(updated);
    const newTotal = Math.round(updated.reduce((sum, it) => sum + (Number(it.total) || 0), 0) * 100) / 100;
    setAmount(newTotal);
    setCashTendered(newTotal);

    // Reset inputs for rapid subsequent entries
    setManualName('');
    setManualHindiName('');
    setManualQuantity('1');
    setManualRate('');
    setManualAmount('');
  };

  // Add extra / direct amount to confirm sale
  const handleAddExtraAmount = (amtToAdd?: number, note?: string) => {
    const val = typeof amtToAdd === 'number' ? amtToAdd : parseFloat(extraAmountInput);
    if (isNaN(val) || val <= 0) {
      alert('Please enter an amount to add.');
      return;
    }

    playKeySound('action');
    const newItem: BillItem = {
      id: `extra-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: note || `Manual Amount Entry (+₹${val})`,
      quantity: 1,
      unit: 'item',
      rate: val,
      total: val,
    };

    const updated = [...items, newItem];
    setItems(updated);
    const newTotal = Math.round(updated.reduce((sum, it) => sum + (Number(it.total) || 0), 0) * 100) / 100;
    setAmount(newTotal);
    setCashTendered(newTotal);
    setExtraAmountInput('');
  };

  // Direct Total Adjustment Handlers
  const handleStartDirectTotalEdit = () => {
    setDirectTotalInput(amount.toString());
    setIsEditingTotalDirectly(true);
  };

  const handleApplyDirectTotal = () => {
    const parsed = parseFloat(directTotalInput);
    if (!isNaN(parsed) && parsed >= 0) {
      setAmount(parsed);
      setCashTendered(parsed);
    }
    setIsEditingTotalDirectly(false);
  };

  // Start in-line editing for rate or quantity
  const handleStartEditItem = (id: string, field: 'quantity' | 'rate', currentVal: number) => {
    setEditingItemId(id);
    setEditingItemField(field);
    setEditingItemValue(currentVal.toString());
  };

  // Save in-line edited rate or quantity
  const handleSaveEditItem = (id: string) => {
    const val = parseFloat(editingItemValue);
    if (isNaN(val) || val <= 0) {
      setEditingItemId(null);
      setEditingItemField(null);
      return;
    }

    const updated = items.map((it) => {
      if (it.id !== id) return it;
      let newQty = it.quantity;
      let newRate = it.rate;
      if (editingItemField === 'quantity') {
        newQty = val;
      } else if (editingItemField === 'rate') {
        newRate = val;
      }
      const newTotal = Math.round(newQty * newRate * 100) / 100;
      return { ...it, quantity: newQty, rate: newRate, total: newTotal };
    });

    setItems(updated);
    const newSum = Math.round(updated.reduce((sum, it) => sum + (Number(it.total) || 0), 0) * 100) / 100;
    setAmount(newSum);
    setCashTendered(newSum);
    setEditingItemId(null);
    setEditingItemField(null);
  };

  const handleCancelEditItem = () => {
    setEditingItemId(null);
    setEditingItemField(null);
  };

  // Update item quantity directly inside sale bill popup
  const handleUpdateItemQuantity = (id: string, delta: number) => {
    const target = items.find((it) => it.id === id);
    if (!target) return;
    let step = delta;
    // For fractional units like kg or litre, step smoothly if quantity is small
    if ((target.unit === 'kg' || target.unit === 'litre') && target.quantity < 1 && Math.abs(delta) === 1) {
      step = delta > 0 ? 0.25 : -0.25;
    }
    const newQty = Math.round((target.quantity + step) * 1000) / 1000;
    if (newQty <= 0) {
      handleDeleteItem(id);
      return;
    }
    const newTotal = Math.round(newQty * target.rate * 100) / 100;
    const updated = items.map((it) => (it.id === id ? { ...it, quantity: newQty, total: newTotal } : it));
    setItems(updated);
    const newSum = Math.round(updated.reduce((sum, it) => sum + (Number(it.total) || 0), 0) * 100) / 100;
    setAmount(newSum);
    setCashTendered(newSum);
  };

  // Delete item from sale popup
  const handleDeleteItem = (id: string) => {
    playKeySound('clear');
    const updated = items.filter((it) => it.id !== id);
    setItems(updated);
    const newSum = Math.round(updated.reduce((sum, it) => sum + (Number(it.total) || 0), 0) * 100) / 100;
    setAmount(newSum);
    setCashTendered(newSum);
  };

  // Clear all items from bill popup
  const handleClearAllItems = () => {
    if (items.length === 0) return;
    const confirmed = safeConfirm('Are you sure you want to remove all items from this bill?');
    if (!confirmed) return;
    playKeySound('clear');
    setItems([]);
    setAmount(0);
    setCashTendered(0);
    setIsManualSectionOpen(true);
  };

  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const custId = e.target.value;
    setSelectedCustomerId(custId);
    const found = customers.find((c) => c.id === custId);
    if (found) {
      setCustomerName(found.name);
      setCustomerPhone(found.phone);
    }
  };

  const executePrintReceipt = async (
    receiptNo: string,
    withQr?: boolean,
    customItems?: BillItem[],
    customAmount?: number
  ) => {
    const shouldIncludeQr = withQr !== undefined ? withQr : includeQrCodeOnSlip;
    const printItems = customItems || items;
    const printAmount = customAmount !== undefined ? customAmount : amount;

    setPrintStatus(
      shouldIncludeQr
        ? 'Sending receipt (with UPI QR) to thermal printer...'
        : 'Sending receipt (without QR) to thermal printer...'
    );
    const receiptData: ThermalReceiptData = {
      shopName: storeSettings.shopName,
      address: storeSettings.address,
      phone: storeSettings.phone,
      gstin: storeSettings.gstin,
      receiptNumber: receiptNo,
      date: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
      cashierName: activeStaff?.name || 'Cashier',
      customerName: customerName.trim() || undefined,
      items:
        printItems.length > 0
          ? printItems
          : [{ id: 'm1', name: 'Manual Counter Sale', quantity: 1, unit: 'packet', rate: printAmount, total: printAmount }],
      subtotal: printAmount / (1 + storeSettings.defaultTaxRate / 100),
      taxAmount: (printAmount * storeSettings.defaultTaxRate) / (100 + storeSettings.defaultTaxRate),
      taxRate: storeSettings.defaultTaxRate,
      grandTotal: printAmount,
      paymentMode,
      upiId: storeSettings.upiId,
      printQrCodeOnSlip: shouldIncludeQr,
    };

    const res = await printReceipt(receiptData, storeSettings);
    if (res.success) {
      setPrintStatus(`Receipt printed via ${res.method} (${shouldIncludeQr ? 'with QR' : 'without QR'})!`);
    } else {
      setPrintStatus(res.error || 'Receipt print error.');
    }
  };

  const handleFinishSale = () => {
    // 1. Auto-commit any pending manual item currently typed in the input fields
    let finalItems = [...items];
    const pending = getPendingItem();
    if (pending) {
      finalItems.push(pending);
    }

    // 2. Auto-commit any custom extra amount in the extraAmountInput
    const pendingExtra = getPendingExtraAmount();
    if (pendingExtra > 0) {
      finalItems.push({
        id: `extra-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: `Manual Amount Entry (+₹${pendingExtra})`,
        quantity: 1,
        unit: 'item',
        rate: pendingExtra,
        total: pendingExtra,
      });
    }

    // 3. Compute final grand total to record
    const computedSum = Math.round(finalItems.reduce((acc, it) => acc + (Number(it.total) || 0), 0) * 100) / 100;
    const finalSaleAmount = computedSum > 0 ? computedSum : (liveDisplayTotal > 0 ? liveDisplayTotal : amount);

    if (finalSaleAmount <= 0) {
      alert('Sale amount must be greater than ₹0. Please add items or enter an amount.');
      return;
    }
    if (paymentMode === 'credit_udhaar' && !customerName.trim()) {
      alert('Please enter Customer Name for Udhaar / Khata entry.');
      return;
    }

    playKeySound('bill');
    const newReceiptNo = `NB-${Date.now().toString().slice(-6)}`;

    // Sync state so success receipt screen reflects exact items and final total
    setItems(finalItems);
    setAmount(finalSaleAmount);
    setCashTendered(finalSaleAmount);
    setManualName('');
    setManualQuantity('1');
    setManualRate('');
    setManualAmount('');
    setExtraAmountInput('');

    onCompleteSale({
      type: 'sale',
      amount: finalSaleAmount,
      baseAmount: finalSaleAmount / (1 + storeSettings.defaultTaxRate / 100),
      taxAmount: (finalSaleAmount * storeSettings.defaultTaxRate) / (100 + storeSettings.defaultTaxRate),
      taxRate: storeSettings.defaultTaxRate,
      paymentMode,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      customerId: selectedCustomerId || undefined,
      staffName: activeStaff?.name,
      staffId: activeStaff?.id,
      remarks: remarks.trim() || undefined,
      items: finalItems.length > 0 ? finalItems : undefined,
    });

    setIsCompleted(true);
    setSavedReceiptNo(newReceiptNo);

    // POS Cash Drawer Integration: Trigger cash drawer solenoid kick on Confirm Sale
    // Automatically pops drawer open for cash transactions & recording sale
    kickCashDrawer().catch((err) => {
      console.warn('POS cash drawer kick error on confirm sale:', err);
    });

    // Auto-print thermal receipt if enabled in printer config
    if (storeSettings.printerConfig?.autoPrintOnSale) {
      executePrintReceipt(newReceiptNo, undefined, finalItems, finalSaleAmount);
    }
  };

  // WhatsApp bill receipt sharing link
  const generateWhatsAppShareUrl = () => {
    let text = `*${storeSettings.shopName}*\n${storeSettings.address}\nPh: ${storeSettings.phone}\n`;
    text += `--------------------------\n`;
    text += `*Bill / Receipt:* ${savedReceiptNo || 'NB-' + Date.now().toString().slice(-6)}\n`;
    text += `*Date:* ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}\n`;
    if (activeStaff) text += `*Cashier:* ${activeStaff.name}\n`;
    if (customerName) text += `*Customer:* ${customerName}\n`;
    text += `--------------------------\n`;

    if (items.length > 0) {
      items.forEach((item, idx) => {
        text += `${idx + 1}. ${item.name} (${item.quantity} ${item.unit}) = ₹${item.total.toFixed(2)}\n`;
      });
      text += `--------------------------\n`;
    }

    text += `*Total Amount:* ₹${amount.toFixed(2)}\n`;
    text += `*Payment Mode:* ${paymentMode.toUpperCase()}\n`;
    if (paymentMode === 'credit_udhaar') {
      text += `*Status:* Added to Udhaar Khata\n`;
    } else {
      text += `*Status:* PAID (Dhanyawad / Thank you!)\n`;
    }

    const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
    const phoneParam = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    return `https://api.whatsapp.com/send?phone=${phoneParam}&text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/95">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Settle Bill / Sale</h3>
              <p className="text-xs text-slate-400">
                {storeSettings.shopName} {activeStaff && `• Cashier: ${activeStaff.name}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3.5" style={{ scrollbarWidth: 'thin' }}>
          {isCompleted ? (
            /* Success Receipt Screen */
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle className="w-10 h-10" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-white">Bill Recorded Successfully!</h4>
                <p className="text-xs text-slate-400 mt-0.5">Receipt #{savedReceiptNo}</p>
              </div>

              {printStatus && (
                <div className="text-[11px] font-semibold text-cyan-300 bg-cyan-950/60 p-2 rounded-xl border border-cyan-800/80 max-w-sm mx-auto">
                  {printStatus}
                </div>
              )}

              <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700 max-w-sm mx-auto text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Bill Amount:</span>
                  <span className="font-bold text-emerald-400 font-mono text-base">₹{amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Payment Mode:</span>
                  <span className="font-semibold text-white uppercase">{paymentMode.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Items:</span>
                  <span className="font-semibold text-slate-200">{items.length} items recorded</span>
                </div>
                {activeStaff && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cashier:</span>
                    <span className="text-slate-200">{activeStaff.name}</span>
                  </div>
                )}
                {customerName && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Customer:</span>
                    <span className="text-slate-200">{customerName}</span>
                  </div>
                )}
                {paymentMode === 'credit_udhaar' && (
                  <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-[11px]">
                    Added to {customerName}'s Udhaar Khata ledger.
                  </div>
                )}
              </div>

              {/* Share & Print Actions */}
              <div className="space-y-2.5 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => executePrintReceipt(savedReceiptNo, true)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-98"
                    title="Print thermal bill slip with dynamic UPI QR code"
                  >
                    <QrCode className="w-4 h-4 text-cyan-300 flex-shrink-0" />
                    <span>Print Slip (With QR)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => executePrintReceipt(savedReceiptNo, false)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-98"
                    title="Print thermal bill slip without QR code"
                  >
                    <Printer className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>Print Slip (Without QR)</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <a
                    href={generateWhatsAppShareUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-colors"
                  >
                    <Share2 className="w-4 h-4 flex-shrink-0" />
                    <span>Send WhatsApp Bill</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      kickCashDrawer();
                      setPrintStatus('POS Cash Drawer opened!');
                      setTimeout(() => setPrintStatus(''), 2500);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-850 hover:bg-slate-750 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                    title="Kick open POS cash drawer"
                  >
                    <Vault className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>Open Cash Drawer</span>
                  </button>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Done (New Bill)
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Active Settlement Form */
            <>
              {/* TOP PRIMARY ACTION: Confirm Sale & Record Button */}
              <button
                type="button"
                onClick={handleFinishSale}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-white font-extrabold rounded-2xl shadow-xl shadow-emerald-950/80 text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all cursor-pointer border border-emerald-400/40"
              >
                <CheckCircle className="w-5 h-5 text-emerald-100 flex-shrink-0" />
                <span>Confirm Sale & Record (₹{liveDisplayTotal.toFixed(2)})</span>
                {pendingAdditions > 0 && (
                  <span className="text-[11px] bg-emerald-700 px-2 py-0.5 rounded-full text-emerald-100 border border-emerald-300/40">
                    (+₹{pendingAdditions.toFixed(2)} item added)
                  </span>
                )}
              </button>

              {/* PAYMENT METHOD SELECTOR */}
              <div className="bg-slate-950/90 p-3 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">Select Payment Method:</span>
                  <span className="text-[11px] font-mono font-bold text-emerald-400">
                    {paymentMode === 'cash'
                      ? '● CASH'
                      : paymentMode === 'online_upi'
                      ? '● UPI QR'
                      : '● UDHAAR'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('cash')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                      paymentMode === 'cash'
                        ? 'bg-emerald-600/35 text-emerald-300 border-emerald-400 shadow-md ring-2 ring-emerald-500/50'
                        : 'bg-slate-800/90 text-slate-400 border-slate-700 hover:bg-slate-750 hover:text-white'
                    }`}
                  >
                    <Banknote className="w-4 h-4 text-emerald-400" />
                    <span>CASH</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode('online_upi')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                      paymentMode === 'online_upi'
                        ? 'bg-cyan-600/35 text-cyan-300 border-cyan-400 shadow-md ring-2 ring-cyan-500/50'
                        : 'bg-slate-800/90 text-slate-400 border-slate-700 hover:bg-slate-750 hover:text-white'
                    }`}
                  >
                    <QrCode className="w-4 h-4 text-cyan-400" />
                    <span>UPI QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode('credit_udhaar')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                      paymentMode === 'credit_udhaar'
                        ? 'bg-amber-600/35 text-amber-300 border-amber-400 shadow-md ring-2 ring-amber-500/50'
                        : 'bg-slate-800/90 text-slate-400 border-slate-700 hover:bg-slate-750 hover:text-white'
                    }`}
                  >
                    <BookOpen className="w-4 h-4 text-amber-400" />
                    <span>UDHAAR</span>
                  </button>
                </div>
              </div>

              {/* GRAND TOTAL AMOUNT DISPLAY */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                    Total Sale Amount to Confirm
                  </span>
                  {isEditingTotalDirectly ? (
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-xl font-bold font-mono text-emerald-400">₹</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={directTotalInput}
                        onChange={(e) => setDirectTotalInput(e.target.value)}
                        className="w-28 bg-slate-900 border border-emerald-500 rounded-xl px-2 py-1 text-white font-mono text-base font-bold focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleApplyDirectTotal}
                        className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                        title="Set direct total"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingTotalDirectly(false)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400 flex items-center gap-2">
                      <span>₹{liveDisplayTotal.toFixed(2)}</span>
                      {pendingAdditions > 0 && (
                        <span className="text-xs text-amber-300 font-semibold bg-amber-950/70 px-2 py-0.5 rounded-lg border border-amber-500/30">
                          (+₹{pendingAdditions.toFixed(2)})
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleStartDirectTotalEdit}
                        className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Directly edit final total"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="text-right text-xs text-slate-400">
                  <div className="font-semibold text-slate-300">
                    {items.length + (pendingItem ? 1 : 0)} {(items.length + (pendingItem ? 1 : 0)) === 1 ? 'item' : 'items'} in bill
                  </div>
                  {storeSettings.defaultTaxRate > 0 && (
                    <div className="text-amber-400/90 text-[11px]">
                      Incl. {storeSettings.defaultTaxRate}% GST
                    </div>
                  )}
                </div>
              </div>

              {/* ========================================================================= */}
              {/* 1. REVIEW BILL ITEMS SECTION (User Request Primary Focus)                 */}
              {/* ========================================================================= */}
              <div className="bg-slate-950/90 rounded-2xl p-3 sm:p-4 border border-slate-800 shadow-xl space-y-3">
                {/* Review Header Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                          <span>Review Items in Bill</span>
                        </h4>
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-emerald-500/30">
                          {items.length + (pendingItem ? 1 : 0)} {(items.length + (pendingItem ? 1 : 0)) === 1 ? 'Item' : 'Items'}
                        </span>
                        {totalItemQuantitySum > 0 && (
                          <span className="hidden sm:inline-block text-[10px] text-slate-400 font-mono">
                            ({totalItemQuantitySum} total qty)
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Check quantity, rates, and totals before confirming payment
                      </p>
                    </div>
                  </div>

                  {/* Header Actions: + Add More Items & Clear All */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsManualSectionOpen(!isManualSectionOpen)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                        isManualSectionOpen
                          ? 'bg-slate-800 text-slate-300 border-slate-700'
                          : 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600/30'
                      }`}
                      title={isManualSectionOpen ? 'Close item addition form' : 'Add more items or extra amount'}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isManualSectionOpen ? 'Hide Add Item' : '+ Add Item / Extra'}</span>
                    </button>

                    {items.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllItems}
                        className="p-1.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition-all cursor-pointer"
                        title="Remove all items from bill"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Keypad / Calculator Sale Notice Banner */}
                {items.some((it) => it.id.startsWith('init-sale-') || it.name.includes('Keypad') || it.name.includes('Counter Sale')) && (
                  <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-[11px] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
                      <span>Keypad counter entry is included in this bill. Tap 🗑️ on the item to remove it if entering individual items.</span>
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {items.length === 0 && !pendingItem ? (
                  <div className="py-6 px-4 text-center rounded-2xl bg-slate-900/60 border border-dashed border-slate-800 space-y-2">
                    <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div className="text-xs text-slate-300 font-semibold">
                      No items currently recorded in this bill
                    </div>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      Add items using the form below or enter an amount to confirm sale directly.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsManualSectionOpen(true)}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Item Now</span>
                    </button>
                  </div>
                ) : (
                  /* Itemized Bill Table / Cards */
                  <div className="space-y-2">
                    <div className="max-h-64 sm:max-h-72 overflow-y-auto space-y-2 pr-1" style={{ scrollbarWidth: 'thin' }}>
                      {items.map((item, idx) => {
                        const isKeypad = item.id.startsWith('init-sale-') || item.name.includes('Keypad') || item.name.includes('Counter Sale');
                        const isEditingRate = editingItemId === item.id && editingItemField === 'rate';
                        const isEditingQty = editingItemId === item.id && editingItemField === 'quantity';

                        return (
                          <div
                            key={item.id || idx}
                            className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shadow-sm"
                          >
                            {/* Left: Index, Item Name & Unit Rate */}
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <span className="w-5 h-5 rounded-lg bg-slate-800 text-slate-400 font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                {idx + 1}
                              </span>

                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-slate-100 flex items-center gap-1.5 text-sm sm:text-base flex-wrap">
                                  <span>{item.name}</span>
                                  {item.hindiName && (
                                    <span className="text-xs text-amber-300 font-medium">({item.hindiName})</span>
                                  )}
                                  {isKeypad && (
                                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30 flex-shrink-0">
                                      Keypad
                                    </span>
                                  )}
                                </div>

                                {/* In-line Edit Rate or Rate Display */}
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {isEditingRate ? (
                                    <div className="flex items-center gap-1">
                                      <span className="text-[11px] text-slate-400 font-mono">₹</span>
                                      <input
                                        type="number"
                                        step="any"
                                        min="0"
                                        value={editingItemValue}
                                        onChange={(e) => setEditingItemValue(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEditItem(item.id)}
                                        className="w-20 bg-slate-950 border border-emerald-500 rounded-lg px-1.5 py-0.5 text-white font-mono text-xs focus:outline-none"
                                        autoFocus
                                      />
                                      <span className="text-[10px] text-slate-400">/{item.unit}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveEditItem(item.id)}
                                        className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                                        title="Save Rate"
                                      >
                                        <Check className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleCancelEditItem}
                                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer"
                                        title="Cancel"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                      <span className="font-mono">₹{item.rate} / {item.unit}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditItem(item.id, 'rate', item.rate)}
                                        className="p-0.5 text-slate-500 hover:text-cyan-300 rounded transition-colors cursor-pointer"
                                        title="Click to edit item price / rate"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Right: Quantity Stepper, Line Total, Delete */}
                            <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                              {/* Quantity Stepper & In-line Quantity Edit */}
                              <div className="flex items-center gap-1 bg-slate-950 px-1.5 py-1 rounded-xl border border-slate-800">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQuantity(item.id, -1)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                                  title="Decrease quantity"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>

                                {isEditingQty ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      step="any"
                                      min="0.001"
                                      value={editingItemValue}
                                      onChange={(e) => setEditingItemValue(e.target.value)}
                                      onKeyDown={(e) => e.key === 'Enter' && handleSaveEditItem(item.id)}
                                      className="w-16 bg-slate-900 border border-emerald-500 rounded-lg px-1.5 py-0.5 text-white font-mono text-xs text-center focus:outline-none"
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveEditItem(item.id)}
                                      className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                                      title="Save quantity"
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditItem(item.id, 'quantity', item.quantity)}
                                    className="font-mono font-bold text-white text-xs px-1.5 min-w-[32px] text-center hover:text-cyan-300 hover:underline cursor-pointer"
                                    title="Click to type exact quantity"
                                  >
                                    {item.quantity} {item.unit}
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQuantity(item.id, 1)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                                  title="Increase quantity"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Line Total */}
                              <div className="text-right min-w-[72px]">
                                <span className="font-mono font-bold text-emerald-400 text-sm">
                                  ₹{item.total.toFixed(2)}
                                </span>
                              </div>

                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* Pending Item Live Preview in the List if currently typed in form */}
                      {pendingItem && (
                        <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 border-dashed">
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="font-medium text-emerald-200 truncate flex items-center gap-1.5">
                              <span>{pendingItem.name}</span>
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-bold">
                                Typing (Will be added)
                              </span>
                            </div>
                            <div className="text-[10px] text-emerald-400/80 font-mono">
                              {pendingItem.quantity} {pendingItem.unit} @ ₹{pendingItem.rate}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="font-mono font-bold text-emerald-300 text-sm">
                              +₹{pendingItem.total.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Review Summary Breakdown Bar */}
                    <div className="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2 mt-2">
                      <div className="text-slate-400 text-[11px] flex items-center gap-2">
                        <span>Items Count: <strong className="text-slate-200 font-mono">{items.length}</strong></span>
                        {totalItemQuantitySum > 0 && (
                          <>
                            <span>•</span>
                            <span>Total Units: <strong className="text-slate-200 font-mono">{totalItemQuantitySum}</strong></span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-right">
                        {storeSettings.defaultTaxRate > 0 && (
                          <span className="text-[11px] text-amber-400/90">
                            Incl. {storeSettings.defaultTaxRate}% GST
                          </span>
                        )}
                        <div className="text-xs">
                          <span className="text-slate-400 mr-1.5">Items Total:</span>
                          <strong className="font-mono font-bold text-emerald-400 text-sm">
                            ₹{liveDisplayTotal.toFixed(2)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ========================================================================= */}
              {/* 2. COLLAPSIBLE ADD ITEMS MANUALLY & AMOUNT ACCORDION                       */}
              {/* ========================================================================= */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3 sm:p-3.5 space-y-3 shadow-md">
                {/* Section Header with Expand/Collapse Toggle */}
                <button
                  type="button"
                  onClick={() => setIsManualSectionOpen(!isManualSectionOpen)}
                  className="w-full flex items-center justify-between text-left transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0">
                      <PackagePlus className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5 group-hover:text-cyan-300 transition-colors">
                        <span>Add Items Manually & Extra Amount</span>
                      </h4>
                      <p className="text-[10px] text-slate-400">Add extra products, loose spices, or lump-sum additions to this bill</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-cyan-400 group-hover:text-cyan-300 font-semibold">
                    <span>{isManualSectionOpen ? 'Collapse' : '+ Add Item'}</span>
                    {isManualSectionOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </div>
                </button>

                {isManualSectionOpen && (
                  <div className="space-y-3 pt-2 border-t border-slate-800">
                    {/* Fast Kirana Item 1-Tap Preset Tags */}
                    <div>
                      <div className="text-[10px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-cyan-400" />
                        <span>Quick Kirana Suggestions:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                        {QUICK_ITEM_SUGGESTIONS.map((sug) => (
                          <button
                            key={sug.name}
                            type="button"
                            onClick={() => handleSelectQuickSuggestion(sug)}
                            className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-medium text-slate-300 hover:text-white border border-slate-700/80 transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                          >
                            <span className="font-semibold">{sug.name}</span>
                            {sug.hindiName && (
                              <span className="text-[10px] text-amber-300 font-normal">({sug.hindiName})</span>
                            )}
                            <span className="text-[10px] text-emerald-400 font-mono">₹{sug.defaultRate}/{sug.unit}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Manual Item Input Grid: Name, Qty, Unit, Rate, Amount */}
                    <form onSubmit={handleAddManualItem} className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                        {/* 1. Item Name (span 5) */}
                        <div className="sm:col-span-5">
                          <label className="text-[11px] text-slate-400 block mb-1 font-medium">
                            Item Name:
                          </label>
                          <input
                            type="text"
                            value={manualName}
                            onChange={(e) => setManualName(e.target.value)}
                            placeholder="e.g. Sugar, Jeera, Atta, Biscuit"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        {/* 2. Quantity & Unit (span 3) */}
                        <div className="sm:col-span-3">
                          <label className="text-[11px] text-slate-400 block mb-1 font-medium">
                            Quantity:
                          </label>
                          <div className="flex gap-1">
                            <input
                              type="number"
                              step="any"
                              min="0.001"
                              value={manualQuantity}
                              onChange={(e) => handleQuantityChange(e.target.value)}
                              placeholder="1"
                              className="w-16 bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-white font-mono text-xs font-bold text-center focus:outline-none focus:border-emerald-500"
                            />
                            <select
                              value={manualUnit}
                              onChange={(e) => setManualUnit(e.target.value as UnitType)}
                              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-1.5 py-1.5 text-white text-[11px] focus:outline-none focus:border-emerald-500 cursor-pointer"
                            >
                              <option value="pcs">pcs</option>
                              <option value="kg">kg</option>
                              <option value="g">g</option>
                              <option value="packet">packet</option>
                              <option value="litre">litre</option>
                              <option value="ml">ml</option>
                              <option value="pouch">pouch</option>
                              <option value="dozen">dozen</option>
                              <option value="box">box</option>
                              <option value="item">item</option>
                            </select>
                          </div>
                        </div>

                        {/* 3. Rate / Price per unit (span 2) */}
                        <div className="sm:col-span-2">
                          <label className="text-[11px] text-slate-400 block mb-1 font-medium">
                            Rate (₹):
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={manualRate}
                            onChange={(e) => handleRateChange(e.target.value)}
                            placeholder="Rate"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-white font-mono text-xs font-semibold focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        {/* 4. Total Amount (span 2) */}
                        <div className="sm:col-span-2">
                          <label className="text-[11px] text-emerald-400 block mb-1 font-bold">
                            Amount (₹):
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={manualAmount}
                            onChange={(e) => handleAmountChange(e.target.value)}
                            placeholder="Amount"
                            className="w-full bg-slate-900 border border-emerald-500/60 rounded-xl px-2 py-1.5 text-emerald-300 font-mono text-xs font-bold focus:outline-none focus:border-emerald-400"
                          />
                        </div>
                      </div>

                      {/* Action Buttons for Adding Item and Adding Amount */}
                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <button
                          type="submit"
                          className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                        >
                          <Plus className="w-4 h-4 text-emerald-100" />
                          <span>Add Item to Bill</span>
                          {pendingItem && (
                            <span className="font-mono bg-emerald-700 px-2 py-0.5 rounded-lg text-[11px]">
                              +₹{pendingItem.total.toFixed(2)}
                            </span>
                          )}
                        </button>

                        {pendingItem && (
                          <button
                            type="button"
                            onClick={() => handleAddManualItem()}
                            className="py-2.5 px-3 bg-teal-600 hover:bg-teal-500 active:scale-[0.99] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                            title="Add item amount to confirm sale total"
                          >
                            <IndianRupee className="w-3.5 h-3.5 text-teal-200" />
                            <span>Add Amount to Total (+₹{pendingItem.total.toFixed(2)})</span>
                          </button>
                        )}
                      </div>
                    </form>

                    {/* Quick Add Extra Amount Section */}
                    <div className="pt-2 border-t border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-300 flex items-center gap-1">
                          <IndianRupee className="w-3.5 h-3.5 text-amber-400" />
                          <span>Add Extra Amount to Sale:</span>
                        </span>
                        <span className="text-[10px] text-slate-400">Instantly adds to total</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {[10, 20, 50, 100, 200, 500].map((amtVal) => (
                          <button
                            key={amtVal}
                            type="button"
                            onClick={() => handleAddExtraAmount(amtVal)}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-amber-950/60 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold transition-all cursor-pointer active:scale-95"
                            title={`Add ₹${amtVal} to sale`}
                          >
                            +₹{amtVal}
                          </button>
                        ))}

                        {/* Custom Extra Amount Input */}
                        <div className="flex items-center gap-1 flex-1 min-w-[140px]">
                          <input
                            type="number"
                            step="any"
                            min="1"
                            value={extraAmountInput}
                            onChange={(e) => setExtraAmountInput(e.target.value)}
                            placeholder="Custom ₹"
                            className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddExtraAmount()}
                            className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors cursor-pointer flex-shrink-0"
                          >
                            + Add to Total
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Mode-Specific Sub-Panel */}
              {paymentMode === 'cash' && (
                <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-semibold">Cash Tendered by Customer:</span>
                    <span className="text-slate-400">
                      Change to Return:{' '}
                      <strong className="text-emerald-400 font-mono text-sm">₹{changeDue.toFixed(2)}</strong>
                    </span>
                  </div>

                  <input
                    type="number"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-lg font-bold"
                  />

                  {/* Fast Indian currency note chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {[50, 100, 200, 500, 2000].map((note) => (
                      <button
                        key={note}
                        type="button"
                        onClick={() => setCashTendered(note)}
                        className="px-2.5 py-1 rounded-lg bg-slate-750 hover:bg-slate-700 text-slate-300 border border-slate-600 text-xs font-mono font-semibold cursor-pointer"
                      >
                        ₹{note}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCashTendered(amount)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 text-xs font-semibold cursor-pointer"
                    >
                      Exact (₹{amount.toFixed(0)})
                    </button>
                  </div>
                </div>
              )}

              {paymentMode === 'online_upi' && (
                <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80 flex flex-col items-center text-center space-y-3">
                  <div className="bg-white p-2.5 rounded-2xl shadow-xl">
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt="UPI Payment QR" className="w-48 h-48 rounded-lg" />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-400 font-medium">
                        Generating Dynamic QR...
                      </div>
                    )}
                  </div>

                  <div className="space-y-0.5 text-xs">
                    <div className="font-bold text-white text-sm">Scan to Pay ₹{amount.toFixed(2)}</div>
                    <div className="text-slate-400 font-mono text-[11px]">
                      UPI ID: {storeSettings.upiId || 'nayabmasale@upi'}
                    </div>
                    <div className="text-[10px] text-emerald-400 font-semibold">
                      Supports GPay, PhonePe, Paytm, BHIM & Any Banking App
                    </div>
                  </div>
                </div>
              )}

              {paymentMode === 'credit_udhaar' && (
                <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-amber-500/40 space-y-3">
                  <div className="flex items-center gap-1.5 text-amber-300 text-xs font-bold">
                    <AlertCircle className="w-4 h-4" />
                    <span>Customer Credit (Udhaar Khata) Entry</span>
                  </div>

                  {customers.length > 0 && (
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Select Existing Customer:</label>
                      <select
                        value={selectedCustomerId}
                        onChange={handleCustomerSelect}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                      >
                        <option value="">-- Choose Customer or Enter Below --</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.phone}) - Current Due: ₹{c.totalDue.toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Customer Details Optional Fields */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1 flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    <span>Customer Name {paymentMode === 'credit_udhaar' && '*'}</span>
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Ramesh Bhai"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    <span>Mobile No. (for WhatsApp):</span>
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="10-digit mobile"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Remarks / Note (Optional):</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. 500g Jeera + 1kg Atta parcel"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>

              {/* Bottom Confirm Sale Button & Quick Cash Drawer Action */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={handleFinishSale}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-99 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-950/80 text-sm flex items-center justify-center gap-2 transition-all cursor-pointer border border-emerald-400/40"
                >
                  <CheckCircle className="w-5 h-5 text-emerald-200" />
                  <span>Confirm Sale & Record (₹{liveDisplayTotal.toFixed(2)})</span>
                  {pendingAdditions > 0 && (
                    <span className="text-[11px] bg-emerald-700 px-2 py-0.5 rounded-full text-emerald-100 border border-emerald-300/40">
                      (+₹{pendingAdditions.toFixed(2)} item added)
                    </span>
                  )}
                </button>

                <div className="flex items-center justify-between px-1 text-xs">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Cash Drawer opens automatically on Confirm Sale</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      kickCashDrawer();
                      setPrintStatus('POS Cash Drawer opened!');
                      setTimeout(() => setPrintStatus(''), 2500);
                    }}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-amber-300 hover:text-amber-200 border border-amber-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Manual open cash drawer now"
                  >
                    <Vault className="w-3.5 h-3.5 text-amber-400" />
                    <span>Open Drawer Now</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

