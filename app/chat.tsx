// app/chat.tsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import * as Speech from "expo-speech";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useFonts,
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";

import { callFinnChat, type ChatMessage } from "../lib/api";
import { createTransaction } from "../Backend/transactions";
import { createGoal } from "../Backend/goals";
import { listMyTransactionsInRange, summarize, type TxDoc } from "../Backend/report";

// ---------- UI const ----------
type Bubble = { id: string; role: "user" | "assistant"; content: string };

const BLUE = "#165DFF";
const BLUE_LIGHT = "#6DA7FF";
const BG_TOP = "#EAF2FF";
const TEXT = "#111827";
const SUBTEXT = "#6B7280";
const BORDER = "#E5E7EB";
const WHITE = "#FFFFFF";
const HOME_ROUTE: Href = "/home";

// storage keys
const STORAGE_CURRENT = "cf:chat:current";
const STORAGE_SESSIONS = "cf:chat:sessions";

// ---------- JSON helpers (ต้องอยู่ก่อนใช้) ----------
const codeBlockJsonRegex = /```json\s*([\s\S]*?)\s*```/i;

type TxType = "income" | "spend";

// ---------- Goal JSON ----------
export type ParsedGoal = {
  title: string;
  targetAmount: number;
  savedAmount?: number;
  dueDate?: string; // YYYY-MM-DD หรือ ISO
  category?: string;
  currency?: string;
  note?: string;
};
function extractGoalJSON(text: string): ParsedGoal | null {
  const m = text.match(codeBlockJsonRegex);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[1]);
    const g = obj?.goal;
    if (!g || typeof g.title !== "string") return null;
    return {
      title: g.title.trim(),
      targetAmount: Number(g.targetAmount ?? 0),
      savedAmount: g.savedAmount != null ? Number(g.savedAmount) : undefined,
      dueDate: typeof g.dueDate === "string" ? g.dueDate : undefined,
      category: typeof g.category === "string" ? g.category : undefined,
      currency: typeof g.currency === "string" ? g.currency : "THB",
      note: typeof g.note === "string" ? g.note : undefined,
    };
  } catch {
    return null;
  }
}

// ---------- Finance JSON จากโมเดล ----------
export type ParsedEntry = {
  type: TxType; // "income" | "spend"
  amount: number;
  note?: string;
  category?: string;
  dateISO?: string;
};
type ParsedFinance = {
  entries: ParsedEntry[];
  summaryTH?: string;
  confident?: boolean;
};
function extractFinanceJSON(text: string): ParsedFinance | null {
  const m = text.match(codeBlockJsonRegex);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[1]);
    if (!obj || !Array.isArray(obj.entries)) return null;
    const entries: ParsedEntry[] = obj.entries
      .map((e: any) => ({
        type: e?.type === "income" ? "income" : e?.type === "spend" ? "spend" : undefined,
        amount: Number(e?.amount ?? 0),
        note: e?.note ?? undefined,
        category: e?.category ?? undefined,
        dateISO: typeof e?.dateISO === "string" ? e.dateISO : undefined,
      }))
      .filter((e: ParsedEntry) => (e.type === "income" || e.type === "spend") && e.amount > 0);
    if (entries.length === 0) return null;
    return {
      entries,
      summaryTH: typeof obj.summaryTH === "string" ? obj.summaryTH : undefined,
      confident: Boolean(obj.confident),
    };
  } catch {
    return null;
  }
}

const formatTHB = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

// ---------- Cards (Finance & Goal) ----------
function FinanceCard(props: {
  parsed: ParsedFinance;
  onSave: (entries: ParsedEntry[]) => Promise<void>;
  onEdit: (entries: ParsedEntry[]) => void;
}) {
  const { parsed, onSave, onEdit } = props;
  const [saving, setSaving] = useState(false);

  const totalIncome = useMemo(
    () => parsed.entries.filter((e) => e.type === "income").reduce((a, b) => a + b.amount, 0),
    [parsed.entries]
  );
  const totalSpend = useMemo(
    () => parsed.entries.filter((e) => e.type === "spend").reduce((a, b) => a + b.amount, 0),
    [parsed.entries]
  );

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave(parsed.entries);
      Alert.alert("Saved", "บันทึกรายการเรียบร้อยแล้ว");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "บันทึกล้มเหลว");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.financeCard}>
      {!!parsed.summaryTH && <Text style={styles.financeSummary}>{parsed.summaryTH}</Text>}

      {parsed.entries.map((e, idx) => (
        <View key={idx} style={styles.financeRow}>
          <View
            style={[styles.typeDot, { backgroundColor: e.type === "income" ? "#0B5BD3" : "#EF4444" }]}
          />
          <Text style={styles.financeText}>
            {e.type === "income" ? "Income" : "Spend"} • {e.category || e.note || "-"} • {formatTHB(e.amount)} THB
          </Text>
        </View>
      ))}

      <View style={styles.totalsRow}>
        <Text style={styles.totalIncome}>+{formatTHB(totalIncome)} THB</Text>
        <Text style={styles.totalSpend}>-{formatTHB(totalSpend)} THB</Text>
      </View>

      <View style={styles.cardBtnRow}>
        <TouchableOpacity
          style={[styles.cardBtn, styles.cardBtnPrimary, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.cardBtnPrimaryText}>Save</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.cardBtn, styles.cardBtnGhost]} onPress={() => onEdit(parsed.entries)}>
          <Text style={styles.cardBtnGhostText}>Edit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function GoalCard({ goal }: { goal: ParsedGoal }) {
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    try {
      setSaving(true);
      await createGoal({
        title: goal.title,
        targetAmount: Number(goal.targetAmount || 0),
        savedAmount: Number(goal.savedAmount || 0),
      });
      Alert.alert("Saved", "บันทึก Goal เรียบร้อยแล้ว");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.bubble, styles.bubbleBot]}>
      <Text style={{ fontWeight: "700", color: "#111827", marginBottom: 6 }}>Create Goal</Text>
      <Text style={{ color: "#111827" }}>🎯 {goal.title}</Text>
      <Text style={{ color: "#111827" }}>Target: {formatTHB(goal.targetAmount)} THB</Text>
      {!!goal.savedAmount && <Text style={{ color: "#111827" }}>Saved: {formatTHB(goal.savedAmount)} THB</Text>}
      {!!goal.dueDate && <Text style={{ color: "#111827" }}>Due: {goal.dueDate.slice(0, 10)}</Text>}
      {!!goal.category && <Text style={{ color: "#111827" }}>Category: {goal.category}</Text>}
      {!!goal.note && <Text style={{ color: "#111827" }}>Note: {goal.note}</Text>}

      <TouchableOpacity onPress={onSave} disabled={saving} style={[styles.cardBtn, styles.cardBtnPrimary, { marginTop: 10 }]}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.cardBtnPrimaryText}>Save Goal</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ---------- Edit Entries Modal ----------
function EditEntriesModal(props: {
  visible: boolean;
  initialEntries: ParsedEntry[];
  onClose: () => void;
  onSave: (entries: ParsedEntry[]) => Promise<void>;
}) {
  const { visible, initialEntries, onClose, onSave } = props;
  const [draft, setDraft] = useState<ParsedEntry[]>(initialEntries);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setDraft(initialEntries);
  }, [visible, initialEntries]);

  const updateAt = (idx: number, patch: Partial<ParsedEntry>) => {
    setDraft((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };
  const removeAt = (idx: number) => setDraft((prev) => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!draft.length) {
      Alert.alert("ไม่มีรายการ", "โปรดเพิ่มอย่างน้อย 1 รายการ");
      return;
    }
    try {
      setSaving(true);
      await onSave(draft);
      onClose();
      Alert.alert("Saved", "บันทึกรายการเรียบร้อยแล้ว");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "บันทึกล้มเหลว");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={mstyles.backdrop}>
        <View style={mstyles.sheet}>
          <Text style={mstyles.title}>Edit entries</Text>
          <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
            {draft.map((e, idx) => (
              <View key={idx} style={mstyles.itemBox}>
                <View style={mstyles.rowBetween}>
                  <View style={mstyles.typeSwitchRow}>
                    <TouchableOpacity
                      onPress={() => updateAt(idx, { type: "income" })}
                      style={[mstyles.typePill, e.type === "income" && mstyles.typePillIncome]}
                    >
                      <Text style={[mstyles.typePillText, e.type === "income" && mstyles.typePillTextActive]}>Income</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => updateAt(idx, { type: "spend" })}
                      style={[mstyles.typePill, e.type === "spend" && mstyles.typePillSpend]}
                    >
                      <Text style={[mstyles.typePillText, e.type === "spend" && mstyles.typePillTextActive]}>Spend</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity onPress={() => removeAt(idx)}>
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>

                <View style={mstyles.fieldRow}>
                  <Text style={mstyles.label}>Amount</Text>
                  <TextInput
                    keyboardType={Platform.select({ ios: "decimal-pad", android: "numeric" })}
                    value={String(e.amount || "")}
                    onChangeText={(t) => updateAt(idx, { amount: Number(t.replace(/,/g, "")) || 0 })}
                    placeholder="0"
                    style={mstyles.input}
                  />
                </View>

                <View style={mstyles.fieldRow}>
                  <Text style={mstyles.label}>Note</Text>
                  <TextInput
                    value={e.note || ""}
                    onChangeText={(t) => updateAt(idx, { note: t })}
                    placeholder="เช่น ขนม / ค่ารถ / แม่ให้"
                    style={mstyles.input}
                  />
                </View>

                <View style={mstyles.fieldRow}>
                  <Text style={mstyles.label}>Category</Text>
                  <TextInput
                    value={e.category || ""}
                    onChangeText={(t) => updateAt(idx, { category: t })}
                    placeholder="เช่น food / transport / gift"
                    style={mstyles.input}
                  />
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={mstyles.footerRow}>
            <TouchableOpacity style={mstyles.btnGhost} onPress={onClose} disabled={saving}>
              <Text style={mstyles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[mstyles.btnPrimary, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={mstyles.btnPrimaryText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// =============== Main Screen ===============
type Session = { id: string; title: string; messages: Bubble[]; updatedAt: number };

const SUGGESTIONS = [
  {
    id: "goal",
    title: "Create a goal\nfrom my text",
    prompt:
      "I want to create a savings goal using Thai. Ask me for missing fields step-by-step until you have: title, targetAmount (THB), savedAmount, dueDate (YYYY-MM-DD), category, currency (default THB), note. When ready, reply with a short Thai confirmation and ONE code-fenced JSON using this exact schema:\n```json\n{ \"goal\": { \"title\": string, \"targetAmount\": number, \"savedAmount\": number, \"dueDate\": string, \"category\": string, \"currency\": string, \"note\": string } }\n```\nNo other JSON blocks.",
    icon: "🎯",
  },
  {
    id: "plan",
    title: "วางแผนการเงิน\nจากข้อมูลจริง",
    prompt: "", // จะประกอบจาก DB แบบไดนามิกในฟังก์ชัน startFinancePlan()
    icon: "📊",
  },
];

export default function ChatScreen() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasChatted, setHasChatted] = useState(false);
  const [messages, setMessages] = useState<Bubble[]>([
    {
      id: "hello",
      role: "assistant",
      content:
        "สวัสดี ฉันคือ Finn ผู้ช่วยด้านการเงินของคุณ\nลองพิมพ์ข้อความเกี่ยวกับรายรับ-รายจ่าย หรือใช้ปุ่ม “วางแผนการเงิน” เพื่อให้ฉันวิเคราะห์จากข้อมูลจริงของคุณได้เลย",
    },
  ]);
  const listRef = useRef<FlatList>(null);

  // TTS


  // Modals
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorDraft, setEditorDraft] = useState<ParsedEntry[]>([]);
  const [historyVisible, setHistoryVisible] = useState(false);

  // History data
  const [sessions, setSessions] = useState<Session[]>([]);

  // ---------- init from storage ----------
  useEffect(() => {
    (async () => {
      try {
        const currRaw = await AsyncStorage.getItem(STORAGE_CURRENT);
        if (currRaw) {
          const curr: Bubble[] = JSON.parse(currRaw);
          if (Array.isArray(curr) && curr.length) {
            setMessages(curr);
            setHasChatted(curr.some((m) => m.role === "user"));
          }
        }
        const listRaw = await AsyncStorage.getItem(STORAGE_SESSIONS);
        if (listRaw) {
          const list: Session[] = JSON.parse(listRaw);
          setSessions(Array.isArray(list) ? list : []);
        }
      } catch {}
    })();
  }, []);

  // save current conversation snapshot
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_CURRENT, JSON.stringify(messages)).catch(() => {});
  }, [messages]);

  // Defer font-loaded early return until after all hooks are declared

  // ---------- save entries to database ----------
  const saveEntries = async (entries: ParsedEntry[]) => {
    for (const e of entries) {
      const iso =
        typeof e.dateISO === "string" && /^\d{4}-\d{2}-\d{2}T/.test(e.dateISO)
          ? e.dateISO
          : new Date().toISOString();
      await createTransaction({
        type: e.type,
        amount: e.amount,
        dateISO: iso,
        note: e.note ?? undefined,
        category: e.category ?? undefined,
      });
    }
  };

  // ---------- editor ----------
  const openEditor = (entries: ParsedEntry[]) => {
    setEditorDraft(entries);
    setEditorVisible(true);
  };

  // ---------- send (logging mode) ----------
  const send = async (userText: string) => {
    const text = userText.trim();
    if (!text || loading) return;

    if (!hasChatted) setHasChatted(true);

    const userMsg: Bubble = { id: String(Date.now()), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history: ChatMessage[] = [
        {
          role: "system",
          content: [
            "You are Finn, a Thai-speaking finance assistant.",
            "When the user writes about income/expense, you MUST return a short Thai summary followed by a single code-fenced JSON (```json ... ```).",
            "JSON schema:",
            "{",
            '  "entries": [',
            '    { "type": "income|spend", "amount": number, "note": string, "category": string, "dateISO": string }',
            "  ],",
            '  "summaryTH": string,',
            '  "confident": boolean',
            "}",
            "If the text is not about logging income/expense, do NOT include JSON.",
            "Use Thai entity/amount extraction.",
          ].join("\n"),
        },
        ...messages.map((m) => ({ role: m.role, content: m.content })) as ChatMessage[],
        { role: "user", content: text },
      ];

      const reply = await callFinnChat(history);
      const botMsg: Bubble = { id: `a-${Date.now()}`, role: "assistant", content: reply };
      setMessages((prev) => [...prev, botMsg]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "ขอโทษนะ มีปัญหาเชื่อมต่อเซิร์ฟเวอร์ ตรวจสอบ BACKEND_URL/IP และโมเดลว่าเปิดอยู่หรือไม่",
        },
      ]);
      console.error(e);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  };

  // ---------- plan finance (อ่าน DB ก่อน แล้วค่อยถามโมเดล) ----------
  const startFinancePlan = async () => {
    try {
      setHasChatted(true);
      setLoading(true);

      // 1) ดึงข้อมูลย้อนหลัง: เดือนนี้ + เดือนที่แล้ว
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const txs: TxDoc[] = await listMyTransactionsInRange({
        startISO: start.toISOString(),
        endISO: end.toISOString(),
      });
      const sum = summarize(txs); // { income, spend, balance, byCat }

      // 2) เตรียม context แบบย่อย
      const topCats = Object.entries(sum.byCat)
        .map(([cat, v]) => ({ cat, income: v.income, spend: v.spend }))
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 6);

      const last10 = [...txs]
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 10)
        .map(
          (t) =>
            `${t.date.slice(0, 10)},${t.type},${t.category || ""},${(t.note || "").replace(/,/g, " ")},${t.amount}`
        )
        .join("\n");

      const context = [
        `ช่วงข้อมูล: ${start.toISOString().slice(0, 10)} ถึง ${end.toISOString().slice(0, 10)}`,
        `รวมรายรับ: ${formatTHB(sum.income)} THB`,
        `รวมรายจ่าย: ${formatTHB(sum.spend)} THB`,
        `คงเหลือ: ${formatTHB(sum.balance)} THB`,
        ``,
        `สรุปรายหมวด (ท็อป 6 ตามรายจ่าย):`,
        ...topCats.map(
          (c) => `- ${c.cat}: รับ ${formatTHB(c.income)} / จ่าย ${formatTHB(c.spend)} THB`
        ),
        ``,
        `10 รายการล่าสุด (CSV: date,type,category,note,amount):`,
        last10 || "(ไม่มีข้อมูล)",
      ].join("\n");

      // 3) สร้างพรอมพ์วางแผนการเงิน
      const planAskTH = [
        "ช่วยวิเคราะห์การเงินจากข้อมูลจริงของฉันด้านล่าง แล้วเสนอแผนการเงินแบบปฏิบัติได้จริง (ภาษาไทย):",
        "- สรุปสถานการณ์ตอนนี้สั้น ๆ",
        "- จัดงบประมาณรายเดือน (Budget) เป็น % และเป็นตัวเลข THB โดยประมาณ",
        "- เสนอเพดานสำหรับหมวดรายจ่ายที่มักใช้เยอะ พร้อมวิธีลด",
        "- กำหนดเป้าหมายการออม (saving) ต่อเดือนและทั้งปี",
        "- ถ้าจำเป็น ให้ถามข้อมูลที่ยังขาด (เช่น รายได้เฉลี่ย/หนี้สิน)",
        "",
        "ข้อมูลจากฐานข้อมูล:",
        "```",
        context,
        "```",
      ].join("\n");

      // 4) ส่งหาโมเดลด้วย system สำหรับ “ที่ปรึกษาการเงิน”
      const history: ChatMessage[] = [
        {
          role: "system",
          content:
            "You are a Thai personal finance planner. Give concise, actionable advice in Thai with bullet lists and clear THB numbers.",
        },
        ...messages.map((m) => ({ role: m.role, content: m.content })) as ChatMessage[],
        { role: "user", content: planAskTH },
      ];

      const userMsg: Bubble = { id: String(Date.now()), role: "user", content: "วางแผนการเงินให้หน่อย (ใช้ข้อมูลจริงของฉัน)" };
      setMessages((prev) => [...prev, userMsg]);

      const reply = await callFinnChat(history);
      const botMsg: Bubble = { id: `a-${Date.now()}`, role: "assistant", content: reply };
      setMessages((prev) => [...prev, botMsg]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "ดึงข้อมูลจากฐานข้อมูลไม่สำเร็จ หรือโมเดลไม่ตอบ ลองใหม่อีกครั้งนะ",
        },
      ]);
      console.error(e);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  };

  // ---------- suggestions ----------
  const onTapSuggestion = (id: string, prompt: string) => {
    if (id === "plan") return startFinancePlan();
    // goal
    setHasChatted(true);
    send(prompt);
  };

  // ---------- TTS ----------
  const [speaking, setSpeakingState] = useState(false);
  const onSpeak = async () => {
    try {
      const speakingNow = await Speech.isSpeakingAsync();
      if (speakingNow) {
        Speech.stop();
        setSpeakingState(false);
        return;
      }
      if (!input.trim()) return;
      setSpeakingState(true);
      Speech.speak(input, {
        language: "th-TH",
        onDone: () => setSpeakingState(false),
        onStopped: () => setSpeakingState(false),
        onError: () => setSpeakingState(false),
      });
    } catch {}
  };

  // ---------- history (save/load/delete) ----------
  const saveCurrentToSessions = async () => {
    try {
      const hasUser = messages.some((m) => m.role === "user");
      if (!hasUser) return;
      const title = messages.find((m) => m.role === "user")?.content?.slice(0, 30) || "Conversation";
      const session: Session = { id: String(Date.now()), title, messages, updatedAt: Date.now() };
      const raw = await AsyncStorage.getItem(STORAGE_SESSIONS);
      const list: Session[] = raw ? JSON.parse(raw) : [];
      const next = [session, ...list].slice(0, 50);
      await AsyncStorage.setItem(STORAGE_SESSIONS, JSON.stringify(next));
      setSessions(next);
    } catch {}
  };

  const newChat = async () => {
    await saveCurrentToSessions();
    const hello: Bubble = {
      id: "hello",
      role: "assistant",
      content:
        "สวัสดี ฉันคือ Finn ผู้ช่วยด้านการเงินของคุณ\nลองพิมพ์ข้อความเกี่ยวกับรายรับ-รายจ่าย หรือใช้ปุ่ม “วางแผนการเงิน” เพื่อให้ฉันวิเคราะห์จากข้อมูลจริงของคุณได้เลย",
    };
    setMessages([hello]);
    setHasChatted(false);
  };

  const openHistory = async () => setHistoryVisible(true);
  const loadSession = async (s: Session) => {
    setMessages(s.messages);
    setHasChatted(s.messages.some((m) => m.role === "user"));
    setHistoryVisible(false);
  };
  const deleteSession = async (id: string) => {
    const raw = await AsyncStorage.getItem(STORAGE_SESSIONS);
    const list: Session[] = raw ? JSON.parse(raw) : [];
    const next = list.filter((x) => x.id !== id);
    await AsyncStorage.setItem(STORAGE_SESSIONS, JSON.stringify(next));
    setSessions(next);
  };
  const clearAllSessions = async () => {
    await AsyncStorage.removeItem(STORAGE_SESSIONS);
    setSessions([]);
  };

  // ---------- render ----------
  const renderItem = ({ item }: { item: Bubble }) => {
    const mine = item.role === "user";

    if (!mine) {
      // 1) Goal JSON → แสดงการ์ดบันทึก Goal
      const g = extractGoalJSON(item.content);
      if (g) {
        return (
          <View style={[styles.row, styles.rowLeft]}>
            <GoalCard goal={g} />
          </View>
        );
      }
      // 2) Finance JSON → แสดงการ์ดบันทึกรายการ
      const parsed = extractFinanceJSON(item.content);
      if (parsed) {
        return (
          <View style={[styles.row, styles.rowLeft]}>
            <View style={[styles.bubble, styles.bubbleBot]}>
              <FinanceCard
                parsed={parsed}
                onSave={saveEntries}
                onEdit={(entries) => {
                  setEditorDraft(entries);
                  setEditorVisible(true);
                }}
              />
            </View>
          </View>
        );
      }
    }

    return (
      <View style={[styles.row, mine ? styles.rowRight : styles.rowLeft]}>
        <View style={[styles.bubble, mine ? styles.bubbleUser : styles.bubbleBot]}>
          <Text style={[styles.bubbleText, mine ? styles.userText : styles.botText, { fontFamily: "Poppins_400Regular" }]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  // Keep all hooks above; bail out of rendering UI until fonts are ready
  if (!fontsLoaded) return null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}>
      <LinearGradient colors={[BLUE, BLUE_LIGHT, BG_TOP]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1 }}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.replace(HOME_ROUTE)} hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}>
            <Ionicons name="arrow-back" size={22} color={WHITE} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { fontFamily: "Poppins_700Bold" }]}>Finn Chat</Text>

          <View style={styles.rightBtns}>
            <TouchableOpacity onPress={openHistory} style={styles.iconCircle}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={WHITE} />
            </TouchableOpacity>
            <TouchableOpacity onPress={newChat} style={styles.newBtn}>
              <Text style={styles.newBtnText}>New</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Mascot + Suggestions */}
        {!hasChatted && (
          <>
            <View style={styles.mascotWrap}>
              <View style={styles.mascotCircle}>
                <Image source={require("../assets/images/finn.png")} style={{ width: 72, height: 72 }} resizeMode="contain" />
              </View>
            </View>
            <View style={styles.cardsRow}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity key={s.id} style={styles.card} activeOpacity={0.9} onPress={() => onTapSuggestion(s.id, s.prompt)}>
                  <Text style={{ fontSize: 18, marginBottom: 8 }}>{s.icon}</Text>
                  <Text style={[styles.cardText, { fontFamily: "Poppins_600SemiBold" }]}>{s.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Input */}
        <View style={styles.inputWrap}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="พิมพ์เช่น วันนี้ซื้อขนม 50 บาท แม่ให้ 20 บาท…"
            placeholderTextColor={SUBTEXT}
            style={[styles.textInput, { fontFamily: "Poppins_400Regular" }]}
            multiline
            onSubmitEditing={() => send(input)}
          />

          {/* TTS */}
          <TouchableOpacity style={styles.fabSpeak} onPress={onSpeak} disabled={!input.trim().length}>
            <Ionicons name={speaking ? "volume-mute-outline" : "volume-high-outline"} size={18} color={speaking ? SUBTEXT : BLUE} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.fabSend, loading && { opacity: 0.5 }]} disabled={loading} onPress={() => send(input)}>
            <Ionicons name="send" size={18} color={WHITE} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Edit Modal */}
      <EditEntriesModal visible={editorVisible} initialEntries={editorDraft} onClose={() => setEditorVisible(false)} onSave={saveEntries} />

      {/* History Modal (มีลบทีละรายการ + ลบทั้งหมด) */}
      <Modal visible={historyVisible} transparent animationType="fade" onRequestClose={() => setHistoryVisible(false)}>
        <View style={hstyles.backdrop}>
          <View style={hstyles.panel}>
            <Text style={hstyles.title}>Chat History</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {sessions.length === 0 ? (
                <Text style={hstyles.empty}>No history</Text>
              ) : (
                sessions.map((s) => (
                  <View key={s.id} style={hstyles.sessionRow}>
                    <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }} onPress={() => loadSession(s)}>
                      <Ionicons name="chatbubble-outline" size={16} color={TEXT} />
                      <View style={{ flex: 1 }}>
                        <Text style={hstyles.sessionTitle} numberOfLines={1}>
                          {s.title}
                        </Text>
                        <Text style={hstyles.sessionSub}>{new Date(s.updatedAt).toLocaleString()}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteSession(s.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <TouchableOpacity style={[hstyles.closeBtn, { flex: 1 }]} onPress={() => setHistoryVisible(false)}>
                <Text style={hstyles.closeText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[hstyles.closeBtn, { flex: 1, backgroundColor: "#EF4444" }]} onPress={clearAllSessions}>
                <Text style={hstyles.closeText}>Clear all</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ---------- styles ----------
const BUBBLE_MAX = "86%";

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 48,
    paddingHorizontal: 16,
  },
  rightBtns: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  newBtn: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  newBtnText: { color: WHITE, fontWeight: "700" },
  headerTitle: { color: WHITE, fontSize: 20, fontWeight: "700", paddingLeft: 60 },

  mascotWrap: { alignItems: "center", marginTop: 14, marginBottom: 16 },
  mascotCircle: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  cardsRow: {
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  card: {
    flex: 1,
    backgroundColor: WHITE,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardText: { color: TEXT, fontSize: 13, lineHeight: 18 },

  row: { marginBottom: 10, paddingHorizontal: 10 },
  rowLeft: { alignItems: "flex-start" },
  rowRight: { alignItems: "flex-end" },
  bubble: {
    maxWidth: BUBBLE_MAX,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleUser: { backgroundColor: BLUE, borderBottomRightRadius: 6 },
  bubbleBot: {
    backgroundColor: WHITE,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  userText: { color: WHITE },
  botText: { color: TEXT },
  bubbleText: { fontSize: 15, lineHeight: 20 },

  inputWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: WHITE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  textInput: { minHeight: 40, maxHeight: 120, color: TEXT, paddingRight: 84 },
  fabSpeak: { position: "absolute", right: 52, bottom: 10, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  fabSend: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },

  // finance card
  financeCard: { gap: 8 },
  financeSummary: { color: TEXT, fontSize: 14, marginBottom: 4 },
  financeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  typeDot: { width: 10, height: 10, borderRadius: 5 },
  financeText: { color: TEXT, fontSize: 13 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, marginBottom: 4 },
  totalIncome: { color: "#0B5BD3", fontWeight: "700" },
  totalSpend: { color: "#EF4444", fontWeight: "700" },
  cardBtnRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  cardBtn: { flex: 1, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardBtnPrimary: { backgroundColor: "#0B5BD3" },
  cardBtnPrimaryText: { color: "#fff", fontWeight: "600" },
  cardBtnGhost: { borderWidth: 1, borderColor: BORDER, backgroundColor: "#fff" },
  cardBtnGhostText: { color: TEXT, fontWeight: "600" },
});

// -------- modal styles (edit) --------
const mstyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 14, maxHeight: "85%" },
  title: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 8 },
  itemBox: { borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 12, marginBottom: 10, backgroundColor: "#fff" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  typeSwitchRow: { flexDirection: "row", gap: 8 },
  typePill: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAFAFA",
  },
  typePillIncome: { borderColor: "#0B5BD3", backgroundColor: "#E9F1FF" },
  typePillSpend: { borderColor: "#EF4444", backgroundColor: "#FDECEC" },
  typePillText: { color: "#374151", fontWeight: "600" },
  typePillTextActive: { color: "#111827" },
  fieldRow: { marginTop: 10 },
  label: { color: "#6B7280", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: "#111827" },
  footerRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  btnGhost: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhostText: { color: "#111827", fontWeight: "600" },
  btnPrimary: { flex: 1, height: 44, borderRadius: 12, backgroundColor: "#0B5BD3", alignItems: "center", justifyContent: "center" },
  btnPrimaryText: { color: "#fff", fontWeight: "700" },
});

// -------- modal styles (history) --------
const hstyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: 16 },
  panel: { backgroundColor: "#fff", borderRadius: 14, padding: 14 },
  title: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 10 },
  empty: { color: SUBTEXT, paddingVertical: 8 },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  sessionTitle: { color: TEXT, fontWeight: "600" },
  sessionSub: { color: SUBTEXT, fontSize: 12 },
  closeBtn: {
    marginTop: 12,
    height: 44,
    borderRadius: 10,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: "#fff", fontWeight: "700" },
});
