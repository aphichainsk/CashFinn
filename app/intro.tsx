// app/intro.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  StatusBar,
  Platform,
  Animated,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import {
  useFonts,
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import { hasActiveSession } from "../Backend/auth_persist";

const BG = "#0048B8";
const HOME: Href = "/home";
const WELCOME: Href = "/welcome";

// หน่วงเวลาเข้าหน้า home เพื่อความสมูท
const SMOOTH_HOME_DELAY_MS = 1000;

export default function IntroScreen() {
  const router = useRouter();

  // ระหว่างตรวจ session
  const [checking, setChecking] = useState(true);

  // ปุ่ม Start จะแสดงหลัง 1 วิ ถ้า "ไม่มี" session
  const [showButton, setShowButton] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // เช็ค session ตอนเปิดแอป
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    (async () => {
      const ok = await hasActiveSession();
      if (cancelled) return;

      if (ok) {
        // มี session -> หน่วงเวลาเล็กน้อยก่อนเข้าบ้าน
        timeout = setTimeout(() => {
          if (!cancelled) router.replace(HOME);
        }, SMOOTH_HOME_DELAY_MS);
      } else {
        // ไม่มี session -> แสดง intro + ปุ่ม Start
        setChecking(false);
        timeout = setTimeout(() => {
          if (cancelled) return;
          setShowButton(true);
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }).start();
        }, 1000);
      }
    })();

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [fadeAnim, router]);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const onNext = () => router.replace(WELCOME);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <View style={styles.centerArea}>
        <Image
          source={require("../assets/images/CashFinnLogo.png")}
          resizeMode="contain"
          style={styles.logo}
        />
        {/* ระหว่างเช็ค session ให้โชว์ spinner */}
        {checking && <ActivityIndicator style={{ marginTop: 16 }} color="#fff" />}
      </View>

      {!checking && showButton && (
        <Animated.View style={[styles.buttonWrap, { opacity: fadeAnim }]}>
          <TouchableOpacity activeOpacity={0.8} onPress={onNext} style={styles.button}>
            <Text style={styles.buttonText}>Start</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centerArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  logo: { width: 500, height: 250 },
  buttonWrap: {
    paddingHorizontal: 35,
    paddingBottom: Platform.select({ ios: 24, android: 70 }),
  },
  button: {
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonText: {
    fontFamily: "Poppins_600SemiBold",
    color: BG,
    fontSize: 16,
  },
});
