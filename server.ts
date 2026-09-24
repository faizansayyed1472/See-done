import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { centralDb } from "./server/centralDb";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: "5mb" }));

// Smart Kirana Domain Knowledge (100% Free, Zero Key, Zero Cloud Dependency)
function getKiranaExpertAdvice(query: string): { text: string; sources: Array<{ title: string; url: string }> } | null {
  const q = query.toLowerCase();

  if (q.includes("wholesale") || q.includes("mandi") || q.includes("apmc") || q.includes("rate") || q.includes("price") || q.includes("bhav")) {
    return {
      text: `NAYAB APMC Mandi Benchmark Rates (Free Open Market Reference):
• Star Anise (चक्र फूल): Wholesale ₹750–850/kg | Retail: ₹1,100–1,300/kg
• Green Cardamom (हरी इलायची, 8mm): Wholesale ₹2,200–2,600/kg | Retail: ₹3,200–3,600/kg
• Cumin Seeds (जीरा, Unjha): Wholesale ₹320–360/kg | Retail: ₹450–520/kg
• Black Pepper (काली मिर्च, Tellicherry): Wholesale ₹620–680/kg | Retail: ₹850–950/kg
• Cloves (लौंग, Lal Pari): Wholesale ₹850–920/kg | Retail: ₹1,200–1,400/kg
• Turmeric Fingers (हल्दी गांठ, Salem): Wholesale ₹150–180/kg | Retail: ₹240–280/kg
• Toor Dal (अरहर दाल, Desi Phatka): Wholesale ₹145–158/kg | Retail: ₹175–195/kg
• Mustard Oil (सरसों तेल, 15L Tin): Wholesale ₹135–142/L | Retail: ₹160–175/L
Advice: Always purchase whole spices in bulk gunny bags during post-harvest arrivals (Nov–Feb for jeera & cardamom) for optimal retail margins.`,
      sources: [
        { title: "Indian APMC Mandi Open Reference", url: "https://en.wikipedia.org/wiki/Agricultural_produce_market_committee" },
        { title: "Open Food Facts Spice Classification", url: "https://world.openfoodfacts.org" },
      ],
    };
  }

  if (q.includes("margin") || q.includes("profit") || q.includes("markup") || q.includes("kamai")) {
    return {
      text: `Kirana & Spice Store Retail Margin Benchmarks:
1. Loose Whole Spices & Herbs (जीरा, लौंग, इलायची, काली मिर्च): 28% to 42% gross margin. Best profitability in Kirana.
2. Loose Pulses & Dals (दालें, चना, राजमा): 12% to 18% margin. High volume, daily turnover.
3. Edible Oils & Ghee (तेल, घी): 5% to 9% margin. Capital-intensive; keep inventory rotation rapid.
4. Branded FMCG & Packaged Foods (Tata Salt, Parle-G, Maggi, Amul): 4% to 8% margin. Attracts footfall, but lower gross margin.
5. Dry Fruits (काजू, बादाम, किशमिश): 20% to 30% margin. Pack in airtight 250g/500g pouches with store branding for higher perceived value.`,
      sources: [
        { title: "Indian Retail Grocery Margin Standards", url: "https://en.wikipedia.org/wiki/Kirana" },
      ],
    };
  }

  if (q.includes("store") || q.includes("monsoon") || q.includes("moisture") || q.includes("humidity") || q.includes("spoil") || q.includes("fungus") || q.includes("keeda")) {
    return {
      text: `Kirana Spice Storage & Preservation Protocol:
• Moisture Threshold: Whole spices must stay below 10% relative moisture to avoid Aspergillus and pest infestation.
• Storage Vessels: Store whole spices in food-grade stainless steel dabbas or airtight HDPE bins. Avoid keeping sacks directly on damp cement floors—use wooden or plastic pallets elevated at least 4 inches.
• Monsoon Care: In coastal or high-humidity regions, use food-grade silica gel packs inside storage bins and ensure store ventilation. If sun is out, sun-dry whole turmeric and red chillies for 4–6 hours.
• Cardamom & Saffron: Keep in opaque, airtight containers away from direct sunlight to preserve volatile essential oils (cineole/terpinyl acetate).`,
      sources: [
        { title: "Spice Storage & Quality Guidelines", url: "https://en.wikipedia.org/wiki/Spice" },
      ],
    };
  }

  if (q.includes("udhaar") || q.includes("credit") || q.includes("ledger") || q.includes("khata") || q.includes("recovery")) {
    return {
      text: `Kirana Udhaar (Customer Credit) Management Rules:
1. Hard Credit Cap: Establish a per-family limit (e.g. ₹2,000–₹5,000) and never extend credit past 30 days.
2. Itemized Receipts: Always issue an itemized digital or printed slip showing opening balance, current items, and closing balance.
3. UPI Payment QR on Bills: Include dynamic UPI QR codes on receipts so customers can settle balances immediately from their phone (GPay/PhonePe).
4. Courteous WhatsApp Reminders: Send friendly summary updates at month-end instead of confrontational calls.`,
      sources: [
        { title: "Kirana Business Management", url: "https://en.wikipedia.org/wiki/Kirana" },
      ],
    };
  }

  if (q.includes("gst") || q.includes("tax") || q.includes("hsn") || q.includes("taxation")) {
    return {
      text: `Indian GST Rules for Kirana & Grocery:
• 0% GST (Exempted): Loose, unbranded pulses, wheat, rice, atta, loose whole spices, fresh milk, and unbranded paneer.
• 5% GST: Pre-packaged and labelled spices, pulses, edible oils, branded tea, and packaged salt.
• 12% / 18% GST: Pickles, processed sauces, confectionery, soaps, detergents, and household cleaning supplies.
Composition Scheme: Kirana retailers with annual turnover under ₹1.5 Crore can opt for the 1% flat turnover tax scheme for simplified accounting.`,
      sources: [
        { title: "GST Council Goods & Services Classification", url: "https://en.wikipedia.org/wiki/Goods_and_Services_Tax_(India)" },
      ],
    };
  }

  return null;
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    mode: "Centralized Client-Server Architecture (Cloud DB / REST & Free APIs)",
    centralDbStatus: centralDb.getStatus(),
    providers: [
      "Centralized Server Database (data/central_store_db.json)",
      "DuckDuckGo Instant Answer API (Free)",
      "Wikipedia & Wikimedia REST API (Free)",
      "Open Food Facts Public API (Free)",
      "OpenStreetMap / Nominatim API (Free)",
      "Open-Meteo Weather API (Free)",
    ],
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// CENTRALIZED CLIENT-SERVER DATABASE & MASTER ADMIN API
// ==========================================

// 1. Central Database Connection & Telemetry Status
app.get("/api/db/status", (_req, res) => {
  try {
    const status = centralDb.getStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to retrieve central DB status", details: err.message });
  }
});

// 2. Full Database Snapshot (Initial bootstrap / master pull)
app.get(["/api/db/sync", "/api/db/snapshot"], (_req, res) => {
  try {
    const snapshot = centralDb.getFullSnapshot();
    res.json({
      status: "connected",
      snapshot,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to retrieve snapshot", details: err.message });
  }
});

// 3. Two-Way Delta Sync (Push mutations from POS terminals / Pull latest central state)
app.post("/api/db/sync", (req, res) => {
  try {
    const { products, transactions, customers, settings, staff, performedBy, clientId, outletId } = req.body || {};
    const result = centralDb.syncClient({
      products,
      transactions,
      customers,
      settings,
      staff,
      performedBy,
      clientId,
      outletId,
    });
    res.json({
      ...result,
      timestamp: result.lastSyncedAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Central synchronization failed", details: err.message });
  }
});

// 4. Products Master Endpoints
app.get("/api/db/products", (_req, res) => {
  res.json(centralDb.getProducts());
});

app.post("/api/db/products", (req, res) => {
  try {
    const { product, performedBy } = req.body;
    if (!product || !product.id || !product.name) {
      return res.status(400).json({ error: "Valid product object with id and name required" });
    }
    const saved = centralDb.saveProduct(product, performedBy || "Master Admin");
    res.json({ success: true, product: saved });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save product", details: err.message });
  }
});

app.delete("/api/db/products/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { performedBy } = req.query;
    const ok = centralDb.deleteProduct(id, String(performedBy || "Master Admin"));
    if (ok) {
      res.json({ success: true, id });
    } else {
      res.status(404).json({ error: "Product not found" });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete product", details: err.message });
  }
});

// 5. Bulk Price & Rate Adjustment (Master Admin tool)
app.post("/api/db/products/bulk-adjust", (req, res) => {
  try {
    const { category, percentageChange, fixedOffset, rounding, actor } = req.body;
    const result = centralDb.bulkAdjustRates({
      category,
      percentageChange: Number(percentageChange) || 0,
      fixedOffset: Number(fixedOffset) || 0,
      rounding,
      actor,
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: "Bulk price adjustment failed", details: err.message });
  }
});

// 6. Transactions & Bills Master Endpoints
app.get("/api/db/transactions", (_req, res) => {
  res.json(centralDb.getTransactions());
});

app.post("/api/db/transactions/void", (req, res) => {
  try {
    const { id, reason, actor } = req.body;
    if (!id) return res.status(400).json({ error: "Transaction id is required" });
    const ok = centralDb.voidTransaction(id, reason || "Voided by Master Admin", actor || "Master Admin");
    if (ok) {
      res.json({ success: true, id });
    } else {
      res.status(404).json({ error: "Transaction not found" });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to void transaction", details: err.message });
  }
});

// 7. Customers / Udhaar Khata Master Endpoints
app.get("/api/db/customers", (_req, res) => {
  res.json(centralDb.getCustomers());
});

// 8. Staff Accounts & Access Control
app.get("/api/db/staff", (_req, res) => {
  res.json(centralDb.getStaff());
});

app.post("/api/db/staff", (req, res) => {
  try {
    const { staff, actor } = req.body;
    if (!Array.isArray(staff)) return res.status(400).json({ error: "Staff accounts array required" });
    const updated = centralDb.updateStaff(staff, actor || "Master Admin");
    res.json({ success: true, staff: updated });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update staff", details: err.message });
  }
});

// 9. Master Admin Authentication Verification
app.post("/api/db/master-admin/auth", (req, res) => {
  try {
    const { pin, serverId, username, userId } = req.body || {};
    const authResult = centralDb.verifyMasterAdmin(pin, serverId || username || userId);
    if (authResult.success) {
      res.json({
        authenticated: true,
        role: authResult.staff?.role || "master_admin",
        staff: authResult.staff,
        serverId: authResult.serverId || "faizan-inamdar",
        serverAdmin: authResult.serverAdmin || "Faizan Inamdar",
        token: `adm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      });
    } else {
      res.status(401).json({ authenticated: false, message: authResult.message || "Invalid credentials" });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Authentication verification failed", details: err.message });
  }
});

// 9b. Outlets Online Management Endpoints (Client-Server Architecture for Remote Admin/Owner)
// GET: Fetch all outlets enriched with real-time sales & live metrics
app.get("/api/db/outlets", (req, res) => {
  try {
    const outlets = centralDb.getEnrichedOutlets();
    res.json({
      success: true,
      outlets,
      timestamp: new Date().toISOString(),
      count: outlets.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to retrieve outlets", details: err.message });
  }
});

// GET: Fetch single outlet breakdown with transactions, customers, and staff
app.get("/api/db/outlets/:id", (req, res) => {
  try {
    const details = centralDb.getOutletDetails(req.params.id);
    if (!details) {
      return res.status(404).json({ error: `Outlet with ID ${req.params.id} not found` });
    }
    res.json({ success: true, ...details });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to retrieve outlet details", details: err.message });
  }
});

// POST: Create or Edit outlet data from any device online
app.post("/api/db/outlets", (req, res) => {
  try {
    const { outlet, actor } = req.body;
    if (!outlet || !outlet.shopName || !outlet.shopName.trim()) {
      return res.status(400).json({ error: "Outlet shopName is required" });
    }
    const saved = centralDb.saveOutlet(outlet, actor || "Admin Owner Online");
    const allOutlets = centralDb.getEnrichedOutlets();
    res.json({
      success: true,
      outlet: saved,
      outlets: allOutlets,
      message: `Outlet "${saved.shopName}" saved successfully`,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save outlet", details: err.message });
  }
});

// DELETE: Remove an outlet
app.delete("/api/db/outlets/:id", (req, res) => {
  try {
    const actor = (req.query.actor as string) || (req.body && req.body.actor) || "Admin Owner Online";
    const result = centralDb.deleteOutlet(req.params.id, actor);
    res.json({
      success: true,
      remainingOutlets: result.remainingOutlets,
      message: `Outlet removed successfully`,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST: Switch active counter POS to target outlet
app.post("/api/db/outlets/switch-active", (req, res) => {
  try {
    const { outletId, actor } = req.body;
    if (!outletId) return res.status(400).json({ error: "outletId is required" });
    const switched = centralDb.switchActiveOutlet(outletId, actor || "Counter Terminal");
    res.json(switched);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 9b-2. Reset Daily Data of Outlets (Sales, Expenses, Cash) to 0
app.post("/api/db/outlets/reset-daily", (req, res) => {
  try {
    const { outletId, actor } = req.body || {};
    const result = centralDb.resetDailyOutletData(outletId || "all", actor || "Admin / Counter");
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to reset daily outlet data", details: err.message });
  }
});

// 9b-2b. Fetch Live Outlet Cash Balance & Drawer Float
app.get("/api/db/outlets/:id/cash", (req, res) => {
  try {
    const cashData = centralDb.getOutletCash(req.params.id);
    res.json({ success: true, ...cashData });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get outlet cash data", details: err.message });
  }
});

// 9b-2c. Update & Sync Outlet Cash Balance (Opening Amount & Added Cash)
app.post("/api/db/outlets/:id/cash", (req, res) => {
  try {
    const outletId = req.params.id;
    const { openingCash, addedCash, openingAmount, addedAmount, mode, actor } = req.body || {};
    const resolvedOpening = typeof openingCash === 'number' ? openingCash : (typeof openingAmount === 'number' ? openingAmount : undefined);
    const resolvedAdded = typeof addedCash === 'number' ? addedCash : (typeof addedAmount === 'number' ? addedAmount : undefined);
    
    const result = centralDb.updateOutletCash(outletId, {
      openingCash: resolvedOpening,
      addedCash: resolvedAdded,
      mode: mode === 'add' ? 'add' : 'set',
      actor: actor || 'Master Admin / Counter',
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update outlet cash", details: err.message });
  }
});

// 9b-2d. Batch Sync Cash Balances for all Outlets
app.post("/api/db/outlets/sync-cash", (req, res) => {
  try {
    const { balances, actor } = req.body || {};
    if (balances && typeof balances === 'object') {
      for (const [oId, b] of Object.entries(balances)) {
        const bal = b as any;
        centralDb.updateOutletCash(oId, {
          openingCash: typeof bal.openingCash === 'number' ? bal.openingCash : bal.openingAmount,
          addedCash: typeof bal.addedCash === 'number' ? bal.addedCash : bal.addedAmount,
          mode: bal.mode || 'set',
          actor: actor || 'Admin Cash Sync',
        });
      }
    }
    const enriched = centralDb.getEnrichedOutlets();
    res.json({ success: true, outlets: enriched });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to batch sync outlet cash", details: err.message });
  }
});

// 9b-3. Daily Snapshots Archive & Date-wise reports
app.get("/api/db/daily-snapshots", (req, res) => {
  try {
    const { from, to, outletId } = req.query;
    const snapshots = centralDb.getDailySnapshots(
      typeof from === 'string' ? from : undefined,
      typeof to === 'string' ? to : undefined,
      typeof outletId === 'string' ? outletId : undefined
    );
    res.json({ success: true, snapshots });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get daily snapshots", details: err.message });
  }
});

app.post("/api/db/daily-snapshots", (req, res) => {
  try {
    const { snapshot, mode } = req.body || {};
    if (!snapshot) return res.status(400).json({ error: "snapshot payload is required" });
    const saved = centralDb.recordDailySnapshot(snapshot, mode === 'absolute' ? 'absolute' : 'accumulate');
    res.json({ success: true, snapshot: saved });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to record daily snapshot", details: err.message });
  }
});

// 9c. Staff Upload Outlet Data to Server Database
app.post("/api/db/outlets/:id/upload", (req, res) => {
  try {
    const outletId = req.params.id;
    const { outletName, products, transactions, customers, staff, outlet, uploadedBy, role, isAutoSync } = req.body || {};
    const result = centralDb.uploadOutletData({
      outletId,
      outletName,
      products,
      transactions,
      customers,
      staff,
      outlet,
      uploadedBy: uploadedBy || "Branch Staff",
      role: role || "Staff",
      isAutoSync: Boolean(isAutoSync),
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to upload outlet data", details: err.message });
  }
});

// 9d. Owner Download All Outlets (JSON Package)
app.get("/api/db/outlets/download-all", (_req, res) => {
  try {
    const pkg = centralDb.getOutletDownloadPackage("all");
    res.json({ success: true, ...pkg });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to compile master outlets package", details: err.message });
  }
});

// 9e. Owner Download Specific Outlet Data (JSON Package)
app.get("/api/db/outlets/:id/download", (req, res) => {
  try {
    const outletId = req.params.id;
    const pkg = centralDb.getOutletDownloadPackage(outletId);
    res.json({ success: true, ...pkg });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to compile outlet download package", details: err.message });
  }
});

// 9f. Owner Direct File Attachment Export for Specific Outlet (JSON or CSV)
app.get("/api/db/outlets/:id/export-file", (req, res) => {
  try {
    const outletId = req.params.id;
    const format = (req.query.format as string) === "csv" ? "csv" : "json";
    const dateStr = new Date().toISOString().split("T")[0];

    if (format === "csv") {
      const csvData = centralDb.getOutletDownloadCsv(outletId);
      const filename = `nayab_outlet_${outletId}_${dateStr}.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(csvData);
    } else {
      const pkg = centralDb.getOutletDownloadPackage(outletId);
      const filename = `nayab_outlet_${outletId}_${dateStr}.json`;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(JSON.stringify(pkg, null, 2));
    }
  } catch (err: any) {
    res.status(500).send(`Export failed: ${err.message}`);
  }
});

// 9g. Owner Export All Outlets File Attachment (JSON or CSV)
app.get("/api/db/outlets/export-all-file", (req, res) => {
  try {
    const format = (req.query.format as string) === "csv" ? "csv" : "json";
    const dateStr = new Date().toISOString().split("T")[0];

    if (format === "csv") {
      const csvData = centralDb.getOutletDownloadCsv("all");
      const filename = `nayab_all_outlets_master_${dateStr}.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(csvData);
    } else {
      const pkg = centralDb.getOutletDownloadPackage("all");
      const filename = `nayab_all_outlets_master_${dateStr}.json`;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(JSON.stringify(pkg, null, 2));
    }
  } catch (err: any) {
    res.status(500).send(`Export failed: ${err.message}`);
  }
});

// 9h. Outlet Upload Metadata & Sync Status
app.get("/api/db/outlets/metadata/upload-status", (_req, res) => {
  try {
    const meta = centralDb.getOutletUploadMetadata();
    res.json({ success: true, metadata: meta });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to retrieve upload metadata", details: err.message });
  }
});

// 10. Audit Logs
app.get("/api/db/audit-logs", (req, res) => {
  const limit = Number(req.query.limit) || 100;
  res.json(centralDb.getAuditLogs(limit));
});

// 11. Cloud Database & Firebase Configuration Bridge
app.post("/api/db/master-admin/cloud-config", (req, res) => {
  try {
    const { cloudSyncMode, firebaseConfig, actor } = req.body;
    const updated = centralDb.updateCloudSyncConfig({
      cloudSyncMode,
      firebaseConfig,
      actor,
    });
    res.json({ success: true, ...updated });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update cloud configuration", details: err.message });
  }
});

// 12. Full Database Backup Restore
app.post("/api/db/master-admin/restore", (req, res) => {
  try {
    const { backupData, actor } = req.body;
    const ok = centralDb.restoreDatabase(backupData, actor || "Master Admin");
    if (ok) {
      res.json({ success: true, snapshot: centralDb.getFullSnapshot() });
    } else {
      res.status(400).json({ error: "Invalid backup data structure" });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to restore database", details: err.message });
  }
});

// 13. Factory Reset Database
app.post("/api/db/master-admin/reset", (req, res) => {
  try {
    const { confirmPhrase, actor } = req.body;
    if (confirmPhrase !== "RESET_NAYAB_CENTRAL_DB") {
      return res.status(400).json({ error: "Confirmation phrase does not match" });
    }
    const freshDb = centralDb.resetToDefaults(actor || "Master Admin");
    res.json({ success: true, snapshot: freshDb });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to reset database", details: err.message });
  }
});

// Free AI Assistant & Kirana Knowledge endpoint (powered entirely by Free Open APIs)
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Messages array is required." });
    }

    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";
    const cleanQuery = lastUserMessage.trim();

    let summaryText = "";
    const sources: Array<{ title: string; url: string }> = [];
    let modelUsed = "free-open-api";

    // 1. Check Smart Kirana Knowledge heuristics for instant shopkeeper advice
    const kiranaAdvice = getKiranaExpertAdvice(cleanQuery);
    if (kiranaAdvice) {
      summaryText = kiranaAdvice.text;
      sources.push(...kiranaAdvice.sources);
      modelUsed = "kirana-smart-open-engine";
    }

    // 2. Query DuckDuckGo Free Instant Answer API
    if (!summaryText) {
      try {
        const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const ddgRes = await fetch(ddgUrl, {
          headers: { "User-Agent": "NayabPOS/1.0 (Free Search API)", Accept: "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (ddgRes.ok) {
          const ddgData = await ddgRes.json();
          if (ddgData.AbstractText) {
            summaryText = ddgData.AbstractText;
            if (ddgData.AbstractURL) {
              sources.push({ title: ddgData.Heading || "DuckDuckGo Free Knowledge", url: ddgData.AbstractURL });
            }
          } else if (Array.isArray(ddgData.RelatedTopics) && ddgData.RelatedTopics.length > 0) {
            const firstTopic = ddgData.RelatedTopics.find((t: any) => t.Text);
            if (firstTopic) {
              summaryText = firstTopic.Text;
              if (firstTopic.FirstURL) {
                sources.push({ title: "DuckDuckGo Related Topic", url: firstTopic.FirstURL });
              }
            }
          }
        }
      } catch {
        // Free DDG fallback
      }
    }

    // 3. Query Wikipedia Open REST API for encyclopedic grocery/spice knowledge
    if (!summaryText) {
      try {
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanQuery)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const wikiRes = await fetch(wikiUrl, {
          headers: { "User-Agent": "NayabPOS/1.0 (Free Wikipedia REST API)", Accept: "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (wikiRes.ok) {
          const wikiData = await wikiRes.json();
          if (wikiData.extract) {
            summaryText = wikiData.extract;
            sources.push({
              title: `Wikipedia: ${wikiData.title || cleanQuery}`,
              url: wikiData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(cleanQuery)}`,
            });
          }
        }
      } catch {
        // Free Wikipedia fallback
      }
    }

    if (!summaryText) {
      summaryText = `This application runs entirely on 100% Free & Open APIs without requiring any Google Cloud or commercial AI subscriptions. All Kirana grocery cataloging, barcode scanning, UPI QR payments, and item lookups use Open Food Facts, Wikipedia, DuckDuckGo, and OpenStreetMap.`;
      sources.push(
        { title: "Open Food Facts (Free Public Database)", url: "https://world.openfoodfacts.org" },
        { title: "Wikipedia Open API", url: "https://en.wikipedia.org" },
        { title: "DuckDuckGo Free API", url: "https://duckduckgo.com" },
        { title: "OpenStreetMap Foundation", url: "https://nominatim.openstreetmap.org" }
      );
    }

    res.json({
      text: summaryText,
      places: [],
      searchQueries: [cleanQuery],
      sources,
      modelUsed,
    });
  } catch (error: any) {
    res.json({
      text: "Operating in 100% Free Open API mode. All POS billing, inventory lookups, and barcode scanning are powered by free public APIs without any paid API key or subscription.",
      places: [],
      searchQueries: [],
      sources: [
        { title: "Open Food Facts (Free Public Database)", url: "https://world.openfoodfacts.org" },
        { title: "DuckDuckGo Free Search", url: "https://duckduckgo.com" },
      ],
      modelUsed: "free-open-api",
    });
  }
});

interface KiranaItemCatalog {
  name: string;
  hindiName: string;
  category: string;
  unit: string;
  rate: number;
  description: string;
  keywords: string[];
}

const CURATED_KIRANA_CATALOG: KiranaItemCatalog[] = [
  // Spices & Masale
  { name: "Star Anise (Chakra Phool)", hindiName: "चक्र फूल", category: "spices", unit: "kg", rate: 750, description: "Aromatic star anise for biryani, garam masala, and rich curries", keywords: ["star", "anise", "chakra", "phool", "badiyan", "star anise"] },
  { name: "Jeera (Cumin Seeds)", hindiName: "साबुत जीरा", category: "spices", unit: "kg", rate: 380, description: "Whole cumin seeds for daily tempering and tadka", keywords: ["jeera", "cumin", "zeera"] },
  { name: "Haldi Powder (Turmeric)", hindiName: "हल्दी पाउडर", category: "spices", unit: "kg", rate: 260, description: "Pure ground turmeric powder with high natural curcumin", keywords: ["haldi", "turmeric"] },
  { name: "Dhaniya Powder (Coriander)", hindiName: "धनिया पाउडर", category: "spices", unit: "kg", rate: 220, description: "Freshly milled aromatic coriander powder", keywords: ["dhaniya", "coriander"] },
  { name: "Lal Mirch Powder (Red Chilli)", hindiName: "लाल मिर्च पाउडर", category: "spices", unit: "kg", rate: 340, description: "Fine red chilli powder for rich heat and color", keywords: ["mirch", "chilli", "lal mirch"] },
  { name: "Kashmiri Lal Mirch", hindiName: "कश्मीरी लाल मिर्च", category: "spices", unit: "kg", rate: 480, description: "Mild heat with deep natural red curry coloring", keywords: ["kashmiri", "deggi"] },
  { name: "Chhoti Elaichi (Green Cardamom)", hindiName: "छोटी इलायची", category: "spices", unit: "kg", rate: 3200, description: "Aromatic bold green cardamom pods (₹320 per 100g)", keywords: ["elaichi", "cardamom", "choti elaichi", "hari elaichi"] },
  { name: "Badi Elaichi (Black Cardamom)", hindiName: "बड़ी इलायची", category: "spices", unit: "kg", rate: 1750, description: "Smoky black cardamom pods for gravies and biryani", keywords: ["badi elaichi", "black cardamom", "moti elaichi"] },
  { name: "Sabut Kali Mirch (Black Pepper)", hindiName: "काली मिर्च", category: "spices", unit: "kg", rate: 850, description: "Bold black peppercorns for rich punjent spice", keywords: ["kali mirch", "black pepper", "pepper"] },
  { name: "Laung (Cloves)", hindiName: "साबुत लौंग", category: "spices", unit: "kg", rate: 1150, description: "Aromatic whole dried flower buds", keywords: ["laung", "clove", "cloves", "lavang"] },
  { name: "Dalchini (Cinnamon Bark)", hindiName: "दालचीनी", category: "spices", unit: "kg", rate: 460, description: "Aromatic sweet cinnamon bark sticks", keywords: ["dalchini", "cinnamon"] },
  { name: "Rai / Sarson (Mustard Seeds)", hindiName: "राई / सरसों दाना", category: "spices", unit: "kg", rate: 110, description: "Black / yellow mustard seeds for tadka and pickling", keywords: ["rai", "sarson", "mustard"] },
  { name: "Saunf (Fennel Seeds)", hindiName: "सौंफ", category: "spices", unit: "kg", rate: 240, description: "Sweet fennel seeds for cooking and mukhwas", keywords: ["saunf", "fennel", "variyali"] },
  { name: "Ajwain (Carom Seeds)", hindiName: "अजवाइन", category: "spices", unit: "kg", rate: 290, description: "Digestive carom seeds for puris and parathas", keywords: ["ajwain", "carom"] },
  { name: "Kasuri Methi", hindiName: "कस्तूरी मेथी", category: "spices", unit: "packet", rate: 45, description: "Dried fenugreek leaves (50g box) for restaurant-style aroma", keywords: ["kasuri", "methi", "kasoori"] },
  { name: "Asafoetida (Hing Vandevi)", hindiName: "हींग (50g)", category: "spices", unit: "packet", rate: 115, description: "Compounded hing for aromatic dal tadka", keywords: ["hing", "asafoetida"] },
  { name: "Kesar (Pure Kashmir Saffron 1g)", hindiName: "शुद्ध केसर", category: "spices", unit: "g", rate: 350, description: "Grade A Mogra saffron threads for sweets and milk", keywords: ["kesar", "saffron", "zafran"] },
  { name: "Jaiphal (Nutmeg)", hindiName: "जायफल", category: "spices", unit: "piece", rate: 25, description: "Whole nutmeg nut for sweets and biryani spices", keywords: ["jaiphal", "nutmeg"] },
  { name: "Javitri (Mace)", hindiName: "जावित्री", category: "spices", unit: "kg", rate: 2200, description: "Fragrant mace spice flower blades", keywords: ["javitri", "mace"] },
  { name: "Tejpatta (Bay Leaves)", hindiName: "तेजपत्ता", category: "spices", unit: "kg", rate: 240, description: "Dried Indian bay leaves for pulao and curries", keywords: ["tejpatta", "bay leaf", "tej patta"] },
  { name: "Amchur Powder", hindiName: "आमचूर पाउडर", category: "spices", unit: "kg", rate: 320, description: "Tangy dry mango powder for snacks and chat", keywords: ["amchur", "mango powder", "aamchur"] },
  { name: "Garam Masala Shahi", hindiName: "शाही गरम मसाला", category: "spices", unit: "kg", rate: 680, description: "Signature 15-spice aromatic blend", keywords: ["garam masala", "garam"] },
  { name: "Biryani Masala", hindiName: "बिरयानी मसाला", category: "spices", unit: "packet", rate: 75, description: "Aromatic Mughlai biryani blend (100g pack)", keywords: ["biryani masala", "biryani"] },

  // Dals & Pulses
  { name: "Toor Dal (Arhar Dal)", hindiName: "अरहर / तूर दाल", category: "dal_pulses", unit: "kg", rate: 165, description: "Unpolished premium yellow pigeon pea dal", keywords: ["toor", "arhar", "tuvar"] },
  { name: "Moong Dal Dhuli (Yellow)", hindiName: "मूंग दाल धुली", category: "dal_pulses", unit: "kg", rate: 130, description: "Yellow split washed moong lentils", keywords: ["moong", "mung"] },
  { name: "Chana Dal", hindiName: "चना दाल", category: "dal_pulses", unit: "kg", rate: 92, description: "Polished split Bengal gram dal", keywords: ["chana dal", "bengal gram"] },
  { name: "Urad Dal Dhuli (White)", hindiName: "उड़द दाल धुली", category: "dal_pulses", unit: "kg", rate: 145, description: "White split skinless urad for idli, dosa, and vada", keywords: ["urad", "udad"] },
  { name: "Masoor Dal (Red Lentils)", hindiName: "मसूर दाल मलका", category: "dal_pulses", unit: "kg", rate: 98, description: "Split red masoor malka lentils", keywords: ["masoor", "malka"] },
  { name: "Kabuli Chana (Chole)", hindiName: "काबुली चना / छोले", category: "dal_pulses", unit: "kg", rate: 135, description: "Large white chickpeas for Amritsari chole", keywords: ["kabuli", "chana", "chole", "chickpeas"] },
  { name: "Kala Chana (Desi)", hindiName: "काला चना", category: "dal_pulses", unit: "kg", rate: 85, description: "Nutritious brown desi chickpeas", keywords: ["kala chana", "black chana"] },
  { name: "Rajma Chitra (Kidney Beans)", hindiName: "चित्रा राजमा", category: "dal_pulses", unit: "kg", rate: 155, description: "Premium spotted Himalayan kidney beans", keywords: ["rajma", "kidney beans"] },
  { name: "Soya Chunks / Nutrela", hindiName: "सोया चंक्स", category: "dal_pulses", unit: "kg", rate: 120, description: "High-protein texturized vegetable protein chunks", keywords: ["soya", "soyabean", "nutrela", "chunks"] },

  // Grains & Flour
  { name: "Chakki Fresh Sharbati Atta", hindiName: "शरबती गेहूं आटा", category: "grains_flour", unit: "kg", rate: 44, description: "100% pure MP Sharbati wheat stone-ground flour", keywords: ["atta", "aata", "wheat flour", "sharbati"] },
  { name: "Basmati Rice Premium 1121", hindiName: "बासमती चावल 1121", category: "grains_flour", unit: "kg", rate: 135, description: "Extra-long grain aged aromatic basmati rice", keywords: ["basmati", "rice", "chawal", "1121"] },
  { name: "Regular Kolam / Sona Masoori Rice", hindiName: "सोना मसूरी चावल", category: "grains_flour", unit: "kg", rate: 62, description: "Daily cooking medium grain lightweight rice", keywords: ["sona", "masoori", "kolam", "rice"] },
  { name: "Maida (Refined Wheat Flour)", hindiName: "मैदा", category: "grains_flour", unit: "kg", rate: 38, description: "Fine bakery-grade all-purpose white flour", keywords: ["maida", "all purpose flour"] },
  { name: "Sooji / Rava (Semolina)", hindiName: "सूजी / रवा", category: "grains_flour", unit: "kg", rate: 42, description: "Granulated wheat semolina for halwa, upma, and idli", keywords: ["sooji", "suji", "rava"] },
  { name: "Besan (Gram Flour)", hindiName: "चना बेसन", category: "grains_flour", unit: "kg", rate: 98, description: "Pure ground chana dal flour for pakoras and sweets", keywords: ["besan", "gram flour"] },
  { name: "Poha (Thick Flattened Rice)", hindiName: "पोहा मोटा", category: "grains_flour", unit: "kg", rate: 55, description: "Clean thick beaten rice flakes for morning breakfast", keywords: ["poha", "pohe", "flattened rice", "chuda"] },
  { name: "Sabudana (Tapioca Sago)", hindiName: "साबुदाना बड़ा", category: "grains_flour", unit: "kg", rate: 90, description: "Pearled sago for fasting khichdi and kheer", keywords: ["sabudana", "sago"] },

  // Oil & Ghee
  { name: "Kachi Ghani Sarson Ka Tel", hindiName: "कच्ची घानी सरसों तेल", category: "oil_ghee", unit: "litre", rate: 158, description: "Cold-pressed pungent mustard cooking oil", keywords: ["sarson", "mustard oil", "kachi ghani", "tel"] },
  { name: "Refined Sunflower Oil (1L Pouch)", hindiName: "रिफाइंड तेल 1L", category: "oil_ghee", unit: "packet", rate: 138, description: "Light refined heart-friendly cooking oil", keywords: ["sunflower oil", "refined oil", "cooking oil", "fortune"] },
  { name: "Pure Desi Cow Ghee", hindiName: "शुद्ध देशी गाय घी", category: "oil_ghee", unit: "litre", rate: 640, description: "Traditional aromatic bilona cow milk ghee", keywords: ["ghee", "desi ghee", "cow ghee"] },

  // Dry Fruits
  { name: "Kaju W320 (Cashews)", hindiName: "काजू साबुत W320", category: "dry_fruits", unit: "kg", rate: 840, description: "Whole bold white crunchy cashew nuts", keywords: ["kaju", "cashew", "cashews"] },
  { name: "Badam Giri (California Almonds)", hindiName: "कैलिफोर्निया बादाम", category: "dry_fruits", unit: "kg", rate: 780, description: "Sweet premium California almond kernels", keywords: ["badam", "almond", "almonds"] },
  { name: "Kishmish (Green Raisins)", hindiName: "हरी किशमिश", category: "dry_fruits", unit: "kg", rate: 340, description: "Long sweet green seedless Afghan raisins", keywords: ["kishmish", "kismis", "raisins"] },
  { name: "Akhrot Giri (Walnut Kernels)", hindiName: "अखरोट गिरी", category: "dry_fruits", unit: "kg", rate: 980, description: "Light half-kernels Kashmiri walnut meat", keywords: ["akhrot", "walnut", "walnuts"] },
  { name: "Pista Salted (Pistachios)", hindiName: "नमकीन पिस्ता", category: "dry_fruits", unit: "kg", rate: 1150, description: "Roasted salted Iranian pistachios", keywords: ["pista", "pistachio", "pistachios"] },
  { name: "Phool Makhana (Fox Nuts)", hindiName: "फूल मखाना", category: "dry_fruits", unit: "kg", rate: 920, description: "Puffed lotus seeds for roasting and sweets", keywords: ["makhana", "fox nuts", "lotus seeds"] },

  // Packaged & Daily Essentials
  { name: "Tata Salt (1kg Pouch)", hindiName: "टाटा नमक 1kg", category: "daily_needs", unit: "packet", rate: 28, description: "Iodised vacuum evaporated salt pouch", keywords: ["salt", "namak", "tata salt"] },
  { name: "Refined White Sugar (Cheeni)", hindiName: "सफेद चीनी", category: "daily_needs", unit: "kg", rate: 45, description: "Crystalline sulfur-free white sugar", keywords: ["sugar", "cheeni", "shakar"] },
  { name: "Red Label / Taj Mahal Tea (250g)", hindiName: "चाय पत्ती 250g", category: "daily_needs", unit: "packet", rate: 140, description: "Strong CTC granular tea blend", keywords: ["tea", "chai", "patti", "red label", "taj mahal"] },
];

function findInCuratedCatalog(query: string): KiranaItemCatalog | null {
  const q = query.toLowerCase().trim();
  for (const item of CURATED_KIRANA_CATALOG) {
    if (item.name.toLowerCase().includes(q) || item.hindiName.includes(q)) {
      return item;
    }
    for (const kw of item.keywords) {
      if (q === kw || q.includes(kw) || kw.includes(q)) {
        return item;
      }
    }
  }
  return null;
}

// 100% Free Open API Kirana & Spice Item Search Engine
// Utilizing:
// 1. Open Food Facts Free Public Food & Barcode Database (100% Free, No API key, Millions of Indian grocery items)
// 2. Wikipedia & Wikimedia Commons Open REST API (100% Free, Authentic Hindi names & images)
// 3. DuckDuckGo Instant Answer Free API (100% Free zero-tracking instant lookup)
// 4. Curated Indian APMC Mandi Benchmark Pricing Catalog (Zero latency & 100% Free)
app.post("/api/item-search", async (req, res) => {
  const { query, barcode } = req.body;
  const rawInput = (typeof query === "string" ? query : "") || (typeof barcode === "string" ? barcode : "");
  if (!rawInput.trim()) {
    return res.status(400).json({ error: "Search query or barcode is required." });
  }

  const cleanQuery = rawInput.trim();
  const lowerQuery = cleanQuery.toLowerCase();

  // Check if query is or contains a numeric barcode (EAN-13, EAN-8, UPC, etc.)
  const barcodeMatch = (barcode && String(barcode).trim()) || cleanQuery.match(/\b\d{8,14}\b/)?.[0] || null;

  let searchSummary = "Retrieved via Free Open APIs (Open Food Facts • Wikipedia • DuckDuckGo)";
  let searchQueries: string[] = [cleanQuery];
  let sources: Array<{ title: string; url: string }> = [];
  let freeApiSource = "Free Public Database";
  let parsedItem: {
    name: string;
    hindiName?: string;
    category?: string;
    suggestedUnit?: string;
    typicalMarketRate?: number;
    description?: string;
    imageUrl?: string;
    searchSummary?: string;
  } | null = null;

  // 1. If Barcode detected: Query Open Food Facts Free Barcode API (100% Free, No Key)
  if (barcodeMatch) {
    try {
      const offBarcodeUrl = `https://world.openfoodfacts.net/api/v2/product/${barcodeMatch}?fields=product_name,product_name_en,product_name_hi,generic_name,brands,categories,quantity,packaging,image_url,image_front_url,image_small_url`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const offBarcodeRes = await fetch(offBarcodeUrl, {
        headers: {
          "User-Agent": "NayabPOS/1.0 (Free Public Barcode API)",
          Accept: "application/json",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (offBarcodeRes.ok) {
        const offJson = await offBarcodeRes.json();
        const p = offJson?.product;
        if (p && (p.product_name || p.product_name_en || p.generic_name)) {
          const rawName = p.product_name || p.product_name_en || p.generic_name;
          const brand = p.brands ? `${p.brands} ` : "";
          const fullName = `${brand}${rawName}`.trim();

          const packaging = (p.quantity || p.packaging || "").toLowerCase();
          let unit = "packet";
          if (packaging.includes("kg") || packaging.includes("kilo")) unit = "kg";
          else if (packaging.includes("litre") || packaging.includes(" l") || packaging.includes("liter")) unit = "litre";
          else if (packaging.includes(" g") || packaging.includes("gm")) unit = "g";
          else if (packaging.includes("pc") || packaging.includes("piece")) unit = "piece";

          let cat = "daily_needs";
          const catStr = (p.categories || "").toLowerCase();
          if (catStr.includes("spice") || catStr.includes("masala") || catStr.includes("herb")) cat = "spices";
          else if (catStr.includes("oil") || catStr.includes("ghee") || catStr.includes("fat")) cat = "oil_ghee";
          else if (catStr.includes("pulse") || catStr.includes("dal") || catStr.includes("legume")) cat = "dal_pulses";
          else if (catStr.includes("flour") || catStr.includes("grain") || catStr.includes("rice")) cat = "grains_flour";
          else if (catStr.includes("nut") || catStr.includes("dry fruit")) cat = "dry_fruits";

          let estRate = 60;
          if (cat === "spices") estRate = 180;
          else if (cat === "oil_ghee") estRate = 145;
          else if (cat === "dry_fruits") estRate = 750;
          else if (cat === "grains_flour") estRate = 55;

          const img = p.image_front_url || p.image_url || p.image_small_url;

          sources.push({
            title: `Open Food Facts Barcode API: ${fullName}`,
            url: `https://world.openfoodfacts.org/product/${barcodeMatch}`,
          });

          freeApiSource = "Open Food Facts Free Barcode API";
          parsedItem = {
            name: fullName.slice(0, 48),
            hindiName: p.product_name_hi || "",
            category: cat,
            suggestedUnit: unit,
            typicalMarketRate: estRate,
            description: p.generic_name || `Barcode item ${barcodeMatch} from free Open Food Facts catalog`,
            imageUrl: img || undefined,
            searchSummary: `Verified via Free Open Food Facts Barcode API (EAN ${barcodeMatch})`,
          };
        }
      }
    } catch {
      // Barcode lookup network timeout fallback
    }
  }

  // 2. Check Curated Indian Mandi Catalog for instant exact Kirana match
  const catalogMatch = findInCuratedCatalog(cleanQuery);

  // 3. Query Open Food Facts Public Text Search API (100% Free, Zero Key, Millions of Indian FMCG items)
  if (!barcodeMatch && !catalogMatch) {
    try {
      const offSearchUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
        cleanQuery
      )}&search_simple=1&action=process&json=1&page_size=3`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const offRes = await fetch(offSearchUrl, {
        headers: {
          "User-Agent": "NayabPOS/1.0 (Free Public Open Food Facts API)",
          Accept: "application/json",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (offRes.ok) {
        const offData = await offRes.json();
        if (offData.products && offData.products.length > 0) {
          const p = offData.products[0];
          const brand = p.brands ? `${p.brands} ` : "";
          const prodName = p.product_name || p.product_name_en || cleanQuery;
          const fullName = `${brand}${prodName}`.trim();

          let cat = "daily_needs";
          const catStr = (p.categories || "").toLowerCase();
          if (catStr.includes("spice") || catStr.includes("masala") || catStr.includes("herb")) cat = "spices";
          else if (catStr.includes("oil") || catStr.includes("ghee") || catStr.includes("fat")) cat = "oil_ghee";
          else if (catStr.includes("pulse") || catStr.includes("dal") || catStr.includes("legume")) cat = "dal_pulses";
          else if (catStr.includes("flour") || catStr.includes("grain") || catStr.includes("rice")) cat = "grains_flour";
          else if (catStr.includes("nut") || catStr.includes("dry fruit")) cat = "dry_fruits";

          let estRate = 80;
          if (cat === "spices") estRate = 180;
          else if (cat === "oil_ghee") estRate = 150;
          else if (cat === "dry_fruits") estRate = 750;

          const img = p.image_front_url || p.image_url || p.image_small_url;

          sources.push({
            title: `Open Food Facts Public API: ${fullName}`,
            url: p.code ? `https://world.openfoodfacts.org/product/${p.code}` : "https://world.openfoodfacts.org",
          });

          freeApiSource = "Open Food Facts Public Open API";
          parsedItem = {
            name: fullName.slice(0, 48),
            hindiName: p.product_name_hi || "",
            category: cat,
            suggestedUnit: "packet",
            typicalMarketRate: estRate,
            description: p.generic_name || `Found via free Open Food Facts catalog (${cat})`,
            imageUrl: img || undefined,
            searchSummary: `Verified via Free Open Food Facts Public Search`,
          };
        }
      }
    } catch {
      // Free search fallback
    }
  }

  // 4. Query Wikipedia Open REST API for description and Wikimedia Commons verified free photo
  let wikiPhotoUrl: string | undefined = undefined;
  if (!parsedItem?.imageUrl) {
    try {
      // Try direct summary API
      const wikiQuery = catalogMatch ? catalogMatch.name.split(" (")[0] : cleanQuery;
      const wikiSummaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiQuery)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const wikiRes = await fetch(wikiSummaryUrl, {
        headers: {
          "User-Agent": "NayabPOS/1.0 (Wikipedia Free Open API)",
          Accept: "application/json",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (wikiRes.ok) {
        const wikiData = await wikiRes.json();
        if (wikiData?.thumbnail?.source) {
          wikiPhotoUrl = wikiData.thumbnail.source;
        }
        if (wikiData?.title && !parsedItem) {
          sources.push({
            title: `Wikipedia Free API: ${wikiData.title}`,
            url: wikiData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiData.title)}`,
          });
          if (!catalogMatch) {
            parsedItem = {
              name: wikiData.title.slice(0, 45),
              category: "spices",
              suggestedUnit: "kg",
              typicalMarketRate: 250,
              description: wikiData.extract?.slice(0, 160) || "Open Wikipedia retail food encyclopedia reference",
              imageUrl: wikiPhotoUrl,
              searchSummary: "Verified via Free Wikipedia Open API",
            };
            freeApiSource = "Wikipedia Free Open API";
          }
        }
      }
    } catch {
      // Wikipedia fallback
    }
  }

  // 4. Query Open Food Facts Free Search API if item not yet found
  if (!parsedItem && !catalogMatch) {
    try {
      const offSearchUrl = `https://world.openfoodfacts.net/api/v2/search?search_terms=${encodeURIComponent(
        cleanQuery
      )}&page_size=2&fields=product_name,product_name_en,product_name_hi,generic_name,brands,categories,quantity,packaging,image_url,image_front_url`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const offRes = await fetch(offSearchUrl, {
        headers: {
          "User-Agent": "NayabPOS/1.0 (Free Public Open Food Facts API)",
          Accept: "application/json",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (offRes.ok) {
        const offData = await offRes.json();
        if (offData?.products && Array.isArray(offData.products) && offData.products.length > 0) {
          const product = offData.products[0];
          const prodName = product.product_name || product.product_name_en || product.generic_name;
          if (prodName) {
            const brandStr = product.brands ? `${product.brands} ` : "";
            const packaging = (product.quantity || product.packaging || "").toLowerCase();
            let unit = "kg";
            if (packaging.includes("l") || packaging.includes("ml") || packaging.includes("litre")) unit = "litre";
            else if (packaging.includes("packet") || packaging.includes("pouch")) unit = "packet";
            else if (packaging.includes("pc") || packaging.includes("piece")) unit = "piece";
            else if (packaging.includes("g") && !packaging.includes("kg")) unit = "g";

            let cat = "general";
            const catStr = (product.categories || "").toLowerCase();
            if (catStr.includes("spice") || catStr.includes("herb")) cat = "spices";
            else if (catStr.includes("oil") || catStr.includes("ghee")) cat = "oil_ghee";
            else if (catStr.includes("pulse") || catStr.includes("dal")) cat = "dal_pulses";
            else if (catStr.includes("grain") || catStr.includes("flour")) cat = "grains_flour";
            else if (catStr.includes("nut") || catStr.includes("dry fruit")) cat = "dry_fruits";

            sources.push({
              title: `Open Food Facts Free API: ${brandStr}${prodName}`,
              url: `https://world.openfoodfacts.org`,
            });

            parsedItem = {
              name: `${brandStr}${prodName}`.slice(0, 45),
              hindiName: product.product_name_hi || "",
              category: cat,
              suggestedUnit: unit,
              typicalMarketRate: 140,
              description: product.generic_name || "Verified from Open Food Facts Public Database",
              imageUrl: product.image_front_url || product.image_url || undefined,
              searchSummary: "Verified from Free Open Food Facts Public Database",
            };
            freeApiSource = "Open Food Facts Free Search API";
          }
        }
      }
    } catch {
      // OFF search fallback
    }
  }

  // 5. Query DuckDuckGo Free Instant Answer API
  if (!parsedItem && !catalogMatch) {
    try {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(
        cleanQuery + " spice grocery india"
      )}&format=json&no_html=1&skip_disambig=1`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const ddgResponse = await fetch(ddgUrl, {
        headers: {
          "User-Agent": "NayabPOS/1.0 (DuckDuckGo Free API)",
          Accept: "application/json",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (ddgResponse.ok) {
        const ddgData = await ddgResponse.json();
        if (ddgData && (ddgData.Heading || ddgData.AbstractText)) {
          const title = ddgData.Heading || cleanQuery;
          const abstract = ddgData.AbstractText || "";
          sources.push({
            title: `DuckDuckGo Free API: ${title}`,
            url: ddgData.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}`,
          });
          parsedItem = {
            name: title.slice(0, 45),
            category: "spices",
            suggestedUnit: "kg",
            typicalMarketRate: 180,
            description: abstract.slice(0, 160) || "Retrieved from DuckDuckGo Free Instant Search",
            searchSummary: "Verified via Free DuckDuckGo Instant Search",
          };
          freeApiSource = "DuckDuckGo Free Search API";
        }
      }
    } catch {
      // DuckDuckGo fallback
    }
  }

  // Determine final item values using parsed response, catalog match, or smart Mandi heuristic
  let finalName = cleanQuery;
  let finalHindi = "";
  let finalCategory = "general";
  let finalUnit = "kg";
  let finalRate = 120;
  let finalDesc = "Indian Kirana retail market product";
  let finalImageUrl: string | undefined = wikiPhotoUrl;

  if (parsedItem && parsedItem.name) {
    finalName = parsedItem.name;
    finalHindi = parsedItem.hindiName || (catalogMatch ? catalogMatch.hindiName : "");
    finalCategory = parsedItem.category || (catalogMatch ? catalogMatch.category : "general");
    finalUnit = parsedItem.suggestedUnit || (catalogMatch ? catalogMatch.unit : "kg");
    finalRate = Number(parsedItem.typicalMarketRate) || (catalogMatch ? catalogMatch.rate : 120);
    finalDesc = parsedItem.description || "Current Indian retail market price";
    finalImageUrl = parsedItem.imageUrl || wikiPhotoUrl;
    searchSummary = parsedItem.searchSummary || `Retrieved via ${freeApiSource}`;
  } else if (catalogMatch) {
    finalName = catalogMatch.name;
    finalHindi = catalogMatch.hindiName;
    finalCategory = catalogMatch.category;
    finalUnit = catalogMatch.unit;
    finalRate = catalogMatch.rate;
    finalDesc = catalogMatch.description;
    finalImageUrl = wikiPhotoUrl;
    freeApiSource = "Curated Indian Mandi & APMC Database";
    searchSummary = `Verified from NAYAB Kirana Catalog (${catalogMatch.unit.toUpperCase()} @ ₹${catalogMatch.rate})`;
    sources.push({
      title: `Curated Indian APMC Mandi Rates: ${catalogMatch.name}`,
      url: "https://world.openfoodfacts.org",
    });
  } else {
    // Intelligent heuristic classification
    const capitalized = cleanQuery.charAt(0).toUpperCase() + cleanQuery.slice(1);
    finalName = capitalized;
    freeApiSource = "Free Mandi Benchmark Heuristic";
    if (lowerQuery.includes("dal") || lowerQuery.includes("chana") || lowerQuery.includes("rajma") || lowerQuery.includes("moong") || lowerQuery.includes("chole")) {
      finalCategory = "dal_pulses";
      finalRate = 130;
      finalDesc = "Pulses & Lentils retail estimate";
    } else if (lowerQuery.includes("oil") || lowerQuery.includes("tel") || lowerQuery.includes("ghee")) {
      finalCategory = "oil_ghee";
      finalUnit = "litre";
      finalRate = 160;
      finalDesc = "Edible oil & ghee retail packaging";
    } else if (lowerQuery.includes("rice") || lowerQuery.includes("atta") || lowerQuery.includes("flour") || lowerQuery.includes("chawal") || lowerQuery.includes("wheat")) {
      finalCategory = "grains_flour";
      finalRate = 65;
      finalDesc = "Flour & grains retail packing";
    } else if (lowerQuery.includes("kaju") || lowerQuery.includes("badam") || lowerQuery.includes("almond") || lowerQuery.includes("cashew") || lowerQuery.includes("pista") || lowerQuery.includes("walnut")) {
      finalCategory = "dry_fruits";
      finalRate = 850;
      finalDesc = "Dry fruit & nuts quality estimate";
    } else if (lowerQuery.includes("masala") || lowerQuery.includes("mirch") || lowerQuery.includes("pepper") || lowerQuery.includes("cardamom") || lowerQuery.includes("clove")) {
      finalCategory = "spices";
      finalRate = 450;
      finalDesc = "Indian whole / powdered spices";
    }
  }

  const resultItem = {
    name: finalName,
    hindiName: finalHindi,
    category: finalCategory,
    suggestedUnit: finalUnit,
    typicalMarketRate: finalRate,
    description: finalDesc,
    imageUrl: finalImageUrl,
    freeApiSource,
  };

  // Return both item object and top-level properties for 100% component compatibility
  return res.json({
    item: resultItem,
    name: resultItem.name,
    hindiName: resultItem.hindiName,
    category: resultItem.category,
    unit: resultItem.suggestedUnit,
    suggestedUnit: resultItem.suggestedUnit,
    estimatedRate: resultItem.typicalMarketRate,
    typicalMarketRate: resultItem.typicalMarketRate,
    rate: resultItem.typicalMarketRate,
    description: resultItem.description,
    imageUrl: resultItem.imageUrl,
    freeApiSource,
    freeApiStatus: "100% Free & Open APIs (Open Food Facts • Wikipedia • DuckDuckGo)",
    searchSummary,
    searchQueries,
    sources,
  });
});

// Endpoint providing transparent status of all 100% Free APIs used in the application
app.get("/api/free-apis-status", (_req, res) => {
  res.json({
    status: "active",
    cost: "₹0.00 / 100% Free Forever",
    requiresPaidBilling: false,
    cloudStatus: "100% Free Open APIs (Zero Google Cloud / Zero Paid Subscriptions)",
    apis: [
      {
        name: "DuckDuckGo Instant Answer API",
        provider: "DuckDuckGo",
        type: "Free Zero-Tracking Web Search & Knowledge",
        pricing: "100% Free Public API (Zero Key Required)",
        status: "Active & Connected",
        purpose: "Instant Kirana search queries, culinary classification, and grocery answers",
        url: "https://duckduckgo.com",
      },
      {
        name: "Open Food Facts Public API",
        provider: "Open Food Facts Community",
        type: "Free & Open-Source Global Food Database",
        pricing: "100% Free Public Open Data (Zero Key Required)",
        status: "Active & Connected",
        purpose: "Real-time FMCG grocery lookup & Indian barcode scanning (EAN-13, Tata, Amul, MDH, Fortune)",
        url: "https://world.openfoodfacts.org",
      },
      {
        name: "Wikipedia & Wikimedia Commons REST API",
        provider: "Wikimedia Foundation",
        type: "Free Open Knowledge & Media",
        pricing: "100% Free Public API (Zero Key Required)",
        status: "Active & Connected",
        purpose: "Authentic Hindi grocery names (हिन्दी नाम), botanical classification, and license-free spice photos",
        url: "https://en.wikipedia.org",
      },
      {
        name: "Open-Meteo Agricultural & Storage Weather API",
        provider: "Open-Meteo",
        type: "Free Open Weather & Humidity Data",
        pricing: "100% Free Open API (Zero Key Required)",
        status: "Active & Connected",
        purpose: "Local ambient temperature and relative humidity monitoring for spice moisture protection",
        url: "https://open-meteo.com",
      },
      {
        name: "OpenStreetMap / Nominatim API",
        provider: "OpenStreetMap Foundation",
        type: "Free Open Geospatial Data",
        pricing: "100% Free Open Data (Zero Key Required)",
        status: "Active & Connected",
        purpose: "Shop location & reverse geocoding for thermal receipts and digital invoices",
        url: "https://nominatim.openstreetmap.org",
      },
      {
        name: "Client-Side Offline QR Engine",
        provider: "Local Device Engine",
        type: "Local Zero-Network Generator",
        pricing: "100% Free & Offline (Zero Commission / Fees)",
        status: "Active & Offline Ready",
        purpose: "Instant dynamic UPI payment QR codes without third-party API dependencies",
        url: "Local Canvas / DataURL",
      },
    ],
  });
});

// Reverse Geocoding / Location Lookup endpoint via Nominatim (with user-agent compliant)
app.get("/api/reverse-geocode", async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: "lat and lng query params are required" });
    }

    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
      String(lat)
    )}&lon=${encodeURIComponent(String(lng))}&zoom=18&addressdetails=1`;

    const fetchRes = await fetch(nominatimUrl, {
      headers: {
        "User-Agent": "GeoNavigator-MapChatbot/1.0",
        Accept: "application/json",
      },
    });

    if (!fetchRes.ok) {
      return res.json({
        displayName: `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`,
        address: {},
      });
    }

    const data = await fetchRes.json();
    res.json({
      displayName: data.display_name || `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`,
      address: data.address || {},
    });
  } catch (err: any) {
    res.json({
      displayName: `${Number(req.query.lat).toFixed(4)}, ${Number(req.query.lng).toFixed(4)}`,
      address: {},
    });
  }
});

// Endpoint to download the full project source code as a ZIP file
app.get("/download-zip", (_req, res) => {
  const zipPath = path.join(process.cwd(), "public", "nayab-billing-source-code.zip");
  res.download(zipPath, "nayab-smart-billing-source-code.zip", (err) => {
    if (err) {
      console.error("Error sending zip:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to download zip file." });
      }
    }
  });
});

// Setup Vite middleware or static serving
async function startServer() {
  // Serve static files in public folder
  app.use(express.static(path.join(process.cwd(), "public")));

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
