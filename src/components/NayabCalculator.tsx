import React, { useState, useEffect, useMemo } from 'react';
import {
  RotateCcw,
  Delete,
  QrCode,
  Receipt,
  ArrowDownCircle,
  ShoppingBag,
  Volume2,
  VolumeX,
  Percent,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  History,
  Clock,
  Printer,
  Mic,
  MicOff,
  CheckCircle2,
  Vault,
} from 'lucide-react';
import { playKeySound } from '../utils/audio';
import { kickCashDrawer } from '../utils/printer';
import { Product, BillItem, CalcHistoryItem } from '../types';
import { KiranaSpiceItemSearch } from './KiranaSpiceItemSearch';
import { ActiveBillTape } from './ActiveBillTape';
import { VoiceCommandModal } from './VoiceCommandModal';
import {
  isSpeechRecognitionSupported,
  getSpeechRecognition,
  parseVoiceCommand,
} from '../utils/voiceCommandParser';
import {
  getStoredCalculationHistory,
  appendCalculationRecord,
  saveCalculationHistory,
} from '../utils/calcHistory';

export type { CalcHistoryItem };

/**
 * Safely evaluates mathematical expressions (supports +, -, *, /, ×, ÷, decimals)
 * without eval(). Respects operator precedence (* and / before + and -) and handles
 * incomplete formulas (such as trailing operators) for real-time live calculation preview.
 */
export function evaluateMathExpression(rawExpr: string): number | null {
  if (!rawExpr || !rawExpr.trim()) return null;
  // Replace symbols: × with *, ÷ with /
  let sanitized = rawExpr.replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '');
  // Remove trailing operators or spaces, or hanging decimals
  sanitized = sanitized.trim().replace(/[\+\-\*\/]+$/, '').trim().replace(/\.$/, '');
  if (!sanitized) return null;

  try {
    const tokens: (number | string)[] = [];
    const regex = /(\d+\.?\d*|\+|\-|\*|\/)/g;
    let match;
    while ((match = regex.exec(sanitized)) !== null) {
      const val = match[1];
      if (['+', '-', '*', '/'].includes(val)) {
        tokens.push(val);
      } else {
        const n = parseFloat(val);
        if (!isNaN(n)) tokens.push(n);
      }
    }

    if (tokens.length === 0) return null;

    // Handle leading negative number
    let startIdx = 0;
    const cleanTokens: (number | string)[] = [];
    if (tokens[0] === '-') {
      if (tokens.length > 1 && typeof tokens[1] === 'number') {
        cleanTokens.push(-tokens[1]);
        startIdx = 2;
      }
    }
    for (let i = startIdx; i < tokens.length; i++) {
      cleanTokens.push(tokens[i]);
    }

    if (cleanTokens.length === 0) return null;

    // Pass 1: Multiplication and Division
    const pass1: (number | string)[] = [];
    let idx = 0;
    while (idx < cleanTokens.length) {
      const tok = cleanTokens[idx];
      if (tok === '*' || tok === '/') {
        const prev = pass1.pop();
        const next = cleanTokens[idx + 1];
        if (typeof prev === 'number' && typeof next === 'number') {
          const res = tok === '*' ? prev * next : (next !== 0 ? prev / next : 0);
          pass1.push(res);
          idx += 2;
        } else {
          if (prev !== undefined) pass1.push(prev);
          idx++;
        }
      } else {
        pass1.push(tok);
        idx++;
      }
    }

    // Pass 2: Addition and Subtraction
    if (pass1.length === 0) return null;
    let result = typeof pass1[0] === 'number' ? pass1[0] : 0;
    let pendingOp: string | null = null;
    for (let j = 1; j < pass1.length; j++) {
      const tok = pass1[j];
      if (tok === '+' || tok === '-') {
        pendingOp = tok;
      } else if (typeof tok === 'number' && pendingOp) {
        if (pendingOp === '+') result += tok;
        if (pendingOp === '-') result -= tok;
        pendingOp = null;
      }
    }

    return isFinite(result) ? Math.round(result * 100) / 100 : null;
  } catch {
    return null;
  }
}

export interface NayabCalculatorProps {
  onOpenSale: (combinedAmount: number, calculatorAmount?: number) => void;
  onOpenExpense?: (currentAmount: number) => void;
  onOpenUpiQr: (combinedAmount: number, calculatorAmount?: number) => void;
  onOpenPosCatalog: () => void;
  onQuickPrintBill?: (combinedAmount: number, calculatorAmount?: number) => void;
  activeBillCount: number;
  activeBillTotal: number;
  defaultTaxRate: number;
  products?: Product[];
  activeBillItems?: BillItem[];
  onUpdateItemQuantity?: (id: string, qty: number) => void;
  onUpdateItemQty?: (id: string, qty: number) => void;
  onRemoveItem?: (id: string) => void;
  onClearBill?: () => void;
  onAddItemToBill?: (item: Omit<BillItem, 'id'>) => void;
  onAddItemsToBill?: (items: Omit<BillItem, 'id'>[]) => void;
  onSelectProductForWeight?: (product: Product) => void;
  onUpdateProduct?: (product: Product) => void;
  onAddProductToInventory?: (product: Product) => void;
  onOpenBarcodeScanner?: () => void;
  onDeleteProduct?: (productId: string) => void;
}

export type TohandsCalculatorProps = NayabCalculatorProps;

export const NayabCalculator: React.FC<NayabCalculatorProps> = ({
  onOpenSale,
  onOpenExpense,
  onOpenUpiQr,
  onOpenPosCatalog,
  onQuickPrintBill,
  activeBillCount,
  activeBillTotal,
  defaultTaxRate,
  products,
  activeBillItems,
  onUpdateItemQuantity,
  onUpdateItemQty,
  onRemoveItem,
  onClearBill,
  onAddItemToBill,
  onAddItemsToBill,
  onSelectProductForWeight,
  onUpdateProduct,
  onAddProductToInventory,
  onOpenBarcodeScanner,
  onDeleteProduct,
}) => {
  const updateItemQty = onUpdateItemQuantity || onUpdateItemQty;

  // Formula state: shows the full mathematical formula (e.g., 3+30+30+30)
  const [formula, setFormula] = useState<string>('0');
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [evaluatedResult, setEvaluatedResult] = useState<number | null>(null);
  const [lastRecordedFormula, setLastRecordedFormula] = useState<string | null>(null);

  const [memory, setMemory] = useState<number>(0);
  const [mrcTapped, setMrcTapped] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [taxRate, setTaxRate] = useState<number>(defaultTaxRate || 5);
  const [taxLabel, setTaxLabel] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(true);
  const [historyCheckIdx, setHistoryCheckIdx] = useState<number | null>(null);
  const [drawerKickFeedback, setDrawerKickFeedback] = useState<boolean>(false);

  // Calculation history tape (persists up to 500 records for owner audit reports)
  const [calcHistory, setCalcHistory] = useState<CalcHistoryItem[]>(() => getStoredCalculationHistory());

  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setCalcHistory(e.detail);
      } else {
        setCalcHistory(getStoredCalculationHistory());
      }
    };
    window.addEventListener('nayab_calc_history_updated', handleUpdate);
    return () => window.removeEventListener('nayab_calc_history_updated', handleUpdate);
  }, []);

  // Requirement 1: Record exactly 1 history of calculation when equal to sign is pressed
  const recordCalculation = (expression: string, result: number) => {
    if (!expression || !expression.trim()) return;
    const newItem = appendCalculationRecord(expression, result);
    if (newItem) {
      setCalcHistory(getStoredCalculationHistory());
      // POS Cash Drawer Integration: Trigger cash drawer when calculation is recorded
      setDrawerKickFeedback(true);
      setTimeout(() => setDrawerKickFeedback(false), 2200);
      kickCashDrawer().catch((err) => {
        console.warn('POS cash drawer kick error on record calculation:', err);
      });
    }
  };

  // Check if formula contains mathematical operators (+, -, ×, ÷, *, /)
  const hasOperator = /[+\-×÷*/]/.test(formula);

  // Requirement 2: Live Calculation Preview
  // The smaller number (e.g., 93) that updates instantly as you type before you hit the equals (=) sign
  const livePreview = useMemo<number | null>(() => {
    if (!hasOperator || isCompleted) return null;
    return evaluateMathExpression(formula);
  }, [formula, hasOperator, isCompleted]);

  // Keep total digit display auto-scrolled to latest digit without changing digit size
  const formulaDisplayRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (formulaDisplayRef.current) {
      formulaDisplayRef.current.scrollLeft = formulaDisplayRef.current.scrollWidth;
    }
  }, [formula, isCompleted]);

  // Sync with bill total if bill is active and user hasn't typed a custom calculation
  useEffect(() => {
    if (activeBillTotal > 0 && formula === '0' && !isCompleted) {
      setFormula(activeBillTotal.toFixed(2));
      setIsCompleted(true);
      setEvaluatedResult(activeBillTotal);
    }
  }, [activeBillTotal]);

  const sound = (type: 'num' | 'op' | 'action' | 'clear' | 'bill') => {
    if (soundEnabled) playKeySound(type);
  };

  // Voice Command Support using Web Speech API
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [isVoiceListening, setIsVoiceListening] = useState<boolean>(false);
  const [voiceInterim, setVoiceInterim] = useState<string>('');
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [voiceFeedbackMessage, setVoiceFeedbackMessage] = useState<string | null>(null);
  const inlineRecognitionRef = React.useRef<any>(null);
  const feedbackTimeoutRef = React.useRef<any>(null);

  const showVoiceFeedback = (msg: string) => {
    setVoiceFeedbackMessage(msg);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => {
      setVoiceFeedbackMessage(null);
    }, 4500);
  };

  const handleVoiceMicClick = () => {
    if (!isSpeechRecognitionSupported()) {
      setIsVoiceModalOpen(true);
      return;
    }
    if (isVoiceListening) {
      handleStopVoiceListening();
    } else {
      handleStartVoiceListening();
    }
  };

  const handleStartVoiceListening = () => {
    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) {
      setIsVoiceModalOpen(true);
      return;
    }

    try {
      if (inlineRecognitionRef.current) {
        try {
          inlineRecognitionRef.current.abort();
        } catch {}
      }

      const recognition = new SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      recognition.onstart = () => {
        setIsVoiceListening(true);
        setVoiceInterim('');
        setVoiceTranscript('');
        sound('action');
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            final += res[0].transcript;
          } else {
            interim += res[0].transcript;
          }
        }

        if (interim) setVoiceInterim(interim);

        if (final) {
          const cleanFinal = final.trim();
          setVoiceTranscript(cleanFinal);
          setVoiceInterim('');
          processVoiceInput(cleanFinal);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Voice recognition error:', event.error);
        setIsVoiceListening(false);
        if (event.error === 'not-allowed') {
          showVoiceFeedback('Microphone permission denied. Click Assistant to configure.');
          setIsVoiceModalOpen(true);
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          showVoiceFeedback(`Speech recognition: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsVoiceListening(false);
      };

      inlineRecognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Voice start err:', err);
      setIsVoiceModalOpen(true);
    }
  };

  const handleStopVoiceListening = () => {
    if (inlineRecognitionRef.current) {
      try {
        inlineRecognitionRef.current.abort();
      } catch {}
      inlineRecognitionRef.current = null;
    }
    setIsVoiceListening(false);
    setVoiceInterim('');
  };

  const processVoiceInput = (spoken: string) => {
    if (!onAddItemToBill) {
      showVoiceFeedback('Bill system is not available.');
      return;
    }

    const parsed = parseVoiceCommand(spoken, products || []);
    const items = parsed.items && parsed.items.length > 0
      ? parsed.items
      : parsed.item
      ? [parsed.item]
      : [];

    if (parsed.success && items.length > 0) {
      const anyNeedsRate = items.some((it) => it.needsRate);
      if (anyNeedsRate) {
        // If any product needs rate confirmation, open voice assistant modal
        setIsVoiceModalOpen(true);
      } else {
        const billItemsToAdd: Omit<BillItem, 'id'>[] = items.map((it) => ({
          productId: it.matchedProduct?.id,
          name: it.name,
          hindiName: it.hindiName,
          quantity: it.quantity,
          unit: it.unit,
          rate: it.rate,
          total: it.total,
        }));

        if (onAddItemsToBill) {
          onAddItemsToBill(billItemsToAdd);
        } else {
          billItemsToAdd.forEach((b) => onAddItemToBill(b));
        }

        sound('bill');
        showVoiceFeedback(parsed.feedbackMessage);
      }
    } else {
      showVoiceFeedback(parsed.feedbackMessage || 'Could not recognize item');
    }
  };

  useEffect(() => {
    return () => {
      if (inlineRecognitionRef.current) {
        try {
          inlineRecognitionRef.current.abort();
        } catch {}
      }
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) return;

      if (e.key >= '0' && e.key <= '9') {
        inputDigit(e.key);
      } else if (e.key === '.') {
        inputDot();
      } else if (e.key === '+') {
        inputOperator('+');
      } else if (e.key === '-') {
        inputOperator('-');
      } else if (e.key === '*') {
        inputOperator('*');
      } else if (e.key === '/') {
        e.preventDefault();
        inputOperator('/');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEquals();
      } else if (e.key === 'Backspace') {
        handleCorrect();
      } else if (e.key === 'Escape') {
        handleAllClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formula, isCompleted, evaluatedResult, lastRecordedFormula]);

  const inputDigit = (digit: string) => {
    sound('num');
    setTaxLabel(null);

    if (isCompleted) {
      setFormula(digit);
      setIsCompleted(false);
      setEvaluatedResult(null);
    } else if (formula === '0') {
      setFormula(digit);
    } else {
      setFormula(formula + digit);
    }
  };

  const inputDoubleZero = () => {
    sound('num');
    setTaxLabel(null);

    if (isCompleted) {
      setFormula('0');
      setIsCompleted(false);
      setEvaluatedResult(null);
    } else if (formula !== '0') {
      setFormula(formula + '00');
    }
  };

  const inputDot = () => {
    sound('num');
    setTaxLabel(null);

    if (isCompleted) {
      setFormula('0.');
      setIsCompleted(false);
      setEvaluatedResult(null);
      return;
    }

    // Check if the current trailing number already has a decimal
    const parts = formula.split(/[\s+\-×÷*/]+/);
    const lastPart = parts[parts.length - 1] || '';
    if (!lastPart.includes('.')) {
      if (formula.endsWith(' ') || formula === '') {
        setFormula(formula + '0.');
      } else {
        setFormula(formula + '.');
      }
    }
  };

  const inputOperator = (nextOp: '+' | '-' | '*' | '/') => {
    sound('op');
    setTaxLabel(null);
    const opSymbol = nextOp === '*' ? '×' : nextOp === '/' ? '÷' : nextOp;

    if (isCompleted && evaluatedResult !== null) {
      setFormula(`${evaluatedResult} ${opSymbol} `);
      setIsCompleted(false);
      return;
    }

    const trimmed = formula.trimEnd();
    // If formula already ends with an operator (e.g., "3 + 30 + "), replace without repeating
    if (/[\+\-×÷*/]$/.test(trimmed)) {
      const base = trimmed.slice(0, -1).trimEnd();
      setFormula(`${base} ${opSymbol} `);
    } else {
      setFormula(`${trimmed} ${opSymbol} `);
    }
  };

  // Requirement 1: Record 1 history of calculation when equal to sign press
  const handleEquals = () => {
    sound('action');
    const result = evaluateMathExpression(formula);

    if (result !== null) {
      const cleanFormula = formula.trim().replace(/[\+\-×÷*/]+$/, '').trim();
      const hasOp = /[\+\-×÷*/]/.test(cleanFormula);

      // Save to calculation history tape strictly on equals press
      if (hasOp && cleanFormula !== lastRecordedFormula) {
        recordCalculation(cleanFormula, result);
        setLastRecordedFormula(cleanFormula);
      }

      setEvaluatedResult(result);
      setIsCompleted(true);
      setFormula(cleanFormula);
    }
  };

  const handlePercentage = () => {
    sound('op');
    const match = formula.match(/^(.+?)\s*([\+\-])\s*(\d+\.?\d*)$/);
    if (match) {
      const base = evaluateMathExpression(match[1]) || 0;
      const op = match[2];
      const pct = parseFloat(match[3]);
      const pctVal = Math.round(((base * pct) / 100) * 100) / 100;
      setFormula(`${match[1]} ${op} ${pctVal}`);
    } else {
      const n = evaluateMathExpression(formula) || 0;
      const res = Math.round((n / 100) * 100) / 100;
      setFormula(String(res));
      setIsCompleted(true);
      setEvaluatedResult(res);
    }
  };

  // CORRECT: single-digit or operator backspace
  const handleCorrect = () => {
    sound('clear');
    if (isCompleted) {
      setIsCompleted(false);
      return;
    }
    const trimmed = formula.trimEnd();
    if (trimmed.length <= 1 || trimmed === '0') {
      setFormula('0');
    } else {
      if (/[\+\-×÷*/]$/.test(trimmed)) {
        setFormula(trimmed.slice(0, -1).trimEnd());
      } else {
        setFormula(trimmed.slice(0, -1));
      }
    }
  };

  // C: Clear current formula
  const handleClearEntry = () => {
    sound('clear');
    setFormula('0');
    setIsCompleted(false);
    setEvaluatedResult(null);
    setTaxLabel(null);
  };

  // AC: All Clear
  const handleAllClear = () => {
    sound('clear');
    setFormula('0');
    setIsCompleted(false);
    setEvaluatedResult(null);
    setLastRecordedFormula(null);
    setTaxLabel(null);
  };

  // TAX+: Add GST rate
  const handleTaxPlus = () => {
    sound('action');
    const baseVal = isCompleted
      ? (evaluatedResult ?? 0)
      : (livePreview ?? (evaluateMathExpression(formula) || 0));
    if (baseVal === 0) return;

    const taxAmount = Math.round(((baseVal * taxRate) / 100) * 100) / 100;
    const totalWithTax = Math.round((baseVal + taxAmount) * 100) / 100;

    setTaxLabel(`TAX+ ${taxRate}% (+₹${taxAmount.toFixed(2)})`);
    setFormula(`${baseVal} + ${taxAmount}`);
    setIsCompleted(true);
    setEvaluatedResult(totalWithTax);
    recordCalculation(`${baseVal} + ${taxRate}% GST`, totalWithTax);
  };

  // TAX-: Deduct GST rate (Calculate Base Amount)
  const handleTaxMinus = () => {
    sound('action');
    const grossVal = isCompleted
      ? (evaluatedResult ?? 0)
      : (livePreview ?? (evaluateMathExpression(formula) || 0));
    if (grossVal === 0) return;

    const baseAmount = Math.round((grossVal / (1 + taxRate / 100)) * 100) / 100;
    const taxDeducted = Math.round((grossVal - baseAmount) * 100) / 100;

    setTaxLabel(`TAX- ${taxRate}% (Base: ₹${baseAmount}, Tax: ₹${taxDeducted})`);
    setFormula(String(baseAmount));
    setIsCompleted(true);
    setEvaluatedResult(baseAmount);
    recordCalculation(`${grossVal} - ${taxRate}% Base`, baseAmount);
  };

  // Memory Operations
  const handleMemoryAdd = () => {
    sound('action');
    const val = isCompleted ? (evaluatedResult ?? 0) : (livePreview ?? evaluateMathExpression(formula) ?? 0);
    setMemory((m) => m + val);
    setMrcTapped(false);
  };

  const handleMemorySubtract = () => {
    sound('action');
    const val = isCompleted ? (evaluatedResult ?? 0) : (livePreview ?? evaluateMathExpression(formula) ?? 0);
    setMemory((m) => m - val);
    setMrcTapped(false);
  };

  const handleMrc = () => {
    sound('action');
    if (!mrcTapped) {
      // First tap: Recall memory
      setFormula(String(memory));
      setIsCompleted(true);
      setEvaluatedResult(memory);
      setMrcTapped(true);
    } else {
      // Second tap: Clear memory
      setMemory(0);
      setMrcTapped(false);
    }
  };

  // Check past calculation steps from calculation history
  const handleCheckPrev = () => {
    sound('op');
    if (calcHistory.length === 0) return;
    const nextIdx = historyCheckIdx === null ? 0 : Math.min(calcHistory.length - 1, historyCheckIdx + 1);
    setHistoryCheckIdx(nextIdx);
    const step = calcHistory[nextIdx];
    setFormula(step.expression);
    setIsCompleted(true);
    setEvaluatedResult(step.result);
  };

  const handleCheckNext = () => {
    sound('op');
    if (calcHistory.length === 0 || historyCheckIdx === null) return;
    const nextIdx = Math.max(0, historyCheckIdx - 1);
    setHistoryCheckIdx(nextIdx);
    const step = calcHistory[nextIdx];
    setFormula(step.expression);
    setIsCompleted(true);
    setEvaluatedResult(step.result);
  };

  const calcAmount = isCompleted
    ? (evaluatedResult ?? 0)
    : (livePreview ?? (evaluateMathExpression(formula) || 0));

  // Combined sale total: active bill items total + calculator amount (if any)
  const combinedSaleTotal = Math.round((activeBillTotal + (calcAmount > 0 ? calcAmount : 0)) * 100) / 100;
  const currentNumericTotal = combinedSaleTotal > 0 ? combinedSaleTotal : (calcAmount || activeBillTotal || 0);

  return (
    <div className="w-full max-w-lg mx-auto space-y-2.5">
      {/* Main NAYAB Calculator Hardware Body - Compact countertop casing */}
      <div className="w-full bg-gradient-to-b from-slate-900 via-slate-925 to-slate-950 rounded-2xl sm:rounded-3xl p-3 sm:p-4 md:p-5 shadow-2xl border border-slate-800 ring-1 ring-slate-800/80">
        {/* Casing Brand Header & Hardware Indicators - Slim & Compact */}
        <div className="flex items-center justify-between pb-1.5 px-0.5 border-b border-slate-800/80 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse"></div>
            <span className="font-extrabold text-white tracking-wider text-xs">NAYAB</span>
            <span className="text-[9px] bg-slate-800 px-1 py-0.2 rounded text-cyan-400 font-mono font-semibold border border-slate-700">
              SMART 12D
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Voice Command Microphone Button - Compact */}
            <button
              id="calculator-voice-mic-trigger"
              onClick={handleVoiceMicClick}
              className={`relative flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-bold transition-all cursor-pointer select-none ${
                isVoiceListening
                  ? 'bg-red-500/20 text-red-300 border-red-500/70 ring-2 ring-red-500/40 animate-pulse'
                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40 hover:border-emerald-400'
              }`}
              title="Voice Command: Speak to add items to current bill (e.g. 'Add 2kg Sugar')"
            >
              <Mic className={`w-3 h-3 ${isVoiceListening ? 'text-red-400 animate-bounce' : 'text-emerald-400'}`} />
              <span className="hidden xs:inline">{isVoiceListening ? 'Listening...' : 'Voice'}</span>
              {isVoiceListening && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping absolute -top-0.5 -right-0.5" />
              )}
            </button>

            {/* Tax selector pill - Compact */}
            <div className="flex items-center gap-1 bg-slate-800/90 px-1.5 py-0.5 rounded-md border border-slate-700/60 text-[10px]">
              <span className="text-slate-400">GST:</span>
              <select
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="bg-transparent text-amber-300 font-bold focus:outline-none cursor-pointer text-[10px]"
              >
                <option value={0} className="bg-slate-900 text-white">0%</option>
                <option value={5} className="bg-slate-900 text-white">5%</option>
                <option value={12} className="bg-slate-900 text-white">12%</option>
                <option value={18} className="bg-slate-900 text-white">18%</option>
                <option value={28} className="bg-slate-900 text-white">28%</option>
              </select>
            </div>

            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1 text-slate-400 hover:text-white transition-colors"
              title={soundEnabled ? 'Mute Keypad Sound' : 'Enable Keypad Sound'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-600" />}
            </button>

            {/* Quick Cash Drawer Kick Key */}
            <button
              id="calculator-cash-drawer-open-btn"
              onClick={async () => {
                sound('action');
                setDrawerKickFeedback(true);
                setTimeout(() => setDrawerKickFeedback(false), 2200);
                await kickCashDrawer();
              }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-[10px] font-bold transition-all cursor-pointer select-none active:scale-95"
              title="Open Cash Drawer (ESC/POS pulse to cash drawer)"
            >
              <Vault className="w-3 h-3 text-amber-400" />
              <span className="hidden xs:inline">Drawer</span>
            </button>
          </div>
        </div>

        {/* Retro LCD Screen Bezel - Compact to fit formula and preview cleanly */}
        <div className="mt-2 bg-stone-900 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-2xl border-2 border-stone-800 shadow-inner relative overflow-hidden flex flex-col justify-between">
          {/* Subtle LCD green glass background glow */}
          <div className="absolute inset-0 bg-emerald-950/20 pointer-events-none"></div>

          {/* Top Status & History Bar */}
          <div className="relative flex items-center justify-between text-[11px] sm:text-xs font-mono text-emerald-400/80 pb-1 border-b border-emerald-900/30">
            <div className="flex items-center gap-1.5 truncate">
              {memory !== 0 && (
                <span className="bg-emerald-400/20 text-emerald-300 px-1 py-0.2 rounded font-bold text-[10px]">M</span>
              )}
              {taxLabel && (
                <span className="text-amber-300 bg-amber-400/10 px-1.5 py-0.2 rounded font-medium text-[10px]">{taxLabel}</span>
              )}
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                {isCompleted ? (
                  <span className="text-emerald-300">TOTAL (=)</span>
                ) : hasOperator ? (
                  <span className="text-cyan-300">CALCULATING</span>
                ) : (
                  <span className="text-emerald-500/80">READY</span>
                )}
              </span>
              {isCompleted && (
                <span className="text-[9px] bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 px-1.5 py-0.2 rounded font-mono font-bold">
                  Recorded ✓
                </span>
              )}
              {drawerKickFeedback && (
                <span className="text-[9px] bg-amber-500/25 text-amber-200 border border-amber-500/40 px-1.5 py-0.2 rounded font-mono font-bold flex items-center gap-1 animate-pulse">
                  <Vault className="w-2.5 h-2.5 text-amber-300" />
                  Drawer Kick
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0 text-[10px] sm:text-[11px] text-emerald-400/70">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1 text-emerald-300 hover:text-white bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/70 transition-colors cursor-pointer"
                title="Toggle calculation history tape"
              >
                <History className="w-3 h-3" />
                <span>History ({calcHistory.length})</span>
              </button>
              <span className="font-semibold hidden xs:inline">12D</span>
            </div>
          </div>

          {/* Top of Display: Live Calculation Preview in smaller font */}
          <div className="relative flex items-center justify-between py-1 px-0.5 text-emerald-300 min-h-[28px] border-b border-emerald-900/40">
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400/90 truncate mr-2">
              {isCompleted ? (
                <span className="truncate">
                  <span className="text-emerald-500/80 text-[10px] uppercase font-sans font-semibold">Formula:</span>{' '}
                  <span className="text-stone-300 font-medium">{formula}</span>
                </span>
              ) : hasOperator ? (
                <span className="truncate flex items-center gap-1">
                  <span className="text-emerald-400/80 text-[10px] uppercase font-sans font-semibold">Formula:</span>{' '}
                  <span className="text-emerald-300 font-medium truncate">{formula}</span>
                </span>
              ) : (
                <span className="text-emerald-600/90 text-[10px] font-medium tracking-wide">NAYAB 12D DUAL-LINE DISPLAY</span>
              )}
            </div>

            {/* Live preview in smaller font on top of display */}
            {livePreview !== null && !isCompleted ? (
              <div className="flex items-center gap-1 bg-emerald-950/90 px-2 py-0.5 rounded-md border border-emerald-600/70 shadow-xs flex-shrink-0 animate-in fade-in">
                <span className="text-[10px] font-sans font-bold text-emerald-400 uppercase tracking-wider">
                  Live:
                </span>
                <span className="text-xs sm:text-sm md:text-base font-black font-['Share_Tech_Mono',monospace] text-emerald-200 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">
                  = {livePreview.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
            ) : isCompleted && evaluatedResult !== null ? (
              <div className="flex items-center gap-1 bg-emerald-950/70 px-2 py-0.5 rounded-md border border-emerald-700/60 text-[10px] text-emerald-300 flex-shrink-0">
                <span className="text-emerald-400 font-bold">=</span>
                <span className="font-bold text-white font-mono text-xs sm:text-sm">
                  {evaluatedResult.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
            ) : null}
          </div>

          {/* Main Area: Constant Total Digit Size - Big, bold LCD digits with leading-none to preserve display dimensions */}
          <div className="relative flex flex-col justify-center my-0.5 sm:my-1 overflow-hidden w-full">
            <div
              ref={formulaDisplayRef}
              className="w-full flex items-center justify-end overflow-x-auto scrollbar-none py-0.5"
            >
              <div
                className="font-['Share_Tech_Mono',monospace] text-6xl sm:text-7xl md:text-8xl font-black tracking-tight text-emerald-300 drop-shadow-[0_0_18px_rgba(52,211,153,0.5)] select-all leading-none text-right whitespace-nowrap"
              >
                {isCompleted && evaluatedResult !== null ? (
                  <span>{evaluatedResult.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                ) : (
                  <span>{formula}</span>
                )}
                {isCompleted && (
                  <span className="text-emerald-400/80 ml-1 font-sans font-bold text-4xl sm:text-5xl">=</span>
                )}
                {!isCompleted && (
                  <span className="text-emerald-400 animate-pulse ml-0.5 font-light">|</span>
                )}
              </div>
            </div>
          </div>

          {/* Active POS items & Combined Total indicator banner inside display */}
          {(activeBillCount > 0 || (calcAmount > 0 && activeBillTotal > 0)) && (
            <div className="mt-1 pt-1 border-t border-emerald-900/40 space-y-0.5 text-[10px] sm:text-[11px] font-sans">
              <div className="flex items-center justify-between text-emerald-300">
                <span className="flex items-center gap-1">
                  <ShoppingBag className="w-3 h-3 text-emerald-400" />
                  <span>Bill ({activeBillCount} items): <strong>₹{activeBillTotal.toFixed(2)}</strong></span>
                </span>
                {calcAmount > 0 && activeBillTotal > 0 && (
                  <span className="text-amber-300 font-mono font-semibold text-[10px]">
                    + Calc: ₹{calcAmount.toFixed(2)}
                  </span>
                )}
              </div>
              {calcAmount > 0 && activeBillTotal > 0 && (
                <div className="flex items-center justify-between text-[11px] font-bold text-emerald-200 bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-800/80 shadow-xs">
                  <span>COMBINED BILL TOTAL:</span>
                  <span className="font-mono text-xs text-emerald-300">₹{combinedSaleTotal.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </div>

      {/* Active Voice Listening Live Banner */}
      {isVoiceListening && (
        <div className="mt-2.5 p-3 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-slate-900 to-emerald-950/90 border border-emerald-500/60 shadow-xl flex items-center justify-between gap-2.5 text-xs animate-in fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="w-7 h-7 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center animate-pulse shadow-md">
                <Mic className="w-4 h-4" />
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping absolute -top-0.5 -right-0.5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-emerald-300 truncate text-xs sm:text-sm">
                {voiceInterim ? `"${voiceInterim}..."` : voiceTranscript ? `"${voiceTranscript}"` : 'Listening... Speak Kirana item & quantity'}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                Try saying: <strong className="text-emerald-400">"Add 2kg Sugar"</strong> or <strong className="text-emerald-400">"500g Jeera"</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setIsVoiceModalOpen(true)}
              className="px-2.5 py-1 rounded-xl bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 text-[11px] font-bold border border-emerald-700/60 transition cursor-pointer"
              title="Open Voice Billing Assistant with examples and language selector"
            >
              Assistant
            </button>
            <button
              onClick={handleStopVoiceListening}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-slate-700 transition cursor-pointer"
            >
              Stop
            </button>
          </div>
        </div>
      )}

      {/* Voice Feedback Banner */}
      {voiceFeedbackMessage && (
        <div className="mt-2 p-2.5 rounded-xl bg-emerald-950/90 border border-emerald-500/70 text-emerald-200 text-xs font-bold flex items-center justify-between gap-2 shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2 truncate">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="truncate">{voiceFeedbackMessage}</span>
          </div>
          <span className="text-[10px] bg-emerald-900 px-2 py-0.5 rounded-md text-emerald-300 font-mono font-bold flex-shrink-0 border border-emerald-700/60">
            Added to Bill
          </span>
        </div>
      )}

      {/* Last 50 Calculations History Tape */}
      {showHistory && (
        <div className="mt-2.5 p-2.5 bg-stone-950/90 border border-emerald-900/50 rounded-2xl font-mono text-xs shadow-inner">
          <div className="flex items-center justify-between text-[11px] text-emerald-400 pb-1.5 border-b border-stone-800/80">
            <span className="flex items-center gap-1.5 font-semibold">
              <History className="w-3.5 h-3.5 text-cyan-400" />
              <span>Calculation History Tape (Last 50)</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-stone-400 hidden sm:inline">Tap row to reload</span>
              {calcHistory.length > 0 && (
                <button
                  onClick={() => setCalcHistory([])}
                  className="text-[10px] text-stone-500 hover:text-red-400 transition-colors"
                  title="Clear history tape"
                >
                  Clear ({calcHistory.length})
                </button>
              )}
            </div>
          </div>

          {calcHistory.length === 0 ? (
            <div className="py-2.5 text-center text-stone-500 text-[11px]">
              No calculation history yet. Perform additions, subtractions or tap '=' to save.
            </div>
          ) : (
            <div className="space-y-1.5 mt-1.5 max-h-52 overflow-y-auto pr-1">
              {calcHistory.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => {
                    sound('num');
                    setFormula(item.expression);
                    setIsCompleted(true);
                    setEvaluatedResult(item.result);
                  }}
                  className="w-full flex items-center justify-between py-1 px-2 rounded-lg bg-stone-900/90 hover:bg-stone-800 border border-stone-800/60 hover:border-emerald-500/50 text-left transition-all group cursor-pointer"
                  title="Click to load this formula and result into calculator"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-[10px] text-stone-500 font-bold w-5">#{idx + 1}</span>
                    <span className="text-stone-300 group-hover:text-emerald-300 truncate font-medium">
                      {item.expression}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="font-bold text-emerald-400 font-mono">= ₹{item.result.toFixed(2)}</span>
                    <span className="text-[9px] text-stone-500 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {item.time}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Function & Memory Row */}
      <div className="grid grid-cols-5 gap-2 mt-3 text-xs font-bold">
        <button
          onClick={handleTaxMinus}
          className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-amber-300 border border-slate-700/80 shadow-sm transition-transform duration-75 ease-out active:scale-90 active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation"
          title="Calculate Base without Tax"
        >
          TAX-
        </button>
        <button
          onClick={handleTaxPlus}
          className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-amber-300 border border-slate-700/80 shadow-sm transition-transform duration-75 ease-out active:scale-90 active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation"
          title="Add Tax percentage"
        >
          TAX+
        </button>
        <button
          onClick={handleMrc}
          className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-cyan-300 border border-slate-700/80 shadow-sm transition-transform duration-75 ease-out active:scale-90 active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation"
          title="Memory Recall / Clear"
        >
          MRC
        </button>
        <button
          onClick={handleMemorySubtract}
          className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-cyan-300 border border-slate-700/80 shadow-sm transition-transform duration-75 ease-out active:scale-90 active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation"
          title="Memory Subtract"
        >
          M-
        </button>
        <button
          onClick={handleMemoryAdd}
          className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-cyan-300 border border-slate-700/80 shadow-sm transition-transform duration-75 ease-out active:scale-90 active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation"
          title="Memory Add"
        >
          M+
        </button>
      </div>

      {/* Check & Step Verification Row */}
      <div className="grid grid-cols-5 gap-2 mt-2 text-xs font-bold">
        <button
          onClick={handleCheckPrev}
          className="py-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 border border-slate-700 flex items-center justify-center gap-0.5 transition-transform duration-75 ease-out active:scale-90 active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation"
          title="Audit Previous Step"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>CHECK</span>
        </button>
        <button
          onClick={handleCheckNext}
          className="py-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 border border-slate-700 flex items-center justify-center gap-0.5 transition-transform duration-75 ease-out active:scale-90 active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation"
          title="Audit Next Step"
        >
          <span>CHECK</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleCorrect}
          className="py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-red-300 border border-slate-700 flex items-center justify-center gap-1 transition-transform duration-75 ease-out active:scale-90 active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation"
          title="Backspace single digit"
        >
          <Delete className="w-3.5 h-3.5" />
          <span>CORRECT</span>
        </button>
        <button
          onClick={handleClearEntry}
          className="py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-orange-400 border border-slate-700 transition-transform duration-75 ease-out active:scale-90 active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation"
          title="Clear current input"
        >
          C
        </button>
        <button
          onClick={handleAllClear}
          className="py-2 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/60 transition-transform duration-75 ease-out active:scale-90 active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation"
          title="All Clear Reset"
        >
          AC
        </button>
      </div>

      {/* Numerical Keypad & Math Operators */}
      <div className="grid grid-cols-4 gap-2.5 mt-3 text-lg sm:text-xl font-bold font-mono">
        {/* Row 1 */}
        <button
          onClick={() => inputDigit('7')}
          className="h-14 sm:h-16 rounded-2xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-100 shadow-md border border-slate-700 flex items-center justify-center transition-transform duration-75 ease-out active:scale-[0.92] active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation"
        >
          7
        </button>
        <button
          onClick={() => inputDigit('8')}
          className="h-14 sm:h-16 rounded-2xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-100 shadow-md border border-slate-700 flex items-center justify-center transition-transform duration-75 ease-out active:scale-[0.92] active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation"
        >
          8
        </button>
        <button
          onClick={() => inputDigit('9')}
          className="h-14 sm:h-16 rounded-2xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-100 shadow-md border border-slate-700 flex items-center justify-center transition-transform duration-75 ease-out active:scale-[0.92] active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation"
        >
          9
        </button>
        <button
          onClick={() => inputOperator('/')}
          className="h-14 sm:h-16 rounded-2xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-cyan-400 shadow-md border border-slate-700 flex items-center justify-center transition-transform duration-75 ease-out active:scale-[0.92] active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation text-2xl font-sans"
        >
          ÷
        </button>

        {/* Row 2 */}
        <button
          onClick={() => inputDigit('4')}
          className="h-14 sm:h-16 rounded-2xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-100 shadow-md border border-slate-700 flex items-center justify-center transition-transform duration-75 ease-out active:scale-[0.92] active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation"
        >
          4
        </button>
        <button
          onClick={() => inputDigit('5')}
          className="h-14 sm:h-16 rounded-2xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-100 shadow-md border border-slate-700 flex items-center justify-center transition-transform duration-75 ease-out active:scale-[0.92] active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation"
        >
          5
        </button>
        <button
          onClick={() => inputDigit('6')}
          className="h-14 sm:h-16 rounded-2xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-100 shadow-md border border-slate-700 flex items-center justify-center transition-transform duration-75 ease-out active:scale-[0.92] active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation"
        >
          6
        </button>
        <button
          onClick={() => inputOperator('*')}
          className="h-14 sm:h-16 rounded-2xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-cyan-400 shadow-md border border-slate-700 flex items-center justify-center transition-transform duration-75 ease-out active:scale-[0.92] active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation text-2xl font-sans"
        >
          ×
        </button>

        {/* Row 3 */}
        <button
          onClick={() => inputDigit('1')}
          className="h-14 sm:h-16 rounded-2xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-100 shadow-md border border-slate-700 flex items-center justify-center transition-transform duration-75 ease-out active:scale-[0.92] active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation"
        >
          1
        </button>
        <button
          onClick={() => inputDigit('2')}
          className="h-14 sm:h-16 rounded-2xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-100 shadow-md border border-slate-700 flex items-center justify-center transition-transform duration-75 ease-out active:scale-[0.92] active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation"
        >
          2
        </button>
        <button
          onClick={() => inputDigit('3')}
          className="h-14 sm:h-16 rounded-2xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-100 shadow-md border border-slate-700 flex items-center justify-center transition-transform duration-75 ease-out active:scale-[0.92] active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation"
        >
          3
        </button>
        <button
          onClick={() => inputOperator('-')}
          className="h-14 sm:h-16 rounded-2xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-cyan-400 shadow-md border border-slate-700 flex items-center justify-center transition-transform duration-75 ease-out active:scale-[0.92] active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation text-3xl font-sans"
        >
          -
        </button>

        {/* Row 4 */}
        <button
          onClick={() => inputDigit('0')}
          className="h-14 sm:h-16 rounded-2xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-100 shadow-md border border-slate-700 flex items-center justify-center transition-transform duration-75 ease-out active:scale-[0.92] active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation"
        >
          0
        </button>
        <button
          onClick={inputDoubleZero}
          className="h-14 sm:h-16 rounded-2xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-100 shadow-md border border-slate-700 flex items-center justify-center transition-transform duration-75 ease-out active:scale-[0.92] active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation text-base"
        >
          00
        </button>
        <button
          onClick={inputDot}
          className="h-14 sm:h-16 rounded-2xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-100 shadow-md border border-slate-700 flex items-center justify-center transition-transform duration-75 ease-out active:scale-[0.92] active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation text-2xl font-sans"
        >
          .
        </button>
        {/* Massive Double-Height Plus Key */}
        <button
          onClick={() => inputOperator('+')}
          className="row-span-2 h-full min-h-[122px] sm:min-h-[138px] rounded-2xl bg-gradient-to-b from-cyan-600 via-cyan-700 to-cyan-800 hover:from-cyan-500 hover:to-cyan-700 text-white shadow-xl shadow-cyan-950/80 border-2 border-cyan-300 flex items-center justify-center transition-transform duration-75 ease-out active:scale-[0.94] active:translate-y-1 active:shadow-inner text-4xl sm:text-5xl font-black font-sans cursor-pointer select-none touch-manipulation"
          title="Plus Addition Key (+ Addition - High Frequency)"
        >
          +
        </button>

        {/* Row 5: Percentage & Large Equals Key */}
        <button
          onClick={handlePercentage}
          className="h-14 sm:h-16 rounded-2xl bg-slate-800 hover:bg-slate-750 text-cyan-400 shadow-md border border-slate-700 flex items-center justify-center transition-transform duration-75 ease-out active:scale-[0.92] active:translate-y-0.5 active:shadow-inner font-mono font-bold text-xl cursor-pointer select-none touch-manipulation"
        >
          %
        </button>

        <button
          onClick={handleEquals}
          className="col-span-2 h-14 sm:h-16 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xl shadow-blue-950/80 border border-blue-400/40 flex items-center justify-center text-3xl font-sans font-bold transition-transform duration-75 ease-out active:scale-[0.95] active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation"
        >
          =
        </button>
      </div>

      {/* Prominent NAYAB Smart Business Action Buttons at the Bottom */}
      <div className="grid grid-cols-4 gap-2 mt-3.5 pt-3 border-t border-slate-800/80">
        {/* SALE / BILL KEY (Green) */}
        <button
          id="btn-nayab-sale-bill"
          onClick={() => {
            sound('bill');
            onOpenSale(combinedSaleTotal, calcAmount);
          }}
          className="col-span-2 py-3 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-950/80 border border-emerald-400/40 flex items-center justify-center gap-2 text-sm sm:text-base transition-transform duration-75 ease-out active:scale-[0.96] active:translate-y-0.5 active:shadow-inner group cursor-pointer select-none touch-manipulation"
        >
          <Receipt className="w-5 h-5 text-emerald-200 group-hover:scale-110 transition-transform" />
          <div className="text-left leading-tight">
            <div className="font-extrabold tracking-wide flex items-center gap-1.5">
              <span>SALE / BILL</span>
              {combinedSaleTotal > 0 && (
                <span className="text-xs bg-emerald-950/90 text-emerald-300 px-1.5 py-0.5 rounded font-mono border border-emerald-700/60">
                  ₹{combinedSaleTotal.toFixed(2)}
                </span>
              )}
            </div>
            <div className="text-[10px] text-emerald-100 font-normal">
              {calcAmount > 0 && activeBillTotal > 0
                ? `Bill ₹${activeBillTotal.toFixed(0)} + Calc ₹${calcAmount.toFixed(0)}`
                : 'Settle & Receipt'}
            </div>
          </div>
        </button>

        {/* PRINT BILL KEY (Blue) - Reviews items in bill before printing */}
        <button
          id="btn-nayab-print-bill"
          onClick={() => {
            sound('bill');
            if (onQuickPrintBill) {
              onQuickPrintBill(combinedSaleTotal, calcAmount);
            }
          }}
          className="py-3 px-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-lg shadow-blue-950/80 border border-blue-400/40 flex flex-col items-center justify-center text-xs transition-transform duration-75 ease-out active:scale-[0.96] active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation"
          title="Review Bill Items & Print Thermal Bill Slip"
        >
          <Printer className="w-4 h-4 text-blue-200 mb-0.5" />
          <span className="font-extrabold tracking-wide">PRINT BILL</span>
          <span className="text-[9px] text-blue-100 font-mono font-bold">
            {combinedSaleTotal > 0 ? `₹${combinedSaleTotal.toFixed(2)}` : 'Review & Slip'}
          </span>
        </button>

        {/* UPI QR KEY (Electric Blue) */}
        <button
          id="btn-nayab-upi-qr"
          onClick={() => {
            sound('action');
            onOpenUpiQr(combinedSaleTotal, calcAmount);
          }}
          className="py-3 px-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-2xl shadow-lg shadow-cyan-950/80 border border-cyan-400/40 flex flex-col items-center justify-center text-xs transition-transform duration-75 ease-out active:scale-[0.96] active:translate-y-0.5 active:shadow-inner cursor-pointer select-none touch-manipulation"
        >
          <QrCode className="w-4 h-4 text-cyan-200 mb-0.5" />
          <span>UPI QR</span>
          <span className="text-[9px] text-cyan-100 font-mono font-bold">
            {combinedSaleTotal > 0 ? `₹${combinedSaleTotal.toFixed(2)}` : 'Scan & Pay'}
          </span>
        </button>
      </div>
    </div>

      {/* 4. Current Bill Tape - PLACED DIRECTLY BELOW SALE BILL BUTTON */}
      {activeBillItems && updateItemQty && onRemoveItem && onClearBill && (
        <div className="mt-4 pt-3 border-t border-slate-800">
          <ActiveBillTape
            items={activeBillItems}
            onUpdateItemQuantity={updateItemQty}
            onRemoveItem={onRemoveItem}
            onClearBill={onClearBill}
            onProceedToSale={() => onOpenSale(combinedSaleTotal, calcAmount)}
            onOpenPosCatalog={onOpenPosCatalog}
            onOpenBarcodeScanner={onOpenBarcodeScanner}
            onPrintBill={onQuickPrintBill ? () => onQuickPrintBill(combinedSaleTotal, calcAmount) : undefined}
            taxRate={taxRate}
          />
        </div>
      )}

      {/* 4. Select Kirana and Spice Inventory Item Search - PLACED BELOW CURRENT BILL TAPE */}
      {products && onAddItemToBill && onSelectProductForWeight && onUpdateProduct && (
        <div className="mt-4 pt-3 border-t border-slate-800">
          <KiranaSpiceItemSearch
            products={products}
            onAddItemToBill={onAddItemToBill}
            onSelectProductForWeight={onSelectProductForWeight}
            onUpdateProduct={onUpdateProduct}
            onAddProductToInventory={onAddProductToInventory}
            onOpenPosCatalog={onOpenPosCatalog}
            onOpenBarcodeScanner={onOpenBarcodeScanner}
            onDeleteProduct={onDeleteProduct}
          />
        </div>
      )}

      {/* Voice Command Billing Assistant Modal (Web Speech API) */}
      {onAddItemToBill && (
        <VoiceCommandModal
          isOpen={isVoiceModalOpen}
          onClose={() => setIsVoiceModalOpen(false)}
          products={products}
          onAddItemToBill={onAddItemToBill}
          onAddItemsToBill={onAddItemsToBill}
          onItemAddedFeedback={showVoiceFeedback}
        />
      )}
    </div>
  );
};

export const TohandsCalculator = NayabCalculator;
