/**
 * Thermal POS Printer Utility for NAYAB Kirana Calculator
 * Supports:
 * 1. Web Bluetooth ESC/POS (58mm / 80mm thermal receipt printers)
 * 2. Web Serial / USB ESC/POS thermal printers
 * 3. Browser Thermal Print fallback with exact 58mm / 80mm print stylesheet
 */

import QRCode from 'qrcode';
import { BillItem, StoreSettings, Transaction } from '../types';

export interface ThermalReceiptData {
  shopName: string;
  address: string;
  phone: string;
  gstin?: string;
  receiptNumber: string;
  date: string;
  cashierName?: string;
  customerName?: string;
  items: BillItem[];
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  grandTotal: number;
  paymentMode: string;
  upiId?: string;
  qrDataUrl?: string;
  printQrCodeOnSlip?: boolean;
}

// Global active hardware handles
let bluetoothDevice: any = null;
let bluetoothCharacteristic: any = null;
let serialPort: any = null;
let serialWriter: any = null;

// ESC/POS Commands
const ESC = '\x1B';
const GS = '\x1D';
const COMMANDS = {
  INIT: `${ESC}@`,
  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  ALIGN_RIGHT: `${ESC}a\x02`,
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  DOUBLE_HEIGHT: `${ESC}!\x10`,
  DOUBLE_WIDTH: `${ESC}!\x20`,
  NORMAL_TEXT: `${ESC}!\x00`,
  LINE_FEED: '\n',
  CUT_PAPER: `${GS}V\x41\x00`, // Full cut
  // Standard ESC/POS Cash Drawer pulse commands:
  // ESC p m t1 t2 (Pin 2: m=0, t1=25, t2=250 => pulse 50ms, off 500ms)
  DRAWER_KICK_PIN2: `${ESC}p\x00\x19\xFA`,
  // ESC p m t1 t2 (Pin 5: m=1, t1=25, t2=250)
  DRAWER_KICK_PIN5: `${ESC}p\x01\x19\xFA`,
  // DLE DC4 real-time cash drawer pulse (0x10 0x14 0x01 0x00 0x01)
  DRAWER_KICK_REALTIME: `\x10\x14\x01\x00\x01`,
};

/**
 * Format string row for fixed width thermal receipt (e.g. 32 cols for 58mm, 48 cols for 80mm)
 */
function formatTwoColumns(left: string, right: string, width: number = 32): string {
  const maxLeft = width - right.length - 1;
  const truncatedLeft = left.length > maxLeft ? left.substring(0, maxLeft) : left;
  const spaces = Math.max(1, width - truncatedLeft.length - right.length);
  return truncatedLeft + ' '.repeat(spaces) + right;
}

/**
 * Connect to Bluetooth Thermal POS Printer via Web Bluetooth API
 */
export async function connectBluetoothPrinter(): Promise<{ success: boolean; deviceName?: string; error?: string }> {
  if (!('bluetooth' in navigator)) {
    return {
      success: false,
      error: 'Web Bluetooth is not supported in this browser. Please use Chrome/Edge or standard printer output.',
    };
  }

  try {
    const nav = navigator as any;
    // Known Bluetooth Printer Service UUIDs
    const device = await nav.bluetooth.requestDevice({
      filters: [
        { namePrefix: 'MPT' },
        { namePrefix: 'RPP' },
        { namePrefix: 'POS' },
        { namePrefix: 'Thermal' },
        { namePrefix: 'TVS' },
        { namePrefix: 'NGX' },
        { namePrefix: 'NAYAB' },
        { namePrefix: 'Nayab' },
        { namePrefix: 'BlueTooth' },
      ],
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS Printer Service
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        '0000ffe0-0000-1000-8000-00805f9b34fb',
      ],
      acceptAllDevices: true,
    });

    const server = await device.gatt.connect();
    bluetoothDevice = device;

    // Discover writable characteristic
    const services = await server.getPrimaryServices();
    for (const service of services) {
      const characteristics = await service.getCharacteristics();
      for (const char of characteristics) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          bluetoothCharacteristic = char;
          break;
        }
      }
      if (bluetoothCharacteristic) break;
    }

    return {
      success: true,
      deviceName: device.name || 'Bluetooth Thermal Printer',
    };
  } catch (err: any) {
    console.warn('Bluetooth connection error:', err);
    return {
      success: false,
      error: err.message || 'Could not connect to Bluetooth printer.',
    };
  }
}

/**
 * Connect to USB / Serial POS Printer via Web Serial API
 */
export async function connectSerialPrinter(): Promise<{ success: boolean; deviceName?: string; error?: string }> {
  if (!('serial' in navigator)) {
    return {
      success: false,
      error: 'Web Serial is not supported in this browser. Please use Google Chrome or Edge.',
    };
  }

  try {
    const nav = navigator as any;
    const port = await nav.serial.requestPort();
    await port.open({ baudRate: 9600 });
    serialPort = port;
    serialWriter = port.writable.getWriter();

    return {
      success: true,
      deviceName: 'USB / Serial Thermal Printer',
    };
  } catch (err: any) {
    console.warn('Serial connection error:', err);
    return {
      success: false,
      error: err.message || 'Could not connect to Serial printer.',
    };
  }
}

/**
 * Disconnect current active hardware printer
 */
export async function disconnectHardwarePrinter(): Promise<void> {
  if (bluetoothDevice && bluetoothDevice.gatt.connected) {
    bluetoothDevice.gatt.disconnect();
    bluetoothDevice = null;
    bluetoothCharacteristic = null;
  }
  if (serialWriter) {
    try {
      serialWriter.releaseLock();
      await serialPort.close();
    } catch {}
    serialWriter = null;
    serialPort = null;
  }
}

export function isHardwarePrinterConnected(): boolean {
  return (
    (bluetoothDevice && bluetoothDevice.gatt && bluetoothDevice.gatt.connected) ||
    (serialPort && serialPort.readable)
  );
}

/**
 * Build ESC/POS Byte Stream for receipt
 */
export function buildEscPosPayload(data: ThermalReceiptData, paperWidth: '58mm' | '80mm' = '58mm'): Uint8Array {
  const width = paperWidth === '80mm' ? 48 : 32;
  const divider = '-'.repeat(width);
  const doubleDivider = '='.repeat(width);

  let text = '';
  text += COMMANDS.INIT;
  text += COMMANDS.ALIGN_CENTER;
  text += COMMANDS.BOLD_ON;
  text += `${data.shopName}\n`;
  text += COMMANDS.BOLD_OFF;

  if (data.address) text += `${data.address}\n`;
  if (data.phone) text += `Ph: ${data.phone}\n`;
  if (data.gstin) text += `GSTIN: ${data.gstin}\n`;

  text += `${doubleDivider}\n`;
  text += COMMANDS.ALIGN_LEFT;
  text += formatTwoColumns(`Rcpt: ${data.receiptNumber}`, data.date, width) + '\n';
  if (data.cashierName) {
    text += `Cashier: ${data.cashierName}\n`;
  }
  if (data.customerName) {
    text += `Customer: ${data.customerName}\n`;
  }
  text += `${divider}\n`;
  text += formatTwoColumns('Item (Qty)', 'Amount', width) + '\n';
  text += `${divider}\n`;

  // Item lines
  data.items.forEach((item, idx) => {
    const itemHeader = `${idx + 1}. ${item.name}`;
    const itemDetail = `   ${item.quantity} ${item.unit} @ Rs.${item.rate}`;
    const itemTotal = `Rs.${item.total.toFixed(2)}`;
    text += `${itemHeader}\n`;
    text += formatTwoColumns(itemDetail, itemTotal, width) + '\n';
  });

  text += `${divider}\n`;
  text += formatTwoColumns('Subtotal:', `Rs.${data.subtotal.toFixed(2)}`, width) + '\n';
  if (data.taxRate > 0) {
    text += formatTwoColumns(`GST (${data.taxRate}%):`, `Rs.${data.taxAmount.toFixed(2)}`, width) + '\n';
  }

  text += `${doubleDivider}\n`;
  text += COMMANDS.BOLD_ON;
  text += formatTwoColumns('GRAND TOTAL:', `Rs.${data.grandTotal.toFixed(2)}`, width) + '\n';
  text += COMMANDS.BOLD_OFF;
  text += `${doubleDivider}\n`;

  text += `Payment: ${data.paymentMode.toUpperCase()}\n`;
  if (data.upiId) {
    text += `UPI: ${data.upiId}\n`;
  }

  text += COMMANDS.ALIGN_CENTER;
  text += '\nDhanyawad! Please Visit Again!\n';
  text += '*** NAYAB Smart Kirana POS ***\n';
  text += '\n\n\n';
  text += COMMANDS.CUT_PAPER;

  const encoder = new TextEncoder();
  return encoder.encode(text);
}

/**
 * Print Receipt through Bluetooth, Serial, or Browser Print Dialog
 */
export async function printReceipt(
  data: ThermalReceiptData,
  settings: StoreSettings
): Promise<{ success: boolean; method: string; error?: string }> {
  const paperWidth = settings.printerConfig.paperWidth || '58mm';
  const shouldPrintQr =
    data.printQrCodeOnSlip !== undefined
      ? data.printQrCodeOnSlip
      : settings.printerConfig?.printQrCodeOnSlip !== false;

  data.printQrCodeOnSlip = shouldPrintQr;

  // Ensure offline QR data URL is generated if enabled and not provided
  if (shouldPrintQr && !data.qrDataUrl && data.grandTotal > 0) {
    try {
      const upiUrl = `upi://pay?pa=${encodeURIComponent(
        data.upiId || 'nayabmasale@upi'
      )}&pn=${encodeURIComponent(data.shopName || 'NAYAB Store')}&am=${data.grandTotal.toFixed(
        2
      )}&cu=INR&tn=${encodeURIComponent(data.receiptNumber)}`;

      data.qrDataUrl = await QRCode.toDataURL(upiUrl, {
        width: 160,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
    } catch (e) {
      console.warn('QR code generation failed, will use fallback image', e);
    }
  }

  // 1. If Bluetooth Characteristic is ready
  if (bluetoothCharacteristic) {
    try {
      const payload = buildEscPosPayload(data, paperWidth);
      // Chunk writes to 512 bytes for Bluetooth BLE MTU limits
      const CHUNK_SIZE = 128;
      for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
        const chunk = payload.slice(i, i + CHUNK_SIZE);
        await bluetoothCharacteristic.writeValue(chunk);
      }
      return { success: true, method: 'bluetooth' };
    } catch (err: any) {
      console.warn('Bluetooth print failed, falling back to browser print:', err);
    }
  }

  // 2. If Serial Writer is ready
  if (serialWriter) {
    try {
      const payload = buildEscPosPayload(data, paperWidth);
      await serialWriter.write(payload);
      return { success: true, method: 'serial' };
    } catch (err: any) {
      console.warn('Serial print failed, falling back to browser print:', err);
    }
  }

  // 3. High-Quality Browser Direct Thermal Receipt Print
  triggerBrowserThermalPrint(data, paperWidth);
  return { success: true, method: 'browser' };
}

/**
 * Dedicated 58mm / 80mm Browser Thermal Receipt Print Flow
 */
export function triggerBrowserThermalPrint(data: ThermalReceiptData, paperWidth: '58mm' | '80mm' = '58mm'): void {
  const widthPx = paperWidth === '80mm' ? '300px' : '220px';

  const printHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt - ${data.receiptNumber}</title>
        <style>
          @page {
            size: ${paperWidth} auto;
            margin: 0mm;
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            line-height: 1.35;
            color: #000;
            background: #fff;
            width: ${widthPx};
            margin: 0 auto;
            padding: 8px 4px;
            font-weight: 600;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: 800; }
          .title { font-size: 14px; margin-bottom: 2px; }
          .divider { border-top: 1px dashed #000; margin: 4px 0; }
          .double-divider { border-top: 2px solid #000; margin: 5px 0; }
          .row { display: flex; justify-content: space-between; margin: 2px 0; }
          .items-table { width: 100%; border-collapse: collapse; margin: 4px 0; }
          .items-table th { border-bottom: 1px dashed #000; text-align: left; padding: 2px 0; }
          .items-table td { padding: 2px 0; vertical-align: top; }
          .total-row { font-size: 13px; font-weight: 900; }
          @media print {
            body { width: 100%; }
          }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="bold title">${data.shopName}</div>
          <div>${data.address || ''}</div>
          <div>Ph: ${data.phone || ''}</div>
          ${data.gstin ? `<div>GSTIN: ${data.gstin}</div>` : ''}
        </div>

        <div class="double-divider"></div>

        <div class="row">
          <span>Rcpt: ${data.receiptNumber}</span>
          <span>${data.date}</span>
        </div>
        ${data.cashierName ? `<div class="row"><span>Cashier:</span><span>${data.cashierName}</span></div>` : ''}
        ${data.customerName ? `<div class="row"><span>Customer:</span><span>${data.customerName}</span></div>` : ''}

        <div class="divider"></div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 55%;">Item</th>
              <th style="width: 20%;" class="text-center">Qty</th>
              <th style="width: 25%;" class="text-right">Amt</th>
            </tr>
          </thead>
          <tbody>
            ${data.items
              .map(
                (item) => `
              <tr>
                <td>${item.name}${item.hindiName ? ` (${item.hindiName})` : ''}</td>
                <td class="text-center">${item.quantity}${item.unit}</td>
                <td class="text-right">₹${item.total.toFixed(2)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div class="divider"></div>

        <div class="row">
          <span>Subtotal:</span>
          <span>₹${data.subtotal.toFixed(2)}</span>
        </div>
        ${
          data.taxRate > 0
            ? `
          <div class="row">
            <span>GST Tax (${data.taxRate}%):</span>
            <span>+₹${data.taxAmount.toFixed(2)}</span>
          </div>
        `
            : ''
        }

        <div class="double-divider"></div>

        <div class="row total-row">
          <span>GRAND TOTAL:</span>
          <span>₹${data.grandTotal.toFixed(2)}</span>
        </div>

        <div class="double-divider"></div>

        <div class="row">
          <span>Payment Mode:</span>
          <span class="bold">${data.paymentMode.toUpperCase()}</span>
        </div>
        ${data.upiId ? `<div class="row"><span>UPI ID:</span><span>${data.upiId}</span></div>` : ''}

        ${
          data.grandTotal > 0 && data.printQrCodeOnSlip !== false && data.qrDataUrl
            ? `
          <div style="margin: 10px 0 6px 0; text-align: center; padding: 6px; border: 1px dashed #444; border-radius: 4px;">
            <div style="font-size: 10px; font-weight: bold; margin-bottom: 3px;">SCAN & PAY VIA UPI</div>
            <div style="font-size: 11px; font-weight: bold; color: #000; margin-bottom: 4px;">₹${data.grandTotal.toFixed(2)}</div>
            <img 
              src="${data.qrDataUrl}" 
              alt="Dynamic UPI QR" 
              style="width: 120px; height: 120px; margin: 0 auto; display: block;" 
            />
            <div style="font-size: 8.5px; margin-top: 3px; color: #333;">PhonePe / GPay / Paytm / BHIM</div>
          </div>
        `
            : data.grandTotal > 0 && data.printQrCodeOnSlip !== false && data.upiId
            ? `
          <div style="margin: 8px 0 4px 0; text-align: center; padding: 5px; border: 1px dashed #666; border-radius: 4px;">
            <div style="font-size: 9.5px; font-weight: bold;">PAY VIA UPI: ${data.upiId}</div>
            <div style="font-size: 8.5px; color: #444;">₹${data.grandTotal.toFixed(2)} • GPay / PhonePe / Paytm</div>
          </div>
        `
            : ''
        }

        <div style="margin-top: 10px;" class="text-center">
          <div>Dhanyawad! Please Visit Again!</div>
          <div style="font-size: 9px; margin-top: 4px; font-weight: bold;">*** NAYAB Smart Kirana POS ***</div>
        </div>
      </body>
    </html>
  `;

  let printed = false;
  try {
    const printWindow = window.open('', '_blank', 'width=350,height=550');
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 300);
      printed = true;
    }
  } catch (err) {
    console.warn('window.open blocked, using iframe print fallback', err);
  }

  if (!printed) {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(printHtml);
        doc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 1500);
        }, 300);
      }
    } catch (e) {
      console.warn('Iframe print failed, falling back to window.print', e);
      window.print();
    }
  }
}

/**
 * Print a quick diagnostic test slip to verify printer connection
 */
export async function printTestReceipt(settings: StoreSettings): Promise<{ success: boolean; error?: string }> {
  const testData: ThermalReceiptData = {
    shopName: settings.shopName || 'Nayab Masale & Kirana Store',
    address: settings.address || 'Main Market, Spice Bazaar',
    phone: settings.phone || '9876543210',
    gstin: settings.gstin || '07AAAAA0000A1Z5',
    receiptNumber: `TEST-${Date.now().toString().slice(-4)}`,
    date: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
    cashierName: 'Admin',
    items: [
      { id: 't1', name: 'Haldi Powder (Turmeric)', quantity: 250, unit: 'g', rate: 220, total: 55.0 },
      { id: 't2', name: 'Sabut Jeera (Cumin)', quantity: 500, unit: 'g', rate: 380, total: 190.0 },
    ],
    subtotal: 245.0,
    taxAmount: 12.25,
    taxRate: settings.defaultTaxRate || 5,
    grandTotal: 257.25,
    paymentMode: 'Cash',
    upiId: settings.upiId || 'nayabmasale@upi',
  };

  return await printReceipt(testData, settings);
}

/**
 * Triggers the POS cash drawer solenoid kick via connected ESC/POS printer
 * (Bluetooth / USB Serial / Thermal driver) or sound/haptic simulation.
 * Sends standard ESC/POS pulse: ESC p 0 25 250 (\x1B\x70\x00\x19\xFA) and Pin 5 fallback.
 */
export async function kickCashDrawer(options?: {
  silent?: boolean;
  pin?: 2 | 5;
}): Promise<{ success: boolean; method: 'bluetooth' | 'serial' | 'simulated'; error?: string }> {
  // Always trigger mechanical register drawer chime sound unless silent requested
  if (!options?.silent) {
    try {
      const { playCashDrawerSound } = await import('./audio');
      playCashDrawerSound();
    } catch {}
  }

  // Build binary ESC/POS drawer kick byte stream
  // We send both standard pin 2 pulse (\x1B\x70\x00\x19\xFA) and pin 5 pulse (\x1B\x70\x01\x19\xFA)
  // to ensure compatibility with all RJ11/RJ12 drawer solenoids (Epson, Star, TVS, NGX, Posiflex)
  const pinCode = options?.pin === 5 ? 0x01 : 0x00;
  const kickBytes = new Uint8Array([
    0x1b, 0x70, pinCode, 0x19, 0xfa, // ESC p m t1 t2
    0x10, 0x14, 0x01, 0x00, 0x01,    // DLE DC4 real-time pulse (Epson standard)
    0x1b, 0x70, 0x01, 0x19, 0xfa     // Pin 5 secondary pulse
  ]);

  // 1. Send via active Web Bluetooth Characteristic
  if (bluetoothCharacteristic) {
    try {
      await bluetoothCharacteristic.writeValue(kickBytes);
      return { success: true, method: 'bluetooth' };
    } catch (err: any) {
      console.warn('Bluetooth cash drawer kick failed:', err);
    }
  }

  // 2. Send via active Web Serial / USB Writer
  if (serialWriter) {
    try {
      await serialWriter.write(kickBytes);
      return { success: true, method: 'serial' };
    } catch (err: any) {
      console.warn('Serial cash drawer kick failed:', err);
    }
  }

  // 3. Fallback: Software registered trigger / browser audio-haptic simulation
  // Allows cash drawer button to function smoothly even when physical printer is not yet paired
  return { success: true, method: 'simulated' };
}
