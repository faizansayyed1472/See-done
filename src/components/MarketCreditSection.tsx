import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  IndianRupee,
  Camera,
  Mic,
  MicOff,
  Upload,
  Play,
  Pause,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
  Printer,
  ChevronDown,
  ChevronUp,
  Store,
  FileText,
  Phone,
  ArrowDownRight,
  Wallet,
  Sparkles,
  ExternalLink,
  RotateCcw,
  FileSpreadsheet,
  Download,
  User,
  Users,
  ChevronRight,
  Check,
  AlertTriangle,
  CalendarClock,
  Bell,
  FolderOpen,
  Image as ImageIcon,
} from 'lucide-react';
import { MarketCreditEntry, MarketCreditPayment, StoreSettings, StoreProfile, BillItem } from '../types';
import { printReceipt, ThermalReceiptData } from '../utils/printer';
import { playKeySound } from '../utils/audio';
import { exportMarketCreditsToExcel, exportSupplierStatementToExcel } from '../utils/excelExport';

export interface DueDateStatus {
  hasDueDate: boolean;
  dueDateStr?: string;
  diffDays: number | null;
  isDueWithin3Days: boolean;
  isDueToday: boolean;
  isOverdue: boolean;
  warningLabel: string;
  badgeStyle: string;
  cardHighlightStyle: string;
}

export function calculateDueDateStatus(entry: MarketCreditEntry): DueDateStatus {
  if (entry.status === 'cleared' || (entry.remainingBaaki || 0) <= 0) {
    return {
      hasDueDate: !!entry.dueDate,
      dueDateStr: entry.dueDate,
      diffDays: null,
      isDueWithin3Days: false,
      isDueToday: false,
      isOverdue: false,
      warningLabel: 'Cleared',
      badgeStyle: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      cardHighlightStyle: '',
    };
  }

  if (!entry.dueDate) {
    return {
      hasDueDate: false,
      diffDays: null,
      isDueWithin3Days: false,
      isDueToday: false,
      isOverdue: false,
      warningLabel: 'No deadline set',
      badgeStyle: 'bg-slate-800 text-slate-400 border-slate-700',
      cardHighlightStyle: '',
    };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = entry.dueDate.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const dueFormatted = due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      hasDueDate: true,
      dueDateStr: entry.dueDate,
      diffDays,
      isDueWithin3Days: true,
      isDueToday: false,
      isOverdue: true,
      warningLabel: `🚨 OVERDUE by ${overdueDays}d (${dueFormatted})!`,
      badgeStyle: 'bg-rose-950 text-rose-200 border-rose-500 animate-pulse font-black shadow-rose-900/50 shadow-md',
      cardHighlightStyle: 'border-2 border-rose-500/90 bg-rose-950/20 shadow-lg shadow-rose-950/60 ring-2 ring-rose-500/40',
    };
  }

  if (diffDays === 0) {
    return {
      hasDueDate: true,
      dueDateStr: entry.dueDate,
      diffDays,
      isDueWithin3Days: true,
      isDueToday: true,
      isOverdue: false,
      warningLabel: `⚠️ DUE TODAY (${dueFormatted})!`,
      badgeStyle: 'bg-amber-950 text-amber-200 border-amber-500 animate-pulse font-black ring-1 ring-amber-400',
      cardHighlightStyle: 'border-2 border-amber-500/90 bg-amber-950/30 shadow-lg shadow-amber-950/60 ring-2 ring-amber-500/50',
    };
  }

  if (diffDays <= 3) {
    return {
      hasDueDate: true,
      dueDateStr: entry.dueDate,
      diffDays,
      isDueWithin3Days: true,
      isDueToday: false,
      isOverdue: false,
      warningLabel: `⚠️ DUE IN ${diffDays} ${diffDays === 1 ? 'DAY' : 'DAYS'} (${dueFormatted})`,
      badgeStyle: 'bg-amber-950/90 text-amber-200 border-amber-500/80 font-black ring-1 ring-amber-500/50 animate-pulse',
      cardHighlightStyle: 'border-2 border-amber-500/80 bg-amber-950/20 shadow-lg shadow-amber-950/40 ring-1 ring-amber-500/40',
    };
  }

  return {
    hasDueDate: true,
    dueDateStr: entry.dueDate,
    diffDays,
    isDueWithin3Days: false,
    isDueToday: false,
    isOverdue: false,
    warningLabel: `Due in ${diffDays}d (${dueFormatted})`,
    badgeStyle: 'bg-blue-950/60 text-blue-300 border-blue-800',
    cardHighlightStyle: '',
  };
}

interface MarketCreditSectionProps {
  entries: MarketCreditEntry[];
  onUpdateEntries: (entries: MarketCreditEntry[]) => void;
  storeSettings: StoreSettings;
  selectedOutletFilter?: string;
  isOwner?: boolean;
}

interface SupplierSummary {
  name: string;
  phone?: string;
  billsCount: number;
  totalPurchased: number;
  totalJama: number;
  remainingBaaki: number;
  entries: MarketCreditEntry[];
  latestTimestamp: string;
  outlets: string[];
  dueSoonBillsCount: number;
}

export const MarketCreditSection: React.FC<MarketCreditSectionProps> = ({
  entries = [],
  onUpdateEntries,
  storeSettings,
  selectedOutletFilter = 'all',
  isOwner = true,
}) => {
  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'cleared' | 'due_soon'>('all');
  const [outletFilter, setOutletFilter] = useState<string>(selectedOutletFilter);
  const [viewMode, setViewMode] = useState<'by_supplier' | 'all_bills'>('by_supplier');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('all');

  useEffect(() => {
    if (selectedOutletFilter) {
      setOutletFilter(selectedOutletFilter);
    }
  }, [selectedOutletFilter]);

  // Expanded suppliers tracking for accordion behavior
  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>({});

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isEditDueDateModalOpen, setIsEditDueDateModalOpen] = useState(false);
  const [activeEntryForDueDate, setActiveEntryForDueDate] = useState<MarketCreditEntry | null>(null);
  const [editDueDateInput, setEditDueDateInput] = useState<string>('');
  const [activeEntryForPayment, setActiveEntryForPayment] = useState<MarketCreditEntry | null>(null);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [activeVoicePlayingId, setActiveVoicePlayingId] = useState<string | null>(null);
  const [printStatusMsg, setPrintStatusMsg] = useState<string>('');

  // Audio elements ref for list playback
  const listAudioRef = useRef<HTMLAudioElement | null>(null);

  // Outlets list from settings
  const outlets: StoreProfile[] = useMemo(() => {
    if (storeSettings.stores && storeSettings.stores.length > 0) {
      return storeSettings.stores;
    }
    return [
      {
        id: 'store-1',
        shopName: 'sy Nayab',
        shortcutName: 'SY',
        tagline: 'Authentic Indian Spices & Daily Groceries',
        phone: '9876543210',
        upiId: 'nayabmasale@upi',
        address: 'Main Bazaar, Outlet 1',
        defaultTaxRate: 0,
      },
      {
        id: 'store-2',
        shopName: 'kp Nayab',
        shortcutName: 'KP',
        tagline: 'Authentic Indian Spices & Daily Groceries',
        phone: '9876543210',
        upiId: 'nayabmasale@upi',
        address: 'Branch 2, Outlet 2',
        defaultTaxRate: 0,
      },
    ];
  }, [storeSettings.stores]);

  // Extract unique supplier list with metadata from all entries
  const allUniqueSuppliers = useMemo(() => {
    const map = new Map<string, { name: string; phone?: string; count: number; totalBaaki: number }>();
    entries.forEach((e) => {
      const trimmed = e.supplierName.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.totalBaaki += e.remainingBaaki || 0;
        if (!existing.phone && e.supplierPhone) existing.phone = e.supplierPhone;
      } else {
        map.set(key, {
          name: trimmed,
          phone: e.supplierPhone,
          count: 1,
          totalBaaki: e.remainingBaaki || 0,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [entries]);

  // Handle List Audio Playback
  const handleToggleVoiceNotePlayback = (entryId: string, voiceUrl: string) => {
    if (activeVoicePlayingId === entryId) {
      if (listAudioRef.current) {
        listAudioRef.current.pause();
      }
      setActiveVoicePlayingId(null);
    } else {
      if (listAudioRef.current) {
        listAudioRef.current.pause();
      }
      const audio = new Audio(voiceUrl);
      listAudioRef.current = audio;
      audio.onended = () => setActiveVoicePlayingId(null);
      audio.onerror = () => setActiveVoicePlayingId(null);
      audio.play().catch(console.warn);
      setActiveVoicePlayingId(entryId);
    }
  };

  // Add Market Credit Form State
  const [supplierSelectionMode, setSupplierSelectionMode] = useState<'existing' | 'new'>('existing');
  const [goodsDescription, setGoodsDescription] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [entryOutletId, setEntryOutletId] = useState<string>(outlets[0]?.id || 'store-1');
  const [entryDateTime, setEntryDateTime] = useState<string>(() => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  });
  const [totalAmountInput, setTotalAmountInput] = useState<string>('');
  const [paidOnDayInput, setPaidOnDayInput] = useState<string>('');
  const [entryDueDate, setEntryDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [formNotes, setFormNotes] = useState('');

  // Image Upload State
  const [billImageBase64, setBillImageBase64] = useState<string | null>(null);
  const [isCompressingImage, setIsCompressingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [isDraggingOverImage, setIsDraggingOverImage] = useState(false);
  const deviceFileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Voice Note Recording State (Strict 15 seconds)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceSecondsLeft, setVoiceSecondsLeft] = useState(15);
  const [recordedVoiceUrl, setRecordedVoiceUrl] = useState<string | null>(null);
  const [isPlayingFormVoice, setIsPlayingFormVoice] = useState(false);
  const formAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const countdownTimerRef = useRef<any>(null);

  // Subsequent Payment (Jama) State
  const [additionalPaymentAmount, setAdditionalPaymentAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'online_upi' | 'bank_transfer'>('cash');
  const [paymentDate, setPaymentDate] = useState<string>(() => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  });
  const [paymentNote, setPaymentNote] = useState<string>('');

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (listAudioRef.current) {
        listAudioRef.current.pause();
      }
    };
  }, []);

  // Calculated remaining Baaki in real-time for the Add form
  const totalAmountNum = parseFloat(totalAmountInput) || 0;
  const paidOnDayNum = parseFloat(paidOnDayInput) || 0;
  const calculatedBaaki = Math.max(0, Math.round((totalAmountNum - paidOnDayNum) * 100) / 100);

  // Open modal pre-selected for a specific supplier (Recurring entry in his section)
  const handleOpenAddModal = (presetSupplierName?: string, presetSupplierPhone?: string) => {
    playKeySound('action');
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    setEntryDateTime(new Date(now.getTime() - tzOffset).toISOString().slice(0, 16));

    if (presetSupplierName) {
      setSupplierSelectionMode('existing');
      setSupplierName(presetSupplierName);
      setSupplierPhone(presetSupplierPhone || '');
    } else if (allUniqueSuppliers.length > 0) {
      setSupplierSelectionMode('existing');
      setSupplierName(allUniqueSuppliers[0].name);
      setSupplierPhone(allUniqueSuppliers[0].phone || '');
    } else {
      setSupplierSelectionMode('new');
      setSupplierName('');
      setSupplierPhone('');
    }

    const defaultDue = new Date();
    defaultDue.setDate(defaultDue.getDate() + 7);
    setEntryDueDate(defaultDue.toISOString().slice(0, 10));

    setGoodsDescription('');
    setTotalAmountInput('');
    setPaidOnDayInput('');
    setBillImageBase64(null);
    setRecordedVoiceUrl(null);
    setVoiceSecondsLeft(15);
    setFormNotes('');
    setIsAddModalOpen(true);
  };

  // Handle supplier dropdown selection in Add modal
  const handleSelectExistingSupplier = (name: string) => {
    const found = allUniqueSuppliers.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (found) {
      setSupplierName(found.name);
      setSupplierPhone(found.phone || '');
    } else {
      setSupplierName(name);
    }
  };

  // Compress and handle image file from device gallery or camera
  const processImageFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageUploadError('Please select a valid image file (JPG, PNG, WebP, HEIC).');
      return;
    }
    setImageUploadError(null);
    setIsCompressingImage(true);

    const reader = new FileReader();
    reader.onerror = () => {
      setImageUploadError('Could not read image file from device. Please try another photo.');
      setIsCompressingImage(false);
    };
    reader.onload = (event) => {
      const resultStr = event.target?.result as string;
      if (!resultStr) {
        setIsCompressingImage(false);
        return;
      }
      const img = new Image();
      img.onerror = () => {
        // Fallback: use raw data URL if canvas cannot parse
        setBillImageBase64(resultStr);
        setIsCompressingImage(false);
      };
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
            setBillImageBase64(compressedDataUrl);
          } else {
            setBillImageBase64(resultStr);
          }
        } catch {
          setBillImageBase64(resultStr);
        }
        setIsCompressingImage(false);
      };
      img.src = resultStr;
    };
    reader.readAsDataURL(file);
  };

  const handleDeviceImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleCameraImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  // Start 15-second Voice Note Recording
  const handleStartVoiceRecording = async () => {
    try {
      playKeySound('action');
      setRecordedVoiceUrl(null);
      setVoiceSecondsLeft(15);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setRecordedVoiceUrl(reader.result as string);
        };
        reader.readAsDataURL(audioBlob);

        stream.getTracks().forEach((track) => track.stop());
        setIsRecordingVoice(false);
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      };

      mediaRecorder.start(200);
      setIsRecordingVoice(true);

      let timeLeft = 15;
      countdownTimerRef.current = setInterval(() => {
        timeLeft -= 1;
        setVoiceSecondsLeft(timeLeft);
        if (timeLeft <= 0) {
          clearInterval(countdownTimerRef.current);
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        }
      }, 1000);
    } catch (err) {
      console.warn('Microphone access denied or unsupported:', err);
      alert('Microphone access is required to record a voice note. Please allow microphone permission in your browser.');
      setIsRecordingVoice(false);
    }
  };

  // Stop Voice Recording prematurely
  const handleStopVoiceRecording = () => {
    playKeySound('num');
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingVoice(false);
  };

  // Discard Recorded Voice Note
  const handleDiscardVoiceNote = () => {
    playKeySound('clear');
    setRecordedVoiceUrl(null);
    setVoiceSecondsLeft(15);
    if (formAudioRef.current) {
      formAudioRef.current.pause();
    }
    setIsPlayingFormVoice(false);
  };

  // Toggle Form Voice Note Preview
  const handleToggleFormVoicePlay = () => {
    if (!recordedVoiceUrl) return;
    if (isPlayingFormVoice) {
      if (formAudioRef.current) formAudioRef.current.pause();
      setIsPlayingFormVoice(false);
    } else {
      if (!formAudioRef.current) {
        formAudioRef.current = new Audio(recordedVoiceUrl);
        formAudioRef.current.onended = () => setIsPlayingFormVoice(false);
        formAudioRef.current.onerror = () => setIsPlayingFormVoice(false);
      }
      formAudioRef.current.play().catch(console.warn);
      setIsPlayingFormVoice(true);
    }
  };

  // Submit New Market Credit Entry
  const handleSaveMarketCredit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goodsDescription.trim()) {
      alert('Please enter description of goods taken on credit.');
      return;
    }
    if (!supplierName.trim()) {
      alert('Please select or enter supplier/party name.');
      return;
    }
    if (totalAmountNum <= 0) {
      alert('Please enter a valid total bill/credit amount.');
      return;
    }

    playKeySound('action');
    const matchedOutlet = outlets.find((o) => o.id === entryOutletId) || outlets[0];
    const initialPayments: MarketCreditPayment[] = [];

    if (paidOnDayNum > 0) {
      initialPayments.push({
        id: `pay-${Date.now()}`,
        amount: paidOnDayNum,
        date: entryDateTime,
        paymentMode: 'cash',
        note: 'Payment (Jama) done on day of taking goods',
        recordedBy: storeSettings.staffAccounts?.find((s) => s.id === storeSettings.activeStaffId)?.name || 'Counter Staff',
      });
    }

    const newEntry: MarketCreditEntry = {
      id: `mc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      goodsDescription: goodsDescription.trim(),
      supplierName: supplierName.trim(),
      supplierPhone: supplierPhone.trim() || undefined,
      outletId: matchedOutlet.id,
      outletName: matchedOutlet.shopName,
      timestamp: entryDateTime,
      dueDate: entryDueDate ? entryDueDate : undefined,
      totalAmount: totalAmountNum,
      paidOnDay: paidOnDayNum,
      remainingBaaki: calculatedBaaki,
      billImageUrl: billImageBase64 || undefined,
      voiceNoteUrl: recordedVoiceUrl || undefined,
      voiceNoteDurationSeconds: recordedVoiceUrl ? 15 - voiceSecondsLeft : undefined,
      status: calculatedBaaki <= 0 ? 'cleared' : 'pending',
      paymentsHistory: initialPayments,
      notes: formNotes.trim() || undefined,
      recordedBy: storeSettings.staffAccounts?.find((s) => s.id === storeSettings.activeStaffId)?.name || 'Counter Staff',
      createdAt: new Date().toISOString(),
    };

    onUpdateEntries([newEntry, ...entries]);

    // Ensure this supplier section is auto-expanded
    setExpandedSuppliers((prev) => ({ ...prev, [newEntry.supplierName.trim().toLowerCase()]: true }));

    // Reset Form
    setGoodsDescription('');
    setSupplierName('');
    setSupplierPhone('');
    setTotalAmountInput('');
    setPaidOnDayInput('');
    setBillImageBase64(null);
    setRecordedVoiceUrl(null);
    setFormNotes('');
    setIsAddModalOpen(false);
  };

  // Open Edit Due Date Modal for existing bill
  const handleOpenEditDueDateModal = (entry: MarketCreditEntry) => {
    playKeySound('action');
    setActiveEntryForDueDate(entry);
    setEditDueDateInput(entry.dueDate || '');
    setIsEditDueDateModalOpen(true);
  };

  // Save updated Due Date on entry
  const handleSaveDueDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEntryForDueDate) return;
    playKeySound('action');

    const updated = entries.map((item) => {
      if (item.id === activeEntryForDueDate.id) {
        return {
          ...item,
          dueDate: editDueDateInput.trim() || undefined,
        };
      }
      return item;
    });

    onUpdateEntries(updated);
    setIsEditDueDateModalOpen(false);
    setActiveEntryForDueDate(null);
  };

  // Submit Subsequent Payment (Jama)
  const handleSaveAdditionalPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEntryForPayment) return;

    const payAmt = parseFloat(additionalPaymentAmount);
    if (!payAmt || payAmt <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    playKeySound('action');
    const updatedPayments: MarketCreditPayment[] = [
      ...(activeEntryForPayment.paymentsHistory || []),
      {
        id: `pay-${Date.now()}`,
        amount: payAmt,
        date: paymentDate,
        paymentMode: paymentMode,
        note: paymentNote.trim() || undefined,
        recordedBy: storeSettings.staffAccounts?.find((s) => s.id === storeSettings.activeStaffId)?.name || 'Counter Staff',
      },
    ];

    const totalPaidSoFar = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
    const newBaaki = Math.max(0, Math.round((activeEntryForPayment.totalAmount - totalPaidSoFar) * 100) / 100);

    const updatedEntry: MarketCreditEntry = {
      ...activeEntryForPayment,
      remainingBaaki: newBaaki,
      status: newBaaki <= 0 ? 'cleared' : 'pending',
      paymentsHistory: updatedPayments,
    };

    onUpdateEntries(entries.map((item) => (item.id === activeEntryForPayment.id ? updatedEntry : item)));

    setAdditionalPaymentAmount('');
    setPaymentNote('');
    setIsPaymentModalOpen(false);
    setActiveEntryForPayment(null);
  };

  // Delete Market Credit Entry
  const handleDeleteEntry = (id: string) => {
    if (confirm('Are you sure you want to delete this market credit record?')) {
      playKeySound('clear');
      onUpdateEntries(entries.filter((item) => item.id !== id));
    }
  };

  // Print Single Voucher on Thermal Slip
  const handlePrintMarketCreditSlip = async (entry: MarketCreditEntry) => {
    playKeySound('action');
    setPrintStatusMsg(`Printing slip for ${entry.supplierName}...`);

    const formattedDate = new Date(entry.timestamp).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const slipItems = [
      {
        id: '1',
        name: `Goods: ${entry.goodsDescription}`,
        quantity: 1,
        unit: 'lot' as const,
        rate: entry.totalAmount,
        total: entry.totalAmount,
      },
      {
        id: '2',
        name: `Day Jama Done: -₹${entry.paidOnDay}`,
        quantity: 1,
        unit: 'jama' as const,
        rate: -entry.paidOnDay,
        total: -entry.paidOnDay,
      },
    ];

    if (entry.paymentsHistory && entry.paymentsHistory.length > 1) {
      entry.paymentsHistory.slice(1).forEach((pay, idx) => {
        slipItems.push({
          id: `pay-${idx + 3}`,
          name: `Jama (${pay.paymentMode.toUpperCase()}): -₹${pay.amount}`,
          quantity: 1,
          unit: 'jama' as const,
          rate: -pay.amount,
          total: -pay.amount,
        });
      });
    }

    const receiptData: ThermalReceiptData = {
      shopName: entry.outletName || storeSettings.shopName,
      address: storeSettings.address,
      phone: storeSettings.phone,
      gstin: storeSettings.gstin,
      receiptNumber: `MC-${entry.id.slice(-6).toUpperCase()}`,
      date: formattedDate,
      cashierName: entry.recordedBy || 'Owner Faizan Inamdar',
      customerName: `Supplier: ${entry.supplierName} ${entry.supplierPhone ? `(${entry.supplierPhone})` : ''}`,
      items: slipItems,
      subtotal: entry.totalAmount,
      taxAmount: 0,
      taxRate: 0,
      grandTotal: entry.remainingBaaki,
      paymentMode: entry.remainingBaaki <= 0 ? 'CLEARED / CHUKTA' : 'BAAKI REMAINING',
      upiId: storeSettings.upiId,
    };

    const res = await printReceipt(receiptData, storeSettings);
    if (res.success) {
      setPrintStatusMsg('Market credit voucher printed successfully!');
    } else {
      setPrintStatusMsg(res.error || 'Could not print voucher.');
    }
    setTimeout(() => setPrintStatusMsg(''), 3500);
  };

  // Print Consolidated Supplier Statement Slip
  const handlePrintSupplierStatement = async (supplier: SupplierSummary) => {
    playKeySound('action');
    setPrintStatusMsg(`Printing statement for ${supplier.name}...`);

    const slipItems: BillItem[] = supplier.entries.map((e, idx) => ({
      id: `item-${idx + 1}`,
      name: `${new Date(e.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}: ${e.goodsDescription.slice(0, 18)}`,
      quantity: 1,
      unit: 'bill',
      rate: e.totalAmount,
      total: e.totalAmount,
    }));

    slipItems.push({
      id: 'item-jama',
      name: 'Total Jama Paid to Supplier',
      quantity: 1,
      unit: 'jama',
      rate: -supplier.totalJama,
      total: -supplier.totalJama,
    });

    const receiptData: ThermalReceiptData = {
      shopName: storeSettings.shopName,
      address: storeSettings.address,
      phone: storeSettings.phone,
      gstin: storeSettings.gstin,
      receiptNumber: `SUP-${Date.now().toString().slice(-6)}`,
      date: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
      cashierName: 'Owner Faizan Inamdar',
      customerName: `Supplier: ${supplier.name} ${supplier.phone ? `(${supplier.phone})` : ''}`,
      items: slipItems,
      subtotal: supplier.totalPurchased,
      taxAmount: 0,
      taxRate: 0,
      grandTotal: supplier.remainingBaaki,
      paymentMode: supplier.remainingBaaki <= 0 ? 'ALL CLEARED' : 'NET BAAKI DUE',
      upiId: storeSettings.upiId,
    };

    const res = await printReceipt(receiptData, storeSettings);
    if (res.success) {
      setPrintStatusMsg(`Supplier statement for ${supplier.name} printed!`);
    } else {
      setPrintStatusMsg(res.error || 'Failed to print supplier statement.');
    }
    setTimeout(() => setPrintStatusMsg(''), 3500);
  };

  // Filtered individual entries
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (outletFilter !== 'all' && entry.outletId && entry.outletId !== outletFilter) {
        return false;
      }
      if (statusFilter === 'pending' && entry.status !== 'pending') return false;
      if (statusFilter === 'cleared' && entry.status !== 'cleared') return false;
      if (statusFilter === 'due_soon') {
        const dueStatus = calculateDueDateStatus(entry);
        if (!dueStatus.isDueWithin3Days) return false;
      }
      if (selectedSupplierFilter !== 'all' && entry.supplierName.trim().toLowerCase() !== selectedSupplierFilter.toLowerCase()) {
        return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchSupplier = entry.supplierName.toLowerCase().includes(q);
        const matchGoods = entry.goodsDescription.toLowerCase().includes(q);
        const matchOutlet = (entry.outletName || '').toLowerCase().includes(q);
        const matchNotes = (entry.notes || '').toLowerCase().includes(q);
        const matchPhone = (entry.supplierPhone || '').toLowerCase().includes(q);
        if (!matchSupplier && !matchGoods && !matchOutlet && !matchNotes && !matchPhone) return false;
      }
      return true;
    });
  }, [entries, outletFilter, statusFilter, selectedSupplierFilter, searchTerm]);

  // Grouped Supplier Sections ("in his section")
  const supplierGroups = useMemo((): SupplierSummary[] => {
    const map = new Map<string, SupplierSummary>();

    filteredEntries.forEach((entry) => {
      const suppKey = entry.supplierName.trim().toLowerCase();
      const existing = map.get(suppKey);
      const isEntryDueSoon = entry.status === 'pending' && (entry.remainingBaaki || 0) > 0 && calculateDueDateStatus(entry).isDueWithin3Days;

      if (existing) {
        existing.billsCount += 1;
        existing.totalPurchased += entry.totalAmount || 0;
        existing.remainingBaaki += entry.remainingBaaki || 0;
        existing.totalJama = Math.max(0, Math.round((existing.totalPurchased - existing.remainingBaaki) * 100) / 100);
        existing.entries.push(entry);
        if (isEntryDueSoon) {
          existing.dueSoonBillsCount += 1;
        }
        if (!existing.phone && entry.supplierPhone) existing.phone = entry.supplierPhone;
        if (entry.outletName && !existing.outlets.includes(entry.outletName)) {
          existing.outlets.push(entry.outletName);
        }
        if (new Date(entry.timestamp) > new Date(existing.latestTimestamp)) {
          existing.latestTimestamp = entry.timestamp;
        }
      } else {
        const totalPurchased = entry.totalAmount || 0;
        const remainingBaaki = entry.remainingBaaki || 0;
        map.set(suppKey, {
          name: entry.supplierName.trim(),
          phone: entry.supplierPhone,
          billsCount: 1,
          totalPurchased,
          totalJama: Math.max(0, Math.round((totalPurchased - remainingBaaki) * 100) / 100),
          remainingBaaki,
          entries: [entry],
          latestTimestamp: entry.timestamp,
          outlets: entry.outletName ? [entry.outletName] : ['sy Nayab'],
          dueSoonBillsCount: isEntryDueSoon ? 1 : 0,
        });
      }
    });

    // Sort: Pending balance first, then highest balance, then latest date
    return Array.from(map.values()).sort((a, b) => {
      if (b.remainingBaaki !== a.remainingBaaki) {
        return b.remainingBaaki - a.remainingBaaki;
      }
      return new Date(b.latestTimestamp).getTime() - new Date(a.latestTimestamp).getTime();
    });
  }, [filteredEntries]);

  // Entries with payment due in <= 3 days (or overdue) for owner warning banner
  const dueSoonEntries = useMemo(() => {
    return entries.filter((e) => {
      if (outletFilter !== 'all' && e.outletId && e.outletId !== outletFilter) return false;
      if (e.status !== 'pending' || (e.remainingBaaki || 0) <= 0) return false;
      return calculateDueDateStatus(e).isDueWithin3Days;
    });
  }, [entries, outletFilter]);

  const totalDueSoonBaaki = useMemo(() => {
    return dueSoonEntries.reduce((sum, e) => sum + (e.remainingBaaki || 0), 0);
  }, [dueSoonEntries]);

  // Aggregated KPI Stats
  const stats = useMemo(() => {
    const relevant = entries.filter((e) => outletFilter === 'all' || e.outletId === outletFilter);
    const totalCreditAmount = relevant.reduce((sum, e) => sum + (e.totalAmount || 0), 0);
    const totalRemainingBaaki = relevant.reduce((sum, e) => sum + (e.remainingBaaki || 0), 0);
    const totalJamaDone = Math.max(0, Math.round((totalCreditAmount - totalRemainingBaaki) * 100) / 100);
    const pendingCount = relevant.filter((e) => e.status === 'pending').length;
    const clearedCount = relevant.filter((e) => e.status === 'cleared').length;
    const uniqueSuppliersCount = new Set(relevant.map((e) => e.supplierName.trim().toLowerCase())).size;

    return {
      totalCreditAmount,
      totalJamaDone,
      totalRemainingBaaki,
      pendingCount,
      clearedCount,
      totalCount: relevant.length,
      uniqueSuppliersCount,
      dueSoonCount: dueSoonEntries.length,
      totalDueSoonBaaki,
    };
  }, [entries, outletFilter, dueSoonEntries, totalDueSoonBaaki]);

  // Toggle supplier accordion expansion
  const toggleSupplierExpand = (suppName: string) => {
    const key = suppName.toLowerCase();
    setExpandedSuppliers((prev) => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key],
    }));
  };

  const isSupplierExpanded = (suppName: string) => {
    const key = suppName.toLowerCase();
    return expandedSuppliers[key] !== false; // default expanded
  };

  return (
    <div className="w-full space-y-4 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Banner with Aligned Headers & Action Buttons */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 p-4 sm:p-5 rounded-3xl border border-rose-500/30 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 flex-shrink-0 shadow-inner">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Credit in Market (बाज़ार उधारी / माल बाक़ी)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold text-[10px] border border-rose-500/30">
                  SUPPLIER UDHAAR LEDGER
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
                Supplier khata ledger for mandi purchases, recurring credit bills, jama payments, remaining baaki, bill photos & 15s voice notes.
              </p>
            </div>
          </div>

          {/* Action Buttons: Excel Export & Record Goods */}
          <div className="flex items-center gap-2.5 flex-wrap self-start md:self-center">
            <button
              type="button"
              onClick={() => {
                playKeySound('action');
                exportMarketCreditsToExcel(filteredEntries, storeSettings.shopName || 'sy Nayab', outletFilter);
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/35 text-emerald-300 border border-emerald-500/40 font-bold text-xs flex items-center gap-2 shadow-sm transition-all active:scale-98 cursor-pointer"
              title="Download entire Credit in Market ledger in Excel (.csv / XLSX format)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>EXPORT TO EXCEL</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-rose-600 hover:from-rose-500 hover:to-pink-500 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-rose-950/80 border border-rose-400/40 active:scale-98 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>RECORD GOODS ON CREDIT</span>
            </button>
          </div>
        </div>

        {/* 4 Aligned Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl flex flex-col justify-between">
            <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
              <span>Total Goods Taken</span>
              <Package className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1">
              ₹{stats.totalCreditAmount.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
              <span>{stats.totalCount} bills recorded</span>
              <span>•</span>
              <span>{stats.uniqueSuppliersCount} suppliers</span>
            </div>
          </div>

          <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex flex-col justify-between">
            <div className="text-[11px] font-semibold text-emerald-400 flex items-center justify-between">
              <span>Total Payment (Jama) Done</span>
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-300 mt-1">
              ₹{stats.totalJamaDone.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-emerald-500 mt-1">
              Paid upfront on purchase & installments
            </div>
          </div>

          <div className="p-3.5 bg-rose-950/50 border border-rose-500/40 rounded-2xl flex flex-col justify-between">
            <div className="text-[11px] font-semibold text-rose-400 flex items-center justify-between">
              <span>Remaining (Baaki Dena Hai)</span>
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-rose-300 mt-1">
              ₹{stats.totalRemainingBaaki.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-rose-400/80 mt-1">
              {stats.pendingCount} pending credit bills to settle
            </div>
          </div>

          <div className="p-3.5 bg-amber-950/40 border border-amber-500/30 rounded-2xl flex flex-col justify-between">
            <div className="text-[11px] font-semibold text-amber-400 flex items-center justify-between">
              <span>Settlement & Deadlines</span>
              <CalendarClock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-base font-black text-amber-200 mt-1 flex items-center gap-2">
              <span className="text-emerald-400">{stats.clearedCount} Cleared</span>
              <span className="text-slate-600">•</span>
              <span className="text-rose-400">{stats.pendingCount} Pending</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
              <span>Active bills</span>
              {stats.dueSoonCount > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500/30 text-amber-300 border border-amber-500/50 animate-pulse">
                  ⚠️ {stats.dueSoonCount} Due ≤3d
                </span>
              ) : (
                <span className="text-emerald-400 font-bold">No overdue</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* URGENT PAYMENT DEADLINE ALERT BANNER (If any entry is due within 3 days or overdue) */}
      {dueSoonEntries.length > 0 && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-amber-950/95 via-rose-950/90 to-amber-950/95 border-2 border-amber-500/80 shadow-xl shadow-amber-950/60 flex flex-col md:flex-row md:items-center justify-between gap-3.5 animate-in fade-in">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/25 border border-amber-500/80 flex items-center justify-center text-amber-300 flex-shrink-0 shadow-lg shadow-amber-950/50 animate-bounce">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-amber-200 text-sm sm:text-base tracking-tight">
                  ⚠️ PAYMENT DEADLINE WARNING: {dueSoonEntries.length} {dueSoonEntries.length === 1 ? 'Bill Due' : 'Bills Due'} in Next 3 Days!
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white uppercase tracking-wider animate-pulse shadow-xs">
                  URGENT ACTION
                </span>
              </div>
              <p className="text-xs text-amber-200/90 mt-0.5">
                Total <span className="font-mono font-bold text-white text-sm">₹{totalDueSoonBaaki.toLocaleString('en-IN')}</span> payment due to suppliers within 3 days. Settle payment or contact supplier to avoid missing payment deadlines.
              </p>
              {/* Quick preview pills of upcoming due bills */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {dueSoonEntries.slice(0, 4).map((entry) => {
                  const dueSt = calculateDueDateStatus(entry);
                  return (
                    <span
                      key={entry.id}
                      className="px-2.5 py-1 rounded-xl bg-black/50 border border-amber-500/50 text-amber-100 text-xs flex items-center gap-1.5 shadow-xs"
                    >
                      <span className="font-bold text-white">{entry.supplierName}</span>:
                      <span className="font-mono text-amber-300 font-bold">₹{entry.remainingBaaki.toLocaleString('en-IN')}</span>
                      <span className="text-[11px] font-black text-amber-400">({dueSt.warningLabel})</span>
                    </span>
                  );
                })}
                {dueSoonEntries.length > 4 && (
                  <span className="text-xs text-amber-300 font-bold">
                    +{dueSoonEntries.length - 4} more
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                playKeySound('action');
                setStatusFilter(statusFilter === 'due_soon' ? 'all' : 'due_soon');
              }}
              className={`px-3.5 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-98 ${
                statusFilter === 'due_soon'
                  ? 'bg-amber-400 text-slate-950 ring-2 ring-white'
                  : 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{statusFilter === 'due_soon' ? 'Show All Bills' : 'Focus Due Soon Bills'}</span>
            </button>
          </div>
        </div>
      )}

      {printStatusMsg && (
        <div className="p-3 rounded-2xl bg-cyan-950/80 border border-cyan-800 text-cyan-300 text-xs font-semibold text-center animate-in fade-in shadow-md">
          {printStatusMsg}
        </div>
      )}

      {/* Aligned Filter & Controls Bar */}
      <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search supplier name, goods (Jeera, Haldi), phone, outlet..."
            className="w-full bg-slate-950 border border-slate-700 focus:border-rose-500 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* View Mode Toggle: By Supplier vs All Bills */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('by_supplier')}
            className={`px-3 py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'by_supplier'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>By Supplier Sections</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/40 font-mono">
              {supplierGroups.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('all_bills')}
            className={`px-3 py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'all_bills'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>All Bills List</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/40 font-mono">
              {filteredEntries.length}
            </span>
          </button>
        </div>

        {/* Outlet Filter Switcher */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <span className="text-slate-400 text-[11px] px-2 flex items-center gap-1 font-semibold">
            <Store className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Outlet:</span>
          </span>
          <button
            type="button"
            onClick={() => setOutletFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
              outletFilter === 'all' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>
          {outlets.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setOutletFilter(o.id)}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                outletFilter === o.id ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              {o.shortcutName || o.shopName}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
              statusFilter === 'all' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({entries.length})
          </button>
          <button
            type="button"
            onClick={() => {
              playKeySound('action');
              setStatusFilter('due_soon');
            }}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 ${
              statusFilter === 'due_soon'
                ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                : dueSoonEntries.length > 0
                ? 'text-amber-300 hover:text-amber-200 bg-amber-950/40 border border-amber-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>Due Soon (≤3d)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/40 font-mono">
              {dueSoonEntries.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              playKeySound('action');
              setStatusFilter('pending');
            }}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
              statusFilter === 'pending' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            Pending ({stats.pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('cleared')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
              statusFilter === 'cleared' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            Cleared ({stats.clearedCount})
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredEntries.length === 0 ? (
        <div className="bg-slate-900/60 rounded-3xl p-8 border border-slate-800 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <Package className="w-7 h-7" />
          </div>
          <h4 className="text-base font-bold text-white">No Market Credit Records Found</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {searchTerm || statusFilter !== 'all' || outletFilter !== 'all'
              ? 'No market credit entries matched your current search and filters.'
              : 'Record spices, grocery sacks or oil tins taken on credit from mandi suppliers with bill images and 15s voice notes.'}
          </p>
          <button
            type="button"
            onClick={() => handleOpenAddModal()}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-md inline-flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record First Credit Entry</span>
          </button>
        </div>
      ) : viewMode === 'by_supplier' ? (
        /* VIEW 1: DEDICATED SUPPLIER SECTIONS ("in his section") */
        <div className="space-y-4">
          {supplierGroups.map((supplier) => {
            const hasPending = supplier.remainingBaaki > 0;
            const isExpanded = isSupplierExpanded(supplier.name);

            return (
              <div
                key={supplier.name}
                className={`rounded-3xl border transition-all overflow-hidden shadow-sm ${
                  hasPending
                    ? 'bg-slate-900/95 border-rose-500/30 hover:border-rose-500/50'
                    : 'bg-slate-900/80 border-emerald-500/30'
                }`}
              >
                {/* Supplier Section Header */}
                <div className="p-4 sm:p-5 bg-slate-950/60 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                  {/* Left: Supplier Info */}
                  <div className="flex items-start sm:items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm flex-shrink-0 border ${
                        hasPending
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-white text-base sm:text-lg tracking-tight">
                          {supplier.name}
                        </span>
                        {supplier.phone && (
                          <a
                            href={`tel:${supplier.phone}`}
                            className="text-xs font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded-lg border border-cyan-800/80 flex items-center gap-1 hover:text-cyan-300 hover:border-cyan-600 transition-colors"
                            title="Call supplier"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{supplier.phone}</span>
                          </a>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {supplier.outlets.join(', ')}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            hasPending
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          }`}
                        >
                          {hasPending ? `${supplier.remainingBaaki > 0 ? 'Baaki Pending' : ''}` : 'All Settled (चुकता)'}
                        </span>
                        {supplier.dueSoonBillsCount > 0 && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-950 text-amber-300 border border-amber-500/80 animate-pulse flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            <span>⚠️ {supplier.dueSoonBillsCount} {supplier.dueSoonBillsCount === 1 ? 'BILL DUE' : 'BILLS DUE'} IN ≤3 DAYS</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                        <span>{supplier.billsCount} credit bills recorded</span>
                        <span>•</span>
                        <span>
                          Last purchase:{' '}
                          {new Date(supplier.latestTimestamp).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Center/Right: Financials & Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                    {/* Financial stats for this supplier */}
                    <div className="flex items-center gap-3 text-right">
                      <div className="text-left sm:text-right">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Total Purchases</div>
                        <div className="text-sm font-bold font-mono text-white">
                          ₹{supplier.totalPurchased.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <div className="text-[10px] text-emerald-400 uppercase font-bold">Total Jama</div>
                        <div className="text-sm font-bold font-mono text-emerald-300">
                          ₹{supplier.totalJama.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="text-left sm:text-right pl-2 border-l border-slate-800">
                        <div className="text-[10px] text-rose-400 uppercase font-bold">Net Baaki</div>
                        <div
                          className={`text-lg font-black font-mono ${
                            hasPending ? 'text-rose-300' : 'text-emerald-400'
                          }`}
                        >
                          ₹{supplier.remainingBaaki.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    {/* Section Actions */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Button to record recurring entry under this exact supplier */}
                      <button
                        type="button"
                        onClick={() => handleOpenAddModal(supplier.name, supplier.phone)}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        title={`Record another recurring credit bill for ${supplier.name}`}
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Add Bill for {supplier.name.split(' ')[0]}</span>
                      </button>

                      {/* Export this supplier's statement to Excel */}
                      <button
                        type="button"
                        onClick={() => {
                          playKeySound('action');
                          exportSupplierStatementToExcel(supplier.name, entries, storeSettings.shopName);
                        }}
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-emerald-950/80 text-slate-300 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/50 transition-colors cursor-pointer"
                        title={`Download Excel statement for ${supplier.name}`}
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      </button>

                      {/* Print thermal statement for this supplier */}
                      <button
                        type="button"
                        onClick={() => handlePrintSupplierStatement(supplier)}
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                        title={`Print complete thermal statement for ${supplier.name}`}
                      >
                        <Printer className="w-4 h-4 text-cyan-400" />
                      </button>

                      {/* Accordion toggle */}
                      <button
                        type="button"
                        onClick={() => toggleSupplierExpand(supplier.name)}
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                        title={isExpanded ? 'Collapse bills' : 'Expand bills'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Supplier Bills Accordion Body */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 space-y-3 bg-slate-900/50">
                    <div className="text-xs font-bold text-slate-400 flex items-center justify-between">
                      <span className="uppercase tracking-wider">
                        Recurring Credit Bills & Receipts ({supplier.entries.length}):
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Click '+ Add Bill' above to record another purchase from {supplier.name}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {supplier.entries.map((entry) => {
                        const isPending = entry.remainingBaaki > 0;
                        const formattedDate = new Date(entry.timestamp).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        const percentPaid = Math.min(
                          100,
                          Math.round(((entry.totalAmount - entry.remainingBaaki) / entry.totalAmount) * 100)
                        );
                        const dueStatus = calculateDueDateStatus(entry);

                        return (
                          <div
                            key={entry.id}
                            className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                              dueStatus.isDueWithin3Days
                                ? `${dueStatus.cardHighlightStyle} shadow-lg shadow-amber-950/40`
                                : isPending
                                ? 'bg-slate-950/80 border-rose-500/30'
                                : 'bg-slate-950/50 border-emerald-500/20 opacity-90'
                            }`}
                          >
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                              {/* Left details */}
                              <div className="space-y-1.5 flex-1 min-w-0">
                                <div className="flex items-center gap-2 text-xs text-amber-200/90 font-medium flex-wrap">
                                  <div className="flex items-center gap-1.5">
                                    <Package className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                    <span className="font-bold text-white text-sm">{entry.goodsDescription}</span>
                                  </div>

                                  {/* Payment Due Date Warning Indicator */}
                                  {dueStatus.hasDueDate ? (
                                    <span
                                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1 ${dueStatus.badgeStyle}`}
                                      title={dueStatus.isDueWithin3Days ? 'Payment due soon or overdue! Settle payment quickly.' : `Payment due date: ${entry.dueDate}`}
                                    >
                                      {dueStatus.isDueWithin3Days ? (
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-300 animate-pulse flex-shrink-0" />
                                      ) : (
                                        <CalendarClock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                      )}
                                      <span>{dueStatus.warningLabel}</span>
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditDueDateModal(entry)}
                                      className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-slate-800/80 hover:bg-slate-750 text-slate-400 hover:text-amber-300 border border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                                      title="Set a payment deadline to track warning indicators"
                                    >
                                      <CalendarClock className="w-3 h-3 text-amber-400" />
                                      <span>+ Set Due Date</span>
                                    </button>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-500" />
                                    <span>Taken: {formattedDate}</span>
                                  </span>
                                  <span>• Outlet: {entry.outletName || 'sy Nayab'}</span>
                                  {entry.recordedBy && <span>• By: {entry.recordedBy}</span>}
                                </div>

                                {entry.notes && (
                                  <div className="text-[11px] text-slate-400 italic">
                                    Note: {entry.notes}
                                  </div>
                                )}

                                {/* Attachments: Image & Voice Note */}
                                <div className="flex items-center gap-2 pt-1 flex-wrap">
                                  {entry.billImageUrl && (
                                    <button
                                      type="button"
                                      onClick={() => setLightboxImageUrl(entry.billImageUrl!)}
                                      className="p-1 rounded-xl bg-slate-800 border border-slate-700 hover:border-cyan-500 flex items-center gap-2 text-xs text-slate-300 group cursor-pointer transition-all"
                                      title="Click to view original bill scan"
                                    >
                                      <img
                                        src={entry.billImageUrl}
                                        alt="Bill"
                                        className="w-8 h-8 rounded-lg object-cover bg-slate-950 border border-slate-700"
                                      />
                                      <div className="text-left pr-2">
                                        <div className="text-[11px] font-bold text-white group-hover:text-cyan-400 flex items-center gap-1">
                                          <span>Bill Photo</span>
                                          <Eye className="w-3 h-3 text-cyan-400" />
                                        </div>
                                      </div>
                                    </button>
                                  )}

                                  {entry.voiceNoteUrl && (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleVoiceNotePlayback(entry.id, entry.voiceNoteUrl!)}
                                      className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                                        activeVoicePlayingId === entry.id
                                          ? 'bg-rose-950/80 border-rose-500 text-rose-200 animate-pulse ring-1 ring-rose-400'
                                          : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:border-rose-500/60 hover:text-white'
                                      }`}
                                    >
                                      {activeVoicePlayingId === entry.id ? (
                                        <Pause className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                                      ) : (
                                        <Play className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                                      )}
                                      <span>
                                        {activeVoicePlayingId === entry.id ? 'Playing 15s Note...' : '15s Voice Note'}
                                      </span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Right details: Numbers & Actions */}
                              <div className="w-full md:w-auto flex flex-col md:items-end justify-between gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                                <div className="flex md:flex-col items-center md:items-end justify-between gap-1 w-full">
                                  <div className="text-left md:text-right">
                                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                      Remaining Baaki
                                    </div>
                                    <div
                                      className={`text-lg sm:text-xl font-black font-mono ${
                                        isPending ? 'text-rose-400' : 'text-emerald-400'
                                      }`}
                                    >
                                      ₹{entry.remainingBaaki.toLocaleString('en-IN')}
                                    </div>
                                  </div>

                                  <div className="text-right text-[11px] text-slate-400 space-y-0.5">
                                    <div>
                                      Bill: <span className="font-mono font-bold text-white">₹{entry.totalAmount}</span>
                                      {' '}| Paid:{' '}
                                      <span className="font-mono font-bold text-emerald-400">
                                        ₹{entry.totalAmount - entry.remainingBaaki}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Progress bar */}
                                <div className="w-full md:w-36 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-300 ${
                                      isPending ? 'bg-gradient-to-r from-emerald-500 to-amber-500' : 'bg-emerald-400'
                                    }`}
                                    style={{ width: `${percentPaid}%` }}
                                  />
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1.5 w-full md:w-auto justify-end flex-wrap">
                                  {isPending && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        playKeySound('action');
                                        setActiveEntryForPayment(entry);
                                        setAdditionalPaymentAmount('');
                                        setIsPaymentModalOpen(true);
                                      }}
                                      className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                                      title="Record payment (Jama) for this bill"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>Pay Jama</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditDueDateModal(entry)}
                                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-amber-300 border border-slate-700 transition-colors cursor-pointer"
                                    title="Set or update payment due date"
                                  >
                                    <CalendarClock className="w-3.5 h-3.5 text-amber-400" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handlePrintMarketCreditSlip(entry)}
                                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                                    title="Print voucher on thermal printer"
                                  >
                                    <Printer className="w-3.5 h-3.5 text-cyan-400" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteEntry(entry.id)}
                                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/50 transition-colors cursor-pointer"
                                    title="Delete this bill"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Payment history logs */}
                            {entry.paymentsHistory && entry.paymentsHistory.length > 0 && (
                              <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-xs">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                  <Wallet className="w-3 h-3 text-emerald-400" />
                                  <span>Jama History:</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  {entry.paymentsHistory.map((p) => (
                                    <div
                                      key={p.id}
                                      className="p-1.5 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between text-[11px]"
                                    >
                                      <div>
                                        <span className="font-bold text-emerald-400 font-mono">₹{p.amount}</span>
                                        <span className="text-slate-400 ml-1">via {p.paymentMode.toUpperCase()}</span>
                                        {p.note && <span className="text-slate-500 ml-1 italic">({p.note})</span>}
                                      </div>
                                      <span className="text-[10px] text-slate-500">
                                        {new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* VIEW 2: ALL BILLS LIST TIMELINE */
        <div className="space-y-3">
          {filteredEntries.map((entry) => {
            const isPending = entry.remainingBaaki > 0;
            const formattedDate = new Date(entry.timestamp).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
            const percentPaid = Math.min(
              100,
              Math.round(((entry.totalAmount - entry.remainingBaaki) / entry.totalAmount) * 100)
            );
            const dueStatus = calculateDueDateStatus(entry);

            return (
              <div
                key={entry.id}
                className={`p-4 rounded-2xl border transition-all ${
                  dueStatus.isDueWithin3Days
                    ? `${dueStatus.cardHighlightStyle} shadow-lg shadow-amber-950/40`
                    : isPending
                    ? 'bg-slate-900/95 border-rose-500/30 hover:border-rose-500/50 shadow-sm'
                    : 'bg-slate-900/70 border-emerald-500/30 opacity-90'
                }`}
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-white text-base tracking-tight">
                        {entry.supplierName}
                      </span>
                      {entry.supplierPhone && (
                        <a
                          href={`tel:${entry.supplierPhone}`}
                          className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded-md border border-cyan-800 flex items-center gap-1 hover:text-cyan-300"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{entry.supplierPhone}</span>
                        </a>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {entry.outletName || 'sy Nayab'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isPending
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}
                      >
                        {isPending ? 'Baaki Pending' : 'Fully Cleared'}
                      </span>

                      {/* Payment Due Date Warning Indicator */}
                      {dueStatus.hasDueDate ? (
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1 ${dueStatus.badgeStyle}`}
                          title={dueStatus.isDueWithin3Days ? 'Payment due soon or overdue! Settle payment quickly.' : `Payment due date: ${entry.dueDate}`}
                        >
                          {dueStatus.isDueWithin3Days ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-300 animate-pulse flex-shrink-0" />
                          ) : (
                            <CalendarClock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          )}
                          <span>{dueStatus.warningLabel}</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenEditDueDateModal(entry)}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-slate-800/80 hover:bg-slate-750 text-slate-400 hover:text-amber-300 border border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                          title="Set a payment deadline to track warning indicators"
                        >
                          <CalendarClock className="w-3 h-3 text-amber-400" />
                          <span>+ Set Due Date</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-amber-200/90 font-medium">
                      <Package className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <span className="font-semibold text-slate-300">Goods:</span>
                      <span className="font-bold text-white">{entry.goodsDescription}</span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>Taken: {formattedDate}</span>
                      </span>
                      {entry.recordedBy && <span>• By: {entry.recordedBy}</span>}
                    </div>

                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      {entry.billImageUrl && (
                        <button
                          type="button"
                          onClick={() => setLightboxImageUrl(entry.billImageUrl!)}
                          className="p-1 rounded-xl bg-slate-800 border border-slate-700 hover:border-cyan-500 flex items-center gap-2 text-xs text-slate-300 group cursor-pointer transition-all"
                        >
                          <img
                            src={entry.billImageUrl}
                            alt="Bill"
                            className="w-9 h-9 rounded-lg object-cover bg-slate-950 border border-slate-700"
                          />
                          <div className="text-left pr-2">
                            <div className="text-[11px] font-bold text-white group-hover:text-cyan-400 flex items-center gap-1">
                              <span>View Bill Image</span>
                              <Eye className="w-3 h-3 text-cyan-400" />
                            </div>
                            <div className="text-[9px] text-slate-400">Receipt Photo</div>
                          </div>
                        </button>
                      )}

                      {entry.voiceNoteUrl && (
                        <button
                          type="button"
                          onClick={() => handleToggleVoiceNotePlayback(entry.id, entry.voiceNoteUrl!)}
                          className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                            activeVoicePlayingId === entry.id
                              ? 'bg-rose-950/80 border-rose-500 text-rose-200 animate-pulse ring-1 ring-rose-400'
                              : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:border-rose-500/60 hover:text-white'
                          }`}
                        >
                          {activeVoicePlayingId === entry.id ? (
                            <Pause className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                          ) : (
                            <Play className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                          )}
                          <span>
                            {activeVoicePlayingId === entry.id ? 'Playing 15s Note...' : 'Listen 15s Voice Note'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="w-full md:w-auto flex flex-col md:items-end justify-between gap-2.5 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                    <div className="flex md:flex-col items-center md:items-end justify-between gap-1 w-full">
                      <div className="text-left md:text-right">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          Remaining (Baaki)
                        </div>
                        <div
                          className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
                            isPending ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          ₹{entry.remainingBaaki.toLocaleString('en-IN')}
                        </div>
                      </div>

                      <div className="text-right text-[11px] text-slate-400 space-y-0.5">
                        <div>
                          Bill: <span className="font-mono font-bold text-white">₹{entry.totalAmount}</span>
                        </div>
                        <div>
                          Paid:{' '}
                          <span className="font-mono font-bold text-emerald-400">
                            ₹{entry.totalAmount - entry.remainingBaaki}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="w-full md:w-44 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isPending ? 'bg-gradient-to-r from-emerald-500 to-amber-500' : 'bg-emerald-400'
                        }`}
                        style={{ width: `${percentPaid}%` }}
                      />
                    </div>

                    <div className="flex items-center gap-1.5 w-full md:w-auto justify-end flex-wrap">
                      {isPending && (
                        <button
                          type="button"
                          onClick={() => {
                            playKeySound('action');
                            setActiveEntryForPayment(entry);
                            setAdditionalPaymentAmount('');
                            setIsPaymentModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Jama Payment</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenEditDueDateModal(entry)}
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-amber-300 border border-slate-700 transition-colors cursor-pointer"
                        title="Set or update payment due date"
                      >
                        <CalendarClock className="w-4 h-4 text-amber-400" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePrintMarketCreditSlip(entry)}
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                      >
                        <Printer className="w-4 h-4 text-cyan-400" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {entry.paymentsHistory && entry.paymentsHistory.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-xs">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Wallet className="w-3 h-3 text-emerald-400" />
                      <span>Payment (Jama) History:</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {entry.paymentsHistory.map((p) => (
                        <div
                          key={p.id}
                          className="p-1.5 bg-slate-950/60 rounded-lg border border-slate-800 flex items-center justify-between text-[11px]"
                        >
                          <div>
                            <span className="font-bold text-emerald-400 font-mono">₹{p.amount}</span>
                            <span className="text-slate-400 ml-1.5">via {p.paymentMode.toUpperCase()}</span>
                            {p.note && <span className="text-slate-500 ml-1 italic">({p.note})</span>}
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: ADD NEW OR RECURRING MARKET CREDIT ENTRY */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-xl bg-slate-900 border-2 border-rose-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl shadow-rose-950/80 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base">Record Goods on Credit (माल उधारी)</h3>
                  <p className="text-xs text-slate-400">Record recurring purchase bill from mandi supplier</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMarketCredit} className="space-y-4">
              {/* SECTION 1: SUPPLIER SELECTION (Existing vs New) */}
              <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-rose-400" />
                    <span>Select Supplier (सप्लायर चुनें) <span className="text-rose-400">*</span>:</span>
                  </label>

                  {/* Mode switcher pills */}
                  <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-700 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSupplierSelectionMode('existing')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                        supplierSelectionMode === 'existing'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Existing Supplier ({allUniqueSuppliers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSupplierSelectionMode('new');
                        setSupplierName('');
                        setSupplierPhone('');
                      }}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                        supplierSelectionMode === 'new'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      + New Supplier
                    </button>
                  </div>
                </div>

                {supplierSelectionMode === 'existing' && allUniqueSuppliers.length > 0 ? (
                  <div className="space-y-2">
                    <select
                      value={supplierName}
                      onChange={(e) => handleSelectExistingSupplier(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-rose-500 rounded-xl px-3 py-2 text-sm text-white outline-none"
                    >
                      <option value="" disabled>-- Select from Existing Mandi Suppliers --</option>
                      {allUniqueSuppliers.map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.name} {s.phone ? `(${s.phone})` : ''} — Baaki: ₹{s.totalBaaki.toLocaleString('en-IN')}
                        </option>
                      ))}
                    </select>

                    {supplierName && (
                      <div className="p-2.5 bg-rose-950/40 border border-rose-500/30 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <span className="text-slate-400">Recording recurring bill for: </span>
                          <span className="font-black text-rose-300">{supplierName}</span>
                          {supplierPhone && (
                            <span className="text-slate-400 ml-1.5 font-mono">({supplierPhone})</span>
                          )}
                        </div>
                        <span className="text-[10px] text-amber-300 font-bold bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-800/80">
                          Appends to his section
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <input
                        type="text"
                        required
                        value={supplierName}
                        onChange={(e) => setSupplierName(e.target.value)}
                        placeholder="Enter Supplier / Party Name (e.g. Patel APMC)"
                        className="w-full bg-slate-900 border border-slate-700 focus:border-rose-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="tel"
                        value={supplierPhone}
                        onChange={(e) => setSupplierPhone(e.target.value)}
                        placeholder="Mobile / Phone (Optional)"
                        className="w-full bg-slate-900 border border-slate-700 focus:border-rose-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 2: GOODS TAKEN */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Goods Taken on Credit (माल का विवरण) <span className="text-rose-400">*</span>:
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={goodsDescription}
                  onChange={(e) => setGoodsDescription(e.target.value)}
                  placeholder="e.g. 50kg Jeera Sack & 25kg Kali Mirch, 10 Tins Oil..."
                  className="w-full bg-slate-950 border border-slate-700 focus:border-rose-500 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 outline-none"
                />
                <div className="flex items-center gap-1.5 mt-1.5 overflow-x-auto pb-1 text-[11px]">
                  <span className="text-slate-500 text-[10px]">Suggestions:</span>
                  {['जीरा 50kg बोरी', 'हल्दी गांठ 100kg', 'सरसों तेल 15L टिन x 10', 'हरी इलायची 5kg', 'काजू W320 20kg'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setGoodsDescription(s)}
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 text-[10px] whitespace-nowrap cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Outlet and Date Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Store Outlet (दुकान):</label>
                  <select
                    value={entryOutletId}
                    onChange={(e) => setEntryOutletId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-rose-500 rounded-xl px-3 py-2 text-sm text-white outline-none"
                  >
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.shopName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    When Taken (दिनांक व समय) <span className="text-rose-400">*</span>:
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={entryDateTime}
                    onChange={(e) => setEntryDateTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-rose-500 rounded-xl px-3 py-2 text-sm text-white outline-none font-mono"
                  />
                </div>
              </div>

              {/* Amounts: Total Bill Amount vs Payment (Jama) on Day vs Remaining Baaki */}
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-white block mb-1">
                      Total Bill Amount (कुल बिल ₹) <span className="text-rose-400">*</span>:
                    </label>
                    <div className="relative">
                      <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={totalAmountInput}
                        onChange={(e) => setTotalAmountInput(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-900 border border-slate-700 focus:border-rose-500 rounded-xl pl-9 pr-3 py-2 text-base font-mono font-bold text-white outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-emerald-300 block mb-1">
                      Payment (Jama) Done on Day (दिन का जमा ₹):
                    </label>
                    <div className="relative">
                      <IndianRupee className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={paidOnDayInput}
                        onChange={(e) => setPaidOnDayInput(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2 text-base font-mono font-bold text-emerald-300 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Real-time Dynamic Baaki Preview */}
                <div className="flex items-center justify-between p-2.5 bg-rose-950/50 border border-rose-500/40 rounded-xl text-xs">
                  <span className="font-bold text-rose-300 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span>Calculated Remaining (Baaki देना है):</span>
                  </span>
                  <span className="text-lg font-black font-mono text-rose-200">
                    ₹{calculatedBaaki.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* PAYMENT DUE DATE FOR DEADLINE WARNINGS */}
              <div className="p-3 bg-slate-950/80 rounded-2xl border border-amber-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <CalendarClock className="w-4 h-4 text-amber-400" />
                    <span>Payment Due Date (भुगतान की नियत तारीख):</span>
                  </label>
                  <span className="text-[10px] text-amber-400/80 font-medium">Warning triggers 3 days before</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={entryDueDate}
                    onChange={(e) => setEntryDueDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { label: '+3 Days', days: 3 },
                      { label: '+7 Days (1 Wk)', days: 7 },
                      { label: '+15 Days', days: 15 },
                      { label: '+30 Days (1 Mo)', days: 30 },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + opt.days);
                          setEntryDueDate(d.toISOString().slice(0, 10));
                        }}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-amber-300 border border-slate-700 text-[10px] font-semibold cursor-pointer transition-colors"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Uploading Image of Bill with dedicated device picker and camera options */}
              <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Upload Image of Bill (बिल का फ़ोटो):</span>
                  </label>
                  {billImageBase64 && (
                    <button
                      type="button"
                      onClick={() => {
                        setBillImageBase64(null);
                        setImageUploadError(null);
                      }}
                      className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>

                {/* Hidden input for selecting photo from device gallery/files (NO capture attribute) */}
                <input
                  ref={deviceFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleDeviceImageChange}
                  className="hidden"
                />

                {/* Hidden input for live camera snap on mobile */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCameraImageChange}
                  className="hidden"
                />

                {imageUploadError && (
                  <div className="p-2 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-200 text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                    <span>{imageUploadError}</span>
                  </div>
                )}

                {billImageBase64 ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-2.5 bg-slate-900 rounded-xl border border-slate-700">
                    <div className="flex items-center gap-3">
                      <img
                        src={billImageBase64}
                        alt="Uploaded Bill"
                        onClick={() => {
                          setLightboxImageUrl(billImageBase64);
                        }}
                        className="w-16 h-16 rounded-lg object-cover border border-cyan-500/50 bg-slate-950 cursor-pointer hover:opacity-90 transition-opacity"
                        title="Click to zoom photo"
                      />
                      <div className="text-xs space-y-0.5">
                        <div className="font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Bill Photo Attached</span>
                        </div>
                        <p className="text-[10px] text-slate-400">Click thumbnail to inspect full size</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          if (deviceFileInputRef.current) {
                            deviceFileInputRef.current.value = '';
                            deviceFileInputRef.current.click();
                          }
                        }}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-cyan-300 border border-cyan-500/40 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                        title="Choose another photo from device files/gallery"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Change from Device</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (cameraInputRef.current) {
                            cameraInputRef.current.value = '';
                            cameraInputRef.current.click();
                          }
                        }}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 rounded-xl text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                        title="Retake photo using camera"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Camera</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingOverImage(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDraggingOverImage(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingOverImage(false);
                      const droppedFile = e.dataTransfer.files?.[0];
                      if (droppedFile) processImageFile(droppedFile);
                    }}
                    className={`border-2 border-dashed rounded-xl p-3.5 text-center transition-all ${
                      isDraggingOverImage
                        ? 'border-cyan-400 bg-cyan-950/30'
                        : 'border-slate-700 hover:border-cyan-500 bg-slate-900/30'
                    }`}
                  >
                    <div className="flex justify-center mb-1.5 gap-2">
                      <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
                        <FolderOpen className="w-5 h-5" />
                      </div>
                      <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400">
                        <Camera className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="text-xs font-bold text-white mb-2">
                      {isCompressingImage ? 'Processing & compressing photo...' : 'Select Bill Photo or Take Camera Picture'}
                    </div>

                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          if (deviceFileInputRef.current) {
                            deviceFileInputRef.current.value = '';
                            deviceFileInputRef.current.click();
                          }
                        }}
                        className="px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer active:scale-95"
                      >
                        <FolderOpen className="w-4 h-4" />
                        <span>Select Photo from Device</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (cameraInputRef.current) {
                            cameraInputRef.current.value = '';
                            cameraInputRef.current.click();
                          }
                        }}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                      >
                        <Camera className="w-4 h-4 text-cyan-400" />
                        <span>Camera Snap</span>
                      </button>
                    </div>

                    <div className="text-[10px] text-slate-500 mt-2">
                      Supports JPG, PNG, WebP, HEIC &bull; Drag & drop file here or browse device
                    </div>
                  </div>
                )}
              </div>

              {/* Record 15-Second Short Voice Note */}
              <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-rose-400" />
                    <span>Record Short Voice Note (15 Seconds):</span>
                  </label>
                  {recordedVoiceUrl && (
                    <button
                      type="button"
                      onClick={handleDiscardVoiceNote}
                      className="text-[11px] text-rose-400 hover:text-rose-300"
                    >
                      Discard Note
                    </button>
                  )}
                </div>

                {isRecordingVoice ? (
                  <div className="p-3.5 bg-rose-950/80 border-2 border-rose-500 rounded-2xl text-center space-y-2.5 animate-pulse">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                      <span className="text-sm font-black text-white">Recording Voice Note...</span>
                    </div>

                    <div className="text-2xl font-black font-mono text-rose-300">
                      00:{String(voiceSecondsLeft).padStart(2, '0')} / 00:15
                    </div>

                    <p className="text-[11px] text-rose-200">
                      Speak goods details or supplier commitments. Stops automatically at 15s.
                    </p>

                    <button
                      type="button"
                      onClick={handleStopVoiceRecording}
                      className="px-4 py-1.5 bg-white text-slate-950 font-black text-xs rounded-xl shadow-md hover:bg-slate-200 cursor-pointer"
                    >
                      Stop Recording Now
                    </button>
                  </div>
                ) : recordedVoiceUrl ? (
                  <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-emerald-500/40">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleToggleFormVoicePlay}
                        className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-md hover:bg-emerald-400 cursor-pointer"
                      >
                        {isPlayingFormVoice ? <Pause className="w-4 h-4 fill-slate-950" /> : <Play className="w-4 h-4 fill-slate-950" />}
                      </button>
                      <div>
                        <div className="text-xs font-bold text-white">15s Voice Note Ready</div>
                        <div className="text-[10px] text-emerald-400 font-semibold">Tap to preview before saving</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleStartVoiceRecording}
                      className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
                    >
                      Re-record (15s)
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartVoiceRecording}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 hover:border-rose-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Mic className="w-4 h-4 text-rose-400" />
                    <span>Tap to Record 15-Second Voice Note</span>
                  </button>
                )}
              </div>

              {/* Optional Remarks */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Additional Remarks / Notes:</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Rate negotiated @₹340/kg, delivery batch 2"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-rose-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-2 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-black text-xs shadow-lg shadow-rose-950/80 cursor-pointer"
                >
                  SAVE MARKET CREDIT BILL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD SUBSEQUENT JAMA PAYMENT */}
      {isPaymentModalOpen && activeEntryForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border-2 border-emerald-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl shadow-emerald-950/80 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-black text-white text-base">Record Payment (Jama)</h3>
                <p className="text-xs text-slate-400">
                  To Supplier: <span className="text-emerald-400 font-bold">{activeEntryForPayment.supplierName}</span>
                </p>
              </div>
              <button
                onClick={() => {
                  setIsPaymentModalOpen(false);
                  setActiveEntryForPayment(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Goods:</span>
                <span className="text-white font-semibold truncate max-w-[200px]">
                  {activeEntryForPayment.goodsDescription}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Bill Value:</span>
                <span className="text-white font-mono font-bold">₹{activeEntryForPayment.totalAmount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Current Baaki:</span>
                <span className="text-rose-400 font-mono font-black">₹{activeEntryForPayment.remainingBaaki}</span>
              </div>
            </div>

            <form onSubmit={handleSaveAdditionalPayment} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-white block mb-1">
                  Payment Amount (जमा राशि ₹) <span className="text-emerald-400">*</span>:
                </label>
                <div className="relative">
                  <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    min="1"
                    max={activeEntryForPayment.remainingBaaki}
                    step="any"
                    required
                    autoFocus
                    value={additionalPaymentAmount}
                    onChange={(e) => setAdditionalPaymentAmount(e.target.value)}
                    placeholder={`Max ₹${activeEntryForPayment.remainingBaaki}`}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2 text-base font-mono font-bold text-white outline-none"
                  />
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setAdditionalPaymentAmount(String(activeEntryForPayment.remainingBaaki))}
                    className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-lg hover:bg-emerald-900"
                  >
                    Full Baaki (₹{activeEntryForPayment.remainingBaaki})
                  </button>
                  {activeEntryForPayment.remainingBaaki > 2000 && (
                    <button
                      type="button"
                      onClick={() => setAdditionalPaymentAmount(String(Math.round(activeEntryForPayment.remainingBaaki / 2)))}
                      className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-lg hover:bg-slate-750"
                    >
                      Half (₹{Math.round(activeEntryForPayment.remainingBaaki / 2)})
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Payment Mode:</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'online_upi', 'bank_transfer'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMode(mode)}
                      className={`p-2 rounded-xl border text-xs font-bold capitalize transition-all cursor-pointer ${
                        paymentMode === mode
                          ? 'bg-emerald-600 text-white border-emerald-400'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                      }`}
                    >
                      {mode.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Payment Date & Time:</label>
                <input
                  type="datetime-local"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Remarks / Note (Optional):</label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="e.g. Paid via GPay / Sent with Abdullah"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsPaymentModalOpen(false);
                    setActiveEntryForPayment(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-950/80 cursor-pointer"
                >
                  RECORD PAYMENT (JAMA)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: LIGHTBOX FOR ORIGINAL BILL IMAGE */}
      {lightboxImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in"
          onClick={() => setLightboxImageUrl(null)}
        >
          <div
            className="relative max-w-3xl w-full max-h-[90vh] bg-slate-900 rounded-3xl border border-slate-700 p-2 overflow-hidden shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between p-2 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>Original Bill Image Preview</span>
              </span>
              <button
                onClick={() => setLightboxImageUrl(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="w-full overflow-auto max-h-[80vh] flex items-center justify-center p-2">
              <img
                src={lightboxImageUrl}
                alt="Bill Full Resolution"
                className="max-w-full max-h-[75vh] object-contain rounded-xl border border-slate-800"
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: EDIT PAYMENT DUE DATE */}
      {isEditDueDateModalOpen && activeEntryForDueDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/50 flex items-center justify-center flex-shrink-0 shadow-inner">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">
                    Set Payment Due Date (भुगतान की नियत तारीख)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Supplier: <span className="text-white font-bold">{activeEntryForDueDate.supplierName}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditDueDateModalOpen(false);
                  setActiveEntryForDueDate(null);
                }}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Goods:</span>
                <span className="font-bold text-white text-right">{activeEntryForDueDate.goodsDescription}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Remaining Baaki:</span>
                <span className="font-mono font-bold text-rose-400">
                  ₹{activeEntryForDueDate.remainingBaaki.toLocaleString('en-IN')}
                </span>
              </div>
              {activeEntryForDueDate.dueDate && (
                <div className="flex justify-between items-center pt-1 border-t border-slate-800/80">
                  <span className="text-slate-400">Current Status:</span>
                  <span className="font-bold text-amber-300">
                    {calculateDueDateStatus(activeEntryForDueDate).warningLabel}
                  </span>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveDueDate} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Payment Due Date (नियत तारीख):
                </label>
                <input
                  type="date"
                  value={editDueDateInput}
                  onChange={(e) => setEditDueDateInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2.5 text-sm font-mono text-white outline-none"
                />
                <p className="text-[10px] text-amber-400/80 mt-1">
                  ⚠️ A bright warning indicator will automatically highlight this bill when the due date is within 3 days.
                </p>
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400">Quick Presets:</span>
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  {[
                    { label: 'Today', days: 0 },
                    { label: '+3 Days', days: 3 },
                    { label: '+7 Days', days: 7 },
                    { label: '+15 Days', days: 15 },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + opt.days);
                        setEditDueDateInput(d.toISOString().slice(0, 10));
                      }}
                      className="py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-amber-300 border border-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditDueDateInput('')}
                  className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-rose-400 text-xs font-bold transition-colors cursor-pointer"
                  title="Remove due date from this bill"
                >
                  Clear Date
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditDueDateModalOpen(false);
                    setActiveEntryForDueDate(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-950/80 cursor-pointer"
                >
                  SAVE DUE DATE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
