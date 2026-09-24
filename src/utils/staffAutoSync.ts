import { useEffect, useState, useRef, useCallback } from 'react';
import { Transaction, CustomerUdhaar, Product, StoreSettings, StaffAccount, StoreProfile, StaffAutoSyncStatus } from '../types';
import { uploadStaffOutletData } from './centralSync';
import { uploadOutletDataToFirestore } from '../firebase';

// Global singleton state for staff automatic sync
class StaffAutoSyncManager {
  private status: StaffAutoSyncStatus = {
    isAutoSyncEnabled: true,
    isSyncing: false,
    lastSyncTimestamp: undefined,
    lastSyncSuccess: true,
    lastSyncError: undefined,
    syncedBillsCount: 0,
    syncedCustomersCount: 0,
    syncedProductsCount: 0,
    lastUploadedBy: undefined,
    targetOutletId: undefined,
    targetOutletName: undefined,
  };

  private listeners = new Set<(status: StaffAutoSyncStatus) => void>();
  private debounceTimer: any = null;
  private intervalTimer: any = null;
  private isProcessing = false;
  private pendingPayload: any = null;

  constructor() {
    try {
      const savedPref = localStorage.getItem('nayab_staff_auto_sync_enabled');
      if (savedPref !== null) {
        this.status.isAutoSyncEnabled = savedPref === 'true';
      }
      const savedLast = localStorage.getItem('nayab_staff_last_auto_sync');
      if (savedLast) {
        this.status.lastSyncTimestamp = savedLast;
      }
    } catch {}
  }

  public getStatus(): StaffAutoSyncStatus {
    return { ...this.status };
  }

  public subscribe(listener: (status: StaffAutoSyncStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const current = this.getStatus();
    this.listeners.forEach((listener) => {
      try {
        listener(current);
      } catch (err) {
        console.warn('Listener error in StaffAutoSyncManager:', err);
      }
    });
  }

  public setAutoSyncEnabled(enabled: boolean) {
    this.status.isAutoSyncEnabled = enabled;
    try {
      localStorage.setItem('nayab_staff_auto_sync_enabled', String(enabled));
    } catch {}
    this.notify();
  }

  /**
   * Request automatic sync with debouncing to prevent thrashing on rapid barcode/item entry
   */
  public queueSync(
    payload: {
      outletId: string;
      outletName?: string;
      products?: Product[];
      transactions?: Transaction[];
      customers?: CustomerUdhaar[];
      staff?: StaffAccount[];
      outlet?: Partial<StoreProfile>;
      uploadedBy?: string;
      role?: string;
      openingCash?: number;
      openingAmount?: number;
      addedCash?: number;
      addedAmount?: number;
    },
    options?: { immediate?: boolean; delayMs?: number }
  ) {
    if (!this.status.isAutoSyncEnabled) {
      return;
    }

    this.pendingPayload = payload;
    const delay = options?.immediate ? 50 : (options?.delayMs ?? 600);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.executeSync();
    }, delay);
  }

  /**
   * Immediately trigger synchronization
   */
  public async executeSync(): Promise<boolean> {
    if (!this.pendingPayload) {
      return false;
    }

    if (this.isProcessing) {
      // Re-queue execution after current sync finishes
      if (!this.debounceTimer) {
        this.debounceTimer = setTimeout(() => this.executeSync(), 800);
      }
      return false;
    }

    const payload = this.pendingPayload;
    this.pendingPayload = null;

    this.isProcessing = true;
    this.status.isSyncing = true;
    this.status.targetOutletId = payload.outletId;
    this.status.targetOutletName = payload.outletName;
    this.status.lastUploadedBy = payload.uploadedBy || 'Staff';
    this.notify();

    try {
      // 1. Upload to Express Central Database
      const serverPromise = uploadStaffOutletData({
        ...payload,
        isAutoSync: true,
      });

      // 2. Upload to Cloud Firestore in parallel
      const firestorePromise = uploadOutletDataToFirestore(
        payload.outletId,
        {
          transactions: payload.transactions,
          customers: payload.customers,
          outlet: payload.outlet,
        },
        payload.uploadedBy || 'Staff Auto-Sync'
      ).catch((fsErr) => {
        console.warn('Firestore background auto-sync warning:', fsErr);
      });

      // Await server upload (with timeout fallback)
      const serverResult = await Promise.race([
        serverPromise,
        new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error('Sync timeout')), 9000)
        ),
      ]).catch((err) => {
        return { success: false, error: err.message };
      });

      await firestorePromise;

      const nowIso = new Date().toISOString();
      const success = serverResult.success;

      this.status.isSyncing = false;
      this.status.lastSyncSuccess = success;
      this.status.lastSyncTimestamp = nowIso;
      this.status.lastSyncError = success ? undefined : (serverResult.error || 'Server sync error');
      this.status.syncedBillsCount = Array.isArray(payload.transactions) ? payload.transactions.length : 0;
      this.status.syncedCustomersCount = Array.isArray(payload.customers) ? payload.customers.length : 0;
      this.status.syncedProductsCount = Array.isArray(payload.products) ? payload.products.length : 0;

      try {
        localStorage.setItem('nayab_staff_last_auto_sync', nowIso);
      } catch {}

      this.notify();
      return success;
    } catch (err: any) {
      this.status.isSyncing = false;
      this.status.lastSyncSuccess = false;
      this.status.lastSyncError = err.message || 'Auto-sync exception';
      this.notify();
      return false;
    } finally {
      this.isProcessing = false;
      // If new payload came while processing, sync again
      if (this.pendingPayload) {
        setTimeout(() => this.executeSync(), 500);
      }
    }
  }
}

export const staffAutoSyncManager = new StaffAutoSyncManager();

/**
 * React hook to access and control staff automatic data synchronization
 */
export function useStaffAutoSync() {
  const [syncStatus, setSyncStatus] = useState<StaffAutoSyncStatus>(() =>
    staffAutoSyncManager.getStatus()
  );

  useEffect(() => {
    return staffAutoSyncManager.subscribe((newStatus) => {
      setSyncStatus(newStatus);
    });
  }, []);

  const triggerSync = useCallback(
    (
      payload: {
        outletId: string;
        outletName?: string;
        products?: Product[];
        transactions?: Transaction[];
        customers?: CustomerUdhaar[];
        staff?: StaffAccount[];
        outlet?: Partial<StoreProfile>;
        uploadedBy?: string;
        role?: string;
        openingCash?: number;
        openingAmount?: number;
        addedCash?: number;
        addedAmount?: number;
      },
      options?: { immediate?: boolean; delayMs?: number }
    ) => {
      staffAutoSyncManager.queueSync(payload, options);
    },
    []
  );

  const setAutoSyncEnabled = useCallback((enabled: boolean) => {
    staffAutoSyncManager.setAutoSyncEnabled(enabled);
  }, []);

  const syncNow = useCallback(async () => {
    return staffAutoSyncManager.executeSync();
  }, []);

  return {
    syncStatus,
    triggerSync,
    setAutoSyncEnabled,
    syncNow,
  };
}
