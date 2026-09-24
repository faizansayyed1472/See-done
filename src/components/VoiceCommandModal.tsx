import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  Plus,
  ShoppingBag,
  ArrowRight,
  HelpCircle,
  RotateCcw,
} from 'lucide-react';
import { Product, BillItem, UnitType } from '../types';
import {
  isSpeechRecognitionSupported,
  getSpeechRecognition,
  parseVoiceCommand,
  ParsedVoiceCommand,
  ParsedVoiceItem,
} from '../utils/voiceCommandParser';
import { playKeySound } from '../utils/audio';

interface VoiceCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  products?: Product[];
  onAddItemToBill: (item: Omit<BillItem, 'id'>) => void;
  onAddItemsToBill?: (items: Omit<BillItem, 'id'>[]) => void;
  onItemAddedFeedback?: (message: string) => void;
}

export const VoiceCommandModal: React.FC<VoiceCommandModalProps> = ({
  isOpen,
  onClose,
  products = [],
  onAddItemToBill,
  onAddItemsToBill,
  onItemAddedFeedback,
}) => {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [language, setLanguage] = useState<'en-IN' | 'hi-IN'>('en-IN');
  const [lastParsed, setLastParsed] = useState<ParsedVoiceCommand | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [customRate, setCustomRate] = useState<string>('');
  const [customRates, setCustomRates] = useState<Record<number, string>>({});
  const [historyAdded, setHistoryAdded] = useState<Array<{ name: string; qty: string; total: number }>>([]);
  
  const recognitionRef = useRef<any>(null);
  const autoAddTimeoutRef = useRef<any>(null);

  const supported = isSpeechRecognitionSupported();

  // Initialize and clean up recognition
  useEffect(() => {
    if (!isOpen) {
      stopListening();
      setTranscript('');
      setInterimTranscript('');
      setLastParsed(null);
      setErrorMessage(null);
      return;
    }

    if (supported) {
      startListening();
    } else {
      setErrorMessage('Web Speech API is not supported in this browser. Please use Chrome, Edge, or Safari.');
    }

    return () => {
      stopListening();
    };
  }, [isOpen, language]);

  const startListening = () => {
    if (!supported) return;

    try {
      stopListening();
      setErrorMessage(null);
      setInterimTranscript('');

      const SpeechRecognitionClass = getSpeechRecognition();
      if (!SpeechRecognitionClass) return;

      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        playKeySound('action');
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

        if (interim) {
          setInterimTranscript(interim);
        }

        if (final) {
          const cleanFinal = final.trim();
          setTranscript(cleanFinal);
          setInterimTranscript('');
          handleProcessSpeech(cleanFinal);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('[Speech Recognition Error]:', event.error);
        if (event.error === 'not-allowed') {
          setErrorMessage('Microphone access was denied. Please allow microphone permission in your browser address bar.');
        } else if (event.error === 'no-speech') {
          // No speech detected, keep listening
        } else if (event.error !== 'aborted') {
          setErrorMessage(`Speech recognition error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setErrorMessage(err?.message || 'Failed to initialize microphone.');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleProcessSpeech = (spokenText: string) => {
    const parsed = parseVoiceCommand(spokenText, products);
    setLastParsed(parsed);

    const items = parsed.items && parsed.items.length > 0
      ? parsed.items
      : parsed.item
      ? [parsed.item]
      : [];

    if (parsed.success && items.length > 0) {
      const anyNeedsRate = items.some((it) => it.needsRate);
      if (anyNeedsRate) {
        // Initialize rate input values for items needing pricing
        const initialRates: Record<number, string> = {};
        items.forEach((it, idx) => {
          if (it.needsRate) {
            initialRates[idx] = it.rate > 0 ? it.rate.toString() : '';
          }
        });
        setCustomRates(initialRates);
      } else {
        // All items have valid rates: add all to bill in one batch!
        executeAddAllToBill(items);
      }
    }
  };

  const executeAddAllToBill = (itemsToAdd: ParsedVoiceItem[]) => {
    if (!itemsToAdd || itemsToAdd.length === 0) return;

    const billItemsToAdd: Omit<BillItem, 'id'>[] = itemsToAdd.map((it) => ({
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
      billItemsToAdd.forEach((item) => onAddItemToBill(item));
    }

    playKeySound('bill');

    const totalAmount = itemsToAdd.reduce((sum, it) => sum + it.total, 0);
    const feedback = itemsToAdd.length === 1
      ? `Added ${itemsToAdd[0].quantity} ${itemsToAdd[0].unit} ${itemsToAdd[0].name} (₹${itemsToAdd[0].total.toFixed(2)})`
      : `Added ${itemsToAdd.length} items (${itemsToAdd.map((i) => i.name).join(', ')}) • Total: ₹${totalAmount.toFixed(2)}`;

    if (onItemAddedFeedback) {
      onItemAddedFeedback(feedback);
    }

    const newHistoryEntries = itemsToAdd.map((it) => ({
      name: it.name,
      qty: `${it.quantity} ${it.unit}`,
      total: it.total,
    }));

    setHistoryAdded((prev) => [...newHistoryEntries, ...prev].slice(0, 8));

    // Restart listening for the next voice command after brief pause
    if (autoAddTimeoutRef.current) clearTimeout(autoAddTimeoutRef.current);
    autoAddTimeoutRef.current = setTimeout(() => {
      if (!isListening && isOpen) {
        startListening();
      }
    }, 1400);
  };

  const handleConfirmPendingRates = () => {
    const items = lastParsed?.items && lastParsed.items.length > 0
      ? lastParsed.items
      : lastParsed?.item
      ? [lastParsed.item]
      : [];

    if (items.length === 0) return;

    const finalizedItems: ParsedVoiceItem[] = items.map((it, idx) => {
      if (it.needsRate) {
        const enteredRate = parseFloat(customRates[idx] || '');
        const validRate = !isNaN(enteredRate) && enteredRate > 0 ? enteredRate : 0;
        const total = Math.round(it.quantity * validRate * 100) / 100;
        return {
          ...it,
          rate: validRate,
          total,
          needsRate: validRate <= 0,
        };
      }
      return it;
    });

    const anyStillNeedsRate = finalizedItems.some((it) => it.needsRate);
    if (anyStillNeedsRate) return;

    executeAddAllToBill(finalizedItems);
    setCustomRates({});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 rounded-3xl border border-emerald-500/30 shadow-2xl shadow-emerald-950/60 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                isListening
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/40 ring-4 ring-emerald-500/20'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {isListening ? <Mic className="w-5 h-5 animate-pulse" /> : <MicOff className="w-5 h-5" />}
              </div>
              {isListening && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-white text-base tracking-tight">
                  Voice Billing Assistant
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Web Speech API
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isListening ? 'Listening... speak item name and quantity' : 'Microphone paused • Tap button to speak'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <div className="flex items-center bg-slate-800 rounded-xl p-0.5 border border-slate-700 text-xs font-semibold">
              <button
                onClick={() => setLanguage('en-IN')}
                className={`px-2 py-1 rounded-lg transition-all ${
                  language === 'en-IN'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="English (India)"
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('hi-IN')}
                className={`px-2 py-1 rounded-lg transition-all ${
                  language === 'hi-IN'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Hindi / हिन्दी"
              >
                हिन्दी
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
              title="Close Voice Assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Microphone Note</p>
                <p className="text-red-300 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Central Active Listening Audio Wave / Mic Pulse */}
          <div className="flex flex-col items-center justify-center py-2 text-center">
            <button
              onClick={toggleListening}
              className={`relative p-6 sm:p-8 rounded-full transition-all duration-300 cursor-pointer active:scale-95 group focus:outline-none ${
                isListening
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-2xl shadow-emerald-500/50 ring-8 ring-emerald-500/20'
                  : 'bg-slate-800 hover:bg-slate-750 text-slate-300 ring-4 ring-slate-800/60'
              }`}
            >
              <Mic className={`w-10 h-10 sm:w-12 sm:h-12 ${isListening ? 'animate-bounce' : 'group-hover:scale-110'} transition-transform`} />
              {isListening && (
                <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-30 pointer-events-none" />
              )}
            </button>

            <div className="mt-3.5">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                isListening
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                {isListening ? 'Listening live... speak now' : 'Tap microphone to start listening'}
              </span>
            </div>
          </div>

          {/* Live Transcript Display Box */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90 shadow-inner">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Spoken Voice Command</span>
              {isListening && <span className="text-emerald-400 font-mono text-[10px]">● Real-time audio stream</span>}
            </div>

            <div className="min-h-[52px] flex items-center">
              {interimTranscript ? (
                <p className="text-base sm:text-lg font-semibold text-emerald-300 italic animate-pulse">
                  "{interimTranscript}..."
                </p>
              ) : transcript ? (
                <p className="text-base sm:text-lg font-bold text-white">
                  "{transcript}"
                </p>
              ) : (
                <p className="text-sm text-slate-500 italic">
                  Say e.g. <span className="text-emerald-400 font-medium">"Add 2kg Sugar"</span> or <span className="text-emerald-400 font-medium">"500g Jeera"</span>...
                </p>
              )}
            </div>
          </div>

          {/* Recognized Result Card (Single or Multi-Item) */}
          {lastParsed && (lastParsed.items?.length || lastParsed.item) && (() => {
            const itemsList = lastParsed.items && lastParsed.items.length > 0
              ? lastParsed.items
              : lastParsed.item
              ? [lastParsed.item]
              : [];
            const anyItemNeedsRate = itemsList.some((it) => it.needsRate);
            const totalSum = itemsList.reduce((sum, it, idx) => {
              const effectiveRate = it.needsRate
                ? parseFloat(customRates[idx] || '0') || 0
                : it.rate;
              return sum + (it.quantity * effectiveRate);
            }, 0);

            return (
              <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 shadow-lg space-y-3.5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {itemsList.length > 1
                          ? `Multi-Item Recognized (${itemsList.length} Items)`
                          : 'Recognized Kirana Item'}
                      </span>
                      {itemsList.length > 1 && (
                        <span className="text-[10px] font-semibold text-slate-400">
                          Single Utterance
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-extrabold text-white mt-1">
                      {itemsList.length > 1
                        ? `${itemsList.length} Items in Utterance`
                        : itemsList[0].name}
                    </h4>
                    {itemsList.length === 1 && itemsList[0].hindiName && (
                      <p className="text-xs text-emerald-400/80 font-medium">
                        {itemsList[0].hindiName}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-400">Total Calculated</div>
                    <div className="text-lg font-black font-mono text-emerald-300">
                      ₹{totalSum.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Items List Breakdown */}
                <div className="space-y-2 pt-1 border-t border-emerald-900/40">
                  {itemsList.map((item, idx) => {
                    const currentRateVal = item.needsRate
                      ? customRates[idx] ?? ''
                      : item.rate.toString();
                    const rateNum = parseFloat(currentRateVal) || 0;
                    const itemTotal = Math.round(item.quantity * rateNum * 100) / 100;

                    return (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center text-[10px]">
                              {idx + 1}
                            </span>
                            <div>
                              <span className="font-bold text-white">{item.name}</span>
                              {item.hindiName && (
                                <span className="text-slate-400 text-[11px] ml-1.5">
                                  ({item.hindiName})
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="font-mono font-bold text-emerald-300">
                              ₹{itemTotal.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                          <div className="flex items-center gap-2">
                            <span>
                              Qty: <strong className="text-white">{item.quantity} {item.unit}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Rate: <strong className={item.rate > 0 ? 'text-amber-300' : 'text-amber-400'}>
                                {item.rate > 0 ? `₹${item.rate}/${item.unit}` : 'Needs Price'}
                              </strong>
                            </span>
                          </div>

                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            {item.matchedProduct ? 'Catalog' : 'Custom'}
                          </span>
                        </div>

                        {/* If this item needs rate input */}
                        {item.needsRate && (
                          <div className="pt-1.5 flex items-center gap-2">
                            <span className="text-[11px] text-amber-300 font-semibold flex-shrink-0">
                              Enter price per {item.unit}:
                            </span>
                            <div className="relative flex-1">
                              <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs font-bold">₹</span>
                              <input
                                type="number"
                                placeholder="e.g. 50"
                                value={customRates[idx] ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCustomRates((prev) => ({ ...prev, [idx]: val }));
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && handleConfirmPendingRates()}
                                className="w-full pl-6 pr-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono font-bold text-xs focus:border-emerald-500 focus:outline-none"
                                autoFocus={idx === 0}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Confirm button if any item needs custom rate */}
                {anyItemNeedsRate ? (
                  <div className="pt-2">
                    <button
                      onClick={handleConfirmPendingRates}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Rates & Add {itemsList.length} Item{itemsList.length > 1 ? 's' : ''} to Bill</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold bg-emerald-950/50 p-2 rounded-xl border border-emerald-800/60">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>{lastParsed.feedbackMessage}</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Spoken Voice Commands Cheat Sheet */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Voice Command Examples (Click to test)</span>
              </div>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-semibold">
                Single & Multi-Item
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                { en: 'Add 1kg rice and 500g dal', desc: 'Multi-Item: Adds rice & dal in single utterance' },
                { en: '2kg sugar, 1 packet salt and 500g jeera', desc: 'Multi-Item: 3 items in one breath' },
                { en: '1kg chawal aur 500g daal', desc: 'Hinglish Multi-Item: Chawal & daal together' },
                { en: 'do kilo cheeni aur ek packet namak', desc: 'Hindi Multi-Item: Sugar & salt combo' },
                { en: 'Add 2 Bread at 40 and 1 Milk at 35', desc: 'Multi-Item with custom prices' },
                { en: '1kg rice 500g dal', desc: 'Rapid speech without conjunction' },
                { en: 'Add 2kg Sugar', desc: 'Single Item: 2 kg sugar at catalog rate' },
                { en: '500g Jeera', desc: 'Single Item: 0.5 kg jeera automatically' },
              ].map((ex, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setTranscript(ex.en);
                    handleProcessSpeech(ex.en);
                  }}
                  className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800/80 text-left transition active:scale-98 group cursor-pointer"
                >
                  <span className="font-bold text-emerald-300 group-hover:text-emerald-200 block">
                    "{ex.en}"
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5 leading-tight">
                    {ex.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Recently Added by Voice in this session */}
          {historyAdded.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Added to Bill in this session
              </div>
              <div className="space-y-1">
                {historyAdded.map((h, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-bold text-white">{h.name}</span>
                      <span className="text-slate-400 font-mono">({h.qty})</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-300">
                      ₹{h.total.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3">
          <button
            onClick={toggleListening}
            className={`flex-1 py-3 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
              isListening
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/50'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-4 h-4" />
                <span>Pause Microphone</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>Start Listening</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="py-3 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
