import React, { useEffect, useState } from "react";
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert,
    KeyboardAvoidingView, Platform, ScrollView
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Href } from "expo-router";
import BottomNav from "../components/BottomNav";
import {
    GoalDoc, getGoal, updateGoal, addGoalProgress, percent, deleteGoal
} from "../../Backend/goals";
import {
    useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold
} from "@expo-google-fonts/poppins";

const COLORS = { primary: "#0B5BD3", text: "#111827", light: "#6B7280", border: "#E5E7EB", track: "#E5E7EB", white: "#FFFFFF", danger: "#EF4444" };

function Progress({ v }: { v: number }) {
    return (
        <View style={{ width: "100%", height: 12, backgroundColor: COLORS.track, borderRadius: 999 }}>
            <View style={{ width: `${Math.min(100, Math.max(0, v))}%`, height: 12, backgroundColor: COLORS.primary, borderRadius: 999 }} />
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
export default function ManageGoal() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();

    const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold });
    const [loading, setLoading] = useState(true);
    const [doc, setDoc] = useState<GoalDoc | null>(null);

    // form fields
    const [title, setTitle] = useState("");
    const [targetAmount, setTargetAmount] = useState("");
    const [savedAmount, setSavedAmount] = useState("");
    const [dueDate, setDueDate] = useState(""); // YYYY-MM-DD
    const [category, setCategory] = useState("");
    const [currency, setCurrency] = useState("THB");
    const [status, setStatus] = useState("active");
    const [note, setNote] = useState("");

    // add progress
    const [addAmt, setAddAmt] = useState("");

    const load = async () => {
        setLoading(true);
        try {
            const g = await getGoal(id);
            setDoc(g);
            setTitle(g.title ?? "");
            setTargetAmount(String(g.targetAmount ?? ""));
            setSavedAmount(String(g.savedAmount ?? ""));
            setDueDate(g.dueDate ? g.dueDate.substring(0, 10) : "");
            setCategory(g.category ?? "");
            setCurrency(g.currency ?? "THB");
            setStatus(g.status ?? "active");
            setNote(g.note ?? "");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [id]);
    if (!fontsLoaded) return null;

    const p = percent({ targetAmount: Number(targetAmount || 0), savedAmount: Number(savedAmount || 0) });

    const onSave = async () => {
        try {
            await updateGoal(id, {
                title: title.trim(),
                targetAmount: Number(targetAmount || 0),
                savedAmount: Number(savedAmount || 0),
                dueDate: dueDate ? new Date(dueDate).toISOString() : null,
                category: category || null,
                currency: currency || "THB",
                status: status || null,
                note: note || null,
            });
            Alert.alert("Saved");
            await load();
        } catch (e: any) {
            Alert.alert("Error", e?.message ?? "บันทึกไม่สำเร็จ");
        }
    };

    const doAdd = async (sign: 1 | -1, quick?: number) => {
        const n = typeof quick === "number" ? quick : Number(addAmt);
        if (!n || n <= 0) return Alert.alert("กรอกจำนวนให้ถูกต้อง");
        try {
            await addGoalProgress(id, sign * n);
            setAddAmt("");
            await load();
        } catch (e: any) {
            Alert.alert("Error", e?.message ?? "อัปเดตยอดไม่สำเร็จ");
        }
    };

    // ✅ ปุ่มลบ goal (ยืนยันก่อน)
    const confirmDelete = () => {
        Alert.alert(
            "Delete goal",
            `ต้องการลบ "${title || "Goal"}" ใช่ไหม? การลบไม่สามารถย้อนกลับได้`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive" as any,
                    onPress: async () => {
                        try {
                            await deleteGoal(id);
                            Alert.alert("Deleted", "ลบเป้าหมายเรียบร้อย");
                            // เปลี่ยนเป็น "/goals" หากหน้า Your goals ของคุณใช้เส้นทางนั้น
                            router.replace("/user_goal");
                        } catch (e: any) {
                            Alert.alert("Error", e?.message ?? "ลบไม่สำเร็จ");
                        }
                    },
                },
            ]
        );
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: COLORS.white }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={22} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Manage goal</Text>
                <View style={{ width: 22 }} />
            </View>

            {loading || !doc ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <ActivityIndicator />
                </View>
            ) : (
                <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
                    {/* Summary */}
                    <View style={styles.card}>
                        <View style={styles.rowBetween}>
                            <Text style={styles.cardTitle}>{title || "Goal"}</Text>
                            <Text style={styles.percent}>{p}%</Text>
                        </View>
                        <Progress v={p} />
                        <Text style={styles.small}>
                            {Number(savedAmount || 0).toLocaleString()} / {Number(targetAmount || 0).toLocaleString()} {currency}
                        </Text>
                    </View>

                    {/* Add progress */}
                    <Text style={styles.sectionTitle}>Add progress</Text>
                    <Text style={styles.label}>Amount</Text>
                    <TextInput style={styles.input} value={addAmt} onChangeText={setAddAmt} keyboardType="numeric" placeholder="เช่น 500" />
                    <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
                        {[100, 500, 1000].map((q) => (
                            <TouchableOpacity key={q} style={styles.chip} onPress={() => doAdd(1, q)}>
                                <Text style={styles.chipText}>+{q}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                        <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={() => doAdd(1)}>
                            <Text style={styles.primaryText}>Add</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.outlineBtn, { flex: 1 }]} onPress={() => doAdd(-1)}>
                            <Text style={styles.outlineText}>Withdraw</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Edit fields */}
                    <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Edit goal</Text>
                    <Text style={styles.label}>Title</Text>
                    <TextInput style={styles.input} value={title} onChangeText={setTitle} />

                    <Text style={styles.label}>Target amount</Text>
                    <TextInput style={styles.input} value={targetAmount} onChangeText={setTargetAmount} keyboardType="numeric" />

                    <Text style={styles.label}>Saved amount</Text>
                    <TextInput style={styles.input} value={savedAmount} onChangeText={setSavedAmount} keyboardType="numeric" />

                    <Text style={styles.label}>Due date (YYYY-MM-DD)</Text>
                    <TextInput
                        style={styles.input}   // << แก้จาก stylesinput เป็น styles.input
                        value={dueDate}
                        onChangeText={setDueDate}
                        placeholder="2025-12-31"
                    />

                    <Text style={styles.label}>Category</Text>
                    <TextInput style={styles.input} value={category} onChangeText={setCategory} />

                    <Text style={styles.label}>Currency</Text>
                    <TextInput style={styles.input} value={currency} onChangeText={setCurrency} />

                    <Text style={styles.label}>Status</Text>
                    <TextInput style={styles.input} value={status} onChangeText={setStatus} />

                    <Text style={styles.label}>Note</Text>
                    <TextInput style={styles.input} value={note} onChangeText={setNote} />

                    <TouchableOpacity style={[styles.primaryBtn, { marginTop: 10 }]} onPress={onSave}>
                        <Text style={styles.primaryText}>Save changes</Text>
                    </TouchableOpacity>

                    {/* ✅ ปุ่มลบ Goal */}
                    <TouchableOpacity style={styles.dangerBtn} onPress={confirmDelete}>
                        <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                        <Text style={styles.dangerText}>Delete goal</Text>
                    </TouchableOpacity>
                </ScrollView>
            )}

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
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 40, paddingBottom: 8 },
    headerTitle: { fontFamily: "Poppins_700Bold", fontSize: 18, color: COLORS.text },

    card: { backgroundColor: "#fff", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
    cardTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: COLORS.text },
    percent: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: COLORS.primary },
    small: { marginTop: 8, color: COLORS.light, fontFamily: "Poppins_400Regular", fontSize: 12 },

    sectionTitle: { fontFamily: "Poppins_700Bold", fontSize: 14, color: COLORS.text, marginBottom: 6 },
    label: { fontFamily: "Poppins_600SemiBold", color: COLORS.text, marginTop: 8, marginBottom: 6 },
    input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: "Poppins_400Regular" },

    primaryBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 14, alignItems: "center" },
    primaryText: { color: "#fff", fontFamily: "Poppins_600SemiBold" },
    outlineBtn: { borderWidth: 1, borderColor: COLORS.primary, paddingVertical: 14, borderRadius: 14, alignItems: "center" },
    outlineText: { color: COLORS.primary, fontFamily: "Poppins_600SemiBold" },

    chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: COLORS.border },
    chipText: { fontFamily: "Poppins_600SemiBold", color: COLORS.text, fontSize: 12 },

    // ✅ ปุ่มลบ
    dangerBtn: {
        marginTop: 14,
        paddingVertical: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.danger,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
    },
    dangerText: { color: COLORS.danger, fontFamily: "Poppins_600SemiBold" },
});
