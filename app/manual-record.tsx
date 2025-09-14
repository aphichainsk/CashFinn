// app/manual-record.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import BottomNav from "./components/BottomNav";                // ✅ แก้ path (อยู่ใน app/)
import { useRouter, type Href } from "expo-router";
import { createTransaction } from "../Backend/transactions";            // ✅ เพิ่ม import สำหรับบันทึกขึ้น Appwrite

// ---- UI consts ----
const COLORS = {
  primary: "#0B5BD3",
  white: "#FFFFFF",
  text: "#111827",
  subtext: "#9CA3AF",
  outline: "#E5E7EB",
  chipBg: "#FFFFFF",
  danger: "#EF4444",
};
const HOME: Href = "/home";
const CHAT: Href = "/chat";
const RADIUS = { xl: 28, lg: 20, md: 14, sm: 12 };
const FONT = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
};

// ---- types ----
type Type = "income" | "spend";

export default function ManualRecordScreen() {
  // form states
  const [amount, setAmount] = useState<string>("");
  const [type, setType] = useState<Type>("income");
  const [note, setNote] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [category, setCategory] = useState<string | undefined>(undefined);

  // ui states
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const chips = ["Salary", "Food & Drinks", "Income", "Books", "Shopping", "Travel"];
  const router = useRouter();

  const onChangeDate = (_: any, selectedDate?: Date) => {
    if (Platform.OS === "android") setShowPicker(false);
    if (selectedDate) setDate(selectedDate);
  };

  const formatted = useMemo(() => {
    const f = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
    return f.replace(",", " ,");
  }, [date]);

  // --- save to Appwrite ---
  const onSave = async () => {
    // validate
    const amt = parseFloat((amount || "0").replace(/,/g, ""));
    if (!amt || Number.isNaN(amt) || amt <= 0) {
      Alert.alert("Invalid amount", "Please enter a valid amount greater than 0.");
      return;
    }
    try {
      setSaving(true);
      const doc = await createTransaction({
        type,
        amount: amt,
        dateISO: date.toISOString(),
        note: note?.trim() || undefined,
        category,
      });
      Alert.alert("Saved", "Your record has been saved.", [
        { text: "OK", onPress: () => router.replace(HOME) },
      ]);
      // หรือจะเคลียร์ฟอร์มแทน:
      // setAmount(""); setNote(""); setCategory(undefined);
    } catch (e: any) {
      const msg = e?.message || e?.response?.message || "Save failed. Please try again.";
      Alert.alert("Error", msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {/* Back button -> Home */}
        <TouchableOpacity onPress={() => router.replace(HOME)} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>

        {/* Title */}
        <Text style={styles.headerTitle}>Manual Record</Text>

        {/* Finn -> Chat */}
        <TouchableOpacity onPress={() => router.replace(CHAT)} style={styles.finnBtn}>
          <Image
            source={require("../assets/images/ai-fill.png")}
            style={{ width: 18, height: 18, marginRight: 6 }}
            resizeMode="contain"
          />
          <Text style={styles.finnText}> Finn</Text>
        </TouchableOpacity>
      </View>

      {/* Date row */}
      <TouchableOpacity style={styles.dateCenter} onPress={() => setShowPicker(true)}>
        <Ionicons name="calendar-outline" size={18} color="#6B7280" />
        <Text style={styles.dateText}> {formatted}</Text>
      </TouchableOpacity>

      {showPicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={onChangeDate}
          minimumDate={new Date(2000, 0, 1)}
          maximumDate={new Date(2100, 11, 31)}
        />
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Amount */}
        <View style={styles.amountWrap}>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor="#D1D5DB"
            keyboardType={Platform.select({ ios: "decimal-pad", android: "numeric" })}
            style={styles.amountInput}
          />
          <Text style={styles.currency}>THB</Text>
        </View>

{/* Type pills */}
<View style={styles.pillRow}>
  {/* Income */}
  <TouchableOpacity
    style={[styles.pill, type === "income" && styles.pillIncomeActive]}
    onPress={() => setType("income")}
    hitSlop={8}
  >
    <Image
      source={require("../assets/images/income_icon.png")}
      style={styles.pillIcon}          // ✅ ไม่ใส่ tintColor เพื่อให้เป็นสีเดิมของ PNG
      resizeMode="contain"
    />
    <Text
      style={[
        styles.pillText,
        type === "income" && styles.pillIncomeTextActive, // ✅ เปลี่ยนสีเฉพาะข้อความ
      ]}
    >
      Income
    </Text>
  </TouchableOpacity>

  {/* Spend */}
  <TouchableOpacity
    style={[styles.pill, type === "spend" && styles.pillSpendActive]}
    onPress={() => setType("spend")}
    hitSlop={8}
  >
    <Image
      source={require("../assets/images/spend_icon.png")}
      style={styles.pillIcon}          // ✅ ไม่แตะสีของ PNG
      resizeMode="contain"
    />
    <Text
      style={[
        styles.pillText,
        type === "spend" && styles.pillSpendTextActive,   // ✅ เปลี่ยนสีเฉพาะข้อความ
      ]}
    >
      Spend
    </Text>
  </TouchableOpacity>
</View>


        {/* Note */}
        <View style={styles.noteWrap}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Note..."
            placeholderTextColor="#BFBFBF"
            multiline
            style={styles.noteInput}
          />
        </View>

        {/* Chips (select category) */}
        <View style={styles.chipsWrap}>
          {chips.map((c) => {
            const active = category === c;
            return (
              <TouchableOpacity
                key={c}
                style={[
                  styles.chip,
                  active && { borderColor: COLORS.primary, backgroundColor: "#F2F7FF" },
                ]}
                onPress={() => setCategory((prev) => (prev === c ? undefined : c))}
              >
                <Text
                  style={[
                    styles.chipText,
                    active && { color: COLORS.primary },
                  ]}
                >
                  {c}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Add category (TODO) */}
        <View style={{ alignItems: "center", marginTop: 10 }}>
          <TouchableOpacity style={styles.plusBtn} onPress={() => { /* TODO: add category */ }}>
            <Ionicons name="add" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={onSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* BottomNav */}
      <BottomNav
        current="home"
        onChange={(tab) => {
          // นำทางตามที่คุณต้องการ
          console.log("tab ->", tab);
        }}
      />
    </View>
  );
}

// ---- styles ----
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },

  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  headerTitle: {
    flex: 1,
    paddingLeft: 30,
    textAlign: "center",
    fontSize: 20,
    color: COLORS.text,
    fontFamily: FONT.bold,
  },
  finnBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 999,
  },
  finnText: { color: COLORS.white, fontFamily: FONT.semibold },

  dateCenter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    marginBottom: 10,
  },
  dateText: {
    fontSize: 14,
    color: "#374151",
    fontFamily: FONT.regular,
  },

  amountWrap: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.outline,
    marginHorizontal: 16,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  amountInput: {
    fontSize: 36,
    color: COLORS.text,
    fontFamily: FONT.medium,
  },
  currency: {
    position: "absolute",
    right: 16,
    bottom: 10,
    fontSize: 12,
    color: COLORS.subtext,
    fontFamily: FONT.regular,
  },

  pillRow: {
    paddingTop: 12,
    flexDirection: "row",
    textAlign: "center",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  pill: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: COLORS.outline,
    flexDirection: "row",
    alignItems: "center",
  },
  pillActiveOutline: { borderColor: "#D1D5DB" },
  pillText: { color: "#374151", fontFamily: FONT.semibold },

  noteWrap: {
    paddingTop: 20,
    borderWidth: 1,
    borderColor: COLORS.outline,
    borderRadius: RADIUS.lg,
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: COLORS.white,
  },
  noteInput: {
    minHeight: 180,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: "top",
    fontSize: 14,
    color: COLORS.text,
    fontFamily: FONT.regular,
  },

  chipsWrap: {
    justifyContent: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  chip: {
    backgroundColor: COLORS.chipBg,
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.outline,
  },
  chipText: { color: COLORS.text, fontFamily: FONT.semibold },

  plusBtn: {
    width: 64,
    height: 32,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  saveBtn: {
    marginHorizontal: 16,
    marginTop: 16,
    height: 56,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: COLORS.white, fontSize: 16, fontFamily: FONT.semibold },


dot: {
  width: 14,
  height: 14,
  borderRadius: 7,
  marginRight: 8,
},

pillIcon: {
  width: 18,
  height: 18,
  marginRight: 6,
},

// สถานะ "เลือก" ของแต่ละประเภท → เปลี่ยนเฉพาะพื้นหลังและขอบ
pillIncomeActive: {
  backgroundColor: "#E9F1FF",     // ฟ้าอ่อน
  borderColor: COLORS.primary,    // ขอบฟ้า
},
pillSpendActive: {
  backgroundColor: "#FBE1E5",     // แดงอ่อน
  borderColor: COLORS.danger,     // ขอบแดง
},

// สีตัวอักษรตอนเลือก
pillIncomeTextActive: { color: COLORS.primary },
pillSpendTextActive: { color: COLORS.danger },



});
