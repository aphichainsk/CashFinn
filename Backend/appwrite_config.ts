// app/appwrite_config.ts
import "react-native-url-polyfill/auto";
import "react-native-get-random-values";

import { Client, Account, Databases, Models, ID, Permission, Role, Query } from "appwrite";

// ───────────────── ENV/CONST ─────────────────
export const APPWRITE_ENDPOINT =
  process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? "http://10.0.2.2/v1";
export const APPWRITE_PROJECT_ID =
  process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? "68bff94e00300517ff17";
export const DB_ID =
  process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID ?? "68c1bfd5000d5b59141d";

export const PROFILE_COLLECTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_PROFILE_COLLECTION_ID ?? "68c1bfe8001458d2450d";
export const TX_COLLECTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_TX_COLLECTION_ID ?? "68c272ee000038aaadf0";
export const GOALS_COLLECTION_ID = "68c311810029021d367b";

// **ถ้าหน้าอื่นใช้ชื่อ DATABASE_ID**
export const DATABASE_ID = DB_ID;

// ───────────────── Client/Services ─────────────────
export const client = new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);
export const account = new Account(client);
export const databases = new Databases(client);

// ───────────────── Types ─────────────────
export type ProfileDoc = Models.Document & {
  userId: string;
  username: string;
  email: string;
  dob?: string | null;
  createdAt: string;
};
export type ProfileCreate = Omit<ProfileDoc, keyof Models.Document>;

export type TxType = "income" | "spend";
export type TransactionDoc = Models.Document & {
  userId: string;
  type: TxType;
  amount: number;          // ใช้ number แทน Float
  date: string;            // ISO 8601
  note?: string | null;
  category?: string | null;
  createdAt: string;
  updatedAt?: string | null;
};
export type TransactionCreate = Omit<TransactionDoc, keyof Models.Document>;

// ───────────────── Utils ─────────────────
export const assertAppwriteReady = () => {
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !DB_ID || !PROFILE_COLLECTION_ID || !TX_COLLECTION_ID) {
    throw new Error("Appwrite env ยังไม่ครบ (ENDPOINT/PROJECT_ID/DB_ID/PROFILE_COLLECTION_ID/TX_COLLECTION_ID)");
  }
};

// ⬇️ re-export ให้ไฟล์อื่น import จาก config ไฟล์เดียว
export { ID, Permission, Role, Query };
