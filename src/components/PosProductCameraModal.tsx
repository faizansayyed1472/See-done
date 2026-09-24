import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  X,
  RefreshCw,
  Flashlight,
  Check,
  RotateCcw,
  UploadCloud,
  AlertCircle,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { playKeySound } from '../utils/audio';

interface PosProductCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName?: string;
  onPhotoCaptured: (dataUrl: string) => void;
}

export const PosProductCameraModal: React.FC<PosProductCameraModalProps> = ({
  isOpen,
  onClose,
  productName,
  onPhotoCaptured,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Captured photo preview state
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Clean stop of camera streams
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore error on stop
        }
      });
      streamRef.current = null;
    }
    setTorchOn(false);
    setCameraActive(false);
  };

  // Start Camera Stream
  const startCamera = async (facing: 'environment' | 'user') => {
    stopCamera();
    setCameraError(null);
    setCameraActive(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported by this browser. Please use photo upload instead.');
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        setCameraActive(true);
      }

      // Check for torch capability
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
        setTorchSupported(Boolean(capabilities && 'torch' in capabilities));
      }
    } catch (err: any) {
      console.warn('Camera start error:', err);
      let msg = 'Unable to access device camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission was denied. Please allow camera access in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera found on this device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Camera is in use by another app or tab.';
      }
      setCameraError(msg);
      setCameraActive(false);
    }
  };

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current || !torchSupported) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchOn(nextState);
      } catch (err) {
        console.warn('Torch toggle error:', err);
      }
    }
  };

  // Flip Front / Back Camera
  const flipCamera = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    startCamera(nextFacing);
  };

  // Capture snapshot from video onto canvas with square cropping & compression
  const handleSnapPhoto = () => {
    if (!videoRef.current) return;
    playKeySound('action');

    try {
      const video = videoRef.current;
      const vWidth = video.videoWidth || 640;
      const vHeight = video.videoHeight || 480;

      // Crop to center square for clean product card display
      const minDim = Math.min(vWidth, vHeight);
      const startX = (vWidth - minDim) / 2;
      const startY = (vHeight - minDim) / 2;

      const canvas = document.createElement('canvas');
      const targetSize = 600; // Optimal 600x600 for crisp cards & compact storage
      canvas.width = targetSize;
      canvas.height = targetSize;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // If front camera, mirror image naturally
      if (cameraFacing === 'user') {
        ctx.translate(targetSize, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, startX, startY, minDim, minDim, 0, 0, targetSize, targetSize);

      // High quality compressed JPEG data URL
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      setCapturedPreview(dataUrl);
      stopCamera();
    } catch (err) {
      console.warn('Failed capturing photo from video:', err);
    }
  };

  // Fallback file upload from gallery / disk
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const minDim = Math.min(img.width, img.height);
        const startX = (img.width - minDim) / 2;
        const startY = (img.height - minDim) / 2;
        const targetSize = 600;
        canvas.width = targetSize;
        canvas.height = targetSize;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, targetSize, targetSize);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          setCapturedPreview(compressed);
          stopCamera();
        } else {
          setCapturedPreview(event.target?.result as string);
        }
        setIsProcessing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Retake photo: clear captured preview and restart camera
  const handleRetake = () => {
    setCapturedPreview(null);
    startCamera(cameraFacing);
  };

  // Confirm photo: pass to caller and close
  const handleConfirmPhoto = () => {
    if (!capturedPreview) return;
    playKeySound('action');
    onPhotoCaptured(capturedPreview);
    handleClose();
  };

  const handleClose = () => {
    stopCamera();
    setCapturedPreview(null);
    setCameraError(null);
    onClose();
  };

  // Manage camera lifecycle based on isOpen and capturedPreview
  useEffect(() => {
    if (isOpen && !capturedPreview) {
      startCamera(cameraFacing);
    } else if (!isOpen) {
      stopCamera();
      setCapturedPreview(null);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-3.5 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                <span>Capture Item Photo</span>
              </h3>
              {productName && (
                <p className="text-xs text-slate-400 truncate max-w-[240px]">
                  For: <span className="text-emerald-400 font-medium">{productName}</span>
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewfinder or Photo Preview */}
        <div className="relative bg-black flex-1 min-h-[300px] sm:min-h-[360px] flex items-center justify-center overflow-hidden">
          {capturedPreview ? (
            /* Captured Snapshot Preview */
            <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-2xl bg-slate-950">
                <img
                  src={capturedPreview}
                  alt="Captured preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-600/90 text-white text-[10px] font-bold flex items-center gap-1 shadow-md">
                  <Check className="w-3 h-3" />
                  <span>Captured</span>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Photo ready to attach to product catalog
              </p>
            </div>
          ) : (
            /* Live Camera Stream */
            <>
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className={`w-full h-full object-cover max-h-[380px] ${
                  cameraFacing === 'user' ? 'scale-x-[-1]' : ''
                }`}
              />

              {/* Viewfinder Target Box Overlay */}
              {cameraActive && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-56 h-56 sm:w-64 sm:h-64 border-2 border-dashed border-white/60 rounded-2xl shadow-lg relative">
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-purple-400 rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-purple-400 rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-purple-400 rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-purple-400 rounded-br-lg" />
                    <span className="absolute bottom-2 inset-x-0 text-center text-[11px] text-white/80 bg-black/40 backdrop-blur-xs py-0.5 rounded-full mx-6 font-medium">
                      Align item in frame
                    </span>
                  </div>
                </div>
              )}

              {/* Camera Error Message */}
              {cameraError && (
                <div className="absolute inset-0 p-6 bg-slate-900/95 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-white font-bold text-sm">Camera Unavailable</h4>
                  <p className="text-xs text-slate-300 max-w-xs">{cameraError}</p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => startCamera(cameraFacing)}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry Camera</span>
                    </button>
                    <label className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer">
                      <UploadCloud className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Upload Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* In-Camera Quick Controls (Flip & Torch) */}
              {cameraActive && (
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  {torchSupported && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`p-2 rounded-xl backdrop-blur-md transition-colors ${
                        torchOn
                          ? 'bg-amber-400 text-slate-950 shadow-lg'
                          : 'bg-black/50 text-white hover:bg-black/70 border border-white/20'
                      }`}
                      title={torchOn ? 'Turn Flash Off' : 'Turn Flash On'}
                    >
                      <Flashlight className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={flipCamera}
                    className="p-2 rounded-xl bg-black/50 hover:bg-black/70 text-white border border-white/20 backdrop-blur-md transition-colors"
                    title="Switch Front/Back Camera"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800">
          {capturedPreview ? (
            /* Review Photo Actions */
            <div className="flex items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={handleRetake}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retake</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmPhoto}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>Attach Photo to Product</span>
              </button>
            </div>
          ) : (
            /* Shutter / Capture Actions */
            <div className="flex items-center justify-between gap-3">
              {/* File upload alternative */}
              <label className="p-2 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors">
                <UploadCloud className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>

              {/* Big Shutter Button */}
              <button
                type="button"
                disabled={!cameraActive}
                onClick={handleSnapPhoto}
                className="flex-1 max-w-[200px] mx-auto py-2.5 px-4 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-950/80 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer border border-purple-400/40"
              >
                <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-purple-600" />
                </div>
                <span>Snap Photo</span>
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="px-3 py-2 rounded-xl text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
