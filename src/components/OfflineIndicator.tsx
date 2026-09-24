import React, { useState } from 'react';
import { WifiOff, X } from 'lucide-react';
import { useOnlineStatus } from '../utils/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);

  if (isOnline || dismissed) return null;

  return (
    <div
      id="pwa-offline-banner"
      className="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-50 flex items-center justify-between gap-3 rounded-2xl bg-amber-600/95 backdrop-blur-md px-4 py-2.5 text-white shadow-2xl border border-amber-400/40 animate-in slide-in-from-bottom-3"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-amber-950/40 border border-amber-300/40 flex items-center justify-center flex-shrink-0 text-amber-200">
          <WifiOff className="w-4 h-4 animate-pulse" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black tracking-wide flex items-center gap-1.5">
            <span>Offline Mode Active</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-900/60 rounded border border-amber-300/30">PWA</span>
          </p>
          <p className="text-[11px] text-amber-100 truncate">
            All billing, calculator, local inventory & cash records work 100% offline.
          </p>
        </div>
      </div>

      <button
        onClick={() => setDismissed(true)}
        className="p-1 rounded-lg text-amber-200 hover:text-white hover:bg-amber-700/50 cursor-pointer flex-shrink-0"
        title="Dismiss notice"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
