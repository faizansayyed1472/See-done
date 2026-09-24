import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Sparkles,
  Plus,
  ShoppingBag,
  X,
  ExternalLink,
  Check,
  Package,
  PlusCircle,
  Scale,
  Camera,
  Barcode,
  Edit2,
  Edit3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Database,
  Loader2,
  Image as ImageIcon,
  UploadCloud,
  Trash2,
  AlertTriangle,
  Building2,
  Store,
  Save,
} from 'lucide-react';
import { Product, ProductCategory, UnitType, BillItem, StoreProfile } from '../types';
import { CATEGORY_LABELS } from '../data/defaultInventory';
import { CustomWeightModal } from './CustomWeightModal';
import { PosBarcodeScannerModal } from './PosBarcodeScannerModal';
import { PosProductCameraModal } from './PosProductCameraModal';
import { generateHighVolumeCatalogue, CATALOGUE_MAX_CAPACITY } from '../utils/idbStorage';
import { getProductOutletInfo, isProductInOutlet, getOutletItemCount } from '../utils/productOutlet';

interface PosCatalogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  lowStockThreshold?: number;
  currentStores?: StoreProfile[];
  activeStoreId?: string;
  onOpenSettings?: (tab?: 'upi' | 'inventory' | 'staff' | 'printer' | 'profile' | 'backup' | 'reports' | 'stores' | 'free_apis' | 'pwa') => void;
  onAddProductToInventory: (product: Product) => void;
  onBulkAddProducts?: (products: Product[]) => void;
  onAddItemToBill: (item: Omit<BillItem, 'id'>) => void;
  onUpdateProduct?: (product: Product) => void;
  onDeleteProduct?: (productId: string) => void;
}

export const PosCatalogDrawer: React.FC<PosCatalogDrawerProps> = ({
  isOpen,
  onClose,
  products,
  lowStockThreshold = 10,
  currentStores = [],
  activeStoreId = 'store-1',
  onOpenSettings,
  onAddProductToInventory,
  onBulkAddProducts,
  onAddItemToBill,
  onUpdateProduct,
  onDeleteProduct,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>('all');
  const [newProductOutlet, setNewProductOutlet] = useState<string>('all');
  const [editingProductOutlet, setEditingProductOutlet] = useState<string>('all');
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleteToast, setDeleteToast] = useState<string>('');
  
  // Custom Weight Modal state for selected product
  const [weightModalProduct, setWeightModalProduct] = useState<Product | null>(null);

  // Device Camera Photo Capture state
  const [cameraModalTarget, setCameraModalTarget] = useState<{
    isOpen: boolean;
    mode: 'new' | 'existing';
    product?: Product;
  } | null>(null);

  // Web Item Search state
  const [isWebSearching, setIsWebSearching] = useState(false);
  const [webSearchResult, setWebSearchResult] = useState<any | null>(null);
  const [webSearchError, setWebSearchError] = useState<string | null>(null);

  // Editable Rates & Quantity form states for web search result
  const [webEditedName, setWebEditedName] = useState('');
  const [webEditedRate, setWebEditedRate] = useState<number | string>(0);
  const [webEditedUnit, setWebEditedUnit] = useState<string>('g');
  const [webEditedQty, setWebEditedQty] = useState<number | string>(1);

  // Pagination for high-capacity catalogue (supports up to 1,500,000 items in IndexedDB)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  // Bulk Scale Generator modal state (tests up to 1,500,000 items)
  const [showBulkScaleModal, setShowBulkScaleModal] = useState(false);
  const [bulkCountToGenerate, setBulkCountToGenerate] = useState(1000);
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState('');

  // Editable Rates & Quantity states
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [tempRate, setTempRate] = useState<number>(0);
  const [tempStock, setTempStock] = useState<number>(0);
  const [quickEditMode, setQuickEditMode] = useState<boolean>(false);
  const [saveSuccessId, setSaveSuccessId] = useState<string | null>(null);
  const [headerSaveSuccess, setHeaderSaveSuccess] = useState<boolean>(false);

  const handleSaveInventoryHeader = () => {
    if (editingProductId) {
      const p = products.find((x) => x.id === editingProductId);
      if (p && tempRate > 0) {
        if (onUpdateProduct) {
          onUpdateProduct({
            ...p,
            rate: Number(tempRate),
            stock: Number(tempStock),
          });
        }
        setEditingProductId(null);
      }
    }
    setHeaderSaveSuccess(true);
    setTimeout(() => setHeaderSaveSuccess(false), 3000);
  };

  // Custom Item creation states (no pre-added forced quantities)
  const [showAddCustomModal, setShowAddCustomModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductHindi, setNewProductHindi] = useState('');
  const [newProductCategory, setNewProductCategory] = useState<ProductCategory>('spices');
  const [newProductUnit, setNewProductUnit] = useState<UnitType>('g');
  const [newProductRate, setNewProductRate] = useState<string>('');
  const [newProductStockWeight, setNewProductStockWeight] = useState<string>('');
  const [newProductBarcode, setNewProductBarcode] = useState<string>('');
  const [newProductImage, setNewProductImage] = useState<string>('');

  // Handle image upload and compression for custom product
  const handleCustomImageUpload = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 200;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setNewProductImage(compressedDataUrl);
        } else {
          setNewProductImage(e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Barcode Scanner Modal State
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);

  // Prevent background scroll and add Escape key listener when catalogue is open
  useEffect(() => {
    if (!isOpen) return;
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (
          showAddCustomModal ||
          showBulkScaleModal ||
          isBarcodeScannerOpen ||
          Boolean(weightModalProduct) ||
          Boolean(cameraModalTarget) ||
          Boolean(productToDelete)
        ) {
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    isOpen,
    onClose,
    showAddCustomModal,
    showBulkScaleModal,
    isBarcodeScannerOpen,
    weightModalProduct,
    cameraModalTarget,
    productToDelete,
  ]);

  // Helper getters for Web Search customizable rate and quantity
  const getCleanWebRate = (): number => {
    const val = parseFloat(String(webEditedRate));
    return isNaN(val) || val < 0 ? 0 : val;
  };

  const getCleanWebQty = (): number => {
    const val = parseFloat(String(webEditedQty));
    return isNaN(val) || val <= 0 ? 1 : val;
  };

  const handleSaveWebToCatalogueAndBill = () => {
    if (!webSearchResult?.item) return;
    const finalRate = getCleanWebRate();
    const qty = getCleanWebQty();
    const finalName = webEditedName.trim() || webSearchResult.item.name;

    const newProd: Product = {
      id: `web-${Date.now()}`,
      name: finalName,
      hindiName: webSearchResult.item.hindiName || '',
      category: webSearchResult.item.category || 'general',
      unit: (webEditedUnit || 'kg') as UnitType,
      rate: finalRate,
      popular: true,
    };

    onAddProductToInventory(newProd);

    onAddItemToBill({
      productId: newProd.id,
      name: newProd.name,
      hindiName: newProd.hindiName,
      quantity: qty,
      unit: newProd.unit,
      rate: finalRate,
      total: Math.round(finalRate * qty * 100) / 100,
    });

    setWebSearchResult(null);
  };

  const handleSaveWebToCatalogueOnly = () => {
    if (!webSearchResult?.item) return;
    const finalRate = getCleanWebRate();
    const finalName = webEditedName.trim() || webSearchResult.item.name;

    const newProd: Product = {
      id: `web-${Date.now()}`,
      name: finalName,
      hindiName: webSearchResult.item.hindiName || '',
      category: webSearchResult.item.category || 'general',
      unit: (webEditedUnit || 'kg') as UnitType,
      rate: finalRate,
      popular: true,
    };

    onAddProductToInventory(newProd);
    setWebSearchResult(null);
  };

  const handleAddWebToBillOnly = () => {
    if (!webSearchResult?.item) return;
    const finalRate = getCleanWebRate();
    const qty = getCleanWebQty();
    const finalName = webEditedName.trim() || webSearchResult.item.name;

    onAddItemToBill({
      productId: `temp-web-${Date.now()}`,
      name: finalName,
      hindiName: webSearchResult.item.hindiName,
      quantity: qty,
      unit: (webEditedUnit || 'kg') as UnitType,
      rate: finalRate,
      total: Math.round(finalRate * qty * 100) / 100,
    });

    setWebSearchResult(null);
  };

  const handleGenerateBulk = () => {
    if (!onBulkAddProducts) return;
    setIsGeneratingBulk(true);
    setTimeout(() => {
      try {
        const batch = generateHighVolumeCatalogue(bulkCountToGenerate, products.length + 1);
        onBulkAddProducts(batch);
        setBulkSuccessMsg(`Successfully generated ${batch.length.toLocaleString()} Kirana items! IndexedDB capacity active.`);
        setTimeout(() => {
          setBulkSuccessMsg('');
          setShowBulkScaleModal(false);
        }, 2500);
      } finally {
        setIsGeneratingBulk(false);
      }
    }, 50);
  };

  const handleStartEditing = (p: Product) => {
    setEditingProductId(p.id);
    setTempRate(p.rate);
    setTempStock(p.stock !== undefined ? p.stock : 100);
    setEditingProductOutlet(p.outletId || 'all');
  };

  const handleSaveRateAndStock = (p: Product, rateVal?: number, stockVal?: number) => {
    const finalRate = rateVal !== undefined ? rateVal : tempRate;
    const finalStock = stockVal !== undefined ? stockVal : tempStock;
    if (finalRate <= 0) return;
    const updated: Product = {
      ...p,
      rate: Number(finalRate),
      stock: Number(finalStock),
      outletId: editingProductOutlet || p.outletId || 'all',
      outletName:
        editingProductOutlet && editingProductOutlet !== 'all'
          ? currentStores?.find((s) => s.id === editingProductOutlet)?.shopName
          : undefined,
    };
    if (onUpdateProduct) {
      onUpdateProduct(updated);
    }
    setEditingProductId(null);
    setSaveSuccessId(p.id);
    setTimeout(() => setSaveSuccessId(null), 2500);
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

  const isProductLowStock = (p: Product) => {
    const itemThreshold = p.minStockAlert !== undefined ? p.minStockAlert : lowStockThreshold;
    return p.stock !== undefined && p.stock <= itemThreshold;
  };

  const lowStockCount = useMemo(() => {
    return products.filter((p) => {
      if (!isProductInOutlet(p, selectedOutletFilter)) return false;
      const itemThreshold = p.minStockAlert !== undefined ? p.minStockAlert : lowStockThreshold;
      return p.stock !== undefined && p.stock <= itemThreshold;
    }).length;
  }, [products, selectedOutletFilter, lowStockThreshold]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      if (!isProductInOutlet(p, selectedOutletFilter)) return false;

      const matchesCat =
        selectedCategory === 'all'
          ? true
          : selectedCategory === 'low_stock'
          ? isProductLowStock(p)
          : p.category === selectedCategory;

      if (!matchesCat) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.hindiName && p.hindiName.includes(q)) ||
        p.category.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.includes(q))
      );
    });
  }, [products, selectedCategory, searchQuery, selectedOutletFilter, lowStockThreshold]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedProducts = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, safePage, pageSize]);

  const handleSelectProductForWeight = (product: Product) => {
    setWeightModalProduct(product);
  };

  const handleConfirmWeightAdd = (item: Omit<BillItem, 'id'>) => {
    onAddItemToBill(item);
    setWeightModalProduct(null);
  };

  // Web search for items not in inventory or for live market price lookup
  const handleWebSearchItem = async (queryText?: string) => {
    const q = queryText || searchQuery;
    if (!q.trim()) return;

    setIsWebSearching(true);
    setWebSearchError(null);
    setWebSearchResult(null);

    try {
      const res = await fetch('/api/item-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q.trim() }),
      });

      if (!res.ok) throw new Error('Search failed.');
      const data = await res.json();
      setWebSearchResult(data);
      if (data?.item) {
        setWebEditedName(data.item.name || '');
        setWebEditedRate(data.item.typicalMarketRate || 100);
        setWebEditedUnit(data.item.suggestedUnit || 'kg');
        setWebEditedQty(1);
      }
    } catch (err: any) {
      setWebSearchError('Could not fetch item data. You can add it manually.');
    } finally {
      setIsWebSearching(false);
    }
  };

  const handleAddWebItemToInventoryAndBill = () => {
    if (!webSearchResult?.item) return;
    const item = webSearchResult.item;
    const newProduct: Product = {
      id: `web-${Date.now()}`,
      name: item.name,
      hindiName: item.hindiName,
      category: item.category,
      unit: item.suggestedUnit || 'kg',
      rate: item.typicalMarketRate,
      imageUrl: item.imageUrl || webSearchResult.imageUrl || undefined,
      popular: true,
    };

    onAddProductToInventory(newProduct);
    setWebSearchResult(null);
    // Open custom weight modal directly for the newly added item
    setWeightModalProduct(newProduct);
  };

  const handleCreateCustomProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) return;

    const parsedRate = parseFloat(newProductRate) || 0;
    const parsedStock = newProductStockWeight.trim() !== '' ? parseFloat(newProductStockWeight) || 0 : undefined;

    const targetOutlet = newProductOutlet || (selectedOutletFilter !== 'all' ? selectedOutletFilter : activeStoreId || 'all');
    const prod: Product = {
      id: `cust-${Date.now()}`,
      name: newProductName.trim(),
      hindiName: newProductHindi.trim() || undefined,
      category: newProductCategory,
      unit: newProductUnit,
      rate: parsedRate,
      stock: parsedStock,
      barcode: newProductBarcode.trim() || undefined,
      imageUrl: newProductImage.trim() || undefined,
      popular: true,
      outletId: targetOutlet,
      outletName: targetOutlet !== 'all' ? currentStores?.find((s) => s.id === targetOutlet)?.shopName : undefined,
    };

    onAddProductToInventory(prod);
    setShowAddCustomModal(false);
    setNewProductName('');
    setNewProductHindi('');
    setNewProductRate('');
    setNewProductStockWeight('');
    setNewProductBarcode('');
    setNewProductOutlet('all');
    setNewProductImage('');
    setCurrentPage(1);
    setSearchQuery('');
    setSelectedCategory('all');

    // Open weight modal to enter bill quantity/weight
    setWeightModalProduct(prod);
  };

  const spiceSuggestions = [
    'Chakra Phool (Star Anise)',
    'Kasuri Methi',
    'Kalonji (Nigella)',
    'Javitri (Mace)',
    'Biryani Masala Special',
    'Saunth (Dry Ginger)',
    'Safed Mirch (White Pepper)',
    'Kabab Chini (Allspice)',
  ];

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 w-full h-full bg-slate-950 z-50 overflow-y-auto flex flex-col animate-in fade-in duration-200">
        {/* Sticky Top Header Section */}
        <div className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-md">
          {/* Main Top Bar */}
          <div className="max-w-7xl mx-auto w-full p-3 sm:px-6 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-4 h-4 text-purple-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm sm:text-base text-white">Kirana & Spice POS Catalog</h3>
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/40 font-semibold hidden sm:inline">
                    Full Page Scroll
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {products.length.toLocaleString()} items • <span className="text-purple-300 font-semibold">1,500,000 Capacity (IndexedDB)</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap ml-auto">
              {onBulkAddProducts && (
                <button
                  onClick={() => setShowBulkScaleModal(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Scale Catalogue Capacity (up to 1,500,000 Items)"
                >
                  <Database className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">1500k Scale</span>
                </button>
              )}
              {/* Header bar Save Inventory button */}
              <button
                onClick={handleSaveInventoryHeader}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                  headerSaveSuccess
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
                title="Save catalogue and inventory changes"
              >
                {headerSaveSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>{headerSaveSuccess ? 'Saved!' : 'Save Inventory'}</span>
              </button>

              <button
                onClick={() => setQuickEditMode(!quickEditMode)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border cursor-pointer ${
                  quickEditMode
                    ? 'bg-purple-600/40 text-purple-200 border-purple-500 shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
                }`}
                title="Toggle Editable Rates & Quantity for all products"
              >
                <Edit2 className="w-3.5 h-3.5 text-purple-400" />
                <span>{quickEditMode ? 'Done Editing' : 'Edit Rates & Qty'}</span>
              </button>
              <button
                onClick={() => setIsBarcodeScannerOpen(true)}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                title="Camera Barcode Scanner"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-400" />
                <span>Scan Barcode</span>
              </button>
              <button
                onClick={() => setShowAddCustomModal(true)}
                className="px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="Create Custom Product"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Add Item</span>
              </button>
              <button
                onClick={onClose}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Close Full Page Catalog (Esc)"
              >
                <X className="w-4 h-4" />
                <span>Close (Esc)</span>
              </button>
            </div>
          </div>

          {/* Search Bar with Web Search Trigger & Quick Barcode Scanner */}
          <div className="border-t border-slate-800/80 bg-slate-900/60">
            <div className="max-w-7xl mx-auto w-full p-3 sm:px-6 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleWebSearchItem();
                }}
                placeholder="Search Kirana / Masale (e.g. Jeera, Haldi, Atta)..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
              />
            </div>

            <button
              onClick={() => setIsBarcodeScannerOpen(true)}
              className="px-2.5 py-2 bg-slate-800 hover:bg-slate-750 text-emerald-400 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm flex-shrink-0"
              title="Trigger camera access for barcode scanning"
            >
              <Camera className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Scan</span>
            </button>

            <button
              onClick={() => handleWebSearchItem()}
              disabled={isWebSearching || !searchQuery.trim()}
              className="px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md flex-shrink-0 transition-all"
              title="Search item or barcode using 100% Free Open APIs (Open Food Facts, Wikipedia, DuckDuckGo)"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-200 animate-pulse" />
              <span>{isWebSearching ? 'Searching...' : 'Free Web Search'}</span>
            </button>
          </div>

          {/* Quick Suggestion Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[10px]">
            <span className="text-slate-500 font-semibold flex-shrink-0">Popular:</span>
            {spiceSuggestions.slice(0, 5).map((s, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSearchQuery(s);
                  handleWebSearchItem(s);
                }}
                className="bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white px-2 py-0.5 rounded-full border border-slate-700 whitespace-nowrap transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
      </div>
      {/* End Sticky Top Header */}

      {/* Delete notification toast */}
      {deleteToast && (
        <div className="max-w-7xl mx-auto w-full px-3 sm:px-6 pt-3">
          <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>{deleteToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setDeleteToast('')}
              className="p-1 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Web Item Search Result Card - Editable Rate & Details */}
      {webSearchResult && (
        <div className="max-w-7xl mx-auto w-full px-3 sm:px-6 pt-3">
          <div className="p-4 bg-gradient-to-b from-indigo-950/95 via-purple-950/95 to-slate-900 border-2 border-cyan-400/80 rounded-2xl shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-indigo-800/60">
              <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Found via 100% Free Open APIs ({webSearchResult.freeApiSource || 'Open Food Facts • Wikipedia'})</span>
              </span>
              <button
                onClick={() => setWebSearchResult(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Product Image preview from free API */}
            {(webSearchResult.item?.imageUrl || webSearchResult.imageUrl) && (
              <div className="flex items-center gap-3 p-2 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="w-14 h-14 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 flex-shrink-0">
                  <img
                    src={webSearchResult.item?.imageUrl || webSearchResult.imageUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
                <div className="text-xs text-slate-300">
                  <p className="font-semibold text-white">Free Open API Product Photo Attached</p>
                  <p className="text-[10px] text-slate-400">Verified from Wikipedia / Open Food Facts public repository</p>
                </div>
              </div>
            )}

            {/* Editable Product Name & Detected Hindi Name */}
            <div className="space-y-1">
              <label className="text-[11px] text-slate-300 font-semibold block">
                Product Name (Customizable):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={webEditedName}
                  onChange={(e) => setWebEditedName(e.target.value)}
                  className="flex-1 bg-slate-950/90 border border-indigo-500/50 focus:border-cyan-400 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-bold text-white outline-none"
                  placeholder="Product Name"
                />
                {webSearchResult.item?.hindiName && (
                  <span className="text-amber-300 text-xs font-semibold px-2.5 py-1.5 bg-amber-950/40 rounded-xl border border-amber-500/30 whitespace-nowrap">
                    {webSearchResult.item.hindiName}
                  </span>
                )}
              </div>
              {webSearchResult.searchSummary && (
                <div className="text-slate-400 text-[10px] italic px-1">
                  {webSearchResult.searchSummary}
                </div>
              )}
            </div>

            {/* Editable Selling Rate, Unit & Customizable Quantity (No +- buttons) */}
            <div className="p-3 bg-slate-950/90 rounded-xl border border-indigo-500/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-cyan-300 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Customize Selling Rate, Unit & Quantity:</span>
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Bill Total: <strong className="text-emerald-400 text-xs font-bold">₹{(getCleanWebRate() * getCleanWebQty()).toFixed(2)}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center">
                {/* 1. Selling Rate (₹) */}
                <div className="sm:col-span-1">
                  <label className="text-[10px] text-slate-300 font-semibold block mb-1">
                    Selling Rate (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-400 font-bold font-mono text-xs">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={webEditedRate}
                      onChange={(e) => setWebEditedRate(e.target.value)}
                      className="w-full bg-slate-900 border-2 border-emerald-500/70 focus:border-emerald-400 rounded-xl pl-6 pr-2 py-1.5 text-white font-mono font-bold text-xs focus:outline-none"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* 2. Unit selector (kg, g, litre, packet, piece, quintal) */}
                <div className="sm:col-span-1">
                  <label className="text-[10px] text-slate-300 font-semibold block mb-1">
                    Unit
                  </label>
                  <select
                    value={webEditedUnit}
                    onChange={(e) => setWebEditedUnit(e.target.value)}
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

                {/* 3. Quantity (Directly customizable text/number input, not +-) */}
                <div className="sm:col-span-1">
                  <label className="text-[10px] text-slate-300 font-semibold block mb-1">
                    Quantity (Customizable)
                  </label>
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    value={webEditedQty}
                    onChange={(e) => setWebEditedQty(e.target.value)}
                    placeholder="e.g. 1, 0.5, 2.5, 25"
                    className="w-full bg-slate-900 border-2 border-indigo-500/60 focus:border-cyan-400 rounded-xl px-3 py-1.5 text-white font-bold text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* Quick rate adjust buttons */}
              <div className="flex items-center gap-1 pt-1 overflow-x-auto text-[10px] font-bold">
                <span className="text-slate-400 text-[10px] mr-1">Quick rate adjust:</span>
                {[-50, -10, +10, +50].map((adj) => (
                  <button
                    key={adj}
                    type="button"
                    onClick={() => {
                      const current = getCleanWebRate();
                      setWebEditedRate(Math.max(1, current + adj));
                    }}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                  >
                    {adj > 0 ? `+₹${adj}` : `-₹${Math.abs(adj)}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleAddWebToBillOnly}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
              >
                Add to Bill Only
              </button>
              <button
                type="button"
                onClick={handleSaveWebToCatalogueOnly}
                className="px-3 py-1.5 bg-purple-900/60 hover:bg-purple-900 text-purple-200 hover:text-white rounded-xl text-xs font-semibold border border-purple-500/40 transition-all cursor-pointer"
              >
                Save to Catalogue Only
              </button>
              <button
                type="button"
                onClick={handleSaveWebToCatalogueAndBill}
                className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-xl text-xs shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save to Catalogue & Bill</span>
              </button>
            </div>
          </div>
        </div>
      )}

        {/* Outlet Catalogue Filter Bar */}
        {currentStores && currentStores.length > 0 && (
          <div className="border-b border-slate-800 bg-slate-950/80">
            <div className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
              <div className="flex items-center gap-1.5 text-slate-400 font-semibold text-[11px] flex-shrink-0 pr-1.5 border-r border-slate-800">
                <Store className="w-3.5 h-3.5 text-amber-400" />
                <span>Outlet:</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedOutletFilter('all');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedOutletFilter === 'all'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                All Outlets ({products.length})
              </button>

              {currentStores.map((store) => {
                const count = getOutletItemCount(products, store.id);
                const isSelected = selectedOutletFilter === store.id;

                return (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => {
                      setSelectedOutletFilter(store.id);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-amber-600 text-white font-bold ring-1 ring-amber-400/50 shadow'
                        : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Building2 className="w-3 h-3" />
                    <span>{store.shopName}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 font-mono">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Category Pills Bar */}
        <div className="border-b border-slate-800 bg-slate-900/40">
          <div className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-2.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              All Items ({products.length})
            </button>

            {/* Low Stock Alert Filter Pill */}
            <button
              onClick={() => setSelectedCategory(selectedCategory === 'low_stock' ? 'all' : 'low_stock')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedCategory === 'low_stock'
                  ? 'bg-red-600 text-white shadow-md shadow-red-950/60 ring-2 ring-red-400 font-bold'
                  : lowStockCount > 0
                  ? 'bg-red-950/60 text-red-300 border border-red-500/50 hover:bg-red-900/60 font-medium'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title={`Filter items at or below threshold (${lowStockThreshold} units)`}
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${selectedCategory === 'low_stock' ? 'text-white' : 'text-red-400'}`} />
              <span>Low Stock ({lowStockCount})</span>
            </button>

            {Object.entries(CATEGORY_LABELS).map(([catKey, cat]) => (
              <button
                key={catKey}
                onClick={() => setSelectedCategory(catKey)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === catKey
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Low Stock Notification Banner - Compact Small Size */}
        {lowStockCount > 0 && (
          <div className="max-w-7xl mx-auto w-full px-3 sm:px-6 pt-2.5">
            <div className="py-1 px-3 rounded-lg bg-red-950/50 border border-red-500/35 flex items-center justify-between gap-2 text-xs shadow-xs animate-in fade-in">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <span className="text-[11px] text-red-200 truncate">
                  <strong className="text-white font-bold">{lowStockCount}</strong> {lowStockCount === 1 ? 'item is' : 'items are'} low in stock
                  <span className="text-red-400/80 ml-1 font-mono text-[10px] hidden sm:inline">(threshold ≤ {lowStockThreshold})</span>
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedCategory(selectedCategory === 'low_stock' ? 'all' : 'low_stock')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    selectedCategory === 'low_stock'
                      ? 'bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-600'
                      : 'bg-red-600 hover:bg-red-500 text-white shadow-xs'
                  }`}
                >
                  <span>{selectedCategory === 'low_stock' ? 'Show All' : 'Filter Low Stock'}</span>
                </button>

                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSettings('inventory');
                    }}
                    className="px-1.5 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-medium border border-slate-700 transition-colors cursor-pointer"
                    title="Configure low stock threshold in Settings"
                  >
                    Settings
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Full Page Product List */}
        <div className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 space-y-4">
          {filteredProducts.length === 0 ? (
            <div className="min-h-[260px] flex flex-col items-center justify-center text-center p-6 bg-slate-900/40 rounded-2xl border border-slate-800">
              <Package className="w-10 h-10 text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-slate-300">No items match "{searchQuery}"</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md">
                Click <strong>"Free Web Search"</strong> above to find its market price and auto-add it!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {paginatedProducts.map((p) => {
              const catConf = CATEGORY_LABELS[p.category] || CATEGORY_LABELS.general;
              const isEditing = editingProductId === p.id || quickEditMode;
              const isSuccess = saveSuccessId === p.id;
              const itemThreshold = p.minStockAlert !== undefined ? p.minStockAlert : lowStockThreshold;
              const isLowStock = p.stock !== undefined && p.stock <= itemThreshold;
              const isOutOfStock = p.stock !== undefined && p.stock <= 0;

              return (
                <div
                  key={p.id}
                  id={`pos-product-${p.id}`}
                  className={`p-3 rounded-2xl border transition-all ${
                    isEditing
                      ? 'bg-slate-800 border-purple-500 shadow-lg'
                      : isSuccess
                      ? 'bg-emerald-950/40 border-emerald-500/60'
                      : isLowStock
                      ? 'bg-gradient-to-r from-red-950/40 via-slate-850 to-red-950/20 border-red-500/90 shadow-md shadow-red-950/40 ring-1 ring-red-500/40 hover:border-red-400'
                      : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 hover:border-purple-500/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {p.imageUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            setCameraModalTarget({
                              isOpen: true,
                              mode: 'existing',
                              product: p,
                            })
                          }
                          className="relative group w-11 h-11 rounded-xl overflow-hidden border border-slate-700 hover:border-purple-400 flex-shrink-0 bg-slate-900 cursor-pointer shadow-sm transition-all"
                          title={`Click to view or retake photo with camera for ${p.name}`}
                        >
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Camera className="w-4 h-4 text-purple-300" />
                          </div>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setCameraModalTarget({
                              isOpen: true,
                              mode: 'existing',
                              product: p,
                            })
                          }
                          className="w-11 h-11 rounded-xl border border-dashed border-slate-700 hover:border-purple-500 bg-slate-900/50 hover:bg-purple-950/40 flex flex-col items-center justify-center text-slate-500 hover:text-purple-300 flex-shrink-0 transition-all cursor-pointer group"
                          title={`Take photo with camera for ${p.name}`}
                        >
                          <Camera className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          <span className="text-[8px] font-medium mt-0.5 leading-none">Photo</span>
                        </button>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className={`font-bold text-base sm:text-lg truncate ${isLowStock ? 'text-red-100' : 'text-white'}`}>
                            {p.name}
                          </h4>
                          {isLowStock && (
                            <span
                              id={`low-stock-alert-badge-${p.id}`}
                              className="text-[9px] sm:text-[10px] bg-red-600/25 text-red-300 font-extrabold px-2 py-0.5 rounded-md border border-red-500/60 flex items-center gap-1 shadow-sm flex-shrink-0 animate-pulse"
                              title={`Low stock alert: current quantity (${p.stock ?? 0} ${p.unit}) is at or below threshold (${itemThreshold} ${p.unit})`}
                            >
                              <AlertTriangle className="w-3 h-3 text-red-400" />
                              <span>{isOutOfStock ? 'OUT OF STOCK' : `LOW STOCK (≤${itemThreshold})`}</span>
                            </span>
                          )}
                          {p.popular && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30 flex-shrink-0">
                              ★ Fast Moving
                            </span>
                          )}
                        </div>
                        {p.hindiName && (
                          <p className="text-xs text-amber-300 font-medium">{p.hindiName}</p>
                        )}
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${catConf.color}`}>
                            {catConf.label}
                          </span>
                          {/* Outlet Badge */}
                          {(() => {
                            const outInfo = getProductOutletInfo(p, currentStores);
                            return (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold inline-flex items-center gap-1 ${
                                  outInfo.isAll
                                    ? 'bg-slate-800 text-slate-400 border-slate-700'
                                    : 'bg-amber-950/40 text-amber-300 border-amber-500/40'
                                }`}
                              >
                                <Building2 className="w-2.5 h-2.5" />
                                <span>{outInfo.shortcut}</span>
                              </span>
                            );
                          })()}
                          {p.barcode && (
                            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-700">
                              <Barcode className="w-3 h-3 text-emerald-400" />
                              <span>{p.barcode}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-base font-bold text-emerald-400 font-mono">₹{p.rate}</div>
                      <div className="text-[10px] text-slate-400">per {p.unit}</div>
                      <div className="text-[10px] mt-0.5">
                        {isLowStock ? (
                          <span className="inline-flex items-center gap-1 font-bold text-red-300 bg-red-950/80 px-1.5 py-0.5 rounded border border-red-500/60">
                            <AlertTriangle className="w-2.5 h-2.5 text-red-400 flex-shrink-0" />
                            <span>Stock: {p.stock !== undefined ? `${p.stock} ${p.unit}` : '0'}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            Stock: <span className="text-slate-200 font-medium">{p.stock !== undefined ? `${p.stock} ${p.unit}` : '100+'}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Inline Editable Rates & Quantity Form */}
                  {isEditing ? (
                    <div className="mt-2.5 pt-2 border-t border-slate-700 space-y-2 bg-slate-900/90 p-2.5 rounded-xl border border-purple-500/40">
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
                              value={editingProductId === p.id ? tempRate : p.rate}
                              onChange={(e) => {
                                if (editingProductId !== p.id) {
                                  setEditingProductId(p.id);
                                  setTempStock(p.stock || 100);
                                }
                                setTempRate(parseFloat(e.target.value) || 0);
                              }}
                              className="w-full bg-slate-950 border border-purple-500 rounded-lg pl-6 pr-2 py-1 text-emerald-400 font-mono font-bold text-xs"
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
                                ? tempStock
                                : p.stock !== undefined
                                ? p.stock
                                : 100
                            }
                            onChange={(e) => {
                              if (editingProductId !== p.id) {
                                setEditingProductId(p.id);
                                setTempRate(p.rate);
                              }
                              setTempStock(parseFloat(e.target.value) || 0);
                            }}
                            className={`w-full bg-slate-950 rounded-lg px-2 py-1 font-mono text-xs ${
                              (editingProductId === p.id ? tempStock : (p.stock ?? 100)) <= itemThreshold
                                ? 'border-2 border-red-500 text-red-300'
                                : 'border border-purple-500 text-white'
                            }`}
                          />
                          {(editingProductId === p.id ? tempStock : (p.stock ?? 100)) <= itemThreshold && (
                            <div className="text-[9px] text-red-400 font-bold flex items-center gap-1 mt-1">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              <span>Triggers Low Stock Alert (≤ {itemThreshold} {p.unit})</span>
                            </div>
                          )}
                        </div>

                        <div className="col-span-2">
                          <label className="text-[10px] text-slate-300 font-semibold block mb-0.5 flex items-center gap-1">
                            <Store className="w-3 h-3 text-amber-400" />
                            <span>Assigned Outlet:</span>
                          </label>
                          <select
                            value={editingProductId === p.id ? editingProductOutlet : (p.outletId || 'all')}
                            onChange={(e) => {
                              if (editingProductId !== p.id) {
                                setEditingProductId(p.id);
                                setTempRate(p.rate);
                                setTempStock(p.stock || 100);
                              }
                              setEditingProductOutlet(e.target.value);
                            }}
                            className="w-full bg-slate-950 border border-purple-500 rounded-lg px-2 py-1 text-white text-xs cursor-pointer"
                          >
                            <option value="all">All Outlets (Shared / सभी शाखाएं)</option>
                            {currentStores?.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.shopName} ({s.shortcutName || s.id})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Photo management inside Edit Mode */}
                      <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt=""
                              className="w-9 h-9 rounded-lg object-cover border border-slate-700 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 flex-shrink-0">
                              <Camera className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold text-slate-200">
                              {p.imageUrl ? 'Item Photo Attached' : 'No Photo Attached'}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {p.imageUrl ? 'Photo helps visual identification' : 'Use camera to snap photo'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setCameraModalTarget({
                                isOpen: true,
                                mode: 'existing',
                                product: p,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/40 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Camera className="w-3 h-3" />
                            <span>{p.imageUrl ? 'Change Photo' : 'Take Photo'}</span>
                          </button>

                          {p.imageUrl && onUpdateProduct && (
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateProduct({ ...p, imageUrl: undefined });
                                setDeleteToast(`Photo removed from "${p.name}"`);
                                setTimeout(() => setDeleteToast(''), 3000);
                              }}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Remove photo from item"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
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
                            <span>Delete Item</span>
                          </button>
                        )}
                        <div className="flex items-center gap-1.5 ml-auto">
                          {editingProductId === p.id && !quickEditMode && (
                            <button
                              type="button"
                              onClick={() => setEditingProductId(null)}
                              className="px-2 py-1 rounded-lg text-slate-400 hover:text-white text-[11px]"
                            >
                              Cancel
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              handleSaveRateAndStock(
                                p,
                                editingProductId === p.id ? tempRate : p.rate,
                                editingProductId === p.id
                                  ? tempStock
                                  : p.stock !== undefined
                                  ? p.stock
                                  : 100
                              )
                            }
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm"
                          >
                            <Check className="w-3 h-3" />
                            <span>Save Changes</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center justify-between pt-2 border-t border-slate-700/60 text-xs">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEditing(p)}
                          className="px-2 py-1 text-slate-400 hover:text-purple-300 hover:bg-purple-950/40 rounded-lg text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                          title="Edit Selling Rate or Stock Quantity"
                        >
                          <Edit2 className="w-3 h-3 text-purple-400" />
                          <span>Edit Rate/Qty</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setCameraModalTarget({
                              isOpen: true,
                              mode: 'existing',
                              product: p,
                            })
                          }
                          className="px-2 py-1 text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/40 rounded-lg text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                          title={`Take or change photo with camera for ${p.name}`}
                        >
                          <Camera className="w-3 h-3 text-cyan-400" />
                          <span>Photo</span>
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
                        <button
                          type="button"
                          onClick={() => handleQuickAddSingle(p)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
                          title={`Quick add 1 ${p.unit}`}
                        >
                          <Plus className="w-3 h-3" />
                          <span>+1 {p.unit}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectProductForWeight(p)}
                          className="px-3 py-1 bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white rounded-xl text-xs font-bold border border-purple-500/40 flex items-center gap-1.5 transition-all shadow-sm"
                        >
                          <Scale className="w-3.5 h-3.5 text-purple-300" />
                          <span>Weight / Add</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* High-Capacity Pagination Controls (IndexedDB Capacity up to 1,500,000 items) */}
      {filteredProducts.length > 0 && (
        <div className="sticky bottom-0 z-30 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md">
          <div className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="text-[11px] text-slate-400">
              Showing <span className="text-white font-bold">{(safePage - 1) * pageSize + 1}</span>–<span className="text-white font-bold">{Math.min(safePage * pageSize, filteredProducts.length)}</span> of <span className="text-purple-300 font-bold">{filteredProducts.length.toLocaleString()}</span> items
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={safePage === 1}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-800 transition-colors"
                title="First Page"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-800 transition-colors"
                title="Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <span className="px-2 py-0.5 text-[11px] font-mono font-bold text-white bg-slate-800 rounded-lg border border-slate-750">
                {safePage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-800 transition-colors"
                title="Next Page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={safePage === totalPages}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-800 transition-colors"
                title="Last Page"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>

              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="ml-1 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-2 py-0.5 text-[11px] outline-none"
              >
                <option value={20}>20 / page</option>
                <option value={30}>30 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
          </div>
        </div>
      )}

        {/* Custom Item Modal */}
        {showAddCustomModal && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-2xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h4 className="font-bold text-sm text-white">Add Item to Inventory</h4>
                <button
                  onClick={() => setShowAddCustomModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateCustomProduct} className="space-y-2.5 text-xs">
                <div>
                  <label className="text-slate-300 block mb-1">Item Name (English):</label>
                  <input
                    type="text"
                    required
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    placeholder="e.g. Kashmiri Kesar / Saffron"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Hindi Name (Optional):</label>
                  <input
                    type="text"
                    value={newProductHindi}
                    onChange={(e) => setNewProductHindi(e.target.value)}
                    placeholder="e.g. कश्मीरी केसर"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-300 block mb-1">Category:</label>
                    <select
                      value={newProductCategory}
                      onChange={(e) => setNewProductCategory(e.target.value as ProductCategory)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2 py-2 text-white focus:outline-none"
                    >
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1">Weight Unit:</label>
                    <select
                      value={newProductUnit}
                      onChange={(e) => setNewProductUnit(e.target.value as UnitType)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2 py-2 text-white focus:outline-none"
                    >
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                      <option value="quintal">quintal</option>
                      <option value="litre">litre</option>
                      <option value="packet">packet</option>
                      <option value="piece">piece</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Selling Rate (₹ per {newProductUnit}):</label>
                  <input
                    type="number"
                    required
                    min="0.1"
                    step="any"
                    placeholder="e.g. 380"
                    value={newProductRate}
                    onChange={(e) => setNewProductRate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Custom Weight / Stock:</label>
                  <input
                    type="number"
                    step="any"
                    placeholder={`e.g. 25 (${newProductUnit}) - Optional`}
                    value={newProductStockWeight}
                    onChange={(e) => setNewProductStockWeight(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-amber-400" />
                    <span>Assigned Outlet:</span>
                  </label>
                  <select
                    value={newProductOutlet}
                    onChange={(e) => setNewProductOutlet(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-white font-medium focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Outlets (Shared / सभी शाखाएं)</option>
                    {currentStores?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.shopName} ({s.shortcutName || s.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Barcode / SKU (Optional):</label>
                  <div className="relative">
                    <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. 8901030382341"
                      value={newProductBarcode}
                      onChange={(e) => setNewProductBarcode(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-white font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Small window for uploading product image */}
                <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-700">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-300 font-medium text-xs flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                      <span>Product Image:</span>
                      <span className="text-slate-500 text-[10px]">(Optional)</span>
                    </label>
                    {newProductImage && (
                      <button
                        type="button"
                        onClick={() => setNewProductImage('')}
                        className="text-[11px] text-red-400 hover:text-red-300 underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl border border-slate-700 bg-slate-800 overflow-hidden flex items-center justify-center flex-shrink-0 relative shadow-inner">
                      {newProductImage ? (
                        <img
                          src={newProductImage}
                          alt="Product preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-500">
                          <ImageIcon className="w-5 h-5 mb-0.5 opacity-60" />
                          <span className="text-[8px] text-slate-500">No Image</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() =>
                            setCameraModalTarget({
                              isOpen: true,
                              mode: 'new',
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-sm"
                        >
                          <Camera className="w-3.5 h-3.5 text-amber-300" />
                          <span>Snap Photo</span>
                        </button>

                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-sm">
                          <UploadCloud className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Upload File</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleCustomImageUpload(file);
                            }}
                          />
                        </label>
                      </div>
                      <input
                        type="text"
                        placeholder="...or paste image URL"
                        value={newProductImage.startsWith('data:') ? '' : newProductImage}
                        onChange={(e) => setNewProductImage(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddCustomModal(false)}
                    className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold"
                  >
                    Save to Catalog
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Custom Weight Modal */}
      {weightModalProduct && (
        <CustomWeightModal
          isOpen={Boolean(weightModalProduct)}
          onClose={() => setWeightModalProduct(null)}
          product={weightModalProduct}
          onConfirmAdd={handleConfirmWeightAdd}
        />
      )}

      {/* POS Camera Barcode Scanner Modal */}
      <PosBarcodeScannerModal
        isOpen={isBarcodeScannerOpen}
        onClose={() => setIsBarcodeScannerOpen(false)}
        products={products}
        onAddItemToBill={onAddItemToBill}
        onSelectProductForWeight={(product) => {
          setWeightModalProduct(product);
        }}
        onCreateNewProductWithBarcode={(barcode) => {
          setNewProductBarcode(barcode);
          setShowAddCustomModal(true);
        }}
      />

      {/* Enterprise Bulk Scale Generator Modal (Capacity: 1,500,000 items) */}
      {showBulkScaleModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border-2 border-indigo-500/60 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white">1,500,000 Item Capacity Scale</h4>
                  <p className="text-[11px] text-indigo-300 font-medium">IndexedDB High-Performance Storage</p>
                </div>
              </div>
              <button
                onClick={() => setShowBulkScaleModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-indigo-950/40 rounded-2xl border border-indigo-500/30 text-xs text-indigo-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span>Current Items in Catalogue:</span>
                <span className="font-mono font-bold text-white">{products.length.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>System Maximum Capacity:</span>
                <span className="font-mono font-bold text-emerald-400">1,500,000 Items (1,500k)</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Storage Engine:</span>
                <span className="font-semibold text-cyan-300">IndexedDB chunked transactions (5,000/batch)</span>
              </div>
            </div>

            {bulkSuccessMsg && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-semibold">
                ✓ {bulkSuccessMsg}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Select Number of Kirana & Grocery Products to Generate:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[500, 1000, 5000, 25000].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setBulkCountToGenerate(count)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      bulkCountToGenerate === count
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    +{count.toLocaleString()} Items
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowBulkScaleModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleGenerateBulk}
                disabled={isGeneratingBulk}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isGeneratingBulk ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Writing to IndexedDB...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Generate +{bulkCountToGenerate.toLocaleString()} Items</span>
                  </>
                )}
              </button>
            </div>
          </div>
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
              Are you sure? This item will be permanently removed from your POS catalog, search suggestions, and stock records.
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
                    setDeleteToast(`"${name}" removed from inventory`);
                    setTimeout(() => setDeleteToast(''), 3500);
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
      {/* Device Camera Item Photo Capture Modal */}
      {cameraModalTarget && (
        <PosProductCameraModal
          isOpen={cameraModalTarget.isOpen}
          onClose={() => setCameraModalTarget(null)}
          productName={
            cameraModalTarget.mode === 'new'
              ? newProductName.trim() || 'New Item'
              : cameraModalTarget.product?.name
          }
          onPhotoCaptured={(photoDataUrl) => {
            if (cameraModalTarget.mode === 'new') {
              setNewProductImage(photoDataUrl);
              setDeleteToast('Photo captured for new product!');
              setTimeout(() => setDeleteToast(''), 3000);
            } else if (cameraModalTarget.product && onUpdateProduct) {
              const updated = {
                ...cameraModalTarget.product,
                imageUrl: photoDataUrl,
              };
              onUpdateProduct(updated);
              setDeleteToast(`Photo attached to "${cameraModalTarget.product.name}"`);
              setTimeout(() => setDeleteToast(''), 3500);
            }
            setCameraModalTarget(null);
          }}
        />
      )}
    </>
  );
};
