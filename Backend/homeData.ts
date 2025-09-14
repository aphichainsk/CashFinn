// Backend/home_data.ts
import { Query } from "appwrite";
import {
  account,
  databases,
  DB_ID,
  PROFILE_COLLECTION_ID,
  TX_COLLECTION_ID, // ✅ ต้องกำหนดให้ถูกใน appwrite_config
} from "./appwrite_config";

const USERS_COLLECTION_ID =
  (process.env.EXPO_PUBLIC_APPWRITE_USERS_COLLECTION_ID as string) || "users";

type Item = {
  id: string;
  label: string;
  amount: number;
  type: "income" | "spend";
};

export type HomeSnapshot = {
  name: string;
  dailySpend: number;
  balance: number;
  items: Item[];       // รายการล่าสุดของเดือน (3 รายการ)
  income7d: number;    // รายรับ 7 วันล่าสุด
  spend7d: number;     // รายจ่าย 7 วันล่าสุด
};

export async function getHomeSnapshot(): Promise<HomeSnapshot> {
  const me = await account.get();

  // ดึงชื่อจากโปรไฟล์ถ้ามี
  let name = me.name || "User";
  try {
    const prof = await databases.getDocument<any>(
      DB_ID,
      PROFILE_COLLECTION_ID,
      me.$id
    );
    if (prof?.username) name = prof.username;
  } catch {}

  // กำหนดช่วงเวลา
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay); endOfDay.setDate(endOfDay.getDate() + 1);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const start7d = new Date(now); start7d.setDate(start7d.getDate() - 7);
  const toISO = (d: Date) => d.toISOString();

  // รวมยอดจาก transactions
  const dailySpend = await sumAmount(me.$id, toISO(startOfDay), toISO(endOfDay), "spend");
  const monthIncome = await sumAmount(me.$id, toISO(startOfMonth), toISO(endOfMonth), "income");
  const monthSpend  = await sumAmount(me.$id, toISO(startOfMonth), toISO(endOfMonth), "spend");

  const income7d = await sumAmount(me.$id, toISO(start7d), toISO(now), "income");
  const spend7d  = await sumAmount(me.$id, toISO(start7d), toISO(now), "spend");

  // ดึงฐาน balance/salary จาก users
  let base = 0;
  try {
    const u = await databases.getDocument<any>(DB_ID, USERS_COLLECTION_ID, me.$id);
    base =
      (typeof u?.balance === "number" ? u.balance : 0) ||
      (typeof u?.salary === "number" ? u.salary : 0) ||
      0;
  } catch {}

  const balance = base + monthIncome - monthSpend;

  // 3 รายการล่าสุดของเดือน
  const items = await latestItems(me.$id, toISO(startOfMonth), toISO(endOfMonth), 3);

  return { name, dailySpend, balance, items, income7d, spend7d };
}

// ------- helpers -------
async function sumAmount(
  userId: string,
  startISO: string,
  endISO: string,
  type: "income" | "spend"
) {
  let total = 0;
  let cursor: string | undefined;

  while (true) {
    const res = await databases.listDocuments<any>(DB_ID, TX_COLLECTION_ID, [
      Query.equal("userId", userId),
      Query.equal("type", type),
      Query.greaterThanEqual("date", startISO),
      Query.lessThan("date", endISO),
      Query.orderDesc("date"),
      Query.limit(100),
      ...(cursor ? [Query.cursorAfter(cursor)] : []),
    ]);

    for (const d of res.documents) {
      const n = typeof d.amount === "number" ? d.amount : parseFloat(d.amount);
      if (!Number.isNaN(n)) total += n;
    }
    if (res.documents.length < 100) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }
  return total;
}

async function latestItems(
  userId: string,
  startISO: string,
  endISO: string,
  limit = 3
): Promise<Item[]> {
  const res = await databases.listDocuments<any>(DB_ID, TX_COLLECTION_ID, [
    Query.equal("userId", userId),
    Query.greaterThanEqual("date", startISO),
    Query.lessThan("date", endISO),
    Query.orderDesc("date"),
    Query.limit(limit),
  ]);
  return res.documents.map((d: any) => ({
    id: d.$id,
    label: d.category || d.note || (d.type === "income" ? "Income" : "Spend"),
    amount: typeof d.amount === "number" ? d.amount : parseFloat(d.amount),
    type: d.type === "income" ? "income" : "spend",
  }));
}

// React hook สำหรับหน้า Home
import { useEffect, useState } from "react";
export function useHomeData() {
  const [data, setData] = useState<HomeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getHomeSnapshot();
      setData(snap);
    } catch (e: any) {
      setError(e?.message || "Failed to load home data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  return { data, loading, error, refresh: load };
}
