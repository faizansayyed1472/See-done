import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  setLogLevel,
  doc,
  getDoc,
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Product, Transaction, CustomerUdhaar, StaffAccount, AuditLogEntry, StoreProfile } from './types';

// Set Firestore log level to silent to suppress non-fatal connection retry notices and offline warnings in iframe/sandboxed environments
try {
  setLogLevel('silent');
} catch {
  // Ignore if unsupported in current runtime
}

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore using the standard Firestore database instance
export const db: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Auth
export const auth = getAuth(app);

// Error Handling Infrastructure conforming to Skill specification
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validates connection to Firestore server gracefully without throwing unhandled exceptions
 */
export async function testFirestoreConnection(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 4000)
    );
    await Promise.race([
      getDoc(doc(db, 'test', 'connection')),
      timeoutPromise,
    ]);
    return true;
  } catch {
    // Offline, timeout, or unreachable - graceful fallback
    return false;
  }
}

/**
 * Recursively removes all undefined and null properties from an object or array,
 * preventing "Unsupported field value: undefined" errors in Firestore setDoc
 * and ensuring values adhere to strict Firestore types.
 */
export function sanitizeForFirestore<T>(input: T): T {
  if (input === null || input === undefined) {
    return null as any;
  }
  if (Array.isArray(input)) {
    return input
      .filter((item) => item !== undefined && item !== null)
      .map((item) => sanitizeForFirestore(item)) as any;
  }
  if (typeof input === 'object' && !(input instanceof Date)) {
    const output: Record<string, any> = {};
    for (const [key, val] of Object.entries(input)) {
      if (val !== undefined && val !== null) {
        if (typeof val === 'number' && isNaN(val)) {
          continue;
        }
        output[key] = sanitizeForFirestore(val);
      }
    }
    return output as any;
  }
  return input;
}

/**
 * Upload local batch of items to Firestore
 */
export async function syncCatalogToFirestore(products: Product[]): Promise<number> {
  let count = 0;
  for (const product of products) {
    try {
      const pDoc = doc(db, 'products', product.id);
      const sanitized = sanitizeForFirestore({
        ...product,
        updatedAt: product.updatedAt || new Date().toISOString(),
      });
      await setDoc(pDoc, sanitized, { merge: true });
      count++;
    } catch (err) {
      console.warn(`Error writing product ${product.id} to Firestore:`, err);
    }
  }
  return count;
}

/**
 * Save or update single product in Firestore
 */
export async function syncProductToFirestore(product: Product): Promise<void> {
  try {
    const pDoc = doc(db, 'products', product.id);
    const sanitized = sanitizeForFirestore({
      ...product,
      updatedAt: product.updatedAt || new Date().toISOString(),
    });
    await setDoc(pDoc, sanitized, { merge: true });
  } catch (err) {
    console.warn(`Error writing product ${product.id} to Firestore:`, err);
  }
}

/**
 * Delete product from Firestore
 */
export async function deleteProductFromFirestore(productId: string): Promise<void> {
  try {
    const pDoc = doc(db, 'products', productId);
    await deleteDoc(pDoc);
  } catch (err) {
    console.warn(`Error deleting product ${productId} from Firestore:`, err);
  }
}

/**
 * Upload transaction to Firestore with schema normalization
 */
export async function recordTransactionInFirestore(transaction: Transaction): Promise<void> {
  const txId = transaction.id || `tx-${Date.now()}`;
  try {
    const tDoc = doc(db, 'transactions', txId);
    const preparedTx: Transaction = {
      ...transaction,
      id: txId,
      receiptNumber: transaction.receiptNumber || `NB-${Date.now().toString().slice(-6)}`,
      type: transaction.type === 'expense' ? 'expense' : 'sale',
      amount: typeof transaction.amount === 'number' && !isNaN(transaction.amount) ? Math.max(0, transaction.amount) : 0,
      paymentMode: transaction.paymentMode || 'cash',
      timestamp: transaction.timestamp || new Date().toISOString(),
      storeId: transaction.storeId || transaction.outletId || 'store-1',
      outletId: transaction.outletId || transaction.storeId || 'store-1',
      outletName: transaction.outletName || transaction.storeName,
    };
    const sanitized = sanitizeForFirestore(preparedTx);
    await setDoc(tDoc, sanitized, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `transactions/${txId}`);
  }
}

/**
 * Sync customer ledger account to Firestore
 */
export async function syncCustomerToFirestore(customer: CustomerUdhaar): Promise<void> {
  try {
    const cDoc = doc(db, 'customers', customer.id);
    const sanitized = sanitizeForFirestore(customer);
    await setDoc(cDoc, sanitized, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `customers/${customer.id}`);
  }
}

/**
 * Sync staff account to Firestore
 */
export async function syncStaffToFirestore(staff: StaffAccount): Promise<void> {
  try {
    const sDoc = doc(db, 'staff', staff.id);
    const sanitized = sanitizeForFirestore(staff);
    await setDoc(sDoc, sanitized, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `staff/${staff.id}`);
  }
}

/**
 * Record audit log entry in Firestore
 */
export async function recordAuditLogInFirestore(entry: AuditLogEntry): Promise<void> {
  try {
    const aDoc = doc(db, 'auditLogs', entry.id);
    const sanitized = sanitizeForFirestore(entry);
    await setDoc(aDoc, sanitized, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `auditLogs/${entry.id}`);
  }
}

/**
 * Fetch all products directly from Firestore
 */
export async function fetchProductsFromFirestore(): Promise<Product[]> {
  try {
    const snap = await getDocs(collection(db, 'products'));
    return snap.docs.map((d) => d.data() as Product);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'products');
  }
}

/**
 * Fetch all transactions directly from Firestore
 */
export async function fetchTransactionsFromFirestore(): Promise<Transaction[]> {
  try {
    const snap = await getDocs(collection(db, 'transactions'));
    return snap.docs.map((d) => d.data() as Transaction);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'transactions');
  }
}

/**
 * Fetch all customers from Firestore
 */
export async function fetchCustomersFromFirestore(): Promise<CustomerUdhaar[]> {
  try {
    const snap = await getDocs(collection(db, 'customers'));
    return snap.docs.map((d) => d.data() as CustomerUdhaar);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'customers');
  }
}

/**
 * Sync single store outlet to Firestore so server admin can view it online from anywhere
 */
export async function syncOutletToFirestore(outlet: StoreProfile): Promise<void> {
  const outletId = outlet.id || `store-${Date.now()}`;
  try {
    const oDoc = doc(db, 'outlets', outletId);
    const preparedOutlet: StoreProfile = {
      ...outlet,
      id: outletId,
      shopName: outlet.shopName || 'Store Outlet',
      phone: outlet.phone || '9876543210',
      address: outlet.address || 'Retail Outlet',
      defaultTaxRate: typeof outlet.defaultTaxRate === 'number' ? outlet.defaultTaxRate : 0,
      createdAt: outlet.createdAt || new Date().toISOString(),
      isDefault: Boolean(outlet.isDefault),
      isPrimary: Boolean(outlet.isPrimary),
    };
    const sanitized = sanitizeForFirestore(preparedOutlet);
    await setDoc(oDoc, sanitized, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `outlets/${outletId}`);
  }
}

/**
 * Sync outlet cash balance (opening amount & added cash) to Firestore
 */
export async function syncOutletCashToFirestore(
  outletId: string,
  cashData: {
    openingCash?: number;
    addedCash?: number;
    cashInHand?: number;
    todaySales?: number;
    todayExpenses?: number;
    date?: string;
  }
): Promise<void> {
  try {
    const oDoc = doc(db, 'outlets', outletId);
    const dataToMerge = sanitizeForFirestore({
      ...cashData,
      lastCashSyncAt: new Date().toISOString(),
    });
    await setDoc(oDoc, dataToMerge, { merge: true });
  } catch (err) {
    console.warn(`Firestore cash sync note for ${outletId}:`, err);
  }
}

/**
 * Sync multiple store outlets to Firestore
 */
export async function syncOutletsToFirestore(outlets: StoreProfile[]): Promise<number> {
  let count = 0;
  for (const outlet of outlets) {
    try {
      await syncOutletToFirestore(outlet);
      count++;
    } catch (err) {
      console.warn(`Error writing outlet ${outlet.id} to Firestore:`, err);
    }
  }
  return count;
}

/**
 * Delete store outlet from Firestore
 */
export async function deleteOutletFromFirestore(outletId: string): Promise<void> {
  try {
    const oDoc = doc(db, 'outlets', outletId);
    await deleteDoc(oDoc);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `outlets/${outletId}`);
  }
}

/**
 * Fetch all outlets directly from Firestore so server admin can view from anywhere online
 */
export async function fetchOutletsFromFirestore(): Promise<StoreProfile[]> {
  try {
    const snap = await getDocs(collection(db, 'outlets'));
    return snap.docs.map((d) => d.data() as StoreProfile);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'outlets');
  }
}

/**
 * Real-time listener for outlets in Firestore
 */
export function listenToOutletsFromFirestore(callback: (outlets: StoreProfile[]) => void): () => void {
  try {
    const unsub = onSnapshot(collection(db, 'outlets'), (snap) => {
      const outlets = snap.docs.map((d) => d.data() as StoreProfile);
      callback(outlets);
    }, (err) => {
      console.warn('Real-time listener for outlets failed:', err);
    });
    return unsub;
  } catch (err) {
    console.warn('Could not establish real-time listener for outlets:', err);
    return () => {};
  }
}

/**
 * Upload complete outlet dataset to Firestore (transactions, customers, outlet metadata)
 */
export async function uploadOutletDataToFirestore(
  outletId: string,
  data: {
    transactions?: Transaction[];
    customers?: CustomerUdhaar[];
    outlet?: Partial<StoreProfile>;
  },
  uploadedBy = 'Branch Staff'
): Promise<void> {
  try {
    // 1. Sync outlet profile document if provided
    if (data.outlet && data.outlet.shopName) {
      await syncOutletToFirestore({
        ...data.outlet,
        id: outletId,
        shopName: data.outlet.shopName,
        phone: data.outlet.phone || '9876543210',
        address: data.outlet.address || 'Nayab Store Counter',
        defaultTaxRate: data.outlet.defaultTaxRate || 0,
      } as StoreProfile);
    }

    // 2. Batch write recent transactions tagged with outletId
    if (Array.isArray(data.transactions) && data.transactions.length > 0) {
      // Sync up to 50 most recent to Firestore
      for (const tx of data.transactions.slice(-50)) {
        if (!tx.id) continue;
        const txDoc = doc(db, 'transactions', tx.id);
        const cleanTx = sanitizeForFirestore({
          ...tx,
          outletId,
          storeId: outletId,
        });
        await setDoc(txDoc, cleanTx, { merge: true });
      }
    }

    // 3. Batch write customers belonging to this outlet
    if (Array.isArray(data.customers) && data.customers.length > 0) {
      for (const cust of data.customers) {
        if (!cust.id) continue;
        const custDoc = doc(db, 'customers', cust.id);
        const cleanCust = sanitizeForFirestore({
          ...cust,
          outletId,
          storeId: outletId,
        });
        await setDoc(custDoc, cleanCust, { merge: true });
      }
    }

    // 4. Audit Log
    const logId = `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const logDoc = doc(db, 'auditLogs', logId);
    await setDoc(
      logDoc,
      sanitizeForFirestore({
        id: logId,
        timestamp: new Date().toISOString(),
        action: 'STAFF_OUTLET_UPLOAD',
        entity: 'database',
        details: `Staff ${uploadedBy} uploaded outlet data for ${outletId}: ${(data.transactions || []).length} bills, ${(data.customers || []).length} customers`,
        performedBy: uploadedBy,
      })
    );
  } catch (err) {
    console.warn('Firestore outlet upload warning:', err);
    // Non-fatal, central server already holds data
  }
}


