import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, ScrollView
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter,Href } from "expo-router";
import BottomNav from "./components/BottomNav";
import { createGoal } from "../Backend/goals";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import {
  useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold,
} from "@expo-google-fonts/poppins";

const COLORS = { primary:"#0B5BD3", text:"#111827", subtext:"#6B7280", border:"#E5E7EB", white:"#FFFFFF" };
const fmtYMD = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD
type TabKey = "home" | "chat" | "report" | "account";
const ROUTE_BY_TAB: Record<TabKey, Href> = {
  home: "/home",
  chat: "/chat",
  report: "/report",
  account: "/account",
};
export default function CreateGoal() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [savedAmount, setSavedAmount] = useState("");

  // ✅ ใช้ Date object + picker
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const [category, setCategory] = useState("");
  const [currency, setCurrency] = useState("THB");
  const [status, setStatus] = useState("active");
  const [note, setNote] = useState("");

  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold });
  if (!fontsLoaded) return null;

  const onPickDate = (e: DateTimePickerEvent, selected?: Date) => {
    // Android จะเป็น modal → ปิดหลังเลือก
    if (Platform.OS === "android") setShowPicker(false);
    if (e.type === "set" && selected) setDueDate(selected);
  };

  const onCreate = async () => {
    if (!title.trim()) return Alert.alert("กรอกชื่อเป้าหมาย (title)");
    try {
      await createGoal({
        title: title.trim(),
        targetAmount: Number(targetAmount || 0),
        savedAmount: Number(savedAmount || 0),
        dueDate: dueDate ? dueDate.toISOString() : null,
        category: category || null,
        currency: currency || "THB",
        status: status || null,
        note: note || null,
      });
      router.replace("/user_goal"); // กลับหน้า Your goals
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "สร้างไม่สำเร็จ");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex:1, backgroundColor:COLORS.white }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create goal</Text>
        <View style={{ width:22 }} />
      </View>

      {/* Form scrollable */}
      <ScrollView
        contentContainerStyle={{ padding:16, paddingBottom:140 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.label}>Title *</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Family Trip" />

        <Text style={styles.label}>Target amount</Text>
        <TextInput style={styles.input} value={targetAmount} onChangeText={setTargetAmount} keyboardType="numeric" placeholder="10000" />

        <Text style={styles.label}>Saved amount (เริ่มต้น)</Text>
        <TextInput style={styles.input} value={savedAmount} onChangeText={setSavedAmount} keyboardType="numeric" placeholder="0" />

        {/* ✅ Due date: touch field + DatePicker */}
        <Text style={styles.label}>Due date</Text>
        <TouchableOpacity style={styles.inputRow} onPress={() => setShowPicker(true)} activeOpacity={0.8}>
          <Ionicons name="calendar-clear" size={18} color={COLORS.subtext} style={{ marginRight: 8 }} />
          <Text style={[styles.inputText, !dueDate && { color: COLORS.subtext }]}>
            {dueDate ? fmtYMD(dueDate) : "Select a date"}
          </Text>
        </TouchableOpacity>
        {showPicker && (
          <DateTimePicker
            value={dueDate ?? new Date()}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={onPickDate}
          />
        )}

        <Text style={styles.label}>Category</Text>
        <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="Travel / Education ..." />

        <Text style={styles.label}>Currency</Text>
        <TextInput style={styles.input} value={currency} onChangeText={setCurrency} placeholder="THB" />

        <Text style={styles.label}>Status</Text>
        <TextInput style={styles.input} value={status} onChangeText={setStatus} placeholder="active / completed / paused" />

        <Text style={styles.label}>Note</Text>
        <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="คำอธิบายเพิ่มเติม" />

        <TouchableOpacity style={styles.primaryBtn} onPress={onCreate}>
          <Text style={styles.primaryText}>Create</Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomNav
              current="home"
              onChange={(k) => {
                const to = ROUTE_BY_TAB[k as TabKey];
                if (to) router.replace(to);
              }}
            />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:16, paddingTop:40, paddingBottom:8 },
  headerTitle: { fontFamily:"Poppins_700Bold", fontSize:18, color:COLORS.text },

  label: { fontFamily:"Poppins_600SemiBold", color:COLORS.text, marginTop:10, marginBottom:6 },
  input: { borderWidth:1, borderColor:COLORS.border, borderRadius:12, paddingHorizontal:14, paddingVertical:12, fontFamily:"Poppins_400Regular" },

  // ✅ สไตล์ของช่องเลือกวันที่ ให้หน้าตาเหมือน TextInput
  inputRow: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: "row", alignItems: "center",
  },
  inputText: { fontFamily: "Poppins_400Regular", fontSize: 14, color: COLORS.text },

  primaryBtn: { backgroundColor:COLORS.primary, paddingVertical:14, borderRadius:14, alignItems:"center", marginTop:12 },
  primaryText: { color:"#fff", fontFamily:"Poppins_600SemiBold" },
});
