import { useSessionStore } from '@/features/auth/sessionStore';
import { SectionStub } from '@/features/home/SectionStub';
import { Button } from '@/ui';

/** Вкладка «Профиль»: заглушка с выходом из аккаунта. */
export function ProfileScreen() {
  return (
    <SectionStub
      title="Профиль"
      footer={
        <Button
          title="Выйти"
          variant="secondary"
          onPress={() => void useSessionStore.getState().signOut()}
          testID="profile-sign-out"
        />
      }
    />
  );
}
