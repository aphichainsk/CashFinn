// app/auth_persist.ts
import { account } from "./appwrite_config";
import type { Models } from "appwrite";

/** ตรวจว่ามี session ใช้งานอยู่ไหม (เรียกเร็ว ๆ ตอนเปิดแอป) */
export async function hasActiveSession(): Promise<boolean> {
  try {
    await account.get(); // 200 = มี session อยู่
    return true;
  } catch {
    return false;        // 401 = ไม่มี session
  }
}

/** กู้คืน user ถ้ามี session (ไม่มีก็คืน null) */
export async function restoreUser():
  Promise<Models.User<Models.Preferences> | null> {
  try {
    return await account.get();
  } catch {
    return null;
  }
}

/**
 * ทางลัด: ใช้บน splash/หน้าหลัก เพื่อ "route อัตโนมัติ"
 * - ถ้ามี session -> ไป /home
 * - ถ้าไม่มี session -> ไป /login
 */
export async function routeBySession(
  router: { replace: (path: any) => void },
  {
    whenLoggedIn = "/home",
    whenLoggedOut = "/login",
  }: { whenLoggedIn?: any; whenLoggedOut?: any } = {}
) {
  const ok = await hasActiveSession();
  router.replace(ok ? whenLoggedIn : whenLoggedOut);
}
