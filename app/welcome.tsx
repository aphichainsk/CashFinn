// app/welcome.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Image as ExpoImage } from "expo-image";
import {
  useFonts,
  Poppins_400Regular,
  Poppins_600SemiBold,
} from "@expo-google-fonts/poppins";

const BLUE = "#0048B8";

export default function WelcomeScreen() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
  });
  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.container}>
      {/* ทำให้ StatusBar โปร่งและอ่านง่ายบนไล่เฉด */}
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      {/* Gradient ทั้งหน้า */}
      <LinearGradient
        colors={["#0048B8", "#FFFFFF"]} // ไล่จากฟ้าจางด้านบนลงขาว
        start={{ x: 0.6, y: 0 }}
        end={{ x: 0.7, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Logo — ขยายและขยับลงมาอีก */}
      <View style={styles.logoWrap}>
        <ExpoImage
          source={require("../assets/images/CashFinnLogo.png")}
          style={styles.logo}
          contentFit="contain"
        />
      </View>

      {/* Illustration GIF — เล่น/วนลูปอัตโนมัติ */}
      <ExpoImage
        source={require("../assets/images/CashFinn.gif")}
        style={styles.illustration}
        contentFit="contain"
        // expo-image เล่น GIF อัตโนมัติอยู่แล้ว (loop)
        // isAnimated={true} // (ค่าเริ่มต้นก็ true)
      />

      {/* Text */}
      <View style={styles.textWrap}>
        <Text style={styles.title}>Type to Track Your Spending</Text>
        <Text style={styles.subtitle}>
          Just write your day, and let AI organize your money.
        </Text>
      </View>

      {/* Buttons */}
      <View style={styles.buttonWrap}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push("/create_acc")}
          activeOpacity={0.9}
        >
          <Text style={styles.primaryText}>Create new account</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/login")}>
          <Text style={styles.secondaryText}>I already have an account</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    backgroundColor: "transparent",
  },

  // โลโก้ใหญ่ขึ้นและเลื่อนลง (เพิ่ม marginTop)
  logoWrap: {
    marginTop: 28,   // เดิม 10 → เลื่อนลงมาอีก
    marginBottom: 16,
    alignSelf: "center",
  },
  logo: {
    width: 200,      // เดิม 100 → ขยาย
    height: 90,      // เดิม 30 → ขยาย
  },

  illustration: {
    width: "92%",
    height: 240,     // ขยายเล็กน้อยให้บาลานซ์กับโลโก้
    marginBottom: 28,
  },

  textWrap: {
    alignItems: "center",
    marginBottom: 40,
    paddingHorizontal: 12,
  },
  title: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 23,
    color: "#111827",
    textAlign: "center",
    marginBottom: 0,
  },
  subtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: "#262626",
    textAlign: "center",
  },

  buttonWrap: {
    width: "100%",
    alignItems: "center",
    marginTop: "auto",
    marginBottom: 30,
  },
  primaryBtn: {
    backgroundColor: BLUE,
    width: "100%",
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  primaryText: {
    fontFamily: "Poppins_600SemiBold",
    color: "#fff",
    fontSize: 16,
  },
  secondaryText: {
    fontFamily: "Poppins_400Regular",
    color: "#111827",
    fontSize: 14,
  },
});
