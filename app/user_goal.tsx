import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect,Href } from "expo-router";
import BottomNav from "./components/BottomNav";
import { GoalDoc, listMyGoals, percent } from "../Backend/goals";
import {
  useFonts,
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";

const COLORS = {
  primary: "#0B5BD3",
  text: "#111827",
  lightText: "#6B7280",
  border: "#E5E7EB",
  track: "#E5E7EB",
  cardBg: "#FFFFFF",
  bg: "#FFFFFF",
};

function Progress({ v }: { v: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressBar, { width: `${Math.min(100, Math.max(0, v))}%` }]} />
    </View>
  );
}
type TabKey = "home" | "chat" | "report" | "account";
const ROUTE_BY_TAB: Record<TabKey, Href> = {
  home: "/home",
  chat: "/chat",
  report: "/report",
  account: "/account",
};
export default function GoalsIndex() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<GoalDoc[]>([]);
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold });

  const load = async () => {
    setLoading(true);
    try {
      const list = await listMyGoals();
      setRows(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useFocusEffect(useCallback(() => { load(); }, []));

  if (!fontsLoaded) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
     <View style={styles.header}>
  <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
    <Ionicons name="chevron-back" size={22} color={COLORS.text} />
  </TouchableOpacity>

  <Text style={styles.headerTitle}>Your goals</Text>

  <TouchableOpacity onPress={() => router.push("/create_goal")} style={styles.iconBtn}>
    <Ionicons name="add" size={22} color={COLORS.text} />
  </TouchableOpacity>
</View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(it) => it.$id}
          contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
          renderItem={({ item }) => {
            const v = percent(item);
            return (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={styles.progressRow}>
                  <Progress v={v} />
                  <Text style={styles.percentText}>{v}%</Text>
                </View>
                <TouchableOpacity
                  style={{ alignSelf: "flex-end" }}
                  onPress={() => router.push(`/goals/${item.$id}`)}
                >
                  <Text style={styles.manage}>Manage</Text>
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", color: COLORS.lightText, marginTop: 24 }}>
              ยังไม่มีเป้าหมาย กดปุ่มด้านล่างเพื่อสร้างใหม่
            </Text>
          }
        />
      )}

      {/* Center + button */}
      <View style={styles.plusWrap}>
        <TouchableOpacity style={styles.plusBtn} onPress={() => router.push("/create_goal")}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
header: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: 16,
  paddingTop: 14,
  paddingBottom: 8,
},
headerTitle: { fontFamily: "Poppins_700Bold", fontSize: 18, color: COLORS.text },
iconBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },

  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  cardTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: COLORS.text, marginBottom: 8 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressTrack: { flex: 1, height: 12, backgroundColor: COLORS.track, borderRadius: 999 },
  progressBar: { height: 12, backgroundColor: COLORS.primary, borderRadius: 999 },
  percentText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: COLORS.primary },
  manage: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: COLORS.primary, marginTop: 6 },
  plusWrap: { position: "absolute", left: 0, right: 0, bottom: 72, alignItems: "center" ,paddingBottom:50},
  plusBtn: {
    width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.primary, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, elevation: 3,
  },
});
