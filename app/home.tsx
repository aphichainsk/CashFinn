// app/home.tsx
// หน้า Home พร้อมเฮดเดอร์สีน้ำเงินเฉพาะด้านบน และการ์ดขาวล้นลงมา

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import BottomNav from "./components/BottomNav";
import { useRouter, type Href } from "expo-router";
import {
  useFonts,
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";

// ดึงข้อมูลจริงจาก backend (เดิม)
import { useHomeData } from "../Backend/homeData";
// โหลด goals จาก Appwrite
import {
  account,
  databases,
  DATABASE_ID,
  GOALS_COLLECTION_ID,
  Query,
} from "../Backend/appwrite_config";

const BLUE = "#0048B8";

type TabKey = "home" | "chat" | "report" | "account";

const ROUTE_BY_TAB: Record<TabKey, Href> = {
  home: "/home",
  chat: "/chat",
  report: "/manual-record",
  account: "/account",
};

// ใช้แสดงการ์ด goal
type GoalRow = { id: string; title: string; progress: number };

export default function Home() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  const { data, loading } = useHomeData();

  // ---------------- Load goals from Appwrite ----------------
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const me = await account.get();
        const res = await databases.listDocuments(
          DATABASE_ID,
          GOALS_COLLECTION_ID,
          [
            Query.equal("userId", me.$id),
            Query.equal("status", "active"),
            Query.orderDesc("$updatedAt"),
            Query.limit(3),
          ]
        );
        const rows: GoalRow[] = res.documents.map((d: any) => {
          const target = Number(d.targetAmount) || 0;
          const saved = Number(d.savedAmount) || 0;
          const progress = target > 0 ? Math.min(saved / target, 1) : 0;
          return { id: d.$id, title: d.title ?? "Untitled", progress };
        });
        setGoals(rows);
      } catch {
        setGoals([]); // ไม่มี session หรืออ่านไม่ได้ → แสดง empty state
      } finally {
        setGoalsLoading(false);
      }
    })();
  }, []);
  // ----------------------------------------------------------

  const pending = !fontsLoaded || loading;
  const name = data?.name ?? "—";
  const dailySpend = data?.dailySpend ?? 0;
  const balance = data?.balance ?? 0;
  const items = data?.items ?? [];
  const incomeWeekly = data?.income7d ?? 0;
  const spendWeekly = data?.spend7d ?? 0;

  const onChatPress = () => router.replace(ROUTE_BY_TAB.chat);
  const onRecordPress = () => router.replace(ROUTE_BY_TAB.report);
  const goDaily = () => router.push("/daily");
  const goWeekly = () => router.push("/weekly");

  if (!fontsLoaded) return null;

  return (
    // ✅ พื้นหลังทั้งหน้าเป็นสีขาว (ไม่ใช้ BLUE ที่ SafeAreaView)
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BLUE} />

      {/* ✅ ScrollView ก็พื้นหลังขาวกันเผื่อ */}
      <ScrollView
        style={{ backgroundColor: "#fff" }}
        contentContainerStyle={{ paddingBottom: 110, backgroundColor: "#fff" }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header gradient (สีน้ำเงินเฉพาะส่วนนี้) */}
        <LinearGradient
          colors={["#0A56CF", BLUE]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.header, { paddingBottom: 70 }]}
        >
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.welcomeText}>Welcome back</Text>
              <Text style={styles.nameText}>{pending ? "Loading…" : name}</Text>
            </View>

            <View style={styles.headerIcons}>
              <TouchableOpacity style={styles.iconBtn}>
                <Image
                  source={require("../assets/images/notification-line.png")}
                  style={{ width: 16, height: 16, tintColor: "#fff" }}
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn}>
                <Image
                  source={require("../assets/images/person.png")}
                  style={{ width: 18, height: 18, tintColor: "#fff" }}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.dailySpendWrap}>
            <Text style={styles.dailySpendValue}>
              {dailySpend.toLocaleString()} <Text style={styles.thb}>THB</Text>
            </Text>
            <Text style={styles.dailySpendSub}>{pending ? "Loading…" : "Daily Spend"}</Text>
          </View>
        </LinearGradient>

        {/* Your Balance card (ล้นลงมา) */}
        <View style={[styles.balanceCard, { marginTop: -34, marginHorizontal: 16 }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Your Balance</Text>

            <View style={styles.legendCol}>
              <View style={styles.legendItem}>
                <Image source={require("../assets/images/income_icon.png")} style={styles.legendImg} />
                <Text style={styles.legendText}>Income</Text>
              </View>
              <View style={styles.legendItem}>
                <Image source={require("../assets/images/spend_icon.png")} style={styles.legendImg} />
                <Text style={styles.legendText}>Spend</Text>
              </View>
            </View>
          </View>

          <Text style={styles.balanceValue}>
            {balance.toLocaleString()} <Text style={styles.thbBlue}>THB</Text>
          </Text>

          <View style={{ marginTop: 10, gap: 8 }}>
            {items.length === 0 ? (
              <Text style={[styles.itemLabel, { color: "#9CA3AF" }]}>
                {pending ? "Loading…" : "No record this month"}
              </Text>
            ) : (
              items.map((it) => (
                <View key={it.id} style={styles.itemRow}>
                  <Image
                    source={
                      it.type === "income"
                        ? require("../assets/images/income_icon.png")
                        : require("../assets/images/spend_icon.png")
                    }
                    style={styles.itemIcon}
                  />
                  <Text style={styles.itemLabel}>
                    {it.label}
                    <Text style={styles.mutedText}>
                      ,{" "}
                      {it.amount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </Text>
                  </Text>
                </View>
              ))
            )}
          </View>

          <TouchableOpacity style={styles.seeAll} onPress={goDaily}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {/* Sheet ขาวส่วนล่าง */}
        <View style={styles.sheet}>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.chatBtn} onPress={onChatPress} activeOpacity={0.9}>
              <Image
                source={require("../assets/images/ai-fill.png")}
                style={{ width: 14, height: 14, tintColor: "#fff" }}
              />
              <Text style={styles.chatText}>Chat with Finn</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryPill} onPress={onRecordPress} activeOpacity={0.9}>
              <Text style={styles.secondaryPillText}>Manual Record</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <TouchableOpacity onPress={goWeekly}>
              <Text style={styles.sectionLink}>Weekly</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.overviewRow}>
            <View style={[styles.overviewCard, { backgroundColor: "#E9F1FF" }]}>
              <View style={styles.overviewIconWrapIncome}>
                <Image source={require("../assets/images/income_icon.png")} style={{ width: 20, height: 20 }} />
              </View>
              <Text style={styles.overviewLabel}>Income</Text>
              <Text style={[styles.overviewValue, { color: "#0B5BD3" }]}>
                +{incomeWeekly.toLocaleString()} <Text style={styles.thbSmall}>THB</Text>
              </Text>
            </View>

            <View style={[styles.overviewCard, { backgroundColor: "#F3E9EC" }]}>
              <View style={styles.overviewIconWrapSpend}>
                <Image source={require("../assets/images/spend_icon.png")} style={{ width: 20, height: 20 }} />
              </View>
              <Text style={styles.overviewLabel}>Spend</Text>
              <Text style={[styles.overviewValue, { color: "#EF4444" }]}>
                -{spendWeekly.toLocaleString()} <Text style={styles.thbSmall}>THB</Text>
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 18, paddingHorizontal: 16 }]}>Reccommend</Text>

          <View style={styles.cardBox}>
            <Text style={styles.cardTitle}>Your goals</Text>

            {goalsLoading ? (
              <View style={{ marginTop: 12 }}>
                <ActivityIndicator />
              </View>
            ) : goals.length === 0 ? (
              <Text style={{ marginTop: 10, color: "#6B7280", fontFamily: "Poppins_400Regular", fontSize: 12 }}>
                ยังไม่มีเป้าหมาย
              </Text>
            ) : (
              goals.map((g) => (
                <View key={g.id} style={{ marginTop: 10 }}>
                  <View style={styles.goalRow}>
                    <Text style={styles.goalLabel} numberOfLines={1}>
                      {g.title}
                    </Text>
                    <Text style={styles.goalPercent}>{Math.round(g.progress * 100)}%</Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${Math.round(g.progress * 100)}%` }]} />
                  </View>
                </View>
              ))
            )}

            <TouchableOpacity style={{ marginTop: 10 }} onPress={() => router.push("/user_goal")}>
              <Text style={styles.sectionLink}>Set new goal</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.shortcutsRow }>
             <TouchableOpacity
    style={styles.shortcutBtn}
    onPress={() => router.push("/report")}   // ⬅️ เพิ่มบรรทัดนี้
    activeOpacity={0.9}
  >
    <Image
      source={require("../assets/images/report.png")}
      style={{ width: 16, height: 16, tintColor: "#fff" }}
    />
    <Text style={styles.shortcutText}>Finn Report</Text>
  </TouchableOpacity>

            <TouchableOpacity style={styles.shortcutBtn}>
              <Image
                source={require("../assets/images/celebrate-line.png")}
                style={{ width: 16, height: 16, tintColor: "#fff" }}
              />
              <Text style={styles.shortcutText}>Challenges</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <BottomNav
        current="home"
        onChange={(k) => {
          const to = ROUTE_BY_TAB[k as TabKey];
          if (to) router.replace(to);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ✅ ทั้งหน้าเป็นพื้นหลังสีขาว
  container: { flex: 1, backgroundColor: "#fff" },

  header: {
    paddingHorizontal: 16,
    paddingTop: 35,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  welcomeText: {
    color: "#E8F0FF",
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    marginBottom: -5,
  },
  nameText: {
    color: "#fff",
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
  },
  headerIcons: { flexDirection: "row", gap: 10 },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },

  dailySpendWrap: { alignItems: "center", marginTop: 12 },
  dailySpendValue: {
    color: "#fff",
    fontSize: 38,
    fontFamily: "Poppins_600SemiBold",
    lineHeight: 32,
  },
  dailySpendSub: {
    color: "#E8F0FF",
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
  },
  thb: { fontSize: 12, fontFamily: "Poppins_600SemiBold" },

  balanceCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#111827",
  },
  legendCol: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 6,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendImg: { width: 14, height: 14 },
  legendText: {
    color: "#6B7280",
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
  },

  balanceValue: {
    marginTop: 4,
    fontSize: 30,
    color: "#0048B8",
    fontFamily: "Poppins_600SemiBold",
  },
  thbBlue: { fontSize: 12, color: "#0048B8", fontFamily: "Poppins_600SemiBold" },

  itemRow: { flexDirection: "row", alignItems: "center" },
  itemIcon: { width: 18, height: 18, marginRight: 8 },
  itemLabel: { fontFamily: "Poppins_400Regular", color: "#111827", fontSize: 12 },
  mutedText: { color: "#6B7280" },
  seeAll: { alignSelf: "flex-end", marginTop: 8 },
  seeAllText: { color: "#0048B8", fontSize: 12, fontFamily: "Poppins_400Regular" },

  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: 12,
    paddingTop: 12,
  },

  actionRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 6,
  },
  chatBtn: {
    flex: 0.5,
    backgroundColor: "#0048B8",
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  chatText: { color: "#fff", fontFamily: "Poppins_600SemiBold", fontSize: 14 },
  secondaryPill: {
    flex: 0.5,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 25,
    backgroundColor: "#0048B8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryPillText: { color: "#fff", fontFamily: "Poppins_600SemiBold", fontSize: 14 },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    alignItems: "center",
    marginTop: 18,
  },
  sectionTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 20,
    color: "#111827",
  },
  sectionLink: { color: "#0048B8", fontSize: 12, fontFamily: "Poppins_400Regular" },

  overviewRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  overviewCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
  },
  overviewIconWrapIncome: {
    width: 40,
    height: 40,
    borderRadius: 50,
    backgroundColor: "#D7E6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  overviewIconWrapSpend: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FBE1E5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  overviewLabel: { fontFamily: "Poppins_400Regular", color: "#6B7280", fontSize: 12 },
  overviewValue: { fontFamily: "Poppins_700Bold", fontSize: 20, marginTop: 2 },
  thbSmall: { fontSize: 10, fontFamily: "Poppins_600SemiBold" },

  cardBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  goalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  goalLabel: { fontFamily: "Poppins_400Regular", color: "#111827", fontSize: 12 },
  goalPercent: { fontFamily: "Poppins_600SemiBold", color: "#111827", fontSize: 12 },
  progressBar: { height: 8, borderRadius: 6, backgroundColor: "#E5E7EB", marginTop: 6 },
  progressFill: { height: "100%", borderRadius: 6, backgroundColor: "#0048B8" },

  shortcutsRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 12,
  },
  shortcutBtn: {
    flex: 1,
    backgroundColor: "#0048B8",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  shortcutText: { color: "#fff", fontFamily: "Poppins_600SemiBold", fontSize: 12 },
});
