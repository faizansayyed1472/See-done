import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  X,
  Flashlight,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  Scale,
  Barcode,
  Sparkles,
  ArrowRight,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Product, BillItem } from '../types';

interface PosBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onAddItemToBill: (item: Omit<BillItem, 'id'>) => void;
  onSelectProductForWeight: (product: Product) => void;
  onCreateNewProductWithBarcode?: (barcode: string) => void;
}

export const PosBarcodeScannerModal: React.FC<PosBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  products,
  onAddItemToBill,
  onSelectProductForWeight,
  onCreateNewProductWithBarcode,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Scanning feedback state
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const [lastScannedTime, setLastScannedTime] = useState<number>(0);
  const [instantAddMode, setInstantAddMode] = useState<boolean>(true);
  const [addedNotice, setAddedNotice] = useState<string | null>(null);

  // Manual input state
  const [manualCode, setManualCode] = useState('');

  // Web search state for unknown barcode
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  const [webSearchItem, setWebSearchItem] = useState<any | null>(null);

  // Audio beep playback using AudioContext
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    } catch {
      // Audio playback failed or blocked
    }
  };

  // Start Camera Stream
  const startCamera = async (facing: 'environment' | 'user') => {
    stopCamera();
    setCameraError(null);
    setCameraActive(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser or environment.');
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }

      // Check for torch/flashlight support on track
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities: any = track.getCapabilities?.() || {};
        if ('torch' in capabilities) {
          setTorchSupported(true);
        } else {
          setTorchSupported(false);
        }
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      let message = 'Unable to access camera. Please allow camera permissions.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Camera permission was denied. Please allow camera in browser settings or use manual barcode entry below.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'No camera device found on this system. You can test with the quick sample barcodes or enter codes manually.';
      }
      setCameraError(message);
      setCameraActive(false);
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setTorchOn(false);
    setCameraActive(false);
  };

  // Toggle Torch
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const newTorch = !torchOn;
        await track.applyConstraints({
          advanced: [{ torch: newTorch } as any],
        });
        setTorchOn(newTorch);
      } catch (err) {
        console.warn('Torch constraint error:', err);
      }
    }
  };

  // Flip Camera
  const flipCamera = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    startCamera(nextFacing);
  };

  // Process Barcode Code
  const processBarcode = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    // Debounce duplicate scans within 1.5 seconds
    const now = Date.now();
    if (trimmed === scannedBarcode && now - lastScannedTime < 1500) {
      return;
    }

    setLastScannedTime(now);
    setScannedBarcode(trimmed);
    setWebSearchItem(null);

    // Play scan sound feedback & vibrate
    playBeep();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(80);
    }

    // Lookup product in inventory by barcode or ID
    const found = products.find(
      (p) =>
        p.barcode?.toLowerCase() === trimmed.toLowerCase() ||
        p.id.toLowerCase() === trimmed.toLowerCase() ||
        (trimmed.length > 3 && p.name.toLowerCase() === trimmed.toLowerCase())
    );

    if (found) {
      setMatchedProduct(found);
      if (instantAddMode) {
        // Auto add 1 unit directly to bill
        onAddItemToBill({
          productId: found.id,
          name: found.name,
          hindiName: found.hindiName,
          quantity: 1,
          unit: found.unit,
          rate: found.rate,
          total: found.rate,
        });
        setAddedNotice(`Added 1x ${found.name} (₹${found.rate}) to bill!`);
        setTimeout(() => setAddedNotice(null), 3000);
      }
    } else {
      setMatchedProduct(null);
      setAddedNotice(null);
    }
  };

  // Barcode Detection Loop
  useEffect(() => {
    if (!isOpen) return;

    startCamera(cameraFacing);

    // Check if BarcodeDetector is natively supported
    const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
    let detector: any = null;

    if (hasBarcodeDetector) {
      try {
        detector = new (window as any).BarcodeDetector({
          formats: [
            'code_128',
            'code_39',
            'code_93',
            'ean_13',
            'ean_8',
            'upc_a',
            'upc_e',
            'qr_code',
            'itf',
            'data_matrix',
          ],
        });
      } catch (e) {
        console.warn('BarcodeDetector initialization error:', e);
      }
    }

    // Set up scanning interval
    const interval = window.setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;

      if (detector) {
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const first = barcodes[0].rawValue;
            if (first) {
              processBarcode(first);
            }
          }
        } catch {
          // ignore detector frame processing errors
        }
      }
    }, 200);

    scanIntervalRef.current = interval;

    return () => {
      clearInterval(interval);
      stopCamera();
    };
  }, [isOpen]);

  // Handle Web Search for Unknown Barcode
  const handleSearchUnknownBarcode = async () => {
    if (!scannedBarcode) return;
    setIsSearchingWeb(true);
    try {
      const res = await fetch('/api/item-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: scannedBarcode, barcode: scannedBarcode }),
      });
      if (res.ok) {
        const data = await res.json();
        setWebSearchItem(data);
      }
    } catch (err) {
      console.warn('Web search error:', err);
    } finally {
      setIsSearchingWeb(false);
    }
  };

  if (!isOpen) return null;

  // Popular sample barcodes for one-tap simulation/testing
  const sampleBarcodes = [
    { label: 'Tata Salt (8901030382341)', code: '8901030382341' },
    { label: 'Haldi Powder (8901058852011)', code: '8901058852011' },
    { label: 'Jeera Seeds (8901058852028)', code: '8901058852028' },
    { label: 'Arhar Dal (8902058852018)', code: '8902058852018' },
    { label: 'Chakki Atta (8903058852015)', code: '8903058852015' },
    { label: 'Kaju W320 (8905058852019)', code: '8905058852019' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Barcode className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                <span>POS Camera Barcode Scanner</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  Live
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Point camera at barcode or enter SKU code to ring up items
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title={soundEnabled ? 'Mute Scan Sound' : 'Enable Scan Sound'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body with Camera Viewport & Controls */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Camera Selection Toolbar & Permission Prompt */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-850 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-emerald-400" />
                <span>Camera Mode:</span>
              </span>
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-xl border border-slate-750">
                <button
                  type="button"
                  onClick={() => {
                    setCameraFacing('environment');
                    startCamera('environment');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    cameraFacing === 'environment' && cameraActive
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Scan using phone/device rear back camera"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Rear / Back</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCameraFacing('user');
                    startCamera('user');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    cameraFacing === 'user' && cameraActive
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Scan using front selfie webcam"
                >
                  <Camera className="w-3 h-3 text-cyan-400" />
                  <span>Front / Selfie</span>
                </button>
              </div>
            </div>

            {!cameraActive && (
              <button
                type="button"
                onClick={() => startCamera(cameraFacing)}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow"
              >
                <span>Allow Camera Access</span>
              </button>
            )}
          </div>

          {/* Camera Viewport Area */}
          <div className="relative w-full aspect-[4/3] bg-black rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-inner">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />

            {/* Viewfinder Aiming Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
              <div className="relative w-64 h-40 sm:w-72 sm:h-44 border-2 border-dashed border-emerald-400/70 rounded-2xl flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.15)]">
                {/* Corner Markers */}
                <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                {/* Animated Red/Green Laser line */}
                <div className="absolute left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-pulse" />

                <span className="text-[11px] font-semibold text-emerald-300 bg-slate-950/80 px-2 py-0.5 rounded-full backdrop-blur-sm border border-emerald-500/30">
                  Align Barcode Here
                </span>
              </div>
            </div>

            {/* Error or Inactive State with Explicit Permission Request */}
            {(!cameraActive || cameraError) && (
              <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-5 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 animate-pulse">
                  <Camera className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white mb-1">
                  {cameraError ? 'Camera Permission Status' : 'Camera Permission Required'}
                </h4>
                <p className="text-xs text-slate-300 max-w-sm mb-3">
                  {cameraError ||
                    'NAYAB POS scanner asks for camera access to scan Kirana barcodes. Please tap below to allow camera permission.'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => startCamera('environment')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Scan with Rear Camera</span>
                  </button>
                  <button
                    onClick={() => startCamera('user')}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700"
                  >
                    <Camera className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Scan with Front Camera</span>
                  </button>
                </div>
              </div>
            )}

            {/* Camera Control Buttons Overlay */}
            <div className="absolute top-3 right-3 flex items-center gap-2">
              {torchSupported && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`p-2 rounded-xl backdrop-blur-md text-xs font-bold transition-all shadow-md ${
                    torchOn
                      ? 'bg-amber-400 text-slate-950 shadow-amber-400/50'
                      : 'bg-slate-900/80 hover:bg-slate-800 text-white'
                  }`}
                  title="Toggle Flashlight / Torch"
                >
                  <Flashlight className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={flipCamera}
                className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md text-white transition-all shadow-md"
                title="Switch Camera (Front / Back)"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Scanning Status Badge */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
              <span className="text-[10px] text-slate-300 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-slate-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Detector Ready (EAN-13, UPC, Code-128, QR)</span>
              </span>
            </div>
          </div>

          {/* Quick Instant Add Mode Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-850 border border-slate-800">
            <div className="flex items-center gap-2">
              <input
                id="instant-add-check"
                type="checkbox"
                checked={instantAddMode}
                onChange={(e) => setInstantAddMode(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
              <label htmlFor="instant-add-check" className="text-xs font-semibold text-slate-200 cursor-pointer">
                Auto-add 1 unit instantly upon barcode scan
              </label>
            </div>
            <span className="text-[10px] text-slate-400">
              {instantAddMode ? 'Fast Checkout Mode' : 'Confirm Weight First'}
            </span>
          </div>

          {/* Added to Bill Notification Toast */}
          {addedNotice && (
            <div className="p-3 bg-emerald-950/70 border border-emerald-500/50 rounded-2xl flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                <span>{addedNotice}</span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-200 px-2 py-0.5 rounded-full font-bold">
                In Current Bill
              </span>
            </div>
          )}

          {/* Scanned Result Banner */}
          {scannedBarcode && (
            <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Scanned Barcode:</span>
                <span className="font-mono font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                  {scannedBarcode}
                </span>
              </div>

              {matchedProduct ? (
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-750 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-sm text-white">{matchedProduct.name}</h4>
                    {matchedProduct.hindiName && (
                      <p className="text-xs text-amber-300">{matchedProduct.hindiName}</p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Rate: <span className="text-emerald-400 font-bold font-mono">₹{matchedProduct.rate}</span> per {matchedProduct.unit}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectProductForWeight(matchedProduct);
                        onClose();
                      }}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1"
                    >
                      <Scale className="w-3.5 h-3.5 text-purple-400" />
                      <span>Custom Wt</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onAddItemToBill({
                          productId: matchedProduct.id,
                          name: matchedProduct.name,
                          hindiName: matchedProduct.hindiName,
                          quantity: 1,
                          unit: matchedProduct.unit,
                          rate: matchedProduct.rate,
                          total: matchedProduct.rate,
                        });
                        setAddedNotice(`Added +1x ${matchedProduct.name}!`);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+1 Add</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-200">
                        Item not found in current inventory
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        This barcode ({scannedBarcode}) is not yet registered. You can add it to your catalog or search it online.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {onCreateNewProductWithBarcode && (
                      <button
                        type="button"
                        onClick={() => {
                          onCreateNewProductWithBarcode(scannedBarcode);
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Register New Item</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSearchUnknownBarcode}
                      disabled={isSearchingWeb}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{isSearchingWeb ? 'Searching Free APIs...' : 'Free Barcode Lookup'}</span>
                    </button>
                  </div>

                  {webSearchItem?.item && (
                    <div className="p-3 bg-slate-900/95 rounded-xl border border-cyan-500/50 mt-2.5 text-xs space-y-2 animate-in fade-in">
                      <div className="flex items-start gap-2.5">
                        {(webSearchItem.item.imageUrl || webSearchItem.imageUrl) && (
                          <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-750 bg-slate-800 flex-shrink-0">
                            <img
                              src={webSearchItem.item.imageUrl || webSearchItem.imageUrl}
                              alt={webSearchItem.item.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-white text-sm sm:text-base truncate">{webSearchItem.item.name}</span>
                            {webSearchItem.item.hindiName && (
                              <span className="text-[10px] text-amber-300 bg-amber-400/10 px-1 py-0.5 rounded border border-amber-500/20 font-medium">
                                {webSearchItem.item.hindiName}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-emerald-400 font-mono font-bold mt-0.5">
                            Est. ₹{webSearchItem.item.typicalMarketRate} / {webSearchItem.item.suggestedUnit || 'unit'}
                          </p>
                          <span className="inline-block text-[9px] text-cyan-300 bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-500/30 mt-1 font-semibold">
                            {webSearchItem.freeApiSource || 'Open Food Facts Free API'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            const rate = Number(webSearchItem.item.typicalMarketRate) || 50;
                            onAddItemToBill({
                              productId: `barcode-${scannedBarcode}-${Date.now()}`,
                              name: webSearchItem.item.name,
                              hindiName: webSearchItem.item.hindiName,
                              quantity: 1,
                              unit: (webSearchItem.item.suggestedUnit as any) || 'packet',
                              rate: rate,
                              total: rate,
                            });
                            setAddedNotice(`Added "${webSearchItem.item.name}" (₹${rate})`);
                            setTimeout(() => setAddedNotice(null), 3000);
                          }}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1 shadow"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+1 Add to Current Bill</span>
                        </button>
                        {onCreateNewProductWithBarcode && (
                          <button
                            type="button"
                            onClick={() => {
                              onCreateNewProductWithBarcode(scannedBarcode);
                              onClose();
                            }}
                            className="px-2.5 py-1.5 bg-purple-600/80 hover:bg-purple-600 text-white rounded-lg font-bold text-[11px]"
                          >
                            Save to Catalog
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Manual Barcode / SKU Input Option */}
          <div className="p-3 bg-slate-850 rounded-2xl border border-slate-800 space-y-2">
            <label className="text-[11px] font-semibold text-slate-400 block">
              Manual Barcode / SKU Number Entry:
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      processBarcode(manualCode);
                      setManualCode('');
                    }
                  }}
                  placeholder="e.g. 8901030382341 or sp-1"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  processBarcode(manualCode);
                  setManualCode('');
                }}
                disabled={!manualCode.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow"
              >
                Scan Code
              </button>
            </div>
          </div>

          {/* Sample Barcodes for Quick Testing */}
          <div className="p-3 bg-slate-900/60 rounded-2xl border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-semibold">Test with Sample Kirana Barcodes:</span>
              <span className="text-[10px] text-slate-500">Tap to simulate camera scan</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sampleBarcodes.map((sb, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => processBarcode(sb.code)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-mono transition-colors flex items-center gap-1"
                >
                  <Barcode className="w-3 h-3 text-emerald-400" />
                  <span>{sb.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-900 flex items-center justify-between text-xs">
          <span className="text-slate-400 text-[11px]">
            {products.filter((p) => p.barcode).length} items in catalog have barcodes
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors"
          >
            Done Scanning
          </button>
        </div>
      </div>
    </div>
  );
};
