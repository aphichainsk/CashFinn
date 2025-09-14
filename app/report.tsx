import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import BottomNav from "./components/BottomNav";
import { useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold } from "@expo-google-fonts/poppins";

import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import ViewShot, { captureRef } from "react-native-view-shot";

// ✅ แก้ path ให้ถูก
import { listMyTransactionsInRange, summarize, toCSV, htmlReport, TxDoc } from "../Backend/report";

const COLORS = { primary:"#0B5BD3", text:"#111827", sub:"#6B7280", border:"#E5E7EB", white:"#FFFFFF" };

type Period = "daily" | "weekly" | "monthly";
type TabKey = "home" | "chat" | "report" | "account";
const ROUTE_BY_TAB: Record<TabKey, Href> = {
  home: "/home",
  chat: "/chat",
  report: "/report",
  account: "/account",
};

export default function ReportPage() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold });
  const [pickerVisible, setPickerVisible] = useState<null | Period>(null);
  const [busy, setBusy] = useState(false);

  // ✅ state สำหรับค่าสรุปที่จะ capture เป็นรูป
  const [imgSum, setImgSum] = useState({ income: 0, spend: 0, balance: 0 });
  const shotRef = useRef<View>(null);

  if (!fontsLoaded) return null;

  // period helpers
  const today = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  const rangeFor = (p: Period) => {
    if (p === "daily") {
      return { startISO: startOfDay(today).toISOString(), endISO: endOfDay(today).toISOString(), label: "Daily" };
    }
    if (p === "weekly") {
      const start = new Date(today); start.setDate(today.getDate() - 6);
      return { startISO: startOfDay(start).toISOString(), endISO: endOfDay(today).toISOString(), label: "Last 7 days" };
    }
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    return { startISO: start.toISOString(), endISO: end.toISOString(), label: today.toLocaleString("en-US", { month: "long", year: "numeric" }) };
  };

  const exportAndShare = async (format: "pdf" | "csv" | "image", p: Period) => {
    try {
      setBusy(true);
      const r = rangeFor(p);
      const txs: TxDoc[] = await listMyTransactionsInRange({ startISO: r.startISO, endISO: r.endISO });
      const sum = summarize(txs);
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const base = `Report_${p}_${ts}`;

      if (format === "csv") {
        const csv = toCSV(txs);
        const uri = FileSystem.cacheDirectory! + `${base}.csv`;
        await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
        await Sharing.shareAsync(uri, { mimeType: "text/csv", dialogTitle: `Share ${base}.csv` });
      } else if (format === "pdf") {
        const html = htmlReport({ title: `Report • ${r.label}`, summary: sum, trans: txs, currency: "THB" });
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri, { UTI: "com.adobe.pdf", mimeType: "application/pdf", dialogTitle: `Share ${base}.pdf` });
      } else {
        // ✅ อัปเดตค่าที่จะใช้ในรูป แล้วค่อย capture
        setImgSum(sum);
        await new Promise((res) => setTimeout(res, 120));
        const uri = await captureRef(shotRef, { format: "png", quality: 1 } as any);
        await Sharing.shareAsync(uri as string, { mimeType: "image/png", dialogTitle: `Share ${base}.png` });
      }
    } catch (e: any) {
      Alert.alert("Export failed", e?.message ?? "Unknown error");
    } finally {
      setBusy(false);
      setPickerVisible(null);
    }
  };

  return (
    <View style={{ flex:1, backgroundColor: COLORS.white }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report</Text>
        <View style={{ width:22 }} />
      </View>

      {/* Option cards */}
      <View style={{ paddingHorizontal:16, paddingTop:6, flexDirection:"row", gap:16 }}>
        <ReportCard label="Daily" onPress={() => setPickerVisible("daily")} />
        <ReportCard label="Weekly" onPress={() => setPickerVisible("weekly")} />
        <ReportCard label="Monthly" onPress={() => setPickerVisible("monthly")} />
      </View>

      {/* ซ่อนองค์ประกอบไว้สำหรับ capture เป็นรูป */}
      <View style={{ position:"absolute", left:-9999, top:-9999 }}>
        <ViewShot ref={shotRef}>
          <ReportImageSummary sum={imgSum} />
        </ViewShot>
      </View>

      {/* ✅ แก้ BottomNav props */}
      <BottomNav
              current="home"
              onChange={(k) => {
                const to = ROUTE_BY_TAB[k as TabKey];
                if (to) router.replace(to);
              }}
            />

      {/* Picker */}
      <Modal visible={pickerVisible !== null} transparent animationType="fade" onRequestClose={() => setPickerVisible(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerVisible(null)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Export as</Text>
          <View style={{ gap:10, marginTop:8 }}>
            <SheetBtn text="PDF" icon="document-text-outline" onPress={() => exportAndShare("pdf", pickerVisible as Period)} />
            <SheetBtn text="CSV" icon="grid-outline" onPress={() => exportAndShare("csv", pickerVisible as Period)} />
            <SheetBtn text="Image (PNG)" icon="image-outline" onPress={() => exportAndShare("image", pickerVisible as Period)} />
          </View>
          <TouchableOpacity style={[styles.cancelBtn, { marginTop: 12 }]} onPress={() => setPickerVisible(null)}>
            <Text style={styles.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
          {busy && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator />
              <Text style={{ marginTop:8, fontFamily:"Poppins_400Regular" }}>Preparing…</Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

function ReportCard({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.cardIcon}>
        <Ionicons name="calendar-outline" size={24} color="#111827" />
      </View>
      <Text style={styles.cardText}>{label}</Text>
    </TouchableOpacity>
  );
}

function SheetBtn({ text, icon, onPress }: { text: string; icon: any; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.sheetBtn} onPress={onPress}>
      <Ionicons name={icon} size={18} color="#111827" />
      <Text style={styles.sheetBtnTxt}>{text}</Text>
    </TouchableOpacity>
  );
}

// ✅ รับค่า sum จริงสำหรับการ capture เป็นรูป
function ReportImageSummary({ sum }: { sum: { income: number; spend: number; balance: number } }) {
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2 });
  return (
    <View style={{ width: 680, backgroundColor: "#fff", padding: 20, borderColor: "#e5e7eb", borderWidth: 1 }}>
      <Text style={{ fontFamily: "Poppins_700Bold", fontSize: 18, color: "#111827", marginBottom: 6 }}>Financial Report</Text>
      <Text style={{ fontFamily: "Poppins_400Regular", color: "#6b7280", marginBottom: 8 }}>Exported from Finn</Text>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <SumBox label="Income" value={`+${fmt(sum.income)} THB`} color="#0B5BD3" />
        <SumBox label="Spend" value={`-${fmt(sum.spend)} THB`} color="#EF4444" />
        <SumBox label="Balance" value={`${fmt(sum.balance)} THB`} color="#111827" />
      </View>
    </View>
  );
}
function SumBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ borderWidth:1, borderColor:"#e5e7eb", borderRadius:12, padding:12, minWidth:180 }}>
      <Text style={{ fontFamily:"Poppins_400Regular", fontSize:12, color:"#6b7280" }}>{label}</Text>
      <Text style={{ fontFamily:"Poppins_700Bold", fontSize:16, color }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header:{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:16, paddingTop:40, paddingBottom:8 },
  headerTitle:{ fontFamily:"Poppins_700Bold", fontSize:18, color:COLORS.text },
  card:{ width:92, alignItems:"center", gap:6, paddingVertical:14, backgroundColor:"#fff", borderWidth:1, borderColor:COLORS.border, borderRadius:16 },
  cardIcon:{ width:40, height:40, borderRadius:12, backgroundColor:"#F3F4F6", alignItems:"center", justifyContent:"center" },
  cardText:{ fontFamily:"Poppins_400Regular", color:COLORS.text, fontSize:12 },
  backdrop:{ position:"absolute", left:0, right:0, top:0, bottom:0, backgroundColor:"rgba(0,0,0,0.2)" },
  sheet:{ position:"absolute", left:16, right:16, bottom:24, backgroundColor:"#fff", borderRadius:16, padding:16, borderWidth:1, borderColor:COLORS.border },
  sheetTitle:{ fontFamily:"Poppins_700Bold", fontSize:16, color:COLORS.text },
  sheetBtn:{ flexDirection:"row", alignItems:"center", gap:10, paddingVertical:12, borderWidth:1, borderColor:COLORS.border, borderRadius:12, paddingHorizontal:12 },
  sheetBtnTxt:{ fontFamily:"Poppins_600SemiBold", color:COLORS.text },
  cancelBtn:{ alignItems:"center", paddingVertical:12, borderRadius:12, borderWidth:1, borderColor:COLORS.border },
  cancelTxt:{ fontFamily:"Poppins_600SemiBold", color:COLORS.text },
  loadingOverlay:{ position:"absolute", left:0, right:0, top:0, bottom:0, backgroundColor:"rgba(255,255,255,0.7)", alignItems:"center", justifyContent:"center", borderRadius:16 },
});
