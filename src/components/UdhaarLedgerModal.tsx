import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  Search,
  Plus,
  Share2,
  CheckCircle,
  Phone,
  User,
  AlertCircle,
  IndianRupee,
} from 'lucide-react';
import { CustomerUdhaar, StoreSettings } from '../types';

interface UdhaarLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: CustomerUdhaar[];
  onSettlePayment: (customerId: string, amount: number) => void;
  onAddCustomer: (customer: CustomerUdhaar) => void;
  storeSettings: StoreSettings;
}

export const UdhaarLedgerModal: React.FC<UdhaarLedgerModalProps> = ({
  isOpen,
  onClose,
  customers,
  onSettlePayment,
  onAddCustomer,
  storeSettings,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCustForSettle, setSelectedCustForSettle] = useState<CustomerUdhaar | null>(null);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [showNewCustModal, setShowNewCustModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [outletFilter, setOutletFilter] = useState<string>(() => storeSettings.activeStoreId || 'all');

  useEffect(() => {
    if (storeSettings.activeStoreId) {
      setOutletFilter(storeSettings.activeStoreId);
    }
  }, [storeSettings.activeStoreId, isOpen]);

  if (!isOpen) return null;

  const activeStoreId = storeSettings.activeStoreId || 'store-1';

  const outletMatchingCustomers = customers.filter((c) => {
    if (outletFilter === 'all') return true;
    const matchId = c.outletId || c.storeId;
    if (matchId) return matchId === outletFilter;
    return outletFilter === 'store-1';
  });

  const totalOutstanding = outletMatchingCustomers.reduce((sum, c) => sum + c.totalDue, 0);

  const filtered = outletMatchingCustomers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  const handleSettleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustForSettle || settleAmount <= 0) return;
    onSettlePayment(selectedCustForSettle.id, settleAmount);
    setSelectedCustForSettle(null);
    setSettleAmount(0);
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newCust: CustomerUdhaar = {
      id: `cust-${Date.now()}`,
      name: newName.trim(),
      phone: newPhone.trim() || 'Not specified',
      totalDue: 0,
      lastActive: new Date().toISOString(),
      notes: newNotes.trim() || undefined,
      storeId: activeStoreId,
      outletId: activeStoreId,
      outletName: storeSettings.shopName,
    };

    onAddCustomer(newCust);
    setShowNewCustModal(false);
    setNewName('');
    setNewPhone('');
    setNewNotes('');
  };

  const generateWhatsAppReminder = (c: CustomerUdhaar) => {
    const text = `Namaste ${c.name} ji,\nThis is a friendly reminder from *${storeSettings.shopName}*.\nYour outstanding Udhaar balance is: *₹${c.totalDue.toFixed(2)}*.\n\nYou can pay via cash or UPI: *${storeSettings.upiId}*.\nDhanyawad / Thank you! 🙏`;
    const cleanPhone = c.phone.replace(/[^0-9]/g, '');
    const phoneParam = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    return `https://api.whatsapp.com/send?phone=${phoneParam}&text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/95">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Customer Udhaar Khata</h3>
              <p className="text-xs text-slate-400">Credit balance ledger & reminders</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowNewCustModal(true)}
              className="px-2.5 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Account</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Total Outstanding Banner */}
        <div className="p-4 bg-gradient-to-r from-amber-950/60 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">Total Customer Udhaar Pending:</span>
            <div className="text-2xl font-bold font-mono text-amber-400">
              ₹{totalOutstanding.toFixed(2)}
            </div>
          </div>
          <div className="text-right text-xs text-slate-400">
            <span>{outletMatchingCustomers.length} Accounts Listed</span>
          </div>
        </div>

        {/* Outlet Selector Bar */}
        <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-400 font-medium">Outlet:</span>
          <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-xl text-xs">
            <button
              onClick={() => setOutletFilter(activeStoreId)}
              className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                outletFilter === activeStoreId
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {storeSettings.shopName || 'Current Outlet'}
            </button>
            <button
              onClick={() => setOutletFilter('all')}
              className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                outletFilter === 'all'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Outlets
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-800 bg-slate-900/60">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer by name or phone..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Customers List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filtered.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-center p-4">
              <BookOpen className="w-8 h-8 text-slate-700 mb-2" />
              <p className="text-xs text-slate-400">No customer credit records found.</p>
            </div>
          ) : (
            filtered.map((c) => (
              <div
                key={c.id}
                className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-sm truncate">{c.name}</span>
                    {c.totalDue > 0 && (
                      <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.2 rounded border border-red-500/30">
                        Due
                      </span>
                    )}
                  </div>
                  <div className="text-slate-400 text-[11px] flex items-center gap-2 mt-0.5">
                    <span>📞 {c.phone}</span>
                    <span>• {new Date(c.lastActive).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-bold font-mono text-amber-300">
                      ₹{c.totalDue.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-500">Pending</div>
                  </div>

                  <div className="flex items-center gap-1">
                    {c.totalDue > 0 && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedCustForSettle(c);
                            setSettleAmount(c.totalDue);
                          }}
                          className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-lg text-xs font-bold border border-emerald-500/30 transition-all"
                          title="Record Payment Received (Jama)"
                        >
                          Jama
                        </button>

                        <a
                          href={generateWhatsAppReminder(c)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-slate-700 hover:bg-emerald-600 text-slate-300 hover:text-white rounded-lg transition-colors"
                          title="Send WhatsApp Payment Reminder"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Settle Payment Modal Sub-dialog */}
        {selectedCustForSettle && (
          <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white">
                Receive Payment (Jama) from: <strong>{selectedCustForSettle.name}</strong>
              </span>
              <button
                onClick={() => setSelectedCustForSettle(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSettleSubmit} className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                min="1"
                max={selectedCustForSettle.totalDue}
                value={settleAmount}
                onChange={(e) => setSettleAmount(parseFloat(e.target.value) || 0)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm font-bold"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Confirm Jama (₹{settleAmount.toFixed(0)})
              </button>
            </form>
          </div>
        )}

        {/* New Customer Account Sub-dialog */}
        {showNewCustModal && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h4 className="font-bold text-sm text-white">New Customer Khata</h4>
                <button
                  onClick={() => setShowNewCustModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateCustomer} className="space-y-2.5 text-xs">
                <div>
                  <label className="text-slate-300 block mb-1">Customer Full Name:</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Salim Bhai"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Mobile Phone (10 digits):</label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Address / Note (Optional):</label>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="e.g. Shop #4, Main Market"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewCustModal(false)}
                    className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold"
                  >
                    Save Khata
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
