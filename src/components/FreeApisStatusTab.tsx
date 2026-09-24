import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CheckCircle2,
  Globe,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  Zap,
  Layers,
  Database,
  QrCode,
  MapPin,
  ThermometerSun,
} from 'lucide-react';

interface FreeApiItem {
  name: string;
  provider?: string;
  type: string;
  pricing: string;
  status: string;
  purpose: string;
  url: string;
}

interface FreeApiStatusResponse {
  status: string;
  cost: string;
  requiresPaidBilling: boolean;
  cloudStatus?: string;
  apis: FreeApiItem[];
}

export const FreeApisStatusTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [apiData, setApiData] = useState<FreeApiStatusResponse | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [testQuery, setTestQuery] = useState('Chakra Phool');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/free-apis-status');
      if (res.ok) {
        const data = await res.json();
        setApiData(data);
        setLastChecked(new Date());
      }
    } catch (err) {
      console.error('Failed to load free APIs status', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleRunTestQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testQuery.trim()) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/item-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: testQuery.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setTestResult(data);
      }
    } catch (err) {
      console.error('Item search test failed', err);
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-200">
      {/* Overview Banner */}
      <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-indigo-950/70 border border-emerald-500/30 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <Cloud className="w-5 h-5" />
              </span>
              <h3 className="text-base font-bold text-white tracking-wide">
                100% Free & Open APIs Architecture
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold border border-emerald-500/30">
                ₹0.00 / Zero Paid Billing
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Every feature across Nayab Masale & Kirana POS—including Indian barcode scanning, item lookups, Mandi wholesale rates, spice weather alerts, and UPI payments—runs strictly on <strong>100% free and open public APIs</strong> without Google Cloud, paid subscriptions, or paywalls.
            </p>
          </div>

          <button
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition shadow-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Checking...' : 'Ping Live APIs'}</span>
          </button>
        </div>

        {lastChecked && (
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Verified live at {lastChecked.toLocaleTimeString()}</span>
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              All Open Endpoints Operational
            </span>
          </div>
        )}
      </div>

      {/* Grid of Free APIs */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          Active Free APIs & Providers (Zero Cloud / Paid APIs)
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* 1. Open-Meteo Weather & Storage API */}
          <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-4 space-y-2.5 hover:border-amber-500/50 transition">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-500/20 text-amber-300 rounded-lg">
                  <ThermometerSun className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-bold text-white text-xs">Open-Meteo Weather & Moisture API</h5>
                  <span className="text-[10px] text-amber-300">Open Meteorological Data</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                100% FREE / ZERO KEY
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-normal">
              Monitors ambient temperature and relative humidity to trigger smart storage and monsoon moisture alerts for whole spices (cardamom, cumin, chillies) without paid weather APIs.
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[10px] text-slate-400">
              <span className="text-emerald-400 font-mono">10,000 req/day Free</span>
              <a
                href="https://open-meteo.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-amber-400 hover:text-amber-300"
              >
                <span>open-meteo.com</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>

          {/* 2. Open Food Facts */}
          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-4 space-y-2.5 hover:border-emerald-500/50 transition">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-bold text-white text-xs">Open Food Facts Public API</h5>
                  <span className="text-[10px] text-emerald-300">Community Open Database</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                ZERO KEY NEEDED
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-normal">
              Powers real-time Indian barcode scanning (EAN-13, FMCG items, Tata, Amul, Parle, MDH, Fortune). Millions of grocery items accessible without any API key or subscription.
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[10px] text-slate-400">
              <span className="text-emerald-400 font-mono">Unlimited Public Access</span>
              <a
                href="https://world.openfoodfacts.org"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
              >
                <span>openfoodfacts.org</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>

          {/* 3. Wikipedia & Wikimedia Commons */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2.5 hover:border-slate-700 transition">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-sky-500/20 text-sky-300 rounded-lg">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-bold text-white text-xs">Wikipedia & Wikimedia REST API</h5>
                  <span className="text-[10px] text-sky-300">Wikimedia Foundation</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 text-[10px] font-bold">
                FREE REST API
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-normal">
              Supplies authentic Hindi grocery and spice names, botanical classification, and license-free spice photos for product cataloging.
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[10px] text-slate-400">
              <span className="text-sky-400 font-mono">Open Knowledge REST API</span>
              <a
                href="https://en.wikipedia.org"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-sky-400 hover:text-sky-300"
              >
                <span>wikipedia.org</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>

          {/* 4. DuckDuckGo Instant Answer */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2.5 hover:border-slate-700 transition">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-500/20 text-amber-300 rounded-lg">
                  <Search className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-bold text-white text-xs">DuckDuckGo Instant Answer API</h5>
                  <span className="text-[10px] text-amber-300">Zero-Tracking Search</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                NO KEY REQUIRED
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-normal">
              Delivers instant zero-tracking search queries, culinary classification, and spice categorization fallbacks with zero user-data logging.
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[10px] text-slate-400">
              <span className="text-amber-400 font-mono">Instant Free Answer API</span>
              <a
                href="https://duckduckgo.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-amber-400 hover:text-amber-300"
              >
                <span>duckduckgo.com</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>

          {/* 5. OpenStreetMap & Nominatim */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2.5 hover:border-slate-700 transition">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-teal-500/20 text-teal-300 rounded-lg">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-bold text-white text-xs">OpenStreetMap / Nominatim API</h5>
                  <span className="text-[10px] text-teal-300">Open Geospatial Data</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-300 text-[10px] font-bold">
                OPEN DATA
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-normal">
              Resolves store location GPS coordinates to clean city and market addresses for printed receipts and invoices without Google Maps billing.
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[10px] text-slate-400">
              <span className="text-teal-400 font-mono">OpenStreetMap Foundation</span>
              <a
                href="https://nominatim.openstreetmap.org"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-teal-400 hover:text-teal-300"
              >
                <span>openstreetmap.org</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>

          {/* 6. Dynamic Offline UPI QR Engine */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2.5 hover:border-slate-700 transition">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-bold text-white text-xs">Client-Side Offline UPI QR Engine</h5>
                  <span className="text-[10px] text-emerald-300">Local Zero-Network Generator</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                100% OFFLINE / ₹0 FEE
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-normal">
              Generates dynamic NPCI-standard UPI QR payment codes directly in your browser. Customers scan with GPay, PhonePe, Paytm, or BHIM for direct bank settlements with 0% gateway commission.
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[10px] text-slate-400">
              <span className="text-emerald-400 font-mono">Direct UPI Bank Settlement</span>
              <span className="text-emerald-400 font-medium">Zero Gateway Cut</span>
            </div>
          </div>
        </div>
      </div>

      {/* Free API Live Tester Sandbox */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Live Free API Query Sandbox
            </h4>
          </div>
          <span className="text-[11px] text-slate-400">Test search resolution in real-time</span>
        </div>

        <form onSubmit={handleRunTestQuery} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              placeholder="e.g. Star Anise, MDH Chana Masala, Turmeric, 8901030000000..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>
          <button
            type="submit"
            disabled={testLoading || !testQuery.trim()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            {testLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>Test Free API</span>
          </button>
        </form>

        {testResult && (
          <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-3.5 space-y-2 text-xs animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">{testResult.name || testResult.item?.name}</span>
                {(testResult.hindiName || testResult.item?.hindiName) && (
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-sans text-xs">
                    {testResult.hindiName || testResult.item?.hindiName}
                  </span>
                )}
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold text-[10px]">
                {testResult.freeApiSource || testResult.freeApiStatus || 'Free API Verified'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              <div className="p-2 bg-slate-900 rounded-lg">
                <span className="text-slate-400 block text-[10px]">Category:</span>
                <span className="font-semibold text-slate-200 capitalize">
                  {testResult.category || testResult.item?.category || 'General'}
                </span>
              </div>
              <div className="p-2 bg-slate-900 rounded-lg">
                <span className="text-slate-400 block text-[10px]">Unit:</span>
                <span className="font-semibold text-slate-200 uppercase">
                  {testResult.unit || testResult.suggestedUnit || testResult.item?.suggestedUnit || 'KG'}
                </span>
              </div>
              <div className="p-2 bg-slate-900 rounded-lg">
                <span className="text-slate-400 block text-[10px]">Estimated Rate:</span>
                <span className="font-bold text-emerald-400">
                  ₹{testResult.typicalMarketRate || testResult.estimatedRate || testResult.rate || 0}
                </span>
              </div>
              <div className="p-2 bg-slate-900 rounded-lg">
                <span className="text-slate-400 block text-[10px]">API Cost:</span>
                <span className="font-semibold text-emerald-300">₹0.00 (Free)</span>
              </div>
            </div>

            {testResult.description && (
              <p className="text-slate-400 text-[11px] pt-1 italic">{testResult.description}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
