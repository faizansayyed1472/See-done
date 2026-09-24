import React, { useState } from 'react';
import { Download, Share, PlusSquare, Check, X, Smartphone, Monitor, ExternalLink, ShieldCheck } from 'lucide-react';
import { usePWAInstall } from '../utils/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'modal' | 'pill' | 'settings';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, isIOS, isInIframe, install, openInNewTab } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showDesktopGuide, setShowDesktopGuide] = useState(false);
  const [installedNotice, setInstalledNotice] = useState(false);

  // If already installed as standalone PWA
  if (isInstalled) {
    if (variant === 'settings' || variant === 'modal') {
      return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-semibold ${className}`}>
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>Installed as Native PWA</span>
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (success) {
        setInstalledNotice(true);
        setTimeout(() => setInstalledNotice(false), 4000);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      setShowDesktopGuide(true);
    }
  };

  return (
    <>
      <button
        id="pwa-install-btn"
        onClick={handleInstallClick}
        className={`flex items-center gap-1.5 font-bold transition-all cursor-pointer select-none active:scale-95 shadow-sm ${
          variant === 'header'
            ? 'px-2.5 py-1 text-xs rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-400/40 shadow-emerald-950/40'
            : variant === 'settings'
            ? 'px-4 py-2 text-xs rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-400/30'
            : 'px-3 py-1.5 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/30'
        } ${className}`}
        title="Install NAYAB POS as Offline App on this device"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden xs:inline">Install PWA</span>
        <span className="xs:hidden">Install</span>
      </button>

      {/* Installed notification toast */}
      {installedNotice && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 text-white shadow-2xl border border-emerald-400 animate-in slide-in-from-top-3">
          <Check className="w-4 h-4 text-emerald-100" />
          <span className="text-xs font-bold">NAYAB POS installed successfully!</span>
        </div>
      )}

      {/* iOS Installation Instructions Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border-2 border-emerald-500/40 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Install on iPhone / iPad</h3>
                  <p className="text-[11px] text-slate-400">NAYAB Smart Kirana PWA</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-2.5 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold flex-shrink-0">
                  1
                </div>
                <p>
                  Tap the <strong className="text-white">Share</strong> button{' '}
                  <span className="inline-block px-1 py-0.5 bg-slate-700 rounded text-slate-200 text-[10px]">
                    <Share className="w-3 h-3 inline pb-0.5" /> Share
                  </span>{' '}
                  in the Safari toolbar at the bottom of your screen.
                </p>
              </div>

              <div className="flex items-start gap-2.5 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold flex-shrink-0">
                  2
                </div>
                <p>
                  Scroll down the share sheet menu and tap{' '}
                  <strong className="text-white">Add to Home Screen</strong>{' '}
                  <PlusSquare className="w-3 h-3 inline text-emerald-400" />.
                </p>
              </div>

              <div className="flex items-start gap-2.5 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold flex-shrink-0">
                  3
                </div>
                <p>
                  Tap <strong className="text-emerald-400">Add</strong> in the top-right corner. The app will launch like a native app and run 100% offline!
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Desktop / Android / Iframe Installation Modal */}
      {showDesktopGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border-2 border-emerald-500/40 p-5 shadow-2xl space-y-4 text-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Install NAYAB POS (PWA)</h3>
                  <p className="text-[11px] text-slate-400">Chrome • Edge • Android • Windows • Mac</p>
                </div>
              </div>
              <button
                onClick={() => setShowDesktopGuide(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {isInIframe && (
                <div className="p-3 rounded-2xl bg-indigo-950/50 border border-indigo-500/30 space-y-2">
                  <p className="text-indigo-200 leading-relaxed">
                    Browser security requires PWAs to be installed from a top-level tab. Open the app in its own window to install with 1-click:
                  </p>
                  <button
                    onClick={openInNewTab}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow active:scale-95"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open in New Tab to Install</span>
                  </button>
                </div>
              )}

              <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60 space-y-2">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <Monitor className="w-4 h-4 text-emerald-400" />
                  <span>On Desktop (Chrome, Edge, Brave):</span>
                </div>
                <p className="text-slate-300 pl-5 leading-normal">
                  Look at the right side of your browser address bar and click the <strong>Install</strong> icon (<span className="text-emerald-400 font-mono">⊕</span> or computer icon), then click <strong>Install</strong>.
                </p>
              </div>

              <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60 space-y-2">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span>On Android (Chrome / Samsung Internet):</span>
                </div>
                <p className="text-slate-300 pl-5 leading-normal">
                  Tap the three dots (<strong>⋮</strong>) in the top-right corner of Chrome, then tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                </p>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-[11px]">
                <ShieldCheck className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                <span>100% Offline Ready: Works even without an internet connection once installed.</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowDesktopGuide(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
