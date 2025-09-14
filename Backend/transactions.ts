// app/transactions.ts
import { ID, Permission, Role } from "appwrite";
import {
  account,
  databases,
  DB_ID,
  TX_COLLECTION_ID,
  type TransactionDoc,
  type TransactionCreate,
} from "./appwrite_config";

/** สร้างสิทธิ์เอกสารให้เจ้าของอ่าน/แก้ไข/ลบได้คนเดียว */
const perms = (userId: string) => [
  Permission.read(Role.user(userId)),
  Permission.update(Role.user(userId)),
  Permission.delete(Role.user(userId)),
];

/** บันทึกรายการรายรับ-รายจ่าย (Manual Record) */
export async function createTransaction(input: {
  type: "income" | "spend";
  amount: number;          // หน่วยบาท (มีทศนิยมได้)
  dateISO: string;         // new Date().toISOString()
  note?: string;
  category?: string;
}): Promise<TransactionDoc> {
  const me = await account.get();

  const payload: TransactionCreate = {
    userId: me.$id,
    type: input.type,
    amount: input.amount,
    date: input.dateISO,
    note: input.note ?? null,
    category: input.category ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };

  const doc = await databases.createDocument<TransactionDoc>(
    DB_ID,
    TX_COLLECTION_ID,
    ID.unique(),
    payload,
    perms(me.$id)
  );

  return doc;
}
