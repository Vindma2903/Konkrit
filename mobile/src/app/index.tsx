import { Redirect } from 'expo-router';

import { useSessionStore } from '@/features/auth/sessionStore';

/** Точка входа: по состоянию сессии отправляет на нужный экран. */
export default function Index() {
  const signedIn = useSessionStore((state) => state.tokens !== null);
  const hasResidency = useSessionStore((state) => state.hasResidency);

  if (!signedIn) return <Redirect href="/login" />;
  return <Redirect href={hasResidency ? '/home' : '/choose-home'} />;
}
