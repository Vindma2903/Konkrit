import {
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/montserrat';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';

import { getApi } from '@/api';
import { useSessionStore } from '@/features/auth/sessionStore';
import { flushDraftWrites } from '@/features/requests/draftStore';
import { queryClient } from '@/lib/queryClient';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
  });
  const hydrated = useSessionStore((state) => state.hydrated);
  const signedIn = useSessionStore((state) => state.tokens !== null);

  // Релизная сборка без реального клиента: говорим об этом прямо, а не «нет соединения».
  const configError = useMemo(() => {
    try {
      getApi();
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Ошибка настройки приложения';
    }
  }, []);

  useEffect(() => {
    void useSessionStore.getState().hydrate();
  }, []);

  // Приложение уходит в фон: сохраняем черновик сразу, не дожидаясь задержки записи.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void flushDraftWrites().catch(() => undefined);
    });
    return () => subscription.remove();
  }, []);

  // Если шрифт не загрузился, работаем на системном: застрять на заставке хуже.
  const ready = (fontsLoaded || fontError !== null) && hydrated;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Пока нет шрифта и сессии, остаётся заставка: без мигания системного шрифта.
  if (!ready) return null;

  if (configError) {
    return (
      <View style={styles.config} accessibilityRole="alert">
        <Text style={styles.configTitle}>Приложение не настроено</Text>
        <Text style={styles.configText}>{configError}</Text>
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" />
          <Stack.Screen name="code" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="choose-home" />
          <Stack.Screen name="apartment" />
          <Stack.Screen name="residency-sent" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="requests/new" />
          <Stack.Screen name="requests/sent" options={{ gestureEnabled: false }} />
          <Stack.Screen name="requests/failed" options={{ gestureEnabled: false }} />
          <Stack.Screen name="requests/[id]" />
          <Stack.Screen name="chats/[id]" />
          <Stack.Screen name="news/[id]" />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  config: { flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: 'center', gap: 12 },
  configTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  configText: { fontSize: 15, color: colors.textMuted, lineHeight: 22 },
});
