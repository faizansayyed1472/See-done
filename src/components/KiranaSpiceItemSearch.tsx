import React, { useState, useMemo } from 'react';
import {
  Search,
  Scale,
  Plus,
  Edit2,
  Check,
  X,
  Camera,
  ShoppingBag,
  Sparkles,
  Barcode,
  Package,
  SlidersHorizontal,
  ChevronDown,
  Globe,
  Trash2,
  Save,
} from 'lucide-react';
import { Product, ProductCategory, UnitType, BillItem } from '../types';
import { CATEGORY_LABELS } from '../data/defaultInventory';

interface KiranaSpiceItemSearchProps {
  products: Product[];
  onAddItemToBill: (item: Omit<BillItem, 'id'>) => void;
  onSelectProductForWeight: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onAddProductToInventory?: (product: Product) => void;
  onOpenPosCatalog?: () => void;
  onOpenBarcodeScanner?: () => void;
  onDeleteProduct?: (productId: string) => void;
}

export const KiranaSpiceItemSearch: React.FC<KiranaSpiceItemSearchProps> = ({
  products,
  onAddItemToBill,
  onSelectProductForWeight,
  onUpdateProduct,
  onAddProductToInventory,
  onOpenPosCatalog,
  onOpenBarcodeScanner,
  onDeleteProduct,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState<number>(0);
  const [editStock, setEditStock] = useState<number>(0);
  const [editSuccessId, setEditSuccessId] = useState<string | null>(null);
  const [quickEditMode, setQuickEditMode] = useState<boolean>(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [toastMsg, setToastMsg] = useState<string>('');

  // Quick Add Item to Inventory state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemHindi, setNewItemHindi] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<ProductCategory>('spices');
  const [newItemUnit, setNewItemUnit] = useState<UnitType>('kg');
  const [newItemRate, setNewItemRate] = useState<string>('');
  const [newItemStock, setNewItemStock] = useState<string>('');
  const [addItemError, setAddItemError] = useState('');
  const [headerSaveSuccess, setHeaderSaveSuccess] = useState(false);

  // Filter products based on search query and category
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.hindiName && p.hindiName.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q);

      const matchesCategory =
        selectedCategory === 'all' || p.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  const handleStartEdit = (p: Product) => {
    setEditingProductId(p.id);
    setEditRate(p.rate);
    setEditStock(p.stock !== undefined ? p.stock : 100);
  };

  const handleSaveEdit = (p: Product) => {
    if (editRate <= 0) return;
    const updated: Product = {
      ...p,
      rate: Number(editRate),
      stock: Number(editStock),
    };
    onUpdateProduct(updated);
    setEditingProductId(null);
    setEditSuccessId(p.id);
    setTimeout(() => setEditSuccessId(null), 2500);
  };

  const handleCancelEdit = () => {
    setEditingProductId(null);
  };

  const handleQuickAddSingle = (p: Product) => {
    onAddItemToBill({
      productId: p.id,
      name: p.name,
      hindiName: p.hindiName,
      quantity: 1,
      unit: p.unit,
      rate: p.rate,
      total: p.rate,
    });
  };

  const handleAddNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    setAddItemError('');
    if (!newItemName.trim()) {
      setAddItemError('Item name is required');
      return;
    }
    const parsedRate = parseFloat(newItemRate);
    if (isNaN(parsedRate) || parsedRate <= 0) {
      setAddItemError('Enter a valid selling rate');
      return;
    }
    const parsedStock = newItemStock.trim() !== '' ? parseFloat(newItemStock) : undefined;
    const newProd: Product = {
      id: `prod-${Date.now()}`,
      name: newItemName.trim(),
      hindiName: newItemHindi.trim() || undefined,
      category: newItemCategory,
      unit: newItemUnit,
      rate: parsedRate,
      stock: parsedStock,
      minStockAlert: 5,
      outletId: 'all',
    };
    if (onAddProductToInventory) {
      onAddProductToInventory(newProd);
    } else {
      onUpdateProduct(newProd);
    }
    setSearchTerm('');
    setSelectedCategory('all');
    setToastMsg(`Saved "${newProd.name}" to inventory successfully!`);
    setTimeout(() => setToastMsg(''), 4000);
    setNewItemName('');
    setNewItemHindi('');
    setNewItemRate('');
    setNewItemStock('');
    setShowAddForm(false);
  };

  const handleHeaderSaveInventory = () => {
    if (editingProductId) {
      const p = products.find((x) => x.id === editingProductId);
      if (p) handleSaveEdit(p);
    }
    setHeaderSaveSuccess(true);
    setToastMsg(`Inventory items saved & synced! (${products.length} active items)`);
    setTimeout(() => {
      setHeaderSaveSuccess(false);
      setToastMsg('');
    }, 3500);
  };

  return (
    <div className="bg-slate-900/90 rounded-3xl p-3.5 sm:p-4 border border-purple-500/30 shadow-xl space-y-3">
      {/* Header & Section Title */}
      <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-xs sm:text-sm text-white tracking-tight flex items-center gap-1.5">
              <span>Select Kirana and Spice Inventory Item Search</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 font-mono font-bold border border-purple-500/30">
                {products.length}
              </span>
            </h3>
            <p className="text-[10px] text-slate-400">
              Search Kirana & Spice Inventory • Editable Rates & Stock Qty
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Header Bar Saving Option for Inventory */}
          <button
            type="button"
            onClick={handleHeaderSaveInventory}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all shadow-sm cursor-pointer ${
              headerSaveSuccess
                ? 'bg-emerald-500 text-slate-950 font-extrabold ring-1 ring-emerald-400'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
            title="Save all inventory items and pending edits"
          >
            {headerSaveSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span>{headerSaveSuccess ? 'Saved!' : 'Save Inventory'}</span>
          </button>

          {/* Add Item to Inventory button in header bar */}
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/40 flex items-center gap-1 transition-all cursor-pointer"
            title="Add new product directly to inventory"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{showAddForm ? 'Close' : 'Add Item'}</span>
          </button>

          {/* Quick Edit Mode Toggle */}
          <button
            type="button"
            onClick={() => setQuickEditMode(!quickEditMode)}
            className={`px-2 py-1 rounded-xl text-[11px] font-semibold border flex items-center gap-1 transition-all ${
              quickEditMode
                ? 'bg-purple-600/30 text-purple-200 border-purple-500/50 shadow-sm'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
            }`}
            title="Toggle Quick Edit for Rates & Stock"
          >
            <Edit2 className="w-3 h-3 text-purple-400" />
            <span className="hidden sm:inline">
              {quickEditMode ? 'Close Edit Mode' : 'Edit Rates & Qty'}
            </span>
          </button>

          {onOpenBarcodeScanner && (
            <button
              type="button"
              onClick={onOpenBarcodeScanner}
              className="p-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs transition-colors"
              title="Scan Barcode with Camera"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-400" />
            </button>
          )}

          {onOpenPosCatalog && (
            <button
              type="button"
              onClick={onOpenPosCatalog}
              className="px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-[11px] font-semibold transition-colors"
            >
              All ({products.length})
            </button>
          )}
        </div>
      </div>

      {/* Header Toast message */}
      {toastMsg && (
        <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 text-xs font-semibold flex items-center justify-between animate-in fade-in shadow-md">
          <div className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>{toastMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMsg('')}
            className="p-1 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quick Add Product Inline Drawer */}
      {showAddForm && (
        <form
          onSubmit={handleAddNewItem}
          className="p-3 bg-slate-950/90 rounded-2xl border border-purple-500/50 space-y-2.5 animate-in fade-in shadow-xl"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-purple-400" />
              <span>Add New Item to Inventory</span>
            </span>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {addItemError && (
            <p className="text-[11px] text-red-400 bg-red-950/50 p-1.5 rounded-lg border border-red-500/40">
              {addItemError}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-slate-300 font-semibold block mb-0.5">Item Name (English) *</label>
              <input
                type="text"
                required
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="e.g. Kasuri Methi"
                className="w-full bg-slate-900 border border-slate-700 focus:border-purple-400 rounded-xl px-2.5 py-1.5 text-xs text-white"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-300 font-semibold block mb-0.5">Hindi Name (Optional)</label>
              <input
                type="text"
                value={newItemHindi}
                onChange={(e) => setNewItemHindi(e.target.value)}
                placeholder="e.g. कस्तूरी मेथी"
                className="w-full bg-slate-900 border border-slate-700 focus:border-purple-400 rounded-xl px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-300 font-semibold block mb-0.5">Category</label>
              <select
                value={newItemCategory}
                onChange={(e) => setNewItemCategory(e.target.value as ProductCategory)}
                className="w-full bg-slate-900 border border-slate-700 focus:border-purple-400 rounded-xl px-2.5 py-1.5 text-xs text-white"
              >
                <option value="spices">Spices & Masale</option>
                <option value="dal_pulses">Dals & Pulses</option>
                <option value="grains_flour">Flour & Rice</option>
                <option value="oil_ghee">Oil & Ghee</option>
                <option value="dry_fruits">Dry Fruits</option>
                <option value="packaged_grocery">Packaged Grocery</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
            <div>
              <label className="text-[10px] text-slate-300 font-semibold block mb-0.5">Unit</label>
              <select
                value={newItemUnit}
                onChange={(e) => setNewItemUnit(e.target.value as UnitType)}
                className="w-full bg-slate-900 border border-slate-700 focus:border-purple-400 rounded-xl px-2.5 py-1.5 text-xs text-white"
              >
                <option value="kg">kg (Kilogram)</option>
                <option value="g">g (Grams)</option>
                <option value="litre">litre</option>
                <option value="packet">packet</option>
                <option value="piece">piece</option>
                <option value="quintal">quintal</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-300 font-semibold block mb-0.5">Rate (₹) *</label>
              <input
                type="number"
                step="any"
                min="0.1"
                required
                value={newItemRate}
                onChange={(e) => setNewItemRate(e.target.value)}
                placeholder="₹ Rate"
                className="w-full bg-slate-900 border border-slate-700 focus:border-purple-400 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-300 font-semibold block mb-0.5">Stock Quantity</label>
              <input
                type="number"
                step="any"
                value={newItemStock}
                onChange={(e) => setNewItemStock(e.target.value)}
                placeholder="Stock units"
                className="w-full bg-slate-900 border border-slate-700 focus:border-purple-400 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
              />
            </div>
            <div>
              <button
                type="submit"
                className="w-full py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save to Inventory</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Search Input Box */}
      <div className="relative">
        <Search className="w-4 h-4 text-purple-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search kirana, spices, dals, oils (e.g. Jeera, Haldi, Atta, Kaju)..."
          className="w-full bg-slate-950 border border-slate-700/90 focus:border-purple-500 rounded-2xl pl-9 pr-8 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all shadow-inner"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`px-2.5 py-1 rounded-xl font-semibold whitespace-nowrap transition-all border ${
            selectedCategory === 'all'
              ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
              : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/80'
          }`}
        >
          All Items ({products.length})
        </button>
        {Object.entries(CATEGORY_LABELS).map(([catKey, catConf]) => {
          const count = products.filter((p) => p.category === catKey).length;
          if (count === 0 && selectedCategory !== catKey) return null;
          return (
            <button
              key={catKey}
              type="button"
              onClick={() => setSelectedCategory(catKey)}
              className={`px-2.5 py-1 rounded-xl font-medium whitespace-nowrap transition-all border ${
                selectedCategory === catKey
                  ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/80'
              }`}
            >
              {catConf.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Items Scrollable Grid / List - Enlarged scroll window showing at least 6-8 items */}
      <div className="min-h-[460px] max-h-[540px] sm:max-h-[580px] overflow-y-auto space-y-2 pr-1 select-none scroll-smooth">
        {filteredProducts.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs space-y-2">
            <Package className="w-7 h-7 mx-auto text-slate-600" />
            <p>No inventory items found matching "{searchTerm}"</p>
            {onOpenPosCatalog && (
              <button
                type="button"
                onClick={onOpenPosCatalog}
                className="px-3 py-1 bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white rounded-xl text-xs font-semibold border border-purple-500/40 transition-colors"
              >
                + Add or Search in POS Catalog
              </button>
            )}
          </div>
        ) : (
          filteredProducts.map((p) => {
            const isEditing = editingProductId === p.id || quickEditMode;
            const isSuccess = editSuccessId === p.id;

            return (
              <div
                key={p.id}
                className={`p-2.5 rounded-2xl border transition-all ${
                  isEditing
                    ? 'bg-slate-800 border-purple-500/70 shadow-lg'
                    : isSuccess
                    ? 'bg-emerald-950/40 border-emerald-500/50'
                    : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 hover:border-purple-500/40'
                }`}
              >
                {/* Item Details Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="w-9 h-9 rounded-xl object-cover border border-slate-700 flex-shrink-0 bg-slate-900"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm sm:text-base text-white">
                          {p.name}
                        </span>
                        {p.hindiName && (
                          <span className="text-xs text-amber-300 font-medium">
                            ({p.hindiName})
                          </span>
                        )}
                        {p.popular && (
                          <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30">
                            ★ Fast
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                        <span className="capitalize">{p.category.replace('_', ' ')}</span>
                        {p.outletName && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
                            {p.outletName}
                          </span>
                        )}
                        {p.barcode && (
                          <span className="font-mono text-slate-400 flex items-center gap-0.5">
                            <Barcode className="w-2.5 h-2.5 text-emerald-400" />
                            {p.barcode}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pricing / Stock Status Display */}
                  <div className="text-right flex-shrink-0">
                    <div className="font-mono font-bold text-sm text-emerald-400">
                      ₹{p.rate}
                      <span className="text-[10px] text-slate-400 font-sans font-normal">
                        /{p.unit}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Stock:{' '}
                      <span className="text-slate-200 font-medium">
                        {p.stock !== undefined ? `${p.stock} ${p.unit}` : '100+'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Inline Editing Form (Editable Rates and Quantity) */}
                {isEditing ? (
                  <div className="mt-2 pt-2 border-t border-slate-700/80 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-300 font-semibold block mb-0.5">
                          Rate (₹ per {p.unit}):
                        </label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-emerald-400 font-bold">
                            ₹
                          </span>
                          <input
                            type="number"
                            step="any"
                            min="0.1"
                            value={editingProductId === p.id ? editRate : p.rate}
                            onChange={(e) => {
                              if (editingProductId !== p.id) {
                                setEditingProductId(p.id);
                                setEditStock(p.stock || 100);
                              }
                              setEditRate(parseFloat(e.target.value) || 0);
                            }}
                            className="w-full bg-slate-950 border border-purple-500 rounded-xl pl-6 pr-2 py-1 text-emerald-400 font-mono font-bold text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-300 font-semibold block mb-0.5">
                          Stock Qty ({p.unit}):
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={
                            editingProductId === p.id
                              ? editStock
                              : p.stock !== undefined
                              ? p.stock
                              : 100
                          }
                          onChange={(e) => {
                            if (editingProductId !== p.id) {
                              setEditingProductId(p.id);
                              setEditRate(p.rate);
                            }
                            setEditStock(parseFloat(e.target.value) || 0);
                          }}
                          className="w-full bg-slate-950 border border-purple-500 rounded-xl px-2.5 py-1 text-white font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-1.5 pt-1">
                      {onDeleteProduct && (
                        <button
                          type="button"
                          onClick={() => setProductToDelete(p)}
                          className="px-2 py-1 rounded-lg bg-rose-950/50 hover:bg-rose-900 border border-rose-500/40 text-rose-300 hover:text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Delete item from inventory"
                        >
                          <Trash2 className="w-3 h-3 text-rose-400" />
                          <span>Delete</span>
                        </button>
                      )}
                      <div className="flex items-center gap-1.5 ml-auto">
                        {editingProductId === p.id && !quickEditMode && (
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="px-2 py-1 rounded-lg text-slate-400 hover:text-white text-[11px]"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(p)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm"
                        >
                          <Check className="w-3 h-3" />
                          <span>Save Rate & Qty</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Action Buttons Row */
                  <div className="mt-2 pt-1.5 border-t border-slate-700/60 flex items-center justify-between gap-1.5 text-xs">
                    {/* Quick Edit Rate & Quantity Button & Delete */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(p)}
                        className="px-2 py-1 text-slate-400 hover:text-purple-300 hover:bg-purple-950/40 rounded-lg text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                        title="Edit Selling Rate or Stock Quantity"
                      >
                        <Edit2 className="w-3 h-3 text-purple-400" />
                        <span>Edit</span>
                      </button>

                      {onDeleteProduct && (
                        <button
                          type="button"
                          onClick={() => setProductToDelete(p)}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                          title={`Delete ${p.name} from inventory`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Custom Weight Modal Trigger */}
                      <button
                        type="button"
                        onClick={() => onSelectProductForWeight(p)}
                        className="px-2.5 py-1 bg-slate-700/80 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-[11px] font-semibold border border-slate-600/80 flex items-center gap-1 transition-all cursor-pointer"
                        title="Add with custom weight (grams / kg)"
                      >
                        <Scale className="w-3 h-3 text-amber-400" />
                        <span>Weight</span>
                      </button>

                      {/* 1-Click Fast Add */}
                      <button
                        type="button"
                        onClick={() => handleQuickAddSingle(p)}
                        className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                        title={`Add 1 ${p.unit} to current bill`}
                      >
                        <Plus className="w-3 h-3" />
                        <span>+1 {p.unit}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Toast message if item deleted */}
      {toastMsg && (
        <div className="p-2 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>{toastMsg}</span>
          </div>
          <button type="button" onClick={() => setToastMsg('')} className="p-0.5 hover:text-white">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Delete Item Confirmation Dialog */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-slate-900 border border-rose-500/50 rounded-2xl p-5 shadow-2xl space-y-3.5 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/90 border border-rose-500/50 flex items-center justify-center text-rose-400 flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">Delete Item from Inventory?</h4>
                <p className="text-xs text-slate-400">Remove item from inventory</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1">
              <div className="font-semibold text-white text-sm">{productToDelete.name}</div>
              {productToDelete.hindiName && (
                <div className="text-xs text-amber-300/80">{productToDelete.hindiName}</div>
              )}
              <div className="text-xs text-emerald-400 font-mono">
                ₹{productToDelete.rate} / {productToDelete.unit} • Category: {productToDelete.category}
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure? This item will be removed from your POS catalog, search suggestions, and stock.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteProduct && productToDelete) {
                    const name = productToDelete.name;
                    onDeleteProduct(productToDelete.id);
                    setToastMsg(`"${name}" removed from inventory`);
                    setTimeout(() => setToastMsg(''), 3000);
                  }
                  setProductToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-rose-950/60 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
