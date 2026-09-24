import { Product, Transaction, CustomerUdhaar, StoreSettings, StaffAccount, AuditLogEntry, CentralDbStatus, StoreProfile, OutletDailySnapshot } from '../types';

export interface SyncResult {
  success: boolean;
  snapshot?: {
    products: Product[];
    transactions: Transaction[];
    customers: CustomerUdhaar[];
    settings: StoreSettings;
    staff: StaffAccount[];
    auditLogs: AuditLogEntry[];
    cloudSyncMode: string;
    lastUpdated: string;
  };
  lastUpdated?: string;
  changesApplied?: boolean;
  error?: string;
}

const API_BASE = '/api/db';

/**
 * Check connectivity and telemetry status of the central server database
 */
export async function checkCentralStatus(): Promise<{
  connected: boolean;
  status: CentralDbStatus;
  latencyMs: number;
}> {
  const start = performance.now();
  try {
    const res = await fetch(`${API_BASE}/status`, {
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(4000),
    });
    const latencyMs = Math.round(performance.now() - start);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      connected: true,
      latencyMs,
      status: {
        status: 'connected',
        version: data.version || '2.0.0',
        serverId: data.serverId || 'faizan-inamdar',
        serverAdmin: data.serverAdmin || 'Faizan Inamdar',
        masterAdminUsername: data.masterAdminUsername || 'faizan',
        lastSyncedAt: data.lastSyncedAt || new Date().toISOString(),
        productsCount: data.productsCount || 0,
        transactionsCount: data.transactionsCount || 0,
        customersCount: data.customersCount || 0,
        storeName: data.storeName || 'sy Nayab',
        cloudSyncMode: data.cloudSyncMode || 'central_api',
        serverLatencyMs: latencyMs,
      },
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      connected: false,
      latencyMs,
      status: {
        status: 'offline',
        version: '2.0.0',
        serverId: 'faizan-inamdar',
        serverAdmin: 'Faizan Inamdar',
        masterAdminUsername: 'faizan',
        lastSyncedAt: '',
        productsCount: 0,
        transactionsCount: 0,
        customersCount: 0,
        storeName: 'Local Terminal Mode',
        cloudSyncMode: 'central_api',
        serverLatencyMs: latencyMs,
      },
    };
  }
}

/**
 * Pull full central database snapshot
 */
export async function pullCentralSnapshot(): Promise<SyncResult> {
  try {
    const res = await fetch(`${API_BASE}/sync`, {
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      success: true,
      snapshot: data.snapshot,
      lastUpdated: data.timestamp,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to pull central snapshot',
    };
  }
}

/**
 * Convenience helper to directly fetch the snapshot data
 */
export async function fetchCentralSnapshot() {
  const res = await pullCentralSnapshot();
  if (res.success && res.snapshot) {
    return res.snapshot;
  }
  return null;
}

/**
 * Push local changes / delta and receive merged central snapshot
 */
export async function pushCentralSync(delta: {
  products?: Product[];
  transactions?: Transaction[];
  customers?: CustomerUdhaar[];
  settings?: StoreSettings;
  staff?: StaffAccount[];
  performedBy?: string;
  clientId?: string;
  outletId?: string;
  openingCash?: number;
  openingAmount?: number;
  addedCash?: number;
  addedAmount?: number;
}): Promise<SyncResult> {
  try {
    const res = await fetch(`${API_BASE}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(delta),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      success: true,
      snapshot: data.snapshot,
      lastUpdated: data.lastUpdated,
      changesApplied: data.changesApplied,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Push sync failed',
    };
  }
}

/**
 * Convenience alias for pushCentralSync
 */
export const pushCentralDelta = pushCentralSync;

/**
 * Master Admin: Verify Master Admin PIN credentials
 */
export async function verifyMasterAdminCredentials(pin: string): Promise<{
  authenticated: boolean;
  role?: string;
  staff?: StaffAccount;
  token?: string;
  message?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/master-admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    if (!res.ok || !data.authenticated) {
      return { authenticated: false, message: data.message || 'Authentication failed' };
    }
    return {
      authenticated: true,
      role: data.role,
      staff: data.staff,
      token: data.token,
    };
  } catch (err: any) {
    // Fallback: if server is temporarily unreachable, check master admin pin locally ('nayab@q6')
    if (pin.trim() === 'nayab@q6') {
      return { authenticated: true, role: 'master_admin' };
    }
    return { authenticated: false, message: err.message || 'Authentication error' };
  }
}

/**
 * Master Admin: Save (add or update) product directly in central DB
 */
export async function saveCentralProduct(product: Product, performedBy = 'Master Admin'): Promise<{ success: boolean; product?: Product; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product, performedBy }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { success: true, product: data.product };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Master Admin: Delete product from central DB
 */
export async function deleteCentralProduct(productId: string, performedBy = 'Master Admin'): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/products/${encodeURIComponent(productId)}?performedBy=${encodeURIComponent(performedBy)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Master Admin: Bulk rate adjustment
 */
export async function bulkAdjustCentralRates(params: {
  category?: string;
  percentageChange?: number;
  fixedOffset?: number;
  rounding?: 'integer' | 'half' | 'none';
  actor?: string;
}): Promise<{ success: boolean; count?: number; updatedProducts?: Product[]; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/products/bulk-adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { success: true, count: data.count, updatedProducts: data.updatedProducts };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Master Admin: Void a transaction
 */
export async function voidCentralTransaction(id: string, reason: string, actor = 'Master Admin'): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/transactions/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, reason, actor }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Master Admin: Update staff accounts
 */
export async function updateCentralStaff(staff: StaffAccount[], actor = 'Master Admin'): Promise<{ success: boolean; staff?: StaffAccount[]; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff, actor }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { success: true, staff: data.staff };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Master Admin: Fetch audit logs
 */
export async function fetchCentralAuditLogs(limit = 100): Promise<AuditLogEntry[]> {
  try {
    const res = await fetch(`${API_BASE}/audit-logs?limit=${limit}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Master Admin: Configure Cloud Database (Firebase Firestore / Central REST API)
 */
export async function updateCentralCloudConfig(params: {
  cloudSyncMode?: 'central_api' | 'firebase_firestore' | 'hybrid';
  firebaseConfig?: {
    projectId?: string;
    apiKey?: string;
    firestoreDatabaseId?: string;
    autoSyncToCloud?: boolean;
  };
  actor?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/master-admin/cloud-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Master Admin: Restore Database
 */
export async function restoreCentralDatabase(backupData: any, actor = 'Master Admin'): Promise<SyncResult> {
  try {
    const res = await fetch(`${API_BASE}/master-admin/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backupData, actor }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { success: true, snapshot: data.snapshot };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Master Admin: Factory Reset Database
 */
export async function resetCentralDatabase(confirmPhrase: string, actor = 'Master Admin'): Promise<SyncResult> {
  try {
    const res = await fetch(`${API_BASE}/master-admin/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmPhrase, actor }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { success: true, snapshot: data.snapshot };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Verify Master Admin / Server Owner credentials with central server
 */
export async function verifyCentralMasterAdmin(pin: string, serverIdOrUsername?: string): Promise<{
  authenticated: boolean;
  role?: string;
  staff?: StaffAccount;
  serverId?: string;
  serverAdmin?: string;
  token?: string;
  message?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/master-admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, serverId: serverIdOrUsername, username: serverIdOrUsername }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { authenticated: false, message: err.message || 'Server connection failed' };
  }
}

/**
 * Master Admin: Fetch all store outlets with live operational metrics
 * Enables admin owner to view outlets from anywhere online from another device
 */
export async function fetchCentralOutlets(): Promise<{
  success: boolean;
  outlets?: StoreProfile[];
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/outlets`, {
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { success: true, outlets: data.outlets };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Master Admin: Fetch detailed live data & metrics for a specific outlet
 */
export async function fetchCentralOutletData(outletId: string): Promise<{
  success: boolean;
  outlet?: StoreProfile;
  recentTransactions?: Transaction[];
  customers?: CustomerUdhaar[];
  staff?: StaffAccount[];
  metrics?: any;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/outlets/${encodeURIComponent(outletId)}`, {
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      success: true,
      outlet: data.outlet,
      recentTransactions: data.recentTransactions,
      customers: data.customers,
      staff: data.staff,
      metrics: data.metrics,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Master Admin: Save (create or update) outlet data on central server
 * Enables admin owner to edit outlets from any device online
 */
export async function saveCentralOutlet(
  outlet: Partial<StoreProfile> & { shopName: string },
  performedBy = 'Admin Owner Online'
): Promise<{
  success: boolean;
  outlet?: StoreProfile;
  outlets?: StoreProfile[];
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/outlets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outlet, actor: performedBy }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return {
      success: true,
      outlet: data.outlet,
      outlets: data.outlets,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Master Admin: Delete outlet on central server
 */
export async function deleteCentralOutlet(
  outletId: string,
  performedBy = 'Admin Owner Online'
): Promise<{
  success: boolean;
  remainingOutlets?: StoreProfile[];
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/outlets/${encodeURIComponent(outletId)}?actor=${encodeURIComponent(performedBy)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return { success: true, remainingOutlets: data.remainingOutlets };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Switch active counter outlet POS
 */
export async function switchCentralActiveOutlet(
  outletId: string,
  performedBy = 'Counter User'
): Promise<{ success: boolean; activeStoreId?: string; outlet?: StoreProfile; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/outlets/switch-active`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId, actor: performedBy }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { success: true, activeStoreId: data.activeStoreId, outlet: data.outlet };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Reset daily data (Sales, Expenses, Added cash) of an outlet or all outlets to 0 on the server DB
 */
export async function resetDailyOutletData(
  outletId: string = 'all',
  performedBy = 'Admin / Counter'
): Promise<{ success: boolean; removedCount?: number; outlets?: StoreProfile[]; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/outlets/reset-daily`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId, actor: performedBy }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return {
      success: true,
      removedCount: data.removedTransactionsCount,
      outlets: data.outlets,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Staff Option: Upload outlet data (bills, transactions, udhaar, inventory) to central server database
 */
export async function uploadStaffOutletData(payload: {
  outletId: string;
  outletName?: string;
  products?: Product[];
  transactions?: Transaction[];
  customers?: CustomerUdhaar[];
  staff?: StaffAccount[];
  outlet?: Partial<StoreProfile>;
  uploadedBy?: string;
  role?: string;
  isAutoSync?: boolean;
  openingCash?: number;
  openingAmount?: number;
  addedCash?: number;
  addedAmount?: number;
}): Promise<{
  success: boolean;
  outletId?: string;
  outletName?: string;
  lastUploadedAt?: string;
  summary?: any;
  uploadMeta?: any;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/outlets/${encodeURIComponent(payload.outletId)}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return {
      success: true,
      outletId: data.outletId,
      outletName: data.outletName,
      lastUploadedAt: data.lastUploadedAt,
      summary: data.summary,
      uploadMeta: data.uploadMeta,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Master Admin & Counter: Sync Opening Cash and Added Cash for an Outlet to Database
 */
export async function syncOutletCash(
  outletId: string,
  cashData: {
    openingCash?: number;
    addedCash?: number;
    openingAmount?: number;
    addedAmount?: number;
    mode?: 'set' | 'add';
    actor?: string;
  }
): Promise<{
  success: boolean;
  outletId?: string;
  openingCash?: number;
  addedCash?: number;
  cashInHand?: number;
  outlets?: StoreProfile[];
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/outlets/${encodeURIComponent(outletId)}/cash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cashData),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return {
      success: true,
      outletId: data.outletId,
      openingCash: data.openingCash,
      addedCash: data.addedCash,
      cashInHand: data.cashInHand,
      outlets: data.outlets,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch live cash metrics (opening, added, cashSales, cashInHand) for an outlet from Database
 */
export async function fetchOutletCash(outletId: string): Promise<{
  success: boolean;
  outletId?: string;
  outletName?: string;
  openingCash?: number;
  addedCash?: number;
  cashSales?: number;
  todayExpenses?: number;
  cashInHand?: number;
  date?: string;
  lastUpdated?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/outlets/${encodeURIComponent(outletId)}/cash`, {
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Owner Option: Download structured data package for one or all outlets from central server database
 */
export async function downloadOwnerOutletPackage(outletId?: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const isAll = !outletId || outletId === 'all';
    const endpoint = isAll ? `${API_BASE}/outlets/download-all` : `${API_BASE}/outlets/${encodeURIComponent(outletId)}/download`;
    const res = await fetch(endpoint, {
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Owner Option: Direct browser file download for JSON or CSV format
 */
export function triggerOutletFileDownload(outletId?: string, format: 'json' | 'csv' = 'json') {
  const isAll = !outletId || outletId === 'all';
  const url = isAll
    ? `${API_BASE}/outlets/export-all-file?format=${format}`
    : `${API_BASE}/outlets/${encodeURIComponent(outletId)}/export-file?format=${format}`;
  
  // Use anchor download for seamless file delivery
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Fetch outlet upload metadata and status
 */
export async function fetchOutletUploadMetadata(): Promise<{
  success: boolean;
  metadata?: Record<string, any>;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/outlets/metadata/upload-status`, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { success: true, metadata: data.metadata };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

const LOCAL_SNAPSHOTS_STORAGE_KEY = 'nayab_daily_snapshots_v1';

/**
 * Get all daily snapshots stored in local storage
 */
export function getLocalDailySnapshots(): OutletDailySnapshot[] {
  try {
    const raw = localStorage.getItem(LOCAL_SNAPSHOTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save daily snapshots array to local storage
 */
export function saveLocalDailySnapshots(snapshots: OutletDailySnapshot[]): void {
  try {
    localStorage.setItem(LOCAL_SNAPSHOTS_STORAGE_KEY, JSON.stringify(snapshots));
    window.dispatchEvent(new CustomEvent('nayab_daily_snapshots_updated', { detail: snapshots }));
  } catch (err) {
    console.warn('Failed to save local snapshots to storage:', err);
  }
}

/**
 * Record a daily snapshot in client local storage and sync to central server database.
 * Supports 'accumulate' mode (default) so resetting counters multiple times in a day
 * never discards previous sales/expenses.
 */
export async function recordOutletDailySnapshot(
  snapshot: Partial<OutletDailySnapshot>,
  mode: 'accumulate' | 'absolute' = 'accumulate'
): Promise<OutletDailySnapshot> {
  const todayStr = snapshot.date || new Date().toISOString().slice(0, 10);
  const outletId = snapshot.outletId || 'store-1';
  const id = `${todayStr}_${outletId}`;
  const localList = getLocalDailySnapshots();
  const existingIdx = localList.findIndex((s) => s.id === id || (s.date === todayStr && s.outletId === outletId));

  let finalSnapshot: OutletDailySnapshot;

  if (existingIdx >= 0 && mode === 'accumulate') {
    const existing = localList[existingIdx];
    existing.grossSales = (Number(existing.grossSales) || 0) + (Number(snapshot.grossSales) || 0);
    existing.salesCount = (Number(existing.salesCount) || 0) + (Number(snapshot.salesCount) || 0);
    existing.expenses = (Number(existing.expenses) || 0) + (Number(snapshot.expenses) || 0);
    existing.expenseCount = (Number(existing.expenseCount) || 0) + (Number(snapshot.expenseCount) || 0);
    existing.cashSales = (Number(existing.cashSales) || 0) + (Number(snapshot.cashSales) || 0);
    existing.upiSales = (Number(existing.upiSales) || 0) + (Number(snapshot.upiSales) || 0);
    existing.udhaarSales = (Number(existing.udhaarSales) || 0) + (Number(snapshot.udhaarSales) || 0);
    existing.netProfit = existing.grossSales - existing.expenses;

    existing.openingCash = existing.openingCash || Number(snapshot.openingCash) || 0;
    existing.addedCash = (Number(existing.addedCash) || 0) + (Number(snapshot.addedCash) || 0);
    existing.cashInHand = (existing.openingCash + existing.addedCash + existing.cashSales) - existing.expenses;

    existing.resetsCount = (Number(existing.resetsCount) || 1) + 1;
    existing.lastResetAt = new Date().toISOString();
    if (snapshot.outletName) existing.outletName = snapshot.outletName;

    if (snapshot.archivedTransactions && snapshot.archivedTransactions.length > 0) {
      const existingTxIds = new Set((existing.archivedTransactions || []).map((t) => t.id));
      const newTxs = snapshot.archivedTransactions.filter((t) => !existingTxIds.has(t.id));
      existing.archivedTransactions = [...(existing.archivedTransactions || []), ...newTxs];
    }

    localList[existingIdx] = existing;
    finalSnapshot = existing;
  } else if (existingIdx >= 0 && mode === 'absolute') {
    const updated: OutletDailySnapshot = {
      ...localList[existingIdx],
      ...snapshot,
      id,
      date: todayStr,
      outletId,
      outletName: snapshot.outletName || localList[existingIdx].outletName || outletId,
      lastResetAt: new Date().toISOString(),
    } as OutletDailySnapshot;
    localList[existingIdx] = updated;
    finalSnapshot = updated;
  } else {
    finalSnapshot = {
      id,
      date: todayStr,
      outletId,
      outletName: snapshot.outletName || (outletId === 'store-1' ? 'sy Nayab' : outletId === 'store-2' ? 'kp Nayab' : outletId),
      grossSales: Number(snapshot.grossSales) || 0,
      salesCount: Number(snapshot.salesCount) || 0,
      expenses: Number(snapshot.expenses) || 0,
      expenseCount: Number(snapshot.expenseCount) || 0,
      cashSales: Number(snapshot.cashSales) || 0,
      upiSales: Number(snapshot.upiSales) || 0,
      udhaarSales: Number(snapshot.udhaarSales) || 0,
      netProfit: (Number(snapshot.grossSales) || 0) - (Number(snapshot.expenses) || 0),
      openingCash: Number(snapshot.openingCash) || 0,
      addedCash: Number(snapshot.addedCash) || 0,
      cashInHand: ((Number(snapshot.openingCash) || 0) + (Number(snapshot.addedCash) || 0) + (Number(snapshot.cashSales) || 0)) - (Number(snapshot.expenses) || 0),
      lastResetAt: new Date().toISOString(),
      resetsCount: 1,
      archivedTransactions: snapshot.archivedTransactions || [],
    };
    localList.push(finalSnapshot);
  }

  saveLocalDailySnapshots(localList);

  // Sync to central server database asynchronously
  fetch(`${API_BASE}/daily-snapshots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ snapshot: finalSnapshot, mode: 'absolute' }),
  }).catch((err) => {
    console.warn('Central server daily snapshot sync note:', err);
  });

  return finalSnapshot;
}

/**
 * Fetch daily snapshots from server database (with local fallback)
 */
export async function fetchOutletDailySnapshots(params?: {
  from?: string;
  to?: string;
  outletId?: string;
}): Promise<{ success: boolean; snapshots: OutletDailySnapshot[]; error?: string }> {
  try {
    const query = new URLSearchParams();
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.outletId) query.set('outletId', params.outletId);

    const res = await fetch(`${API_BASE}/daily-snapshots?${query.toString()}`, {
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.snapshots)) {
        // Merge with local storage
        const local = getLocalDailySnapshots();
        const serverMap = new Map<string, OutletDailySnapshot>(data.snapshots.map((s: OutletDailySnapshot) => [s.id, s]));
        
        // Merge local non-synced into map
        for (const loc of local) {
          if (!serverMap.has(loc.id)) {
            serverMap.set(loc.id, loc);
          } else {
            // Pick highest gross sales or accumulated resets
            const serv = serverMap.get(loc.id)!;
            if ((loc.resetsCount || 0) > (serv.resetsCount || 0) || (loc.grossSales || 0) > (serv.grossSales || 0)) {
              serverMap.set(loc.id, { ...serv, ...loc });
            }
          }
        }

        const merged = Array.from(serverMap.values()).sort((a, b) => b.date.localeCompare(a.date));
        saveLocalDailySnapshots(merged);
        return { success: true, snapshots: merged };
      }
    }
  } catch (err: any) {
    console.warn('Fetch remote daily snapshots fallback to local:', err.message);
  }

  // Fallback to local snapshots
  let localSnaps = getLocalDailySnapshots();
  if (params?.outletId && params.outletId !== 'all') {
    localSnaps = localSnaps.filter((s) => s.outletId === params.outletId);
  }
  if (params?.from) {
    localSnaps = localSnaps.filter((s) => s.date >= params.from!);
  }
  if (params?.to) {
    localSnaps = localSnaps.filter((s) => s.date <= params.to!);
  }
  return { success: true, snapshots: localSnaps.sort((a, b) => b.date.localeCompare(a.date)) };
}


