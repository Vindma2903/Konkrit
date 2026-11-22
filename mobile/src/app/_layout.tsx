import {
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/montserrat';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { useSessionStore } from '@/features/auth/sessionStore';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const [fontsLoaded] = useFonts({
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
  });
  const hydrated = useSessionStore((state) => state.hydrated);
  const signedIn = useSessionStore((state) => state.tokens !== null);

  useEffect(() => {
    void useSessionStore.getState().hydrate();
  }, []);

  const ready = fontsLoaded && hydrated;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Пока нет шрифта и сессии, остаётся заставка: без мигания системного шрифта.
  if (!ready) return null;

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
          <Stack.Screen name="home" />
          <Stack.Screen name="requests/new" />
          <Stack.Screen name="requests/sent" />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}
