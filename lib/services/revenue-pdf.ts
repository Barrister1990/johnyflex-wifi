import { createRequire } from "module";
import { existsSync } from "fs";
import { join } from "path";
import type { RevenueSummary } from "@/lib/types";

type PdfDoc = {
  page: { width: number; height: number };
  on(event: "data", cb: (chunk: Buffer) => void): void;
  on(event: "end", cb: () => void): void;
  on(event: "error", cb: (err: Error) => void): void;
  rect(
    x: number,
    y: number,
    w: number,
    h: number,
  ): { fill(color: string): void };
  roundedRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): { stroke(color: string): void };
  fillColor(color: string): PdfDoc;
  fontSize(size: number): PdfDoc;
  font(name: string): PdfDoc;
  text(
    text: string,
    x?: number,
    y?: number,
    options?: { continued?: boolean; width?: number },
  ): PdfDoc;
  moveTo(x: number, y: number): {
    lineTo(x: number, y: number): { stroke(color: string): void };
  };
  addPage(): void;
  end(): void;
};

type PdfCtor = new (options?: {
  size?: string;
  margin?: number;
  info?: Record<string, string>;
}) => PdfDoc;

/** Lazy-load pdfkit only when exporting — avoids Next build-time MODULE_NOT_FOUND. */
function loadPdfKit(): PdfCtor {
  const root = process.cwd();
  const pkgJson = join(root, "package.json");
  const pdfkitEntry = join(root, "node_modules", "pdfkit", "js", "pdfkit.js");
  if (!existsSync(pdfkitEntry) && !existsSync(join(root, "node_modules", "pdfkit"))) {
    throw new Error(
      "pdfkit is not installed. On the server run: npm install pdfkit && npm run build",
    );
  }
  const requirePdf = createRequire(pkgJson);
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- CJS runtime load
  return requirePdf("pdfkit") as PdfCtor;
}

function money(currency: string, n: number) {
  return `${currency} ${n.toFixed(2)}`;
}

/** Auditor / bank style financial statement PDF. */
export async function buildRevenuePdf(
  summary: RevenueSummary,
  opts?: { companyName?: string; generatedBy?: string },
): Promise<Buffer> {
  const PDFDocument = loadPdfKit();
  const company = opts?.companyName ?? "JohnnyFlex";
  const generatedBy = opts?.generatedBy ?? "Operator";

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 48,
      info: {
        Title: `Financial Report ${summary.from} to ${summary.to}`,
        Author: company,
        Subject: "Hotspot revenue and expenses",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const ink = "#0F1115";
    const muted = "#5c6570";
    const accent = "#c4a35a";

    // Header band
    doc.rect(0, 0, doc.page.width, 72).fill(ink);
    doc.fillColor("#ffffff").fontSize(18).font("Helvetica-Bold");
    doc.text(company, 48, 22, { continued: false });
    doc.fontSize(10).font("Helvetica").fillColor("#d8dde3");
    doc.text("Financial Report — Hotspot Billing", 48, 46);

    doc.fillColor(ink);
    doc.fontSize(11).font("Helvetica-Bold");
    doc.text("Statement period", 48, 96);
    doc.font("Helvetica").fontSize(10).fillColor(muted);
    doc.text(`${summary.from}  →  ${summary.to}`, 48, 112);
    doc.text(
      `Generated ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC · ${generatedBy}`,
      48,
      126,
    );

    // Summary box
    const boxY = 150;
    doc.roundedRect(48, boxY, doc.page.width - 96, 88, 6).stroke(accent);
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(9);
    doc.text("GROSS REVENUE", 60, boxY + 14);
    doc.text("EXPENSES", 220, boxY + 14);
    doc.text("NET PROFIT / (LOSS)", 360, boxY + 14);
    doc.fontSize(14);
    doc.text(money(summary.currency, summary.grossRevenue), 60, boxY + 32);
    doc.text(money(summary.currency, summary.expenseTotal), 220, boxY + 32);
    doc.fillColor(summary.netProfit >= 0 ? "#1a7a4c" : "#b42318");
    doc.text(money(summary.currency, summary.netProfit), 360, boxY + 32);

    doc.fillColor(muted).font("Helvetica").fontSize(9);
    doc.text(
      `${summary.successfulPayments} successful · ${summary.failedPayments} failed · ${summary.pendingPayments} pending · avg ticket ${money(summary.currency, summary.averageTicket)}`,
      60,
      boxY + 58,
      { width: doc.page.width - 120 },
    );

    let y = boxY + 110;
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(11);
    doc.text("Revenue by channel", 48, y);
    y += 18;
    doc.font("Helvetica").fontSize(10).fillColor(muted);
    doc.text(`Paystack: ${money(summary.currency, summary.paystackRevenue)}`, 48, y);
    doc.text(`Voucher: ${money(summary.currency, summary.voucherRevenue)}`, 220, y);
    doc.text(`Mock / other: ${money(summary.currency, summary.mockRevenue)}`, 360, y);
    y += 28;

    // Period buckets
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(11);
    doc.text("Period breakdown", 48, y);
    y += 16;
    doc.fontSize(8).fillColor(muted);
    doc.text("Period", 48, y);
    doc.text("Revenue", 200, y);
    doc.text("Expenses", 290, y);
    doc.text("Net", 380, y);
    doc.text("Txns", 470, y);
    y += 12;
    doc.moveTo(48, y).lineTo(doc.page.width - 48, y).stroke("#e5e7eb");
    y += 8;
    doc.font("Helvetica").fontSize(9).fillColor(ink);
    for (const b of summary.buckets.slice(-24)) {
      if (y > doc.page.height - 120) {
        doc.addPage();
        y = 48;
      }
      doc.text(b.label, 48, y, { width: 140 });
      doc.text(money(summary.currency, b.revenue), 200, y);
      doc.text(money(summary.currency, b.expenses), 290, y);
      doc.text(money(summary.currency, b.net), 380, y);
      doc.text(String(b.payments), 470, y);
      y += 14;
    }

    y += 16;
    if (y > doc.page.height - 160) {
      doc.addPage();
      y = 48;
    }
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(11);
    doc.text("Successful payments (detail)", 48, y);
    y += 16;
    doc.fontSize(8).fillColor(muted);
    doc.text("Date", 48, y);
    doc.text("Reference", 120, y);
    doc.text("Customer", 250, y);
    doc.text("Package", 360, y);
    doc.text("Amount", 470, y);
    y += 12;
    doc.moveTo(48, y).lineTo(doc.page.width - 48, y).stroke("#e5e7eb");
    y += 8;
    doc.font("Helvetica").fontSize(8).fillColor(ink);
    for (const p of summary.payments.slice(0, 40)) {
      if (y > doc.page.height - 100) {
        doc.addPage();
        y = 48;
      }
      doc.text(p.createdAt.slice(0, 10), 48, y);
      doc.text(p.reference.slice(0, 18), 120, y);
      doc.text((p.customerEmail || "—").slice(0, 22), 250, y);
      doc.text((p.packageName || "—").slice(0, 18), 360, y);
      doc.text(money(p.currency, p.amount), 470, y);
      y += 12;
    }

    if (summary.expenses.length) {
      y += 16;
      if (y > doc.page.height - 100) {
        doc.addPage();
        y = 48;
      }
      doc.fillColor(ink).font("Helvetica-Bold").fontSize(11);
      doc.text("Expenses", 48, y);
      y += 16;
      doc.font("Helvetica").fontSize(8);
      for (const e of summary.expenses.slice(0, 30)) {
        if (y > doc.page.height - 80) {
          doc.addPage();
          y = 48;
        }
        doc.fillColor(muted).text(e.incurredAt.slice(0, 10), 48, y);
        doc.fillColor(ink).text(`${e.category} — ${e.description}`.slice(0, 50), 120, y);
        doc.text(money(e.currency, e.amount), 470, y);
        y += 12;
      }
    }

    // Footer attestation
    const foot = doc.page.height - 64;
    doc.moveTo(48, foot - 16).lineTo(doc.page.width - 48, foot - 16).stroke("#e5e7eb");
    doc.fontSize(8).fillColor(muted).font("Helvetica");
    doc.text(
      "This report is generated from WiFiHub billing records (successful payments and recorded expenses). Paystack settlement figures, where applicable, should be reconciled against the Paystack dashboard and bank statements. For audit / banking use.",
      48,
      foot - 8,
      { width: doc.page.width - 96 },
    );

    doc.end();
  });
}
