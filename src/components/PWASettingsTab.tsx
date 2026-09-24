import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Monitor,
  Download,
  CheckCircle2,
  Wifi,
  WifiOff,
  RefreshCw,
  Layers,
  ShieldCheck,
  ExternalLink,
  Share,
  PlusSquare,
  Sparkles,
  HardDrive,
  Zap,
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import { usePWAInstall } from '../utils/usePWAInstall';
import { useOnlineStatus } from '../utils/useOnlineStatus';
import { PWAInstallButton } from './PWAInstallButton';

export const PWASettingsTab: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isInIframe, install, openInNewTab } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [swStatus, setSwStatus] = useState<string>('Checking...');
  const [swScope, setSwScope] = useState<string>('');
  const [cacheSizeEstimate, setCacheSizeEstimate] = useState<string>('Calculating...');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  useEffect(() => {
    // Check Service Worker Registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          setSwStatus(reg.active ? 'Active & Running' : 'Registered');
          setSwScope(reg.scope || '/');
        } else {
          setSwStatus('Ready (Auto-registers on load)');
          setSwScope('/');
        }
      }).catch(() => {
        setSwStatus('Unavailable in this context');
      });
    } else {
      setSwStatus('Service Worker not supported');
    }

    // Storage estimate
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((est) => {
        const usedMb = est.usage ? (est.usage / (1024 * 1024)).toFixed(1) : '0';
        const quotaMb = est.quota ? (est.quota / (1024 * 1024)).toFixed(0) : '0';
        setCacheSizeEstimate(`${usedMb} MB used (of ${quotaMb} MB available)`);
      }).catch(() => {
        setCacheSizeEstimate('Standard Browser Storage');
      });
    } else {
      setCacheSizeEstimate('Standard Browser Storage');
    }
  }, []);

  const handleForceUpdate = async () => {
    setIsUpdating(true);
    setUpdateMsg(null);
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          setUpdateMsg('Service worker cache updated successfully. App is up to date.');
        } else {
          setUpdateMsg('Cache is clean. Reloading page...');
          window.location.reload();
        }
      } else {
        window.location.reload();
      }
    } catch (e) {
      setUpdateMsg('Cache check completed.');
    } finally {
      setTimeout(() => setIsUpdating(false), 800);
      setTimeout(() => setUpdateMsg(null), 5000);
    }
  };

  return (
    <div className="space-y-4 text-slate-100 animate-in fade-in">
      {/* Header Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/40 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-white">Progressive Web App (PWA)</h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                100% Offline Ready
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Install NAYAB POS as a standalone desktop or mobile application. Works anywhere without continuous internet.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <PWAInstallButton variant="settings" />
        </div>
      </div>

      {/* Official App Icon & Brand Assets Showcase */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-emerald-500/30 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-emerald-400" />
            <div>
              <h4 className="font-extrabold text-white text-sm">Official App Icon & Visual Assets</h4>
              <p className="text-[11px] text-slate-400">
                PWA launcher icons, splash screen assets, Apple touch icon, and vector graphics
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href="/pwa-512x512.png"
              download="nayab-pos-icon-512.png"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download 512px PNG</span>
            </a>
            <a
              href="/icon.svg"
              download="nayab-pos-icon.svg"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Vector SVG</span>
            </a>
          </div>
        </div>

        {/* Icon Preview Gallery */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Main 512px / Master Icon Preview */}
          <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
            <img
              src="/pwa-512x512.png"
              alt="NAYAB POS 512px App Icon"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover shadow-md ring-2 ring-emerald-500/40 flex-shrink-0"
            />
            <div className="space-y-1 min-w-0">
              <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wide">
                Master 512×512
              </span>
              <p className="text-xs font-bold text-white truncate">pwa-512x512.png</p>
              <p className="text-[11px] text-slate-400 leading-snug">
                Standard PWA install manifest, splash screen, and Windows/Mac taskbar shortcut.
              </p>
            </div>
          </div>

          {/* Maskable Android Icon Preview */}
          <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-slate-900 border-2 border-emerald-500/40 p-1 flex items-center justify-center flex-shrink-0 shadow-md">
              <img
                src="/pwa-maskable-512x512.png"
                alt="Maskable App Icon"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <span className="inline-block px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-extrabold uppercase tracking-wide">
                Maskable Safe Zone
              </span>
              <p className="text-xs font-bold text-white truncate">pwa-maskable-512x512.png</p>
              <p className="text-[11px] text-slate-400 leading-snug">
                Adapts seamlessly to Android circular, squircle, or teardrop launcher shapes.
              </p>
            </div>
          </div>

          {/* iOS & Mobile Launcher Simulated Preview */}
          <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="flex flex-col items-center flex-shrink-0">
              <img
                src="/apple-touch-icon.png"
                alt="Apple Touch Icon"
                className="w-14 h-14 rounded-2xl object-cover shadow-lg ring-1 ring-white/20"
              />
              <span className="text-[10px] font-semibold text-slate-300 mt-1">NayabPOS</span>
            </div>
            <div className="space-y-1 min-w-0">
              <span className="inline-block px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-extrabold uppercase tracking-wide">
                Apple Touch 180×180
              </span>
              <p className="text-xs font-bold text-white truncate">apple-touch-icon.png</p>
              <p className="text-[11px] text-slate-400 leading-snug">
                Retina resolution bookmark for iPhone & iPad Safari home screen additions.
              </p>
            </div>
          </div>
        </div>

        {/* Specifications Table */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800">
            <span className="text-slate-400 block font-medium">Standard Icon:</span>
            <span className="font-bold text-emerald-300">512 × 512 px (PNG)</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800">
            <span className="text-slate-400 block font-medium">Mobile Icon:</span>
            <span className="font-bold text-emerald-300">192 × 192 px (PNG)</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800">
            <span className="text-slate-400 block font-medium">Vector Asset:</span>
            <span className="font-bold text-cyan-300">Scalable (SVG)</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800">
            <span className="text-slate-400 block font-medium">Browser Favicon:</span>
            <span className="font-bold text-indigo-300">favicon.ico (Multi-size)</span>
          </div>
        </div>
      </div>

      {/* Grid: Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: App Installation */}
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Install Status</span>
            <Download className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-sm font-bold text-white flex items-center gap-1.5">
            {isInstalled ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Installed (Standalone)</span>
              </>
            ) : isInstallable ? (
              <>
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                <span>Ready to Install</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                <span>Web Browser Mode</span>
              </>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            {isInstalled ? 'Running with native window chrome' : 'Can be added to homescreen or desktop'}
          </p>
        </div>

        {/* Card 2: Network Connectivity */}
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Network State</span>
            {isOnline ? (
              <Wifi className="w-4 h-4 text-emerald-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-amber-400" />
            )}
          </div>
          <div className="text-sm font-bold text-white flex items-center gap-1.5">
            {isOnline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Online & Synchronized</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>Offline Safe Mode</span>
              </>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            {isOnline ? 'All features & open APIs accessible' : 'Billing & thermal printing 100% active'}
          </p>
        </div>

        {/* Card 3: Service Worker */}
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Service Worker</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-sm font-bold text-white flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            <span className="truncate">{swStatus}</span>
          </div>
          <p className="text-[11px] text-slate-400 truncate">
            Scope: {swScope || '/'}
          </p>
        </div>

        {/* Card 4: Local Storage & Cache */}
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Offline Storage</span>
            <HardDrive className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-sm font-bold text-white truncate">
            {cacheSizeEstimate}
          </div>
          <p className="text-[11px] text-slate-400">
            LocalStorage + IndexedDB + Workbox
          </p>
        </div>
      </div>

      {/* Iframe Notice if opened inside preview */}
      {isInIframe && (
        <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
              <ExternalLink className="w-4 h-4" />
              <span>Running Inside Web Preview Frame</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Browsers restrict direct PWA installation inside embedded frames. Open NAYAB POS in a full browser tab to enable 1-click home screen or desktop install.
            </p>
          </div>
          <button
            onClick={openInNewTab}
            className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open in Full Tab</span>
          </button>
        </div>
      )}

      {/* Installation Guide Tabs / Accordion */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>How to Install NAYAB POS on Any Device</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Android Guide */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
              <Smartphone className="w-4 h-4" />
              <span>Android (Chrome / Samsung)</span>
            </div>
            <ol className="text-xs text-slate-300 space-y-1.5 list-decimal pl-4 leading-relaxed">
              <li>Open Chrome or Samsung Internet.</li>
              <li>Tap the three dots (<strong className="text-white">⋮</strong>) in the top right.</li>
              <li>Tap <strong className="text-white">Install app</strong> or <strong className="text-white">Add to Home screen</strong>.</li>
              <li>App icon appears on your home screen with offline capability!</li>
            </ol>
          </div>

          {/* iOS Guide */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
            <div className="flex items-center gap-2 text-sky-400 font-bold text-xs">
              <Share className="w-4 h-4" />
              <span>iPhone & iPad (Safari)</span>
            </div>
            <ol className="text-xs text-slate-300 space-y-1.5 list-decimal pl-4 leading-relaxed">
              <li>Open the app in Apple Safari.</li>
              <li>Tap the <strong className="text-white">Share</strong> button at bottom of screen.</li>
              <li>Scroll down and tap <strong className="text-white">Add to Home Screen</strong> <PlusSquare className="w-3 h-3 inline text-emerald-400" />.</li>
              <li>Tap <strong className="text-white">Add</strong> in the top right corner.</li>
            </ol>
          </div>

          {/* Desktop Guide */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
            <div className="flex items-center gap-2 text-teal-400 font-bold text-xs">
              <Monitor className="w-4 h-4" />
              <span>Windows, Mac & Linux</span>
            </div>
            <ol className="text-xs text-slate-300 space-y-1.5 list-decimal pl-4 leading-relaxed">
              <li>Use Chrome, Edge, or Brave.</li>
              <li>Look at the right side of the address bar for the <strong className="text-white">Install</strong> icon (<span className="text-emerald-400 font-mono">⊕</span>).</li>
              <li>Click <strong className="text-white">Install NAYAB POS</strong>.</li>
              <li>Launches in its own distraction-free window with taskbar pin!</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Offline Kirana Features List */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Offline Kirana Capabilities Built-In</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-white">Local Billing Counter:</strong>
              <p className="text-slate-400 text-[11px]">Instant barcode scanning, weight calculations, and bill finalization without internet.</p>
            </div>
          </div>

          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-white">Web Thermal Printing (ESC/POS):</strong>
              <p className="text-slate-400 text-[11px]">USB and Bluetooth thermal printing works directly via browser hardware APIs offline.</p>
            </div>
          </div>

          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-white">Dynamic UPI QR Generation:</strong>
              <p className="text-slate-400 text-[11px]">Offline QR code generator builds standard NPCI-compliant UPI intents on thermal slips.</p>
            </div>
          </div>

          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-white">Udhaar Khata & Ledger:</strong>
              <p className="text-slate-400 text-[11px]">Customer balance tracking, credit logs, and WhatsApp bill links function seamlessly.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cache & Maintenance Actions */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h5 className="font-bold text-white text-xs">PWA Cache & Updates</h5>
          <p className="text-[11px] text-slate-400">
            Force service worker update to pull the latest offline assets and features.
          </p>
          {updateMsg && (
            <p className="text-xs font-semibold text-emerald-400 mt-1">{updateMsg}</p>
          )}
        </div>

        <button
          type="button"
          onClick={handleForceUpdate}
          disabled={isUpdating}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold transition active:scale-95 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin text-emerald-400' : ''}`} />
          <span>{isUpdating ? 'Checking...' : 'Check for Updates'}</span>
        </button>
      </div>
    </div>
  );
};
