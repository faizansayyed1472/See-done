import { MarketCreditEntry, Transaction, StoreSettings, Product } from '../types';

/**
 * Escapes a cell value for Excel CSV compliance
 */
function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Exports all Credit in Market entries to an Excel-compatible CSV with UTF-8 BOM
 */
export function exportMarketCreditsToExcel(
  entries: MarketCreditEntry[],
  shopName = 'sy Nayab',
  outletFilter = 'all'
): void {
  const filtered = outletFilter === 'all' ? entries : entries.filter((e) => e.outletId === outletFilter);

  const totalBill = filtered.reduce((s, e) => s + (e.totalAmount || 0), 0);
  const totalBaaki = filtered.reduce((s, e) => s + (e.remainingBaaki || 0), 0);
  const totalJama = Math.max(0, Math.round((totalBill - totalBaaki) * 100) / 100);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const rows: string[][] = [
    [`${shopName} - CREDIT IN MARKET (माल बाक़ी / SUPPLIER UDHAAR LEDGER)`],
    [`Generated On: ${dateStr} at ${timeStr}`, `Outlet Filter: ${outletFilter === 'all' ? 'All Outlets' : outletFilter}`],
    [`Total Bills: ${filtered.length}`, `Total Purchases: Rs. ${totalBill}`, `Total Jama Done: Rs. ${totalJama}`, `Total Baaki Due: Rs. ${totalBaaki}`],
    [], // Blank separator row
    [
      'S.No.',
      'Supplier / Party Name (सप्लायर)',
      'Phone Number (मोबाइल)',
      'Outlet (दुकान)',
      'Date & Time (तारीख़ व समय)',
      'Payment Due Date (अंतिम तारीख़)',
      'Deadline Warning (डेडलाइन अलर्ट)',
      'Goods Taken on Credit (सामान का विवरण)',
      'Total Bill Amount (कुल बिल ₹)',
      'Initial Jama on Day (दिन का जमा ₹)',
      'Subsequent Jama (बाद का जमा ₹)',
      'Total Jama Done (कुल जमा ₹)',
      'Remaining Baaki (बाक़ी देना है ₹)',
      'Status (स्थिति)',
      'Bill Image (बिल फोटो)',
      'Voice Note (आवाज़ नोट)',
      'Recorded By (दर्जकर्ता)',
      'Notes / Remarks (रिमार्क)',
    ],
  ];

  filtered.forEach((entry, idx) => {
    const subsequentPayments = (entry.paymentsHistory || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const dayJama = entry.paidOnDay || 0;
    const totalJamaForBill = Math.max(0, Math.round((entry.totalAmount - entry.remainingBaaki) * 100) / 100);

    const formattedDate = new Date(entry.timestamp).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    let deadlineWarning = '-';
    if (entry.status !== 'cleared' && (entry.remainingBaaki || 0) > 0 && entry.dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [y, m, d] = entry.dueDate.split('-').map(Number);
      const due = new Date(y, m - 1, d);
      due.setHours(0, 0, 0, 0);
      const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        deadlineWarning = `OVERDUE by ${Math.abs(diffDays)} days!`;
      } else if (diffDays === 0) {
        deadlineWarning = 'DUE TODAY!';
      } else if (diffDays <= 3) {
        deadlineWarning = `WARNING: DUE IN ${diffDays} DAYS`;
      } else {
        deadlineWarning = `Due in ${diffDays} days`;
      }
    }

    rows.push([
      String(idx + 1),
      entry.supplierName || 'Unknown Supplier',
      entry.supplierPhone || '-',
      entry.outletName || 'sy Nayab',
      formattedDate,
      entry.dueDate || 'No Due Date',
      deadlineWarning,
      entry.goodsDescription || '-',
      String(entry.totalAmount || 0),
      String(dayJama),
      String(subsequentPayments),
      String(totalJamaForBill),
      String(entry.remainingBaaki || 0),
      entry.remainingBaaki <= 0 ? 'CLEARED (चुकता)' : 'PENDING (बाक़ी)',
      entry.billImageUrl ? 'YES (Attached)' : 'NO',
      entry.voiceNoteUrl ? `YES (${entry.voiceNoteDurationSeconds || 15}s Note)` : 'NO',
      entry.recordedBy || 'Admin',
      entry.notes || '-',
    ]);
  });

  // Grand Total row
  rows.push([]);
  rows.push([
    'TOTAL',
    `Suppliers: ${new Set(filtered.map((e) => e.supplierName)).size}`,
    '',
    '',
    '',
    '',
    '',
    `Total Bills: ${filtered.length}`,
    String(totalBill),
    '',
    '',
    String(totalJama),
    String(totalBaaki),
    totalBaaki <= 0 ? 'ALL CLEARED' : 'PENDING DUES',
    '',
    '',
    '',
    '',
  ]);

  const csvContent = '\uFEFF' + rows.map((r) => r.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const isoDate = now.toISOString().slice(0, 10);
  link.download = `${shopName.replace(/\s+/g, '_')}_Credit_In_Market_Ledger_${isoDate}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports a specific supplier's recurring credit bills statement to Excel
 */
export function exportSupplierStatementToExcel(
  supplierName: string,
  entries: MarketCreditEntry[],
  shopName = 'sy Nayab'
): void {
  const supplierEntries = entries.filter(
    (e) => e.supplierName.trim().toLowerCase() === supplierName.trim().toLowerCase()
  );

  const totalBill = supplierEntries.reduce((s, e) => s + (e.totalAmount || 0), 0);
  const totalBaaki = supplierEntries.reduce((s, e) => s + (e.remainingBaaki || 0), 0);
  const totalJama = Math.max(0, Math.round((totalBill - totalBaaki) * 100) / 100);
  const supplierPhone = supplierEntries.find((e) => e.supplierPhone)?.supplierPhone || '-';

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const rows: string[][] = [
    [`${shopName} - SUPPLIER STATEMENT (सप्लायर खाता विवरण)`],
    [`Supplier: ${supplierName}`, `Phone: ${supplierPhone}`, `Statement Date: ${dateStr} ${timeStr}`],
    [`Total Bills: ${supplierEntries.length}`, `Total Purchases: Rs. ${totalBill}`, `Total Jama Done: Rs. ${totalJama}`, `Net Balance Due (Baaki): Rs. ${totalBaaki}`],
    [],
    [
      'Bill No.',
      'Date & Time (तारीख़ व समय)',
      'Payment Due Date (अंतिम तारीख़)',
      'Deadline Alert (डेडलाइन)',
      'Goods Description (सामान का विवरण)',
      'Outlet (दुकान)',
      'Bill Amount (कुल बिल ₹)',
      'Day Jama (दिन का जमा ₹)',
      'Subsequent Jama (बाद का जमा ₹)',
      'Total Jama Done (कुल जमा ₹)',
      'Remaining Baaki (बाक़ी ₹)',
      'Status (स्थिति)',
      'Bill Image',
      'Voice Note',
      'Notes / Remarks',
    ],
  ];

  supplierEntries.forEach((entry, idx) => {
    const subsequentPayments = (entry.paymentsHistory || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const dayJama = entry.paidOnDay || 0;
    const totalJamaForBill = Math.max(0, Math.round((entry.totalAmount - entry.remainingBaaki) * 100) / 100);

    const formattedDate = new Date(entry.timestamp).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    let deadlineWarning = '-';
    if (entry.status !== 'cleared' && (entry.remainingBaaki || 0) > 0 && entry.dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [y, m, d] = entry.dueDate.split('-').map(Number);
      const due = new Date(y, m - 1, d);
      due.setHours(0, 0, 0, 0);
      const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        deadlineWarning = `OVERDUE (${Math.abs(diffDays)}d)`;
      } else if (diffDays === 0) {
        deadlineWarning = 'DUE TODAY!';
      } else if (diffDays <= 3) {
        deadlineWarning = `DUE IN ${diffDays} DAYS`;
      } else {
        deadlineWarning = `Due in ${diffDays}d`;
      }
    }

    rows.push([
      `#${idx + 1}`,
      formattedDate,
      entry.dueDate || '-',
      deadlineWarning,
      entry.goodsDescription || '-',
      entry.outletName || 'sy Nayab',
      String(entry.totalAmount || 0),
      String(dayJama),
      String(subsequentPayments),
      String(totalJamaForBill),
      String(entry.remainingBaaki || 0),
      entry.remainingBaaki <= 0 ? 'CLEARED' : 'PENDING',
      entry.billImageUrl ? 'YES' : 'NO',
      entry.voiceNoteUrl ? 'YES' : 'NO',
      entry.notes || '-',
    ]);
  });

  // Grand Total row
  rows.push([]);
  rows.push([
    'TOTAL',
    '',
    '',
    '',
    `Bills: ${supplierEntries.length}`,
    '',
    String(totalBill),
    '',
    '',
    String(totalJama),
    String(totalBaaki),
    totalBaaki <= 0 ? 'ALL CLEARED' : 'BALANCE DUE',
    '',
    '',
    '',
  ]);

  const csvContent = '\uFEFF' + rows.map((r) => r.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const isoDate = now.toISOString().slice(0, 10);
  const cleanSupp = supplierName.replace(/\s+/g, '_');
  link.download = `${shopName.replace(/\s+/g, '_')}_Supplier_${cleanSupp}_Statement_${isoDate}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports Store Sales, Payments & Analytics to an Excel-compatible CSV file with UTF-8 BOM
 */
export function exportStoreSalesAndAnalyticsToExcel(
  transactions: Transaction[],
  storeSettings?: StoreSettings,
  outletFilter = 'all',
  timeFilter = 'all',
  customTitle = 'Store Sales & Analytics Report'
): void {
  const activeOutletName =
    outletFilter === 'all'
      ? 'All Outlets (सभी दुकानें)'
      : storeSettings?.stores?.find((s) => s.id === outletFilter)?.shopName || outletFilter;

  const validTransactions = transactions.filter((tx) => !tx.voided);
  const sales = validTransactions.filter((tx) => tx.type === 'sale');
  const expenses = validTransactions.filter((tx) => tx.type === 'expense');

  const totalSalesAmount = sales.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const totalExpensesAmount = expenses.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const netRevenue = Math.round((totalSalesAmount - totalExpensesAmount) * 100) / 100;

  const cashSales = sales.filter((tx) => tx.paymentMode === 'cash').reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const upiSales = sales.filter((tx) => tx.paymentMode === 'online_upi').reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const udhaarSales = sales.filter((tx) => tx.paymentMode === 'credit_udhaar').reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const avgBillValue = sales.length > 0 ? Math.round(totalSalesAmount / sales.length) : 0;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  // 1. Header & Summary Section
  const rows: string[][] = [
    [`${storeSettings?.shopName || 'Nayab Masale & Kirana'} - ${customTitle.toUpperCase()}`],
    [`Generated On: ${dateStr} at ${timeStr}`, `Outlet Filter: ${activeOutletName}`, `Period: ${timeFilter.toUpperCase()}`],
    [],
    ['--- EXECUTIVE FINANCIAL SUMMARY (वित्तीय सारांश) ---'],
    ['Metric', 'Amount (₹)', 'Count / Percentage', 'Notes'],
    ['Total Gross Sales (कुल बिक्री)', `₹${totalSalesAmount.toLocaleString('en-IN')}`, `${sales.length} Bills`, 'Completed sales transactions'],
    ['Cash Sales (नकद बिक्री)', `₹${cashSales.toLocaleString('en-IN')}`, `${totalSalesAmount > 0 ? Math.round((cashSales / totalSalesAmount) * 100) : 0}% of Sales`, 'Collected in Cash Box'],
    ['Online UPI Sales (यूपीआई बिक्री)', `₹${upiSales.toLocaleString('en-IN')}`, `${totalSalesAmount > 0 ? Math.round((upiSales / totalSalesAmount) * 100) : 0}% of Sales`, 'Direct Bank UPI Transfer'],
    ['Credit / Udhaar Given (उधार बिक्री)', `₹${udhaarSales.toLocaleString('en-IN')}`, `${totalSalesAmount > 0 ? Math.round((udhaarSales / totalSalesAmount) * 100) : 0}% of Sales`, 'Customer Udhaar Ledger'],
    ['Total Expenses (दुकान खर्चे)', `₹${totalExpensesAmount.toLocaleString('en-IN')}`, `${expenses.length} Entries`, 'Shop expenses & payouts'],
    ['Net Inflow / Profit (शुद्ध आय)', `₹${netRevenue.toLocaleString('en-IN')}`, `${sales.length} Bills`, 'Gross Sales minus Expenses'],
    ['Average Bill Value (औसत बिल)', `₹${avgBillValue.toLocaleString('en-IN')}`, '-', 'Per Sale Ticket'],
    [],
    // 2. Transactions Table
    ['--- DETAILED TRANSACTIONS LEDGER (लेनदेन विवरण) ---'],
    [
      'S.No.',
      'Date & Time (तारीख़ व समय)',
      'Receipt # (बिल संख्या)',
      'Type (प्रकार)',
      'Outlet / Branch (दुकान / शाखा)',
      'Cashier / Staff (कैशियर)',
      'Customer Name (ग्राहक नाम)',
      'Customer Phone (ग्राहक मोबाइल)',
      'Payment Mode (भुगतान माध्यम)',
      'Items Count (आइटम)',
      'Items Summary (सामान का विवरण)',
      'Tax Amount (टैक्स ₹)',
      'Total Amount (कुल राशि ₹)',
      'Status (स्थिति)',
      'Void Reason / Remarks (रिमार्क)',
    ],
  ];

  transactions.forEach((tx, idx) => {
    const formattedDate = new Date(tx.timestamp).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const itemsSummary = tx.items && tx.items.length > 0
      ? tx.items.map((it) => `${it.name} (${it.quantity}${it.unit || ''} @ ₹${it.rate})`).join('; ')
      : '-';

    const itemsCount = tx.items ? tx.items.reduce((sum, it) => sum + it.quantity, 0) : 0;

    let modeLabel = 'Cash';
    if (tx.paymentMode === 'online_upi') modeLabel = 'Online UPI';
    if (tx.paymentMode === 'credit_udhaar') modeLabel = 'Credit Udhaar';

    rows.push([
      String(idx + 1),
      formattedDate,
      tx.receiptNumber || tx.id,
      tx.type === 'sale' ? 'SALE' : 'EXPENSE',
      tx.storeName || (tx.storeId ? storeSettings?.stores?.find((s) => s.id === tx.storeId)?.shopName || tx.storeId : 'Main Store'),
      tx.staffName || 'Staff',
      tx.customerName || '-',
      tx.customerPhone || '-',
      modeLabel,
      String(itemsCount || (tx.items?.length || '-')),
      itemsSummary,
      String(tx.taxAmount || 0),
      String(tx.amount || 0),
      tx.voided ? 'VOIDED (रद्द)' : 'COMPLETED (सफल)',
      tx.voidReason || tx.remarks || tx.notes || '-',
    ]);
  });

  // Grand totals row
  rows.push([]);
  rows.push([
    'TOTALS',
    '',
    `Total Records: ${transactions.length}`,
    `Sales: ${sales.length} | Exp: ${expenses.length}`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    `Net: ₹${netRevenue.toLocaleString('en-IN')}`,
    '',
    '',
  ]);

  // 3. Product Sales Analytics (Top selling items)
  const productSalesMap = new Map<string, { name: string; category?: string; qty: number; revenue: number }>();
  sales.forEach((tx) => {
    if (tx.items && tx.items.length > 0) {
      tx.items.forEach((item) => {
        const key = item.name.trim();
        const existing = productSalesMap.get(key) || { name: item.name, category: item.category, qty: 0, revenue: 0 };
        existing.qty += item.quantity || 1;
        existing.revenue += item.total || (item.quantity * item.rate) || 0;
        productSalesMap.set(key, existing);
      });
    }
  });

  if (productSalesMap.size > 0) {
    rows.push([]);
    rows.push(['--- PRODUCT SALES PERFORMANCE ANALYTICS (उत्पाद बिक्री विश्लेषण) ---']);
    rows.push(['Rank', 'Product Name (सामान का नाम)', 'Category', 'Total Quantity Sold', 'Total Revenue Generated (₹)']);
    const sortedProducts = Array.from(productSalesMap.values()).sort((a, b) => b.revenue - a.revenue);
    sortedProducts.forEach((p, idx) => {
      rows.push([
        String(idx + 1),
        p.name,
        p.category || 'General',
        String(Math.round(p.qty * 100) / 100),
        `₹${Math.round(p.revenue).toLocaleString('en-IN')}`,
      ]);
    });
  }

  // 4. Outlet Comparison Table (if outlets exist)
  if (storeSettings?.stores && storeSettings.stores.length > 0) {
    rows.push([]);
    rows.push(['--- OUTLET-WISE REVENUE BREAKDOWN (शाखा अनुसार बिक्री) ---']);
    rows.push(['Outlet Name', 'Outlet ID', 'Phone', 'Total Sales Bills', 'Total Sales Revenue (₹)', 'Cash (₹)', 'UPI (₹)', 'Udhaar (₹)']);

    storeSettings.stores.forEach((outlet) => {
      const outletSales = sales.filter((tx) => tx.storeId === outlet.id || tx.storeName === outlet.shopName);
      const oTotal = outletSales.reduce((sum, tx) => sum + (tx.amount || 0), 0);
      const oCash = outletSales.filter((tx) => tx.paymentMode === 'cash').reduce((sum, tx) => sum + (tx.amount || 0), 0);
      const oUpi = outletSales.filter((tx) => tx.paymentMode === 'online_upi').reduce((sum, tx) => sum + (tx.amount || 0), 0);
      const oUdh = outletSales.filter((tx) => tx.paymentMode === 'credit_udhaar').reduce((sum, tx) => sum + (tx.amount || 0), 0);

      rows.push([
        outlet.shopName,
        outlet.id,
        outlet.phone,
        String(outletSales.length),
        `₹${oTotal.toLocaleString('en-IN')}`,
        `₹${oCash.toLocaleString('en-IN')}`,
        `₹${oUpi.toLocaleString('en-IN')}`,
        `₹${oUdh.toLocaleString('en-IN')}`,
      ]);
    });
  }

  // Generate and trigger download with UTF-8 BOM
  const csvContent = '\uFEFF' + rows.map((r) => r.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const isoDate = now.toISOString().slice(0, 10);
  const cleanStore = (storeSettings?.shopName || 'Nayab').replace(/\s+/g, '_');
  const cleanOutlet = outletFilter.replace(/\s+/g, '_');
  link.download = `${cleanStore}_Sales_Analytics_${cleanOutlet}_${isoDate}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
