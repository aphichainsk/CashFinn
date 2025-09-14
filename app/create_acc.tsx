// app/create_acc.tsx
// หน้าสมัครสมาชิก เชื่อม Appwrite: create account + สร้างเอกสารโปรไฟล์

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
import { createAccountAndProfile } from "../Backend/auth_config";

const BLUE = "#0048B8";
const HOME_ROUTE: Href = "/home";

export default function CreateAccountScreen() {
    const router = useRouter();

    // ฟิลด์สำหรับกรอก
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPass, setConfirmPass] = useState("");

    // UI states
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // โหลดฟอนต์
    const [fontsLoaded] = useFonts({
        Poppins_400Regular,
        Poppins_600SemiBold,
    });

    if (!fontsLoaded) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: "center" }]}>
                <ActivityIndicator size="small" color={BLUE} />
            </SafeAreaView>
        );
    }

    // ตรวจรูปแบบอีเมลง่าย ๆ
    const isEmail = (v: string) => /\S+@\S+\.\S+/.test(v);

    // สมัครสมาชิก -> Appwrite
    const handleSignUp = async () => {
        setErrorMsg(null);

        // validate เบื้องต้น
        if (!username.trim() || !email.trim() || !password || !confirmPass) {
            setErrorMsg("Please fill in all fields.");
            return;
        }
        if (!isEmail(email)) {
            setErrorMsg("Please enter a valid email address.");
            return;
        }
        if (password.length < 6) {
            setErrorMsg("Password must be at least 6 characters.");
            return;
        }
        if (password !== confirmPass) {
            setErrorMsg("Passwords do not match.");
            return;
        }

        try {
            setSubmitting(true);
            await createAccountAndProfile(
                {
                    username: username.trim(),
                    email: email.trim(),
                    password,
                },
                { force: true } // ⬅️ สำคัญ: เคลียร์ session ค้างก่อนสมัคร
            );
            router.replace("/home");
        } catch (err: any) {
            const msg =
                err?.message ||
                err?.response?.message ||
                "Sign up failed. Please try again.";
            setErrorMsg(msg);
            // ถ้าต้องการ popup เพิ่มเติม
            // Alert.alert("Sign up failed", msg);
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
                <Text style={styles.title}>Create your account</Text>
                <Text style={styles.subtitle}>
                    Create an account to show to manage your money
                </Text>

                <TextInput
                    placeholder="Username"
                    placeholderTextColor="#9CA3AF"
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    editable={!submitting}
                />
                <TextInput
                    placeholder="Email"
                    placeholderTextColor="#9CA3AF"
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
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

                <Text style={styles.link}>Confirm your password</Text>
                <TextInput
                    placeholder="Password"
                    placeholderTextColor="#9CA3AF"
                    style={styles.input}
                    secureTextEntry
                    value={confirmPass}
                    onChangeText={setConfirmPass}
                    editable={!submitting}
                />

                {/* แสดง error ถ้ามี */}
                {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

                {/* Continue button */}
                <TouchableOpacity
                    style={[styles.primaryBtn, submitting && { opacity: 0.7 }]}
                    activeOpacity={0.9}
                    onPress={handleSignUp}
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
        paddingTop: 50,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
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
        marginBottom: 4,
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
