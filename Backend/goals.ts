// Backend/goals.ts
import { ID, Models, Query } from "appwrite";
import { account, databases, DATABASE_ID, GOALS_COLLECTION_ID } from "./appwrite_config";

export type GoalDoc = Models.Document & {
  userId: string;              // required
  title: string;               // required
  targetAmount?: number;       // Double
  savedAmount?: number;        // Double
  dueDate?: string | null;     // Datetime ISO
  category?: string | null;    // String
  currency?: string | null;    // String (default THB)
  status?: string | null;      // Enum (เช่น active/completed/paused)
  note?: string | null;        // String
  isArchived?: boolean;        // Boolean (default false)
};

// ----- helpers -----
export async function getCurrentUserId() {
  const user = await account.get();
  return user.$id;
}

export function percent(goal: Pick<GoalDoc, "targetAmount" | "savedAmount">) {
  const t = Number(goal.targetAmount ?? 0);
  const s = Number(goal.savedAmount ?? 0);
  if (!t || t <= 0) return 0;
  const p = Math.floor((s / t) * 100);
  const clipped = Math.min(100, Math.max(0, p));
  return Number.isFinite(clipped) ? clipped : 0;
}

// ----- CRUD -----
export async function listMyGoals(): Promise<GoalDoc[]> {
  const uid = await getCurrentUserId();
  const res = await databases.listDocuments<GoalDoc>(
    DATABASE_ID,
    GOALS_COLLECTION_ID,
    [
      Query.equal("userId", uid),
      Query.equal("isArchived", false), // จะผ่านถ้า field มีและเป็น false
      Query.orderDesc("$createdAt"),
    ]
  );
  return res.documents;
}

export async function createGoal(input: {
  title: string;
  targetAmount?: number;
  savedAmount?: number;
  dueDate?: string | null;
  category?: string | null;
  currency?: string | null; // ถ้าไม่กรอก จะใส่ THB ให้
  status?: string | null;
  note?: string | null;
}) {
  const uid = await getCurrentUserId();
  return databases.createDocument<GoalDoc>(
    DATABASE_ID,
    GOALS_COLLECTION_ID,
    ID.unique(),
    {
      userId: uid,
      title: input.title.trim(),
      targetAmount: input.targetAmount ? Number(input.targetAmount) : 0,
      savedAmount: input.savedAmount ? Number(input.savedAmount) : 0,
      dueDate: input.dueDate ?? null,
      category: input.category ?? null,
      currency: input.currency ?? "THB",
      status: input.status ?? "active",
      note: input.note ?? null,
      isArchived: false,
    }
  );
}

export async function getGoal(id: string) {
  return databases.getDocument<GoalDoc>(DATABASE_ID, GOALS_COLLECTION_ID, id);
}

export async function updateGoal(
  id: string,
  patch: Partial<
    Pick<
      GoalDoc,
      | "title"
      | "targetAmount"
      | "savedAmount"
      | "dueDate"
      | "category"
      | "currency"
      | "status"
      | "note"
      | "isArchived"
    >
  >
) {
  return databases.updateDocument<GoalDoc>(DATABASE_ID, GOALS_COLLECTION_ID, id, patch);
}

// เพิ่ม/ถอน progress (delta > 0 เพิ่มเงินออม, delta < 0 ถอน)
export async function addGoalProgress(id: string, delta: number) {
  const g = await getGoal(id);
  const next = Math.max(0, Number(g.savedAmount ?? 0) + Number(delta || 0)); // กันค่าติดลบ
  return databases.updateDocument<GoalDoc>(DATABASE_ID, GOALS_COLLECTION_ID, id, {
    savedAmount: next,
  });
}
export async function deleteGoal(id: string) {
  return databases.deleteDocument(DATABASE_ID, GOALS_COLLECTION_ID, id);
}