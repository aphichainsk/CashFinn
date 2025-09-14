import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type TabKey = "home" | "chat" | "account";

export default function BottomNav({
    current,
    onChange,
}: {
    current: TabKey;
    onChange: (k: TabKey) => void;
}) {
    return (
        <View style={styles.wrap}>
            <NavItem
                label="Home"
                icon="home-outline"
                active={current === "home"}
                onPress={() => onChange("home")}
            />

            <CenterAction
                label="Finn Chat"
                image={require("../../assets/images/ai-line-nav.png")} // ขึ้นกับตำแหน่งจริง
                active={current === "chat"}
                onPress={() => onChange("chat")}
            />

            <NavItem
                label="Account"
                icon="person-outline"
                active={current === "account"}
                onPress={() => onChange("account")}
            />
        </View>
    );
}

function NavItem({
    label,
    icon,
    active,
    onPress,
}: {
    label: string;
    icon: any;
    active?: boolean;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity style={styles.item} onPress={onPress}>
            <Ionicons name={icon} size={22} color={active ? "#0B5BD3" : "#6B7280"} />
            <Text style={[styles.itemText, active && { color: "#0B5BD3" }]}>{label}</Text>
        </TouchableOpacity>
    );
}

function CenterAction({
    label,
    image,
    active,
    onPress,
}: {
    label: string;
    image: any; // ใช้ require() path หรือ { uri: string }
    active?: boolean;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity style={styles.center} onPress={onPress}>
            <View style={styles.centerCircle}>
                <Image
  source={image}
  style={{ width: 34, height: 34, resizeMode: "contain", tintColor: "#FFFFFF" }}
/>
            </View>
            <Text style={[styles.itemText, active && { color: "#0B5BD3" }]}>{label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-around",
    paddingTop: 10,
    paddingBottom: 35, // เพิ่ม padding ด้านล่างเพื่อให้พอดีกับหน้าจอที่มี notch
  },
  item: { alignItems: "center", justifyContent: "center", gap: 4 },
  itemText: { fontSize: 12, color: "#6B7280", marginTop: 2 },

  center: { alignItems: "center", justifyContent: "center" },
  centerCircle: {
    width: 60,   // ⬅️ ขยายจาก 56 → 70
    height: 60,  // ⬅️ ขยายจาก 56 → 70
    borderRadius: 999,
    backgroundColor: "#0B5BD3", // พื้นหลังสีน้ำเงิน
    alignItems: "center",
    justifyContent: "center",
    marginBottom: -2, // ⬅️ ขยับปุ่มขึ้น (เพิ่มระยะห่างจาก bottom)
  },
});
