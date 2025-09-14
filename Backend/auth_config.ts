// app/auth_config.ts
import {
  account,
  databases,
  DB_ID,
  PROFILE_COLLECTION_ID,
  type ProfileDoc,
  type ProfileCreate,
  assertAppwriteReady,
} from "./appwrite_config";
import { ID, Permission, Role, Models } from "appwrite";

export type SignUpInput = {
  username: string;
  email: string;
  password: string;
  dob?: string | null;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type AuthResult = {
  user: Models.User<Models.Preferences>;
  session?: Models.Session;
  profile?: ProfileDoc;
};

// ---------- helpers ----------
const userPermissions = (userId: string) => [
  Permission.read(Role.user(userId)),
  Permission.update(Role.user(userId)),
  Permission.delete(Role.user(userId)),
];

// คืน user ถ้ามี session อยู่แล้ว
export async function getActiveUser() {
  try {
    return await account.get();
  } catch {
    return null;
  }
}

// ลบ session ปัจจุบันทั้งหมดให้เกลี้ยง (กันเคสค้างจากหลายอุปกรณ์/hot reload)
export async function ensureLoggedOut() {
  try {
    await account.deleteSessions(); // ลบทุก session ของ user ปัจจุบัน
  } catch {
    // ไม่มี session ก็เงียบไป
  }
}

/**
 * สมัคร + (optionally) บังคับลบ session เดิม + login + สร้างเอกสารโปรไฟล์
 */
export async function createAccountAndProfile(
  input: SignUpInput,
  opts?: { force?: boolean }
): Promise<AuthResult> {
  assertAppwriteReady();

  const { username, email, password, dob } = input;

  // กัน session ค้างก่อนสมัคร
  if (opts?.force) {
    await ensureLoggedOut();
  } else {
    // ถ้ามี session ค้าง ให้ลบทิ้งอัตโนมัติ (แนะนำ)
    await ensureLoggedOut();
  }

  // 1) สร้างผู้ใช้ใหม่
  const user = await account.create(ID.unique(), email, password, username);

  // 2) login ทันที
  const session = await account.createEmailPasswordSession(email, password);

  // 3) สร้างโปรไฟล์ (docId = user.$id)
  const profileData: ProfileCreate = {
    userId: user.$id,
    username,
    email,
    dob: dob ?? null,
    createdAt: new Date().toISOString(),
  };

  const profileDoc = await databases.createDocument<ProfileDoc>(
    DB_ID,
    PROFILE_COLLECTION_ID,
    user.$id,
    profileData,
    userPermissions(user.$id)
  );

  return { user, session, profile: profileDoc };
}

/**
 * Login ด้วย email/password
 * - ถ้ามี session เดิมของ "user เดิม" อยู่แล้ว => ข้ามการสร้าง session คืนข้อมูลให้เลย
 * - ถ้าเป็น user อื่นหรือ force => ลบ session เดิมก่อน แล้วค่อยสร้างใหม่
 */
export async function login(
  input: LoginInput,
  opts?: { force?: boolean }
): Promise<AuthResult> {
  assertAppwriteReady();

  const { email, password } = input;

  const current = await getActiveUser();
  if (current) {
    if (!opts?.force && current.email === email) {
      // มี session เดิมของ user เดิมอยู่แล้ว -> ดึงโปรไฟล์แล้วคืนค่า
      let profileDoc: ProfileDoc | undefined;
      try {
        profileDoc = await databases.getDocument<ProfileDoc>(
          DB_ID,
          PROFILE_COLLECTION_ID,
          current.$id
        );
      } catch {}
      return { user: current, profile: profileDoc };
    }
    // เป็นคนละอีเมล หรือ force -> เคลียร์ก่อน
    await ensureLoggedOut();
  }

  const session = await account.createEmailPasswordSession(email, password);
  const user = await account.get();

  let profileDoc: ProfileDoc | undefined;
  try {
    profileDoc = await databases.getDocument<ProfileDoc>(
      DB_ID,
      PROFILE_COLLECTION_ID,
      user.$id
    );
  } catch {}

  return { user, session, profile: profileDoc };
}

export async function logout(): Promise<void> {
  await account.deleteSession("current");
}

export async function getCurrentUser() {
  return account.get();
}

export async function getMyProfile() {
  const me = await account.get();
  return databases.getDocument<ProfileDoc>(DB_ID, PROFILE_COLLECTION_ID, me.$id);
}
