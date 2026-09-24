import React, { useState } from 'react';
import {
  Search,
  Globe,
  Sparkles,
  Plus,
  Receipt,
  ExternalLink,
  Check,
  Package,
  ArrowRight,
  RefreshCw,
  TrendingUp,
  Tag,
  Edit3,
} from 'lucide-react';
import { Product, ProductCategory, UnitType, BillItem } from '../types';
import { CATEGORY_LABELS } from '../data/defaultInventory';

interface WebProductSearchProps {
  existingProducts: Product[];
  onAddProductToInventory: (product: Product) => void;
  onSelectProductForBill: (product: Product, quantity?: number) => void;
}

const POPULAR_WEB_QUERIES = [
  'Chakra Phool (Star Anise)',
  'Makhana (Fox Nuts)',
  'Kalonji (Nigella)',
  'Gond Katira',
  'Javitri (Mace)',
  'Kashmiri Kesar (Saffron)',
  'White Pepper',
  'Poha (Beaten Rice)',
];

export const WebProductSearch: React.FC<WebProductSearchProps> = ({
  existingProducts,
  onAddProductToInventory,
  onSelectProductForBill,
}) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<any | null>(null);
  const [addedToInventorySuccess, setAddedToInventorySuccess] = useState(false);

  // Editable fields for found product
  const [editedName, setEditedName] = useState('');
  const [editedRate, setEditedRate] = useState<number | string>(100);
  const [editedUnit, setEditedUnit] = useState('kg');
  const [editedQty, setEditedQty] = useState<number | string>(1);

  // Check if query matches an item already in inventory
  const localMatch = query.trim()
    ? existingProducts.find(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          (p.hindiName && p.hindiName.includes(query))
      )
    : null;

  const getCleanRate = (): number => {
    const parsed = parseFloat(String(editedRate));
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  };

  const getCleanQty = (): number => {
    const parsed = parseFloat(String(editedQty));
    return isNaN(parsed) || parsed <= 0 ? 1 : parsed;
  };

  const handleSearch = async (searchTerm?: string) => {
    const q = (searchTerm !== undefined ? searchTerm : query).trim();
    if (!q) return;

    if (searchTerm !== undefined) {
      setQuery(searchTerm);
    }

    setIsSearching(true);
    setErrorMsg(null);
    setSearchResult(null);
    setAddedToInventorySuccess(false);

    try {
      const res = await fetch('/api/item-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });

      if (!res.ok) {
        throw new Error('Failed to fetch market data.');
      }

      const data = await res.json();
      setSearchResult(data);
      if (data?.item) {
        setEditedName(data.item.name || '');
        setEditedRate(data.item.typicalMarketRate || 100);
        setEditedUnit(data.item.suggestedUnit || 'kg');
        setEditedQty(1);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not fetch web pricing. Try another product name.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddToInventory = () => {
    if (!searchResult?.item) return;
    const item = searchResult.item;
    const finalRate = getCleanRate();

    const newProduct: Product = {
      id: `prod-web-${Date.now()}`,
      name: editedName.trim() || item.name,
      hindiName: item.hindiName || '',
      category: (item.category as ProductCategory) || 'spices',
      unit: (editedUnit as UnitType) || 'kg',
      rate: finalRate,
      imageUrl: item.imageUrl || searchResult?.imageUrl || undefined,
      popular: true,
    };

    onAddProductToInventory(newProduct);
    setAddedToInventorySuccess(true);
    setTimeout(() => setAddedToInventorySuccess(false), 3500);
  };

  const handleAddToBill = () => {
    if (!searchResult?.item) return;
    const item = searchResult.item;
    const finalRate = getCleanRate();
    const finalName = editedName.trim() || item.name;
    const finalUnit = (editedUnit as UnitType) || 'kg';
    const finalQty = getCleanQty();

    // First ensure it's in inventory if not already
    let targetProduct = existingProducts.find(
      (p) => p.name.toLowerCase() === finalName.toLowerCase()
    );

    if (!targetProduct) {
      targetProduct = {
        id: `prod-web-${Date.now()}`,
        name: finalName,
        hindiName: item.hindiName || '',
        category: (item.category as ProductCategory) || 'spices',
        unit: finalUnit,
        rate: finalRate,
        imageUrl: item.imageUrl || searchResult?.imageUrl || undefined,
        popular: true,
      };
      onAddProductToInventory(targetProduct);
    } else {
      // Update with new rate and unit if needed
      targetProduct = {
        ...targetProduct,
        rate: finalRate,
        unit: finalUnit,
      };
    }

    onSelectProductForBill(targetProduct, finalQty);
  };

  return (
    <div className="bg-slate-900/80 rounded-3xl p-4 border border-cyan-500/30 shadow-lg space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>Search from Free Web APIs</span>
            </h4>
          </div>
        </div>
        <span className="text-[10px] text-emerald-300 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/40 font-semibold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          100% Free Open APIs
        </span>
      </div>

      {/* Search Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
        className="flex items-center gap-2"
      >
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search spice, grocery, or barcode via free Open Food Facts & Wikipedia APIs..."
            className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl pl-9 pr-3 py-2 text-white text-xs placeholder:text-slate-500 font-medium transition-all shadow-inner"
          />
        </div>
        <button
          type="submit"
          disabled={isSearching || !query.trim()}
          className="px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-cyan-950 transition-all flex-shrink-0"
        >
          {isSearching ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span className="hidden sm:inline">Searching...</span>
            </>
          ) : (
            <>
              <Globe className="w-3.5 h-3.5" />
              <span>Search Web</span>
            </>
          )}
        </button>
      </form>

      {/* Quick Suggestion Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
        <span className="text-[10px] text-slate-500 uppercase font-semibold flex-shrink-0">Trending:</span>
        {POPULAR_WEB_QUERIES.map((qText) => (
          <button
            key={qText}
            type="button"
            onClick={() => handleSearch(qText)}
            className="whitespace-nowrap px-2 py-0.5 rounded-lg bg-slate-800/90 hover:bg-cyan-950 hover:text-cyan-300 border border-slate-700/80 hover:border-cyan-500/50 text-slate-300 text-[10px] transition-colors"
          >
            {qText}
          </button>
        ))}
      </div>

      {/* Local Store Inventory Quick Match Alert */}
      {localMatch && !isSearching && (
        <div className="flex items-center justify-between p-2 rounded-xl bg-indigo-950/40 border border-indigo-700/60 text-xs">
          <div className="flex items-center gap-2 truncate">
            <Package className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            <span className="text-slate-300 truncate">
              Already in store:{' '}
              <strong className="text-white">{localMatch.name}</strong>
              {localMatch.hindiName ? ` (${localMatch.hindiName})` : ''} - ₹{localMatch.rate}/{localMatch.unit}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSelectProductForBill(localMatch)}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[10px] flex-shrink-0 transition-colors ml-2"
          >
            Bill Item
          </button>
        </div>
      )}

      {/* Loading State */}
      {isSearching && (
        <div className="py-4 text-center space-y-2">
          <div className="inline-flex items-center justify-center p-2 rounded-xl bg-cyan-500/10 text-cyan-400 animate-pulse">
            <Globe className="w-5 h-5 animate-spin text-cyan-400 mr-2" />
            <span className="text-xs font-semibold">Consulting live Indian APMC Mandi & retail web rates...</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs">
          {errorMsg}
        </div>
      )}

      {/* Web Search Result Card */}
      {searchResult?.item && !isSearching && (
        <div className="p-3 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-cyan-500/50 rounded-2xl space-y-2.5 shadow-xl animate-in fade-in duration-200">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-start gap-3">
              {(searchResult.item.imageUrl || searchResult.imageUrl) && (
                <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-700 bg-slate-800 flex-shrink-0 relative shadow">
                  <img
                    src={searchResult.item.imageUrl || searchResult.imageUrl}
                    alt={searchResult.item.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h5 className="font-bold text-sm sm:text-base text-white">{searchResult.item.name}</h5>
                  {searchResult.item.hindiName && (
                    <span className="text-xs font-semibold text-amber-300 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                      {searchResult.item.hindiName}
                    </span>
                  )}
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/30 capitalize">
                    {searchResult.item.category.replace('_', ' ')}
                  </span>
                  {searchResult.freeApiSource && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 font-medium">
                      {searchResult.freeApiSource}
                    </span>
                  )}
                </div>
                {searchResult.item.description && (
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    {searchResult.item.description}
                  </p>
                )}
              </div>
            </div>

            {/* Price Badge */}
            <div className="text-right flex-shrink-0 bg-emerald-950/70 border border-emerald-500/40 px-2.5 py-1.5 rounded-xl">
              <span className="text-[10px] text-emerald-400 block font-semibold">Web Market Rate</span>
              <span className="text-base font-black text-emerald-300 font-mono">
                ₹{searchResult.item.typicalMarketRate}
              </span>
              <span className="text-[10px] text-emerald-400/80">/{searchResult.item.suggestedUnit || 'kg'}</span>
            </div>
          </div>

          {/* Search Insights & Sources */}
          {searchResult.searchSummary && (
            <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-xl border border-slate-800 flex items-start gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span>{searchResult.searchSummary}</span>
                {searchResult.sources && searchResult.sources.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-[10px] text-cyan-400">
                    <span className="text-slate-500">Sources:</span>
                    {searchResult.sources.slice(0, 2).map((src: any, i: number) => (
                      <span key={i} className="inline-flex items-center gap-0.5 truncate max-w-[140px] text-slate-400">
                        • {src.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Editable Rate & Details Form */}
          <div className="p-3 bg-slate-950/90 rounded-xl border border-indigo-500/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-cyan-300 flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Customize Selling Rate, Unit & Quantity:</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Total: <strong className="text-emerald-400 text-xs">₹{(getCleanRate() * getCleanQty()).toFixed(2)}</strong>
              </span>
            </div>

            {/* Product Name */}
            <div>
              <label className="text-[10px] text-slate-300 font-semibold block mb-1">
                Product Name
              </label>
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="w-full bg-slate-900 border border-indigo-500/40 focus:border-cyan-400 rounded-xl px-3 py-1.5 text-xs font-bold text-white outline-none"
                placeholder="Product Name"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center">
              {/* Selling Rate (₹) */}
              <div className="relative sm:col-span-1">
                <label className="text-[10px] text-slate-300 font-semibold block mb-1">
                  Selling Rate (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-400 font-bold font-mono text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={editedRate}
                    onChange={(e) => setEditedRate(e.target.value)}
                    className="w-full bg-slate-900 border-2 border-emerald-500/70 focus:border-emerald-400 rounded-xl pl-6 pr-2 py-1.5 text-white font-mono font-bold text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Unit selector: kg, g, litre, packet, piece, quintal */}
              <div className="sm:col-span-1">
                <label className="text-[10px] text-slate-300 font-semibold block mb-1">
                  Unit
                </label>
                <select
                  value={editedUnit}
                  onChange={(e) => setEditedUnit(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-400 rounded-xl px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="kg">kg (Kilogram)</option>
                  <option value="g">g (Grams)</option>
                  <option value="litre">litre (Litre)</option>
                  <option value="packet">packet (Packet / Pouch)</option>
                  <option value="piece">piece (Piece / Item)</option>
                  <option value="quintal">quintal (Quintal / 100 kg)</option>
                </select>
              </div>

              {/* Quantity (customizable, no +- buttons) */}
              <div className="sm:col-span-1">
                <label className="text-[10px] text-slate-300 font-semibold block mb-1">
                  Quantity (Customizable)
                </label>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  value={editedQty}
                  onChange={(e) => setEditedQty(e.target.value)}
                  placeholder="e.g. 1, 0.5, 2.5, 25"
                  className="w-full bg-slate-900 border-2 border-indigo-500/60 focus:border-cyan-400 rounded-xl px-3 py-1.5 text-white font-bold text-xs font-mono focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
            <button
              type="button"
              onClick={handleAddToInventory}
              disabled={addedToInventorySuccess}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                addedToInventorySuccess
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-800 hover:bg-slate-750 text-cyan-300 border border-cyan-500/30'
              }`}
            >
              {addedToInventorySuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Added to Inventory!</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 text-cyan-400" />
                  <span>+ Add to Inventory</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleAddToBill}
              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Bill Item Now →</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
