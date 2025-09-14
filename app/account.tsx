// app/account.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import BottomNav from "./components/BottomNav";
import { useRouter, type Href } from "expo-router";
import {
  useFonts,
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import {
  account,
  databases,
  DB_ID,
  PROFILE_COLLECTION_ID,
  type ProfileDoc,
} from "../Backend/appwrite_config";
import { getCurrentUser, getMyProfile, logout } from "../Backend/auth_config";
import { Permission, Role } from "appwrite";

const BLUE = "#0048B8";
const GREY = "#6B7280";
const BORDER = "#E5E7EB";
const BG = "#FFFFFF";

// === your Appwrite collection id for "users" ===
const USERS_COLLECTION_ID =
  (process.env.EXPO_PUBLIC_APPWRITE_USERS_COLLECTION_ID as string) ||
  "68c1bfe8001458d2450d";

type TabKey = "home" | "chat" | "report" | "account";
const ROUTE_BY_TAB: Record<TabKey, Href> = {
  home: "/home",
  chat: "/chat",
  report: "/manual-record",
  account: "/account",
};

// helpers
const toYMD = (d: Date | null) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`
    : null;

const parseMoney = (s: string) => {
  const n = parseFloat((s || "0").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

// Appwrite Datetime ควรเป็น ISO
const toISODateOrNull = (d: Date | null) => (d ? new Date(d).toISOString() : null);

export default function AccountScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // profile form
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState<Date | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");

  // users collection form
  const [salary, setSalary] = useState<string>("");
  const [balance, setBalance] = useState<number>(0);

  // monthly debts
  const [debtAmount, setDebtAmount] = useState<string>("");
  const [debtType, setDebtType] = useState<string>("");

  const [showDobPicker, setShowDobPicker] = useState(false);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  // load user + profile + users
  useEffect(() => {
    (async () => {
      try {
        const me = await getCurrentUser(); // account.get()

        // profiles collection
        let profile: ProfileDoc | null = null;
        try {
          profile = await getMyProfile();
        } catch {
          profile = null; // ยังไม่มี
        }

        // base values from account
        setUsername(profile?.username ?? me.name ?? "");
        setEmail(profile?.email ?? me.email ?? "");
        // dob ใน profiles เก็บเป็น YYYY-MM-DD (string) -> แปลงเป็น Date
        if (profile?.dob) {
          const [y, m, d] = String(profile.dob).split("-").map(Number);
          if (y && m && d) setDob(new Date(y, m - 1, d));
        }

        // users collection
        try {
          const u = await databases.getDocument<any>(DB_ID, USERS_COLLECTION_ID, me.$id);
          if (typeof u?.salary === "number") setSalary(String(u.salary));
          if (typeof u?.balance === "number") setBalance(u.balance);
          if (typeof u?.debtAmount === "number") setDebtAmount(String(u.debtAmount));
          if (typeof u?.debtType === "string") setDebtType(u.debtType || "");

          // ถ้ามี username/email/dob ใน users และฟอร์มยังว่าง ให้ sync มาด้วย
          if (!username && typeof u?.username === "string") setUsername(u.username);
          if (!email && typeof u?.email === "string") setEmail(u.email);
          if (!dob && typeof u?.dob === "string") setDob(new Date(u.dob));
        } catch {
          // ยังไม่มี users doc -> จะสร้างตอน Save
        }
      } catch (err: any) {
        const msg = err?.message || err?.response?.message || "Failed to load profile.";
        setErrorMsg(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onPickDob = (_: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") setShowDobPicker(false);
    if (selected) setDob(selected);
  };

  const handleSave = async () => {
    setErrorMsg(null);
    if (saving) return;

    try {
      setSaving(true);
      const me = await account.get();

      // 1) update account name/email
      if (username.trim() && username.trim() !== me.name) {
        await account.updateName(username.trim());
      }
      if (email.trim() && email.trim() !== me.email) {
        if (!currentPassword) {
          Alert.alert("Current password required", "Please enter your current password to change email.");
          setSaving(false);
          return;
        }
        await account.updateEmail(email.trim(), currentPassword);
      }

      // 2) upsert PROFILE doc (ส่ง username เสมอ เพราะอาจเป็น required ที่ schema)
      const profilePayload: Partial<Pick<ProfileDoc, "username" | "email" | "dob">> = {
        username: (username || "").trim(),
        email: (email || "").trim(),
        dob: toYMD(dob), // profiles เก็บเป็น YYYY-MM-DD
      };
      try {
        await databases.updateDocument(
          DB_ID, PROFILE_COLLECTION_ID, me.$id, profilePayload as any
        );
      } catch (err: any) {
        // ถ้าไม่พบเอกสาร -> create
        if (err?.code === 404 || err?.responseCode === 404) {
          await databases.createDocument(
            DB_ID,
            PROFILE_COLLECTION_ID,
            me.$id,
            profilePayload as any,
            [
              Permission.read(Role.user(me.$id)),
              Permission.update(Role.user(me.$id)),
              Permission.delete(Role.user(me.$id)),
            ]
          );

        } else {
          throw err;
        }
      }

      // 3) upsert USERS doc (ต้องมี userId และ username ตาม schema)
      const salaryNum = parseMoney(salary);
      const debtAmountNum = parseMoney(debtAmount);
      const usersPayload: any = {
        userId: me.$id, // REQUIRED
        username: (username || "").trim(), // REQUIRED
        email: (email || "").trim(),
        dob: toISODateOrNull(dob), // Datetime (ISO) หรือ null
        salary: salaryNum,
        debtAmount: debtAmountNum,
        debtType: (debtType || "").trim(),
        updatedAt: new Date().toISOString(),
      };

      try {
        // update ถ้ามีอยู่แล้ว
        const current = await databases.getDocument<any>(DB_ID, USERS_COLLECTION_ID, me.$id);
        const next: any = { ...usersPayload };

        // ถ้า balance ยังไม่มี ให้ตั้งต้นเท่ากับ salary
        if (!current?.balance || current.balance === 0) next.balance = salaryNum;

        const updated = await databases.updateDocument<any>(DB_ID, USERS_COLLECTION_ID, me.$id, next);
        if (typeof updated?.balance === "number") setBalance(updated.balance);
      } catch (err: any) {
        // ไม่มีเอกสาร -> create
        const created = await databases.createDocument<any>(
          DB_ID,
          USERS_COLLECTION_ID,
          me.$id, // ใช้ userId เป็น docId
          {
            ...usersPayload,
            balance: salaryNum, // ตั้งต้น
            createdAt: new Date().toISOString(),
          },
          [
            Permission.read(Role.user(me.$id)),
            Permission.update(Role.user(me.$id)),
            Permission.delete(Role.user(me.$id)),
          ]
        );
        if (typeof created?.balance === "number") setBalance(created.balance);
      }

      Alert.alert("Saved", "Your changes have been saved.");
      setCurrentPassword("");
    } catch (err: any) {
      const msg = err?.message || err?.response?.message || "Failed to save changes. Please try again.";
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {loading ? (
        <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
          <ActivityIndicator color={BLUE} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Account</Text>
            <Text style={styles.headerSub}>Manage your profile</Text>

            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {username?.trim()?.charAt(0)?.toUpperCase() || "U"}
              </Text>
            </View>
          </View>

          {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Your name"
              placeholderTextColor={GREY}
              style={styles.input}
              editable={!saving}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="name@domain.com"
              placeholderTextColor={GREY}
              style={styles.input}
              editable={!saving}
            />

            <Text style={styles.tipText}>Changing your email requires your current password.</Text>

            <Text style={styles.label}>Current password (for email change)</Text>
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="••••••••"
              placeholderTextColor={GREY}
              style={styles.input}
              secureTextEntry
              editable={!saving}
            />

            <Text style={styles.label}>Date of birth</Text>
            <TouchableOpacity
              onPress={() => setShowDobPicker(true)}
              activeOpacity={0.8}
              style={[styles.input, styles.inputPressable]}
              disabled={saving}
            >
              <Text
                style={[
                  styles.dateText,
                  !dob && { color: GREY, fontFamily: "Poppins_400Regular" },
                ]}
              >
                {dob
                  ? dob.toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "2-digit",
                  })
                  : "DD / MM / YYYY"}
              </Text>
            </TouchableOpacity>

            {showDobPicker && (
              <DateTimePicker
                value={dob ?? new Date(2000, 0, 1)}
                mode="date"
                display={Platform.select({ ios: "inline", android: "default" })}
                onChange={(e, d) => {
                  if (Platform.OS === "android") setShowDobPicker(false);
                  if (d) setDob(d);
                }}
                maximumDate={new Date()}
              />
            )}

            {/* Salary & Balance */}
            <Text style={styles.label}>Monthly Salary (THB)</Text>
            <TextInput
              value={salary}
              onChangeText={setSalary}
              placeholder="0"
              placeholderTextColor={GREY}
              keyboardType={Platform.select({ ios: "decimal-pad", android: "numeric" })}
              style={styles.input}
              editable={!saving}
            />

            <View style={{ marginTop: 8, marginBottom: 4 }}>
              <Text style={styles.balanceLabel}>
                Current Balance{" "}
                <Text style={{ color: BLUE, fontFamily: "Poppins_700Bold" }}>
                  {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} THB
                </Text>
              </Text>
              <Text style={styles.tipText}>* ถ้ายังไม่เคยมี balance ระบบจะตั้งต้นเท่ากับเงินเดือนที่กรอก</Text>
            </View>

            {/* Monthly debts */}
            <Text style={styles.sectionTitle}>Monthly Debts</Text>

            <Text style={styles.label}>Monthly Debt Amount (THB)</Text>
            <TextInput
              value={debtAmount}
              onChangeText={setDebtAmount}
              placeholder="0"
              placeholderTextColor={GREY}
              keyboardType={Platform.select({ ios: "decimal-pad", android: "numeric" })}
              style={styles.input}
              editable={!saving}
            />

            <Text style={styles.label}>Debt Type (e.g., Mortgage / Car Loan)</Text>
            <TextInput
              value={debtType}
              onChangeText={setDebtType}
              placeholder="Mortgage / Car / Personal…"
              placeholderTextColor={GREY}
              style={styles.input}
              editable={!saving}
            />

            {/* Actions */}
            <TouchableOpacity
              style={[styles.primaryBtn, saving && { opacity: 0.7 }]}
              disabled={saving}
              onPress={handleSave}
              activeOpacity={0.9}
            >
              <Text style={styles.primaryText}>{saving ? "Saving..." : "Save changes"}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={async () => {
                try {
                  await logout();
                  router.replace("/login");
                } catch (err: any) {
                  const msg = err?.message || err?.response?.message || "Failed to log out.";
                  Alert.alert("Error", msg);
                }
              }}
              activeOpacity={0.9}
              disabled={saving}
            >
              <Text style={styles.logoutText}>Log out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      <BottomNav
        current="account"
        onChange={(k) => {
          const to = ROUTE_BY_TAB[k as TabKey];
          if (to) router.replace(to);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 10,
  },
  headerTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    color: "#111827",
  },
  headerSub: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: GREY,
    marginTop: 2,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  avatarText: {
    color: "#fff",
    fontFamily: "Poppins_700Bold",
    fontSize: 26,
  },

  form: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 10,
  },
  sectionTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 15,
    color: "#111827",
    marginTop: 10,
  },
  label: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: "#111827",
    marginTop: 8,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#fff",
  },
  inputPressable: { justifyContent: "center" },
  dateText: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: "#111827" },
  tipText: { fontFamily: "Poppins_400Regular", fontSize: 12, color: GREY, marginTop: -6, marginBottom: 8 },

  balanceLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: "#111827" },

  primaryBtn: {
    backgroundColor: BLUE,
    borderRadius: 28,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 18,
  },
  primaryText: {
    color: "#fff",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
  },

  logoutBtn: {
    borderRadius: 28,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  logoutText: {
    color: "#EF4444",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
  },

  errorText: {
    color: "#EF4444",
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    marginHorizontal: 20,
    marginTop: 8,
  },
});
