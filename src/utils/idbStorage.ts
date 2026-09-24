import { Product, ProductCategory, UnitType } from '../types';
import { INITIAL_PRODUCTS } from '../data/defaultInventory';

const DB_NAME = 'nayab_smart_pos_db';
const DB_VERSION = 1;
const STORE_PRODUCTS = 'products';

// 1500 thousand = 1,500,000 items capacity
export const CATALOGUE_MAX_CAPACITY = 1500000;

/**
 * Opens or upgrades the IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
        const store = db.createObjectStore(STORE_PRODUCTS, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('barcode', 'barcode', { unique: false });
        store.createIndex('popular', 'popular', { unique: false });
        store.createIndex('rate', 'rate', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

/**
 * Load all products from IndexedDB.
 * Falls back to localStorage or initial products if database is empty.
 */
export async function getAllProductsFromIDB(): Promise<Product[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PRODUCTS, 'readonly');
      const store = tx.objectStore(STORE_PRODUCTS);
      const request = store.getAll();

      request.onsuccess = () => {
        const result = request.result as Product[];
        if (result && result.length > 0) {
          resolve(result);
        } else {
          // Check if localStorage has stored products before initializing default
          let fallbackProducts: Product[] | null = null;
          try {
            const raw = localStorage.getItem('tohands_products_v2') || localStorage.getItem('nayab_products_v2');
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length > 0) {
                fallbackProducts = parsed;
              }
            }
          } catch {}

          const prodsToSeed = fallbackProducts || INITIAL_PRODUCTS;
          saveAllProductsToIDB(prodsToSeed)
            .then(() => resolve(prodsToSeed))
            .catch(() => resolve(prodsToSeed));
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('IndexedDB unavailable, checking localStorage fallback:', err);
    try {
      const raw = localStorage.getItem('tohands_products_v2') || localStorage.getItem('nayab_products_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_PRODUCTS;
  }
}

/**
 * Persist all products into IndexedDB using high-performance chunked transactions.
 * Handles massive arrays up to 1,500,000 items without memory starvation.
 */
export async function saveAllProductsToIDB(products: Product[]): Promise<void> {
  if (!products || products.length === 0) {
    // Safety guard: Never clear the database when provided an empty array
    return;
  }

  try {
    const db = await openDB();
    const CHUNK_SIZE = 5000;

    // Clear and batch write in chunks
    const clearTx = db.transaction(STORE_PRODUCTS, 'readwrite');
    clearTx.objectStore(STORE_PRODUCTS).clear();
    await new Promise<void>((resolve, reject) => {
      clearTx.oncomplete = () => resolve();
      clearTx.onerror = () => reject(clearTx.error);
    });

    for (let i = 0; i < products.length; i += CHUNK_SIZE) {
      const chunk = products.slice(i, i + CHUNK_SIZE);
      const tx = db.transaction(STORE_PRODUCTS, 'readwrite');
      const store = tx.objectStore(STORE_PRODUCTS);
      for (const item of chunk) {
        store.put(item);
      }
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  } catch (err) {
    console.error('Failed to save products to IndexedDB:', err);
  }
}

/**
 * Save or update a single product
 */
export async function saveSingleProductToIDB(product: Product): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_PRODUCTS, 'readwrite');
    tx.objectStore(STORE_PRODUCTS).put(product);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to save single product to IndexedDB:', err);
  }
}

/**
 * Delete a product by ID
 */
export async function deleteProductFromIDB(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_PRODUCTS, 'readwrite');
    tx.objectStore(STORE_PRODUCTS).delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to delete product from IndexedDB:', err);
  }
}

/**
 * Bulk import new products into existing catalogue
 */
export async function bulkImportToIDB(newProducts: Product[]): Promise<number> {
  try {
    const db = await openDB();
    const CHUNK_SIZE = 2500;
    let addedCount = 0;

    for (let i = 0; i < newProducts.length; i += CHUNK_SIZE) {
      const chunk = newProducts.slice(i, i + CHUNK_SIZE);
      const tx = db.transaction(STORE_PRODUCTS, 'readwrite');
      const store = tx.objectStore(STORE_PRODUCTS);
      for (const item of chunk) {
        store.put(item);
        addedCount++;
      }
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
    return addedCount;
  } catch (err) {
    console.error('Bulk import to IndexedDB failed:', err);
    return 0;
  }
}

/**
 * Clear all products from IndexedDB
 */
export async function clearProductsIDB(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_PRODUCTS, 'readwrite');
    tx.objectStore(STORE_PRODUCTS).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to clear products from IndexedDB:', err);
  }
}

/**
 * Realistic Indian Kirana, Spices & FMCG catalogue items generator.
 * Can scale from 100 up to 1,500,000 high-capacity catalogue items.
 */
export function generateHighVolumeCatalogue(count: number, existingOffset = 0): Product[] {
  const brands = [
    'Tata Sampann', 'Fortune', 'Aashirvaad', 'Everest', 'MDH', 'Catch',
    'Patanjali', 'Saffola', 'Haldiram', 'Bikaji', 'Amul', 'Britannia',
    'Parle', 'ITC Sunfeast', 'Dabur', 'Godrej', 'Nestle Maggi', 'Colgate',
    'Dettol', 'Surf Excel', 'Rin', 'Vim', 'Lizol', 'Dhara', 'Bailley',
    'MDH Kadhai', 'Badshah Masala', 'Ramdev Masala', 'MTR', 'Goldiee',
  ];

  const categories: { cat: ProductCategory; items: { en: string; hi: string; unit: UnitType; baseRate: number }[] }[] = [
    {
      cat: 'spices',
      items: [
        { en: 'Haldi Powder', hi: 'हल्दी पाउडर', unit: 'kg', baseRate: 260 },
        { en: 'Jeera Seeds', hi: 'साबुत जीरा', unit: 'kg', baseRate: 380 },
        { en: 'Dhaniya Powder', hi: 'धनिया पाउडर', unit: 'kg', baseRate: 220 },
        { en: 'Lal Mirch Powder', hi: 'लाल मिर्च पाउडर', unit: 'kg', baseRate: 340 },
        { en: 'Garam Masala', hi: 'गरम मसाला', unit: 'kg', baseRate: 650 },
        { en: 'Chhoti Elaichi', hi: 'छोटी इलायची', unit: 'g', baseRate: 3.2 },
        { en: 'Kali Mirch Sabut', hi: 'काली मिर्च', unit: 'kg', baseRate: 850 },
        { en: 'Laung Cloves', hi: 'लौंग', unit: 'kg', baseRate: 1150 },
        { en: 'Dalchini Bark', hi: 'दालचीनी', unit: 'kg', baseRate: 460 },
        { en: 'Rai Mustard Seeds', hi: 'राई / सरसों दाना', unit: 'kg', baseRate: 110 },
        { en: 'Kashmiri Deggi Mirch', hi: 'कश्मीरी मिर्च', unit: 'kg', baseRate: 480 },
        { en: 'Chana Masala', hi: 'चना मसाला', unit: 'packet', baseRate: 72 },
        { en: 'Sabji Masala', hi: 'सब्जी मसाला', unit: 'packet', baseRate: 60 },
        { en: 'Kasuri Methi Special', hi: 'कस्तूरी मेथी', unit: 'packet', baseRate: 48 },
        { en: 'Asafoetida Hing', hi: 'हींग स्पेशल', unit: 'packet', baseRate: 115 },
      ],
    },
    {
      cat: 'dal_pulses',
      items: [
        { en: 'Toor Arhar Dal', hi: 'अरहर दाल', unit: 'kg', baseRate: 165 },
        { en: 'Moong Dal Dhuli', hi: 'मूंग दाल धुली', unit: 'kg', baseRate: 130 },
        { en: 'Chana Dal Desi', hi: 'चना दाल', unit: 'kg', baseRate: 92 },
        { en: 'Urad Dal Dhuli', hi: 'उड़द दाल', unit: 'kg', baseRate: 145 },
        { en: 'Kabuli Chana Dollar', hi: 'काबुली चना', unit: 'kg', baseRate: 135 },
        { en: 'Kala Chana Desi', hi: 'काला चना', unit: 'kg', baseRate: 85 },
        { en: 'Rajma Chitra Red', hi: 'राजमा', unit: 'kg', baseRate: 155 },
        { en: 'Masoor Dal Malki', hi: 'मसूर दाल', unit: 'kg', baseRate: 105 },
      ],
    },
    {
      cat: 'grains_flour',
      items: [
        { en: 'Sharbati Chakki Atta', hi: 'गेहूं आटा', unit: 'kg', baseRate: 44 },
        { en: 'Basmati Rice Premium', hi: 'बासमती चावल', unit: 'kg', baseRate: 95 },
        { en: 'Maida Special', hi: 'मैदा', unit: 'kg', baseRate: 38 },
        { en: 'Sooji Rava', hi: 'सूजी / रवा', unit: 'kg', baseRate: 42 },
        { en: 'Poha Thick Flakes', hi: 'पोहा', unit: 'kg', baseRate: 55 },
        { en: 'Besan Fine Chana Flour', hi: 'बेसन', unit: 'kg', baseRate: 88 },
        { en: 'Makka Atta Corn Flour', hi: 'मक्के का आटा', unit: 'kg', baseRate: 40 },
        { en: 'Jowar Millet Flour', hi: 'ज्वार आटा', unit: 'kg', baseRate: 50 },
      ],
    },
    {
      cat: 'oil_ghee',
      items: [
        { en: 'Kachi Ghani Mustard Oil', hi: 'सरसों का तेल', unit: 'litre', baseRate: 155 },
        { en: 'Refined Sunflower Oil', hi: 'सूरजमुखी तेल', unit: 'packet', baseRate: 138 },
        { en: 'Shuddh Desi Cow Ghee', hi: 'देशी गाय घी', unit: 'litre', baseRate: 640 },
        { en: 'Soyabean Cooking Oil', hi: 'सोयाबीन तेल', unit: 'litre', baseRate: 125 },
        { en: 'Til Oil Sesame', hi: 'तिल का तेल', unit: 'litre', baseRate: 320 },
      ],
    },
    {
      cat: 'packaged_grocery',
      items: [
        { en: 'Tata Salt Vacuum Evaporated', hi: 'नमक', unit: 'packet', baseRate: 28 },
        { en: 'Sugar Madhur Pure Sulphurless', hi: 'चीनी', unit: 'kg', baseRate: 46 },
        { en: 'Tea Gold Special Leaf', hi: 'चाय पत्ती', unit: 'kg', baseRate: 480 },
        { en: 'Noodles 2-Minute Masala Pack', hi: 'मैगी नूडल्स', unit: 'packet', baseRate: 14 },
        { en: 'Penne Pasta Durum Wheat', hi: 'पास्ता', unit: 'packet', baseRate: 65 },
        { en: 'Tomato Ketchup Fresh Bottle', hi: 'टोमैटो सॉस', unit: 'packet', baseRate: 120 },
      ],
    },
    {
      cat: 'daily_needs',
      items: [
        { en: 'Bath Soap Neem & Tulsi 100g', hi: 'साबुन', unit: 'piece', baseRate: 35 },
        { en: 'Detergent Powder Active Wash 1kg', hi: 'सर्फ पाउडर', unit: 'packet', baseRate: 140 },
        { en: 'Dishwash Bar Lemon 300g', hi: 'विम बार', unit: 'piece', baseRate: 25 },
        { en: 'Toothpaste Strong Dental Care 150g', hi: 'टूथपेस्ट', unit: 'piece', baseRate: 98 },
        { en: 'Hair Oil Pure Almond Bhringraj 200ml', hi: 'बालों का तेल', unit: 'piece', baseRate: 160 },
      ],
    },
  ];

  const variants = [
    'Standard Pack', 'Family Saver 1kg', 'Wholesale Bulk 5kg', 'Gold Reserve',
    'Export Grade', 'Budget Pack 500g', 'Festival Special', 'Select Organic',
    'Pure Traditional', 'Mandi Fresh Batch',
  ];

  const generated: Product[] = [];
  let currentId = existingOffset + 1;

  while (generated.length < count) {
    const catGroup = categories[Math.floor(Math.random() * categories.length)];
    const baseItem = catGroup.items[Math.floor(Math.random() * catGroup.items.length)];
    const brand = brands[Math.floor(Math.random() * brands.length)];
    const variant = variants[Math.floor(Math.random() * variants.length)];

    // Pricing calculation with realistic variation
    const priceMultiplier = 0.85 + Math.random() * 0.4;
    const finalRate = Math.max(5, Math.round(baseItem.baseRate * priceMultiplier));

    const itemNumber = currentId;
    const barcodeNumber = `890${String(1000000000 + itemNumber).slice(1)}`;

    generated.push({
      id: `prod-scale-${itemNumber}`,
      name: `${brand} ${baseItem.en} - ${variant} #${itemNumber}`,
      hindiName: `${baseItem.hi} (${brand})`,
      category: catGroup.cat,
      unit: baseItem.unit,
      rate: finalRate,
      stock: Math.floor(Math.random() * 500) + 10,
      popular: Math.random() < 0.15,
      barcode: barcodeNumber,
      notes: `Enterprise high-capacity catalogue item #${itemNumber}`,
    });

    currentId++;
  }

  return generated;
}

/**
 * Returns formatted capacity metrics
 */
export function getStorageCapacityMetrics(currentCount: number) {
  const percentage = Math.min(100, (currentCount / CATALOGUE_MAX_CAPACITY) * 100);
  const remaining = Math.max(0, CATALOGUE_MAX_CAPACITY - currentCount);

  return {
    currentCount,
    maxCapacity: CATALOGUE_MAX_CAPACITY,
    maxCapacityFormatted: '1,500,000 Items (1500 Thousand)',
    percentage: Number(percentage.toFixed(2)),
    remaining,
    isNearLimit: percentage >= 95,
    engine: 'Enterprise IndexedDB (Quota ~10GB+)',
  };
}
