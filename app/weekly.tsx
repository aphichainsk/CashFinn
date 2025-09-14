// app/weekly.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { databases, DB_ID, TX_COLLECTION_ID, account } from "../Backend/appwrite_config";
import { Query } from "appwrite";
import BottomNav from "./components/BottomNav";
import {
  useFonts,
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";

type TabKey = "home" | "chat" | "report" | "account";
const ROUTE_BY_TAB: Record<TabKey, Href> = {
  home: "/home",
  chat: "/chat",
  report: "/manual-record",
  account: "/account",
};

const BLUE = "#0B5BD3";
const RED = "#EF4444";
const GRAY_BG = "#F3F4F6";

const INCOME_ICON = require("../assets/images/income_icon.png");
const SPEND_ICON = require("../assets/images/spend_icon.png");

/* utils */
const ymdLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
const normalizeText = (v: any) => {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return "";
  return s;
};
const toMillis = (v?: string) => (v ? new Date(v).getTime() : 0);
const startOfWeekMon = (d: Date) => {
  const day = (d.getDay() + 6) % 7; // Mon=0
  const s = new Date(d);
  s.setDate(d.getDate() - day);
  s.setHours(0, 0, 0, 0);
  return s;
};
const endOfWeek = (s: Date) => {
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
};
const fmtHeader = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${dt.toLocaleString("en-US", { month: "short" })} ${d} , ${y}`;
};

export default function Weekly() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const [anchor, setAnchor] = useState(() => new Date()); // วันใดวันหนึ่งในสัปดาห์นี้
  const [userId, setUserId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  // popup edit state
  const [editVisible, setEditVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editDraft, setEditDraft] = useState<any | null>(null);

  // login user
  useEffect(() => {
    (async () => {
      try {
        const me = await account.get();
        setUserId(me.$id);
      } catch (e) {
        console.error("account.get failed:", e);
      }
    })();
  }, []);

  // load week
  useEffect(() => {
    if (!userId) return;
    loadWeek(userId, anchor);
  }, [userId, anchor]);

  const goPrevWeek = () =>
    setAnchor((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7));
  const goNextWeek = () =>
    setAnchor((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7));

  /** ดึงทั้งแบบ string-YYYYMMDD (หลายวันในสัปดาห์) + ISO ระหว่างช่วง แล้วรวม */
  async function loadWeek(uid: string, a: Date) {
    try {
      setLoading(true);

      const s = startOfWeekMon(a);
      const e = endOfWeek(s);

      // list of day strings in week
      const days: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(s);
        d.setDate(s.getDate() + i);
        days.push(ymdLocal(d));
      }

      // helper to fetch all pages
      const fetchAllPages = async (base: any[]) => {
        const pageSize = 100;
        let offset = 0;
        const out: any[] = [];
        while (true) {
          const res = await databases.listDocuments(DB_ID, TX_COLLECTION_ID, [
            ...base,
            Query.limit(pageSize),
            Query.offset(offset),
          ]);
          out.push(...(res.documents || []));
          if (!res.documents || res.documents.length < pageSize) break;
          offset += pageSize;
        }
        return out;
      };

      // 1) date == any(dayString)
      const listA = await fetchAllPages([Query.equal("userId", uid), Query.equal("date", days)]);
      // 2) date between ISO week
      const listB = await fetchAllPages([
        Query.equal("userId", uid),
        Query.between("date", s.toISOString(), e.toISOString()),
      ]);

      const map = new Map<string, any>();
      listA.forEach((d: any) => map.set(d.$id, d));
      listB.forEach((d: any) => map.set(d.$id, d));
      const merged = Array.from(map.values());

      // sort desc by date then createdAt
      merged.sort((a: any, b: any) => {
        const t = toMillis(b.date) - toMillis(a.date);
        if (t !== 0) return t;
        const ca = new Date(a.$createdAt || 0).getTime();
        const cb = new Date(b.$createdAt || 0).getTime();
        return cb - ca;
      });

      setRows(merged);
    } catch (e) {
      console.error("loadWeek failed:", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // group by day (YYYY-MM-DD)
  const sections = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const it of rows) {
      let key = it.date;
      // normalize ISO -> day string
      if (key && key.includes("T")) {
        const dt = new Date(key);
        key = ymdLocal(dt);
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(it);
    }
    const list = Array.from(groups.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([day, data]) => ({ title: day, data }));
    return list;
  }, [rows]);

  // weekly totals
  const { incomeSum, spendSum, balance } = useMemo(() => {
    let inc = 0,
      sp = 0;
    for (const r of rows) {
      const n = typeof r.amount === "number" ? r.amount : parseFloat(r.amount ?? "0");
      if (r.type === "income") inc += n;
      else sp += n;
    }
    return { incomeSum: inc, spendSum: sp, balance: inc - sp };
  }, [rows]);

  // ===== Edit Modal helpers =====
  const openEdit = (doc: any) => {
    setEditDraft({
      ...doc,
      note: doc?.note ?? "",
      category: doc?.category ?? "",
      amount: typeof doc?.amount === "number" ? doc.amount : Number(doc?.amount ?? 0),
    });
    setEditVisible(true);
  };

  const closeEdit = () => {
    setEditVisible(false);
    setEditDraft(null);
  };

  const saveEdit = async () => {
    if (!editDraft) return;
    try {
      setSaving(true);
      await databases.updateDocument(DB_ID, TX_COLLECTION_ID, editDraft.$id, {
        type: editDraft.type === "income" ? "income" : "spend",
        amount: Number(editDraft.amount) || 0,
        note: (editDraft.note ?? "").toString(),
        category: editDraft.category ? editDraft.category.toString() : undefined,
        date: editDraft.date, // คงวันเดิม
      });
      closeEdit();
      if (userId) loadWeek(userId, anchor);
    } catch (e) {
      console.error("updateDocument failed:", e);
      Alert.alert("Error", "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  // delete
  const handleDelete = (id: string) => {
    Alert.alert("Delete", "Do you want to delete this record?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await databases.deleteDocument(DB_ID, TX_COLLECTION_ID, id);
            if (userId) loadWeek(userId, anchor);
          } catch (e) {
            console.error("deleteDocument failed:", e);
          }
        },
      },
    ]);
  };

  const sWeek = startOfWeekMon(anchor);
  const eWeek = endOfWeek(sWeek);

  const TabBtn = ({ label, active, onPress }: any) => (
    <TouchableOpacity onPress={onPress} style={[s.tabBtn, active && s.tabBtnActive]}>
      <Text
        style={[
          s.tabText,
          active && s.tabTextActive,
          fontsLoaded && { fontFamily: "Poppins_600SemiBold" },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={s.wrap}>
      {/* Header */}
      <View style={s.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={[s.headerTitle, fontsLoaded && { fontFamily: "Poppins_700Bold" }]}>
          Transaction
        </Text>
        <TouchableOpacity style={s.finnBtn}>
          <Ionicons name="sparkles-outline" size={14} color="#fff" />
          <Text style={[s.finnText, fontsLoaded && { fontFamily: "Poppins_600SemiBold" }]}>
            {" "}
            Finn
          </Text>
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={s.legendWrap}>
        <View style={s.legendItem}>
          <Image source={INCOME_ICON} style={s.legendImg} />
          <Text style={[s.legendTxt, fontsLoaded && { fontFamily: "Poppins_400Regular" }]}>
            {" "}
            Income
          </Text>
        </View>
        <View style={s.legendItem}>
          <Image source={SPEND_ICON} style={s.legendImg} />
          <Text style={[s.legendTxt, fontsLoaded && { fontFamily: "Poppins_400Regular" }]}>
            {" "}
            Spend
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabsRow}>
        <TabBtn label="Daily" onPress={() => router.replace("/daily")} />
        <TabBtn label="Weekly" active onPress={() => {}} />
        <TabBtn label="Monthly" onPress={() => router.replace("/monthly")} />
      </View>

      {/* Week range */}
      <View style={s.dateRow}>
        <TouchableOpacity onPress={goPrevWeek}>
          <Ionicons name="chevron-back" size={18} color="#6B7280" />
        </TouchableOpacity>
        <Text style={[s.dateTxt, fontsLoaded && { fontFamily: "Poppins_600SemiBold" }]}>
          {sWeek.toLocaleString("en-US", { month: "short" })} {sWeek.getDate()} , {sWeek.getFullYear()}  –{" "}
          {eWeek.toLocaleString("en-US", { month: "short" })} {eWeek.getDate()} , {eWeek.getFullYear()}
        </Text>
        <TouchableOpacity onPress={goNextWeek}>
          <Ionicons name="chevron-forward" size={18} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Balance */}
      <Text style={[s.balanceLabel, fontsLoaded && { fontFamily: "Poppins_400Regular" }]}>
        Balance
      </Text>
      <Text style={[s.balanceValue, fontsLoaded && { fontFamily: "Poppins_700Bold" }]}>
        {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })} <Text style={s.thb}>THB</Text>
      </Text>

      {/* Income/Spend summary */}
      <View style={s.totalsRow}>
        <View style={s.totalItem}>
          <Image source={INCOME_ICON} style={s.totalImg} />
          <Text style={[s.totalTxt, fontsLoaded && { fontFamily: "Poppins_400Regular" }]}>
            {"  "}
            {incomeSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            <Text style={s.thbTiny}> THB</Text>
          </Text>
        </View>
        <View style={s.totalItem}>
          <Image source={SPEND_ICON} style={s.totalImg} />
          <Text style={[s.totalTxt, fontsLoaded && { fontFamily: "Poppins_400Regular" }]}>
            {"  "}
            {spendSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            <Text style={s.thbTiny}> THB</Text>
          </Text>
        </View>
      </View>

      {/* Sections by day */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.$id}
        refreshing={loading}
        onRefresh={() => userId && loadWeek(userId, anchor)}
        contentContainerStyle={{ paddingBottom: 110, paddingTop: 8 }}
        renderSectionHeader={({ section }) => (
          <View style={{ paddingTop: 14, paddingBottom: 8 }}>
            <Text style={[s.sectionTitle, fontsLoaded && { fontFamily: "Poppins_600SemiBold" }]}>
              {fmtHeader(section.title)}
            </Text>
          </View>
        )}
        renderItem={({ item }) => {
          const isIncome = item.type === "income";
          const amt =
            typeof item.amount === "number" ? item.amount : parseFloat(item.amount ?? "0");
          const note = normalizeText(item.note);
          const category = normalizeText(item.category);

          return (
            <View style={s.cardRow}>
              <View
                style={[
                  s.roundIcon,
                  { backgroundColor: isIncome ? "#E9F1FF" : "#FBE7EA" },
                ]}
              >
                <Image source={isIncome ? INCOME_ICON : SPEND_ICON} style={s.rowIcon} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[s.note, fontsLoaded && { fontFamily: "Poppins_600SemiBold" }]}
                  numberOfLines={1}
                >
                  {note}
                </Text>
                <View style={s.chip}>
                  <Text style={[s.chipTxt, fontsLoaded && { fontFamily: "Poppins_400Regular" }]}>
                    {category}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  s.amount,
                  { color: isIncome ? BLUE : RED },
                  fontsLoaded && { fontFamily: "Poppins_700Bold" },
                ]}
              >
                {amt.toFixed(2)}
              </Text>

              <View style={s.actions}>
                <TouchableOpacity style={s.actionBtn} onPress={() => openEdit(item)}>
                  <Ionicons name="create-outline" size={18} color="#6B7280" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: "#FEE2E2" }]}
                  onPress={() => handleDelete(item.$id)}
                >
                  <Ionicons name="trash-outline" size={18} color={RED} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        renderSectionFooter={({ section }) => (
          <TouchableOpacity
            style={{ alignSelf: "flex-end", marginTop: -2, marginBottom: 8 }}
            onPress={() => router.push(`/daily?date=${section.title}`)}
          >
            <Text style={{ color: BLUE, fontSize: 12 }}>More</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text
            style={[
              { color: "#9CA3AF", padding: 12 },
              fontsLoaded && { fontFamily: "Poppins_400Regular" },
            ]}
          >
            {userId ? "No records." : "Loading..."}
          </Text>
        }
      />

      {/* ===== Edit Popup ===== */}
      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={closeEdit}>
        <View style={m.backdrop}>
          <View style={m.sheet}>
            <Text style={[m.title, fontsLoaded && { fontFamily: "Poppins_700Bold" }]}>
              Edit transaction
            </Text>

            {/* Type toggle */}
            <View style={m.row}>
              <TouchableOpacity
                style={[m.typePill, editDraft?.type === "income" && m.typeIncome]}
                onPress={() => setEditDraft((d: any) => ({ ...d, type: "income" }))}
              >
                <Text style={[m.typeText, editDraft?.type === "income" && m.typeTextActive]}>
                  Income
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[m.typePill, editDraft?.type === "spend" && m.typeSpend]}
                onPress={() => setEditDraft((d: any) => ({ ...d, type: "spend" }))}
              >
                <Text style={[m.typeText, editDraft?.type === "spend" && m.typeTextActive]}>
                  Spend
                </Text>
              </TouchableOpacity>
            </View>

            {/* Amount */}
            <Text style={m.label}>Amount</Text>
            <TextInput
              keyboardType={Platform.select({ ios: "decimal-pad", android: "numeric" })}
              value={String(editDraft?.amount ?? "")}
              onChangeText={(t) =>
                setEditDraft((d: any) => ({
                  ...d,
                  amount: Number(t.replace(/,/g, "")) || 0,
                }))
              }
              placeholder="0"
              style={m.input}
            />

            {/* Note */}
            <Text style={m.label}>Note</Text>
            <TextInput
              value={editDraft?.note ?? ""}
              onChangeText={(t) => setEditDraft((d: any) => ({ ...d, note: t }))}
              placeholder="รายละเอียด"
              style={m.input}
            />

            {/* Category */}
            <Text style={m.label}>Category</Text>
            <TextInput
              value={editDraft?.category ?? ""}
              onChangeText={(t) => setEditDraft((d: any) => ({ ...d, category: t }))}
              placeholder="เช่น Food & Drinks"
              style={m.input}
            />

            <View style={m.footer}>
              <TouchableOpacity style={m.btnGhost} onPress={closeEdit} disabled={saving}>
                <Text style={m.btnGhostText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[m.btnPrimary, saving && { opacity: 0.7 }]}
                onPress={saveEdit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={m.btnPrimaryText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNav
        current="home"
        onChange={(k) => {
          const to = ROUTE_BY_TAB[k as TabKey];
          if (to) router.replace(to);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 16, paddingTop: 40 },

  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  headerTitle: { fontSize: 24, color: "#111827", paddingLeft: 40 },

  finnBtn: {
    flexDirection: "row",
    backgroundColor: BLUE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignItems: "center",
  },
  finnText: { color: "#fff", fontSize: 12 },

  legendWrap: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18, marginTop: 6 },
  legendItem: { flexDirection: "row", alignItems: "center" },
  legendImg: { width: 16, height: 16, resizeMode: "contain" },
  legendTxt: { color: "#6B7280", fontSize: 12 },

  tabsRow: { flexDirection: "row", gap: 10, marginTop: 12, justifyContent: "center" },
  tabBtn: { paddingVertical: 4, paddingHorizontal: 15, borderRadius: 20, backgroundColor: GRAY_BG },
  tabBtnActive: { backgroundColor: BLUE },
  tabText: { color: "#111827" },
  tabTextActive: { color: "#fff" },

  dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 12 },
  dateTxt: { color: "#111827" },

  balanceLabel: { textAlign: "center", marginTop: 10, color: "#6B7280" },
  balanceValue: { textAlign: "center", fontSize: 30, color: BLUE, marginTop: 2 },
  thb: { fontSize: 12, color: BLUE },

  totalsRow: { flexDirection: "row", justifyContent: "center", gap: 18, marginTop: 6, alignItems: "center" },
  totalItem: { flexDirection: "row", alignItems: "center" },
  totalImg: { width: 16, height: 16, resizeMode: "contain" },
  totalTxt: { color: "#6B7280" },
  thbTiny: { fontSize: 11, color: "#6B7280" },

  sectionTitle: { color: "#111827", fontSize: 14 },

  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    marginBottom: 10,
  },
  roundIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 10 },
  rowIcon: { width: 16, height: 16, resizeMode: "contain" },

  note: { color: "#111827", fontSize: 14 },
  chip: { alignSelf: "flex-start", backgroundColor: "#EEEFF3", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  chipTxt: { color: "#6B7280", fontSize: 10 },

  amount: { fontSize: 14, marginLeft: 8 },

  actions: { flexDirection: "row", gap: 6, marginLeft: 8 },
  actionBtn: { padding: 6, borderRadius: 10, backgroundColor: "#EEF2FF" },
});

const m = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  title: { fontSize: 16, color: "#111827", marginBottom: 8 },
  row: { flexDirection: "row", gap: 8, marginBottom: 10 },
  typePill: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAFAFA",
  },
  typeIncome: { borderColor: "#0B5BD3", backgroundColor: "#E9F1FF" },
  typeSpend: { borderColor: "#EF4444", backgroundColor: "#FDECEC" },
  typeText: { color: "#374151", fontWeight: "600" },
  typeTextActive: { color: "#111827" },
  label: { color: "#6B7280", marginTop: 6, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#111827",
  },
  footer: { flexDirection: "row", gap: 10, marginTop: 12 },
  btnGhost: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhostText: { color: "#111827", fontWeight: "700" },
  btnPrimary: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#0B5BD3",
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: { color: "#fff", fontWeight: "700" },
});
