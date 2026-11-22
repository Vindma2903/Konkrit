import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { getApi, type Profile } from '@/api';
import { useSessionStore } from '@/features/auth/sessionStore';
import { colors, radius } from '@/theme';
import { Button, Icon, LinkText, Screen, Text } from '@/ui';

import { profileSections } from './sections';

/** Строка «Адрес, кв. N»; без адреса её нет, без квартиры — только адрес. */
export function addressLine(profile: Profile | undefined): string | null {
  if (!profile?.address) return null;
  return profile.apartment ? `${profile.address}, кв. ${profile.apartment}` : profile.address;
}

/** Вкладка «Профиль»: карточка жителя, разделы и выход (макет «Житель: профиль»). */
export function ProfileScreen() {
  const user = useSessionStore((state) => state.user);
  // Ключ с идентификатором жителя: профиль прежнего жителя не показывается следующему.
  const profile = useQuery({
    queryKey: ['profile', user?.id ?? null],
    queryFn: () => getApi().getProfile(),
  });

  const name = profile.data?.name?.trim() || user?.phone || user?.email || '';
  const address = addressLine(profile.data);

  let identity: React.ReactNode;
  if (profile.isError && !profile.data) {
    identity = (
      <View style={styles.identityText}>
        <Text weight={700} size={14} color={colors.error}>
          Не удалось загрузить профиль
        </Text>
        <LinkText size={13} onPress={() => void profile.refetch()} testID="profile-retry">
          Повторить
        </LinkText>
      </View>
    );
  } else if (profile.isPending) {
    identity = (
      <Text weight={600} size={14} color={colors.textMuted} testID="profile-loading">
        Загружаем профиль…
      </Text>
    );
  } else {
    identity = (
      <View style={styles.identityText}>
        <Text weight={800} size={18} numberOfLines={2} testID="profile-name">
          {name}
        </Text>
        {address ? (
          <Text weight={500} size={13} color={colors.textMuted} testID="profile-address">
            {address}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <Screen
      bottomInset={false}
      contentGap={16}
      header={
        <View style={styles.titleRow}>
          <Text weight={800} size={20} accessibilityRole="header">
            Профиль
          </Text>
        </View>
      }
    >
      <View style={styles.card} testID="profile-card">
        <View style={styles.avatar}>
          <Icon name="profile" size={32} color={colors.accentText} />
        </View>
        {identity}
      </View>

      <View style={styles.menu}>
        {profileSections.map((section, index) => (
          <Pressable
            key={section.key}
            accessibilityRole="button"
            accessibilityLabel={section.title}
            onPress={() =>
              router.push({ pathname: '/profile/[section]', params: { section: section.key } })
            }
            style={[styles.row, index > 0 ? styles.divider : null]}
            testID={`profile-section-${section.key}`}
          >
            <Icon name={section.icon} color={colors.accent} />
            <Text weight={600} size={15} style={styles.rowTitle}>
              {section.title}
            </Text>
            <Icon name="chevronRight" color={colors.textMuted} />
          </Pressable>
        ))}
      </View>

      <Button
        title="Выйти"
        icon="logout"
        variant="danger"
        style={styles.signOut}
        onPress={() => void useSessionStore.getState().signOut()}
        testID="profile-sign-out"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: { flex: 1, gap: 4 },
  menu: { borderRadius: radius.card, backgroundColor: colors.surface, overflow: 'hidden' },
  row: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16 },
  rowTitle: { flex: 1 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  signOut: { height: 52, borderWidth: 1, borderColor: colors.border },
});
