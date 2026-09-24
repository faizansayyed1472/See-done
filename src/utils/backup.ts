import { FullBackupData, Product, Transaction, CustomerUdhaar, StoreSettings, MarketCreditEntry } from '../types';

/**
 * Compiles all store data into a standard FullBackupData structure
 */
export function createFullBackupData(
  products: Product[],
  transactions: Transaction[],
  customers: CustomerUdhaar[],
  storeSettings: StoreSettings,
  cashFlow?: { openingAmount: number; addedAmount: number },
  marketCredits?: MarketCreditEntry[]
): FullBackupData {
  const totalUdhaarDue = customers.reduce((sum, c) => sum + (c.totalDue || 0), 0);
  const totalMarketCreditBaaki = (marketCredits || []).reduce((sum, mc) => sum + (mc.remainingBaaki || 0), 0);

  return {
    version: '1.0',
    appName: 'NAYAB Smart Calculator & Kirana POS',
    backupTimestamp: new Date().toISOString(),
    storeName: storeSettings.shopName || 'sy Nayab',
    summary: {
      totalProducts: products.length,
      totalTransactions: transactions.length,
      totalCustomers: customers.length,
      totalUdhaarDue: Math.round(totalUdhaarDue * 100) / 100,
      totalMarketCreditBaaki: Math.round(totalMarketCreditBaaki * 100) / 100,
    },
    data: {
      products,
      transactions,
      customers,
      marketCredits,
      storeSettings,
      cashFlow,
    },
  };
}

/**
 * Triggers a browser file download of the full backup JSON
 */
export function downloadBackupAsJson(backupData: FullBackupData, customFileName?: string): string {
  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const cleanStoreName = (backupData.storeName || 'Store')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
  const fileName = customFileName || `${cleanStoreName}_Full_Backup_${dateStr}_${timeStr}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  // Store metadata of last successful backup
  try {
    localStorage.setItem('nayab_last_backup_timestamp', now.toISOString());
    localStorage.setItem('nayab_last_backup_filename', fileName);
    // Keep a snapshot in local storage
    localStorage.setItem('nayab_auto_backup_latest', jsonString);
  } catch (err) {
    console.warn('Could not cache backup in localStorage:', err);
  }

  return fileName;
}

/**
 * Saves an automated backup snapshot locally in browser storage
 */
export function saveAutoBackupSnapshot(backupData: FullBackupData): { timestamp: string; sizeKb: number } {
  const jsonString = JSON.stringify(backupData);
  const timestamp = new Date().toISOString();
  const sizeKb = Math.round((jsonString.length / 1024) * 10) / 10;

  try {
    localStorage.setItem('nayab_auto_backup_latest', jsonString);
    localStorage.setItem('nayab_last_auto_backup_time', timestamp);

    // Save history of recent 5 snapshots metadata
    const historyJson = localStorage.getItem('nayab_backup_snapshots_meta') || localStorage.getItem('tohands_backup_snapshots_meta');
    const history: Array<{ timestamp: string; sizeKb: number; countProducts: number; countTx: number }> = historyJson
      ? JSON.parse(historyJson)
      : [];

    const newEntry = {
      timestamp,
      sizeKb,
      countProducts: backupData.summary.totalProducts,
      countTx: backupData.summary.totalTransactions,
    };

    const updatedHistory = [newEntry, ...history.filter((h) => h.timestamp !== timestamp)].slice(0, 5);
    localStorage.setItem('nayab_backup_snapshots_meta', JSON.stringify(updatedHistory));
  } catch (err) {
    console.warn('Failed saving auto backup snapshot to localStorage:', err);
  }

  return { timestamp, sizeKb };
}

/**
 * Validates and parses uploaded backup JSON file content
 */
export function validateBackupJson(rawText: string): {
  isValid: boolean;
  error?: string;
  data?: FullBackupData;
} {
  try {
    const parsed = JSON.parse(rawText);

    if (!parsed || typeof parsed !== 'object') {
      return { isValid: false, error: 'Uploaded file is not a valid JSON object.' };
    }

    // Support both standardized FullBackupData format and raw data exports
    let products = parsed.data?.products || parsed.products;
    let transactions = parsed.data?.transactions || parsed.transactions;
    let customers = parsed.data?.customers || parsed.customers;
    let storeSettings = parsed.data?.storeSettings || parsed.storeSettings;
    let cashFlow = parsed.data?.cashFlow || parsed.cashFlow;

    if (!Array.isArray(products) && !Array.isArray(transactions) && !Array.isArray(customers)) {
      return {
        isValid: false,
        error: 'JSON file does not contain inventory, transactions, or customer records.',
      };
    }

    const backupData: FullBackupData = {
      version: parsed.version || '1.0',
      appName: parsed.appName || 'NAYAB Smart Calculator & Kirana POS',
      backupTimestamp: parsed.backupTimestamp || new Date().toISOString(),
      storeName: parsed.storeName || storeSettings?.shopName || 'Restored Store',
      summary: {
        totalProducts: Array.isArray(products) ? products.length : 0,
        totalTransactions: Array.isArray(transactions) ? transactions.length : 0,
        totalCustomers: Array.isArray(customers) ? customers.length : 0,
        totalUdhaarDue: Array.isArray(customers)
          ? customers.reduce((acc: number, c: any) => acc + (Number(c.totalDue) || 0), 0)
          : 0,
      },
      data: {
        products: Array.isArray(products) ? products : [],
        transactions: Array.isArray(transactions) ? transactions : [],
        customers: Array.isArray(customers) ? customers : [],
        storeSettings: storeSettings || undefined,
        cashFlow: cashFlow || undefined,
      },
    };

    return { isValid: true, data: backupData };
  } catch (err: any) {
    return { isValid: false, error: `Invalid JSON syntax: ${err.message || 'Corrupted file'}` };
  }
}
