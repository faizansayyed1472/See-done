import React, { useState } from 'react';
import { X, ArrowDownCircle, Check, Tag } from 'lucide-react';
import { Transaction } from '../types';
import { playKeySound } from '../utils/audio';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAmount: number;
  onRecordExpense: (expense: Omit<Transaction, 'id' | 'receiptNumber' | 'timestamp'>) => void;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  initialAmount,
  onRecordExpense,
}) => {
  const [amount, setAmount] = useState<number>(initialAmount);
  const [category, setCategory] = useState<string>('Inventory Stock');
  const [partyName, setPartyName] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'online_upi'>('cash');

  if (!isOpen) return null;

  const quickExpenseCategories = [
    'Inventory Stock',
    'Wholesale Mandi Payment',
    'Packaging & Carry Bags',
    'Shop Rent / Kiraya',
    'Electricity / Power Bill',
    'Chai / Staff Snacks',
    'Transport / Auto Rikshaw',
    'Miscellaneous Expense',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;

    playKeySound('action');

    onRecordExpense({
      type: 'expense',
      amount,
      paymentMode,
      customerName: partyName.trim() || undefined,
      remarks: `${category}${remarks ? ` - ${remarks.trim()}` : ''}`,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/95">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <ArrowDownCircle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Record Store Expense</h3>
              <p className="text-xs text-slate-400">Deduct payout from daily register</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 text-xs">
          {/* Amount */}
          <div>
            <label className="text-slate-300 font-semibold block mb-1">
              Expense Payout Amount (₹):
            </label>
            <input
              type="number"
              required
              step="any"
              min="1"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xl font-bold font-mono text-amber-400"
            />
          </div>

          {/* Quick Category Chips */}
          <div>
            <label className="text-slate-400 block mb-1.5 font-medium flex items-center gap-1">
              <Tag className="w-3.5 h-3.5" />
              <span>Category:</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {quickExpenseCategories.map((cat, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    category === cat
                      ? 'bg-amber-600/30 text-amber-300 border border-amber-500'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Vendor / Supplier Name */}
          <div>
            <label className="text-slate-300 block mb-1">
              Paid To (Vendor / Supplier / Person):
            </label>
            <input
              type="text"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              placeholder="e.g. Khari Baoli Spices Wholesaler"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
            />
          </div>

          {/* Payment Mode */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-slate-300 block mb-1">Paid Via:</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
              >
                <option value="cash">Cash from Counter</option>
                <option value="online_upi">Online / UPI Bank</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 block mb-1">Details / Bill No.:</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. 50kg Mirch sack"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold rounded-xl shadow-lg shadow-amber-950/60 text-sm flex items-center justify-center gap-2 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Record Expense Payout (-₹{amount.toFixed(2)})</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
