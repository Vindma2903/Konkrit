import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme';
import { Icon, Text, type IconName } from '@/ui';

const tabs: { name: string; title: string; icon: IconName }[] = [
  { name: 'home', title: 'Новости', icon: 'news' },
  { name: 'requests', title: 'Заявки', icon: 'requests' },
  { name: 'services', title: 'Услуги', icon: 'services' },
  { name: 'chat', title: 'Чат', icon: 'chat' },
  { name: 'profile', title: 'Профиль', icon: 'profile' },
];

/** Нижняя навигация жителя: Новости, Заявки, Услуги, Чат, Профиль. */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.bar, { height: 72 + insets.bottom, paddingBottom: insets.bottom }],
        tabBarItemStyle: styles.item,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.title,
            tabBarButtonTestID: `tab-${tab.name}`,
            tabBarIcon: ({ color }) => <Icon name={tab.icon} color={String(color)} />,
            tabBarLabel: ({ focused, color }) => (
              <Text weight={focused ? 700 : 600} size={11} color={String(color)}>
                {tab.title}
              </Text>
            ),
            tabBarActiveTintColor: colors.accentText,
            tabBarInactiveTintColor: colors.textMuted,
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 8,
  },
  item: { minHeight: 44, justifyContent: 'center', gap: 4 },
});
