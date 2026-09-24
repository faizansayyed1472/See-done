import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, QrCode, CheckCircle, Copy, Check } from 'lucide-react';
import { StoreSettings } from '../types';
import { copyToClipboard } from '../utils/clipboard';

interface QuickUpiQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAmount: number;
  storeSettings: StoreSettings;
  onRecordSaleAsUpi: (amount: number) => void;
}

export const QuickUpiQrModal: React.FC<QuickUpiQrModalProps> = ({
  isOpen,
  onClose,
  initialAmount,
  storeSettings,
  onRecordSaleAsUpi,
}) => {
  const [amount, setAmount] = useState<number>(initialAmount);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    setAmount(initialAmount || 100);
  }, [initialAmount, isOpen]);

  useEffect(() => {
    if (!isOpen || amount <= 0) return;

    const receiptNo = `QR-${Date.now().toString().slice(-6)}`;
    const upiUrl = `upi://pay?pa=${encodeURIComponent(
      storeSettings.upiId || 'nayabmasale@upi'
    )}&pn=${encodeURIComponent(
      storeSettings.shopName || 'Nayab Masale & Kirana'
    )}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent('QuickPay ' + receiptNo)}`;

    QRCode.toDataURL(upiUrl, {
      width: 260,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR error:', err));
  }, [amount, storeSettings, isOpen]);

  if (!isOpen) return null;

  const handleCopyUpiId = async () => {
    await copyToClipboard(storeSettings.upiId || 'nayabmasale@upi');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMarkPaid = () => {
    onRecordSaleAsUpi(amount);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
              <QrCode className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Instant UPI QR Code</h3>
              <p className="text-[11px] text-slate-400">{storeSettings.shopName}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col items-center text-center space-y-3">
          {/* Amount Controller */}
          <div className="w-full bg-slate-950 p-2.5 rounded-2xl border border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400 ml-1">Pay Amount:</span>
            <div className="flex items-center gap-1">
              <span className="text-cyan-400 text-lg font-bold">₹</span>
              <input
                type="number"
                step="any"
                min="1"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="w-28 bg-transparent text-right text-xl font-bold font-mono text-cyan-300 focus:outline-none"
              />
            </div>
          </div>

          {/* Rendered QR Card */}
          <div className="bg-white p-3 rounded-2xl shadow-xl border-4 border-slate-800">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="UPI QR" className="w-52 h-52 rounded-lg" />
            ) : (
              <div className="w-52 h-52 flex items-center justify-center text-xs text-slate-400">
                Generating QR...
              </div>
            )}
          </div>

          {/* UPI ID info */}
          <div className="space-y-1 w-full text-xs">
            <div className="flex items-center justify-center gap-1.5 text-slate-300 font-mono bg-slate-800/80 py-1.5 px-3 rounded-xl border border-slate-700">
              <span className="truncate max-w-[200px]">{storeSettings.upiId || 'nayabmasale@upi'}</span>
              <button
                onClick={handleCopyUpiId}
                className="text-cyan-400 hover:text-cyan-300 ml-1"
                title="Copy UPI ID"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <p className="text-[10px] text-slate-500">
              Works with PhonePe, Google Pay, Paytm, BHIM UPI
            </p>
          </div>

          {/* Mark as paid button */}
          <div className="w-full pt-2">
            <button
              onClick={handleMarkPaid}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5 transition-all"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Customer Scanned & Paid (Record Sale)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
