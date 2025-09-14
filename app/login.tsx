// app/login.tsx
import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
    Alert,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
    useFonts,
    Poppins_400Regular,
    Poppins_600SemiBold,
} from "@expo-google-fonts/poppins";
import { login } from "../Backend/auth_config"; // ⬅️ ใช้ฟังก์ชันจาก auth_config

const BLUE = "#0048B8";
const HOME_ROUTE: Href = "/home";

export default function LoginScreen() {
    const router = useRouter();

    // ฟิลด์สำหรับกรอก
    const [emailOrUser, setEmailOrUser] = useState("");
    const [password, setPassword] = useState("");

    // สถานะ UI
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // โหลดฟอนต์
    const [fontsLoaded] = useFonts({
        Poppins_400Regular,
        Poppins_600SemiBold,
    });
    if (!fontsLoaded) return null;

    // helper: ตรวจรูปแบบอีเมลง่าย ๆ
    const isEmail = (v: string) => /\S+@\S+\.\S+/.test(v);

    // กด Continue -> เรียก Appwrite login
    const handleLogin = async () => {
        setErrorMsg(null);

        // ป้องกันกดรัว
        if (submitting) return;

        // validate เบื้องต้น
        if (!emailOrUser || !password) {
            setErrorMsg("Please fill in both email/username and password.");
            return;
        }

        // ตอนนี้รองรับ email เท่านั้น (เพราะ permission โปรไฟล์เป็นของเจ้าของ)
        if (!isEmail(emailOrUser)) {
            Alert.alert(
                "Use your email",
                "Please log in with your email address. Username login will be added later."
            );
            return;
        }

        try {
            setSubmitting(true);
            await login({ email: emailOrUser.trim(), password }, { force: true });
            router.replace("/home");
        } catch (err: any) {
            // ข้อความ error จาก Appwrite
            const msg =
                err?.message ||
                err?.response?.message ||
                "Login failed. Please check your credentials.";
            setErrorMsg(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={22} color="#111" />
                </TouchableOpacity>
            </View>

            {/* Body */}
            <View style={styles.body}>
                <Text style={styles.title}>Access your account</Text>
                <Text style={styles.subtitle}>
                    Log in to your account to show to manage your money
                </Text>

                <TextInput
                    placeholder="Username or Email"
                    placeholderTextColor="#9CA3AF"
                    style={styles.input}
                    autoCapitalize="none"
                    value={emailOrUser}
                    onChangeText={setEmailOrUser}
                    editable={!submitting}
                />
                <TextInput
                    placeholder="Password"
                    placeholderTextColor="#9CA3AF"
                    style={styles.input}
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    editable={!submitting}
                />

                {/* แสดง error ถ้ามี */}
                {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

                <TouchableOpacity
                    onPress={() => {
                        // TODO: ทำ flow reset password ด้วย Appwrite (account.createRecovery)
                        Alert.alert("Coming soon", "Forgot password will be added soon.");
                    }}
                    disabled={submitting}
                >
                    <Text style={styles.link}>Forgot password</Text>
                </TouchableOpacity>

                {/* Continue button */}
                <TouchableOpacity
                    style={[styles.primaryBtn, submitting && { opacity: 0.7 }]}
                    activeOpacity={0.9}
                    onPress={handleLogin}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.primaryText}>Continue</Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },

    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#E5E7EB",
    },

    body: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
    title: {
        fontFamily: "Poppins_600SemiBold",
        fontSize: 20,
        color: "#111827",
        marginBottom: 6,
    },
    subtitle: {
        fontFamily: "Poppins_400Regular",
        fontSize: 14,
        color: "#6B7280",
        marginBottom: 24,
    },
    input: {
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontFamily: "Poppins_400Regular",
        fontSize: 14,
        color: "#111827",
        marginBottom: 16,
    },
    link: {
        fontFamily: "Poppins_400Regular",
        fontSize: 14,
        color: BLUE,
        marginBottom: 24,
    },
    primaryBtn: {
        backgroundColor: BLUE,
        borderRadius: 30,
        paddingVertical: 14,
        alignItems: "center",
        marginTop: 20,
    },
    primaryText: {
        fontFamily: "Poppins_600SemiBold",
        fontSize: 16,
        color: "#fff",
    },
    errorText: {
        color: "#EF4444",
        fontFamily: "Poppins_400Regular",
        fontSize: 13,
        marginBottom: 8,
    },
});
