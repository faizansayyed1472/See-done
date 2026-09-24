import { Product, StoreProfile } from '../types';

/**
 * Checks whether a given product belongs to or is available in a specific store outlet.
 *
 * Rules:
 * 1. If outletId is 'all' or empty, all products match.
 * 2. If product has no outletId or outletId === 'all', it is treated as universal (available in all outlets).
 * 3. If product has assignedOutletIds, it matches if 'all' is included or the specific outletId is included.
 * 4. Otherwise, it matches if product.outletId === outletId.
 */
export function isProductInOutlet(product: Product, targetOutletId?: string): boolean {
  if (!targetOutletId || targetOutletId === 'all') {
    return true;
  }

  // Check multi-outlet assignment array
  if (product.assignedOutletIds && Array.isArray(product.assignedOutletIds) && product.assignedOutletIds.length > 0) {
    if (product.assignedOutletIds.includes('all')) return true;
    return product.assignedOutletIds.includes(targetOutletId);
  }

  // Check single outletId
  if (product.outletId) {
    if (product.outletId === 'all') return true;
    return product.outletId === targetOutletId;
  }

  // Legacy or unassigned items without outletId default to all outlets
  return true;
}

/**
 * Filters a product array by target outletId.
 */
export function filterProductsByOutlet(products: Product[], targetOutletId?: string): Product[] {
  if (!targetOutletId || targetOutletId === 'all') return products;
  return products.filter((p) => isProductInOutlet(p, targetOutletId));
}

/**
 * Returns user-friendly outlet badge info for a product.
 */
export function getProductOutletInfo(
  product: Product,
  stores: StoreProfile[] = []
): { label: string; shortcut: string; isAll: boolean; outletId: string } {
  if (
    !product.outletId ||
    product.outletId === 'all' ||
    (product.assignedOutletIds && product.assignedOutletIds.includes('all'))
  ) {
    return {
      label: 'All Outlets (Shared)',
      shortcut: 'ALL',
      isAll: true,
      outletId: 'all',
    };
  }

  const foundStore = stores.find((s) => s.id === product.outletId);
  if (foundStore) {
    return {
      label: foundStore.shopName,
      shortcut: foundStore.shortcutName || foundStore.shopName.slice(0, 3).toUpperCase(),
      isAll: false,
      outletId: foundStore.id,
    };
  }

  return {
    label: product.outletName || product.outletId,
    shortcut: (product.outletName || product.outletId).slice(0, 3).toUpperCase(),
    isAll: false,
    outletId: product.outletId,
  };
}

/**
 * Counts how many items in the catalogue belong to a specific outlet.
 */
export function getOutletItemCount(products: Product[], outletId: string): number {
  if (outletId === 'all') return products.length;
  return products.filter((p) => isProductInOutlet(p, outletId)).length;
}

/**
 * Resolves outlet name from ID safely.
 */
export function getStoreOutletName(stores: StoreProfile[], storeId?: string): string {
  if (!storeId || storeId === 'all') return 'All Outlets';
  const found = stores.find((s) => s.id === storeId);
  return found?.shopName || storeId;
}
