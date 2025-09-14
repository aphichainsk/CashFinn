import { Models, Query } from "appwrite";
import { account, databases, DATABASE_ID, TX_COLLECTION_ID } from "./appwrite_config";

export type TxDoc = Models.Document & {
  userId: string;                
  type: "income" | "spend";
  amount: number;                // Double
  date: string;                  // ISO string
  note?: string | null;
  category?: string | null;
};

export async function getCurrentUserId() {
  const me = await account.get();
  return me.$id;
}

export type DateRange = { startISO: string; endISO: string };

export async function listMyTransactionsInRange(range: DateRange): Promise<TxDoc[]> {
  const uid = await getCurrentUserId();

  const LIMIT = 100;
  const all: TxDoc[] = [];
  let cursor: string | null = null;

  while (true) {
    const queries: any[] = [
      Query.equal("userId", uid),                         // ✅ คีย์ตรง DB
      Query.greaterThanEqual("date", range.startISO),
      Query.lessThanEqual("date", range.endISO),
      Query.orderAsc("date"),
      Query.limit(LIMIT),
    ];
    if (cursor) queries.push(Query.cursorAfter(cursor));

    const res = await databases.listDocuments<TxDoc>(
      DATABASE_ID,
      TX_COLLECTION_ID,
      queries
    );

    all.push(...res.documents);
    if (res.documents.length < LIMIT) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }
  return all;
}

export function summarize(trans: TxDoc[]) {
  let income = 0;
  let spend = 0;
  const byCat: Record<string, { income: number; spend: number }> = {};

  for (const t of trans) {
    const cat = (t.category || "uncategorized").toLowerCase();
    if (!byCat[cat]) byCat[cat] = { income: 0, spend: 0 };

    if (t.type === "income") {
      income += t.amount || 0;
      byCat[cat].income += t.amount || 0;
    } else {
      spend += t.amount || 0;
      byCat[cat].spend += t.amount || 0;
    }
  }
  const balance = income - spend;
  return { income, spend, balance, byCat };
}

export function toCSV(trans: TxDoc[]) {
  const header = ["date", "type", "category", "note", "amount"];
  const rows = trans.map((t) => [
    t.date,
    t.type,
    t.category || "",
    (t.note || "").replace(/"/g, '""'),
    Number(t.amount ?? 0).toFixed(2),
  ]);
  return header.join(",") + "\n" +
    rows.map((r) => r.map((c) => (c.includes(",") ? `"${c}"` : c)).join(",")).join("\n");
}

export function htmlReport(opts: {
  title: string;
  currency?: string;
  summary: { income: number; spend: number; balance: number };
  trans: TxDoc[];
}) {
  const { title, summary, trans, currency = "THB" } = opts;
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const rows = trans.map(t => `
    <tr>
      <td>${t.date?.slice(0,10)}</td>
      <td class="${t.type}">${t.type}</td>
      <td>${t.category || ""}</td>
      <td>${t.note || ""}</td>
      <td class="amt ${t.type}">${fmt(Number(t.amount || 0))} ${currency}</td>
    </tr>`).join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>${title}</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial;padding:16px;color:#111827}
h1{font-size:18px;margin:0 0 10px}
.sum{display:flex;gap:12px;margin:10px 0}
.card{border:1px solid #e5e7eb;border-radius:12px;padding:12px;min-width:150px}
.lab{font-size:12px;color:#6b7280}.val{font-size:16px;font-weight:700}
.inc{color:#0B5BD3}.sp{color:#EF4444}.bal{color:#111827}
table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}
th,td{border-bottom:1px solid #e5e7eb;padding:8px;text-align:left}
td.amt{text-align:right} td.income{color:#0B5BD3} td.spend{color:#EF4444}
</style></head>
<body>
<h1>${title}</h1>
<div class="sum">
  <div class="card"><div class="lab">Income</div><div class="val inc">+${fmt(summary.income)} ${currency}</div></div>
  <div class="card"><div class="lab">Spend</div><div class="val sp">-${fmt(summary.spend)} ${currency}</div></div>
  <div class="card"><div class="lab">Balance</div><div class="val bal">${fmt(summary.balance)} ${currency}</div></div>
</div>
<table><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Note</th><th>Amount</th></tr></thead>
<tbody>${rows}</tbody></table>
</body></html>`;
}
