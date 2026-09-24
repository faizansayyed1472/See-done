import React, { useState, useEffect } from 'react';
import { X, Scale, IndianRupee, Plus, Check } from 'lucide-react';
import { Product, UnitType, BillItem } from '../types';
import { playKeySound } from '../utils/audio';

interface CustomWeightModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onConfirmAdd: (item: Omit<BillItem, 'id'>) => void;
}

export const CustomWeightModal: React.FC<CustomWeightModalProps> = ({
  isOpen,
  onClose,
  product,
  onConfirmAdd,
}) => {
  const [inputMode, setInputMode] = useState<'weight' | 'rupees'>('weight');
  const [weightValue, setWeightValue] = useState<string>('');
  const [weightUnit, setWeightUnit] = useState<UnitType>('g');
  const [rupeesValue, setRupeesValue] = useState<string>('');
  const [customRate, setCustomRate] = useState<number>(0);

  useEffect(() => {
    if (product) {
      setCustomRate(product.rate);
      setWeightUnit('g');
      // No pre-added quantity: start blank so merchant inputs custom weight
      setWeightValue('');
      setRupeesValue('');
      setInputMode('weight');
    }
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  // Rate normalized to per-kg or per-g
  const baseRatePerKg = product.unit === 'g' ? product.rate * 1000 : product.rate;

  // Computed values
  let calculatedWeightInKg = 0;
  let calculatedTotal = 0;

  if (inputMode === 'weight') {
    const numWeight = parseFloat(weightValue) || 0;
    if (weightUnit === 'g') {
      calculatedWeightInKg = numWeight / 1000;
    } else if (weightUnit === 'quintal') {
      calculatedWeightInKg = numWeight * 100;
    } else {
      calculatedWeightInKg = numWeight;
    }
    calculatedTotal = Math.round(calculatedWeightInKg * baseRatePerKg * 100) / 100;
  } else {
    const numRupees = parseFloat(rupeesValue) || 0;
    calculatedTotal = numRupees;
    if (baseRatePerKg > 0) {
      calculatedWeightInKg = numRupees / baseRatePerKg;
    }
  }

  // Weight chips
  const weightPresets = [
    { label: '50g', weight: 50, unit: 'g' as UnitType },
    { label: '100g', weight: 100, unit: 'g' as UnitType },
    { label: '250g', weight: 250, unit: 'g' as UnitType },
    { label: '500g', weight: 500, unit: 'g' as UnitType },
    { label: '1 kg', weight: 1, unit: 'kg' as UnitType },
    { label: '2 kg', weight: 2, unit: 'kg' as UnitType },
    { label: '5 kg', weight: 5, unit: 'kg' as UnitType },
    { label: '10 kg', weight: 10, unit: 'kg' as UnitType },
  ];

  // Rupee quick chips
  const rupeePresets = [10, 20, 50, 100, 200, 500];

  const handleSelectWeightPreset = (presetWeight: number, presetUnit: UnitType) => {
    playKeySound('num');
    setInputMode('weight');
    setWeightValue(presetWeight.toString());
    setWeightUnit(presetUnit);
  };

  const handleSelectRupeePreset = (rupees: number) => {
    playKeySound('num');
    setInputMode('rupees');
    setRupeesValue(rupees.toString());
  };

  const handleAppendNumber = (digit: string) => {
    playKeySound('num');
    if (inputMode === 'weight') {
      if (digit === '.' && weightValue.includes('.')) return;
      setWeightValue((prev) => prev + digit);
    } else {
      if (digit === '.' && rupeesValue.includes('.')) return;
      setRupeesValue((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    playKeySound('clear');
    if (inputMode === 'weight') {
      setWeightValue((prev) => prev.slice(0, -1));
    } else {
      setRupeesValue((prev) => prev.slice(0, -1));
    }
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (calculatedTotal <= 0) return;

    playKeySound('action');

    // Final quantity and unit formatting
    let finalQty = 0;
    let finalUnit: UnitType = weightUnit;

    if (inputMode === 'weight') {
      finalQty = parseFloat(weightValue) || 0;
      finalUnit = weightUnit;
    } else {
      // By rupees: save as grams if < 1kg, else kg
      if (calculatedWeightInKg < 1) {
        finalQty = Math.round(calculatedWeightInKg * 1000 * 10) / 10;
        finalUnit = 'g';
      } else {
        finalQty = Math.round(calculatedWeightInKg * 1000) / 1000;
        finalUnit = 'kg';
      }
    }

    onConfirmAdd({
      productId: product.id,
      name: product.name,
      hindiName: product.hindiName,
      quantity: finalQty,
      unit: finalUnit,
      rate: customRate,
      total: calculatedTotal,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header with Product Details */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center">
              <Scale className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-lg sm:text-xl text-white truncate">{product.name}</h3>
              </div>
              {product.hindiName && (
                <p className="text-sm text-amber-300 font-semibold">{product.hindiName}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block">Selling Rate</span>
              <span className="text-xs sm:text-sm font-bold font-mono text-emerald-400">
                ₹{customRate}/{product.unit}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleConfirm} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Input Mode Selector: By Weight vs By Rupees */}
          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setInputMode('weight');
                playKeySound('num');
              }}
              className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                inputMode === 'weight'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>1. Enter Weight</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setInputMode('rupees');
                playKeySound('num');
              }}
              className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                inputMode === 'rupees'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <IndianRupee className="w-3.5 h-3.5" />
              <span>2. Enter Rupees</span>
            </button>
          </div>

          {/* Mode 1: Weight Input & Quick Weight Presets */}
          {inputMode === 'weight' ? (
            <div className="space-y-3">
              {/* Quick Kirana Weight Presets */}
              <div>
                <label className="text-slate-400 font-semibold block mb-1.5">
                  Fast Weight Presets:
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {weightPresets.map((preset, idx) => {
                    const isSelected =
                      weightValue === preset.weight.toString() && weightUnit === preset.unit;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectWeightPreset(preset.weight, preset.unit)}
                        className={`p-2 rounded-xl text-center border font-bold text-xs transition-all ${
                          isSelected
                            ? 'bg-purple-600 text-white border-purple-400 shadow-md ring-1 ring-purple-400'
                            : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-750 hover:text-white'
                        }`}
                      >
                        <div>{preset.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Weight Input with Unit Selector */}
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
                <label className="text-slate-400 block font-semibold">
                  Or Type Custom Weight:
                </label>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      required
                      autoFocus
                      placeholder="e.g. 250, 1.5, 75..."
                      value={weightValue}
                      onChange={(e) => setWeightValue(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-lg font-bold focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <select
                    value={weightUnit}
                    onChange={(e) => setWeightUnit(e.target.value as UnitType)}
                    className="w-28 bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-white font-bold text-xs focus:border-purple-500 focus:outline-none"
                  >
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="quintal">quintal</option>
                    <option value="litre">litre</option>
                    <option value="packet">packet</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            /* Mode 2: By Rupees / Amount */
            <div className="space-y-3">
              <div>
                <label className="text-slate-400 font-semibold block mb-1.5">
                  Quick Amount Presets:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {rupeePresets.map((amt) => {
                    const isSelected = rupeesValue === amt.toString();
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleSelectRupeePreset(amt)}
                        className={`p-2.5 rounded-xl text-center border font-mono font-bold text-sm transition-all ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-400 shadow-md ring-1 ring-emerald-400'
                            : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-750'
                        }`}
                      >
                        ₹{amt}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
                <label className="text-slate-400 block font-semibold">
                  Or Enter Custom Rupees:
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 font-bold text-lg font-mono">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    autoFocus
                    placeholder="e.g. 20, 35, 150..."
                    value={rupeesValue}
                    onChange={(e) => setRupeesValue(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3.5 py-2.5 text-white font-mono text-lg font-bold focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Calculation Preview Summary Box */}
          <div className="p-3.5 bg-gradient-to-r from-slate-900 to-slate-850 rounded-2xl border border-slate-700/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Calculated Weight:</span>
              <span className="font-mono font-bold text-purple-300 text-sm">
                {calculatedWeightInKg < 1
                  ? `${Math.round(calculatedWeightInKg * 1000)} grams (${(calculatedWeightInKg).toFixed(3)} kg)`
                  : `${calculatedWeightInKg.toFixed(3)} kg (${Math.round(calculatedWeightInKg * 1000)} g)`}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800">
              <span className="text-slate-300 font-bold text-sm">Total Item Price:</span>
              <span className="font-mono font-extrabold text-xl text-emerald-400">
                ₹{calculatedTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Quick On-Screen Touch Numpad */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleAppendNumber(digit)}
                className="h-10 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-mono text-base font-bold transition-all active:scale-95"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handleBackspace}
              className="h-10 rounded-xl bg-slate-800 hover:bg-red-950/60 text-red-400 font-mono text-xs font-bold transition-all active:scale-95 flex items-center justify-center"
            >
              DEL
            </button>
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={calculatedTotal <= 0}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 disabled:opacity-40 text-white font-extrabold text-sm shadow-lg shadow-purple-950/80 flex items-center justify-center gap-2 transition-all active:scale-99"
            >
              <Check className="w-4 h-4" />
              <span>
                Add to Bill (₹{calculatedTotal.toFixed(2)})
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
