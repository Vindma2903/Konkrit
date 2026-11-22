import { StyleSheet, View } from 'react-native';

import type { Person } from '@/api';
import { colors, radius } from '@/theme';
import { Icon, Text } from '@/ui';

function PersonRow({
  label,
  person,
  testID,
}: {
  label: string;
  person: Person | null;
  testID: string;
}) {
  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.avatar}>
        <Icon name="profile" size={20} color={colors.accentText} />
      </View>
      <View style={styles.texts}>
        <Text weight={600} size={11} color={colors.textMuted}>
          {label}
        </Text>
        <Text weight={600} size={14}>
          {person ? `${person.name}, ${person.position}` : 'Не назначен'}
        </Text>
      </View>
    </View>
  );
}

/** Куратор и исполнитель заявки; не назначенный показан как «Не назначен». */
export function PeopleBlock({
  curator,
  executor,
}: {
  curator: Person | null;
  executor: Person | null;
}) {
  return (
    <View style={styles.block}>
      <PersonRow label="Куратор" person={curator} testID="person-curator" />
      <PersonRow label="Исполнитель" person={executor} testID="person-executor" />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 2 },
});
