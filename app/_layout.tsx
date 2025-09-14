import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { 
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold
} from '@expo-google-fonts/poppins';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';

export default function RootLayout() {
  // เรียก hooks ทั้งหมดแบบไม่เป็นเงื่อนไข
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    // ถ้าต้องใช้ SpaceMono รวมไว้ในรอบเดียว
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // การ render แบบมีเงื่อนไขทำใน JSX ด้านล่าง (ไม่ตัด Hooks)
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {!fontsLoaded ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Loading...</Text>
        </View>
      ) : (
        <>
          <Stack>
            <Stack.Screen name="intro" options={{ headerShown: false }} />
            <Stack.Screen name="account" options={{ headerShown: false }} />
            <Stack.Screen name="reports" options={{ headerShown: false }} />
            <Stack.Screen name="welcome" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="create_acc" options={{ headerShown: false }} />
            <Stack.Screen name="home" options={{ headerShown: false }} />
            <Stack.Screen name="manual-record" options={{ headerShown: false }} />
            <Stack.Screen name="chat" options={{ headerShown: false }} />
            <Stack.Screen name="daily" options={{ headerShown: false }} />
            <Stack.Screen name="weekly" options={{ headerShown: false }} />
            <Stack.Screen name="monthly" options={{ headerShown: false }} />
            <Stack.Screen name="user_goal" options={{ headerShown: false }} />
            <Stack.Screen name="create_goal" options={{ headerShown: false }} />
            <Stack.Screen name="goals/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            <Stack.Screen name="report" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="auto" />
        </>
      )}
    </ThemeProvider>
  );
}
