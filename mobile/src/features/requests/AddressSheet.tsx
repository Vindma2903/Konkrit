import { Pressable, ScrollView, StyleSheet } from 'react-native';

import type { Residency } from '@/api';
import { colors, radius } from '@/theme';
import { ActionRow, BottomSheet, Icon, Text } from '@/ui';

type AddressSheetProps = {
  visible: boolean;
  /** Подтверждённые привязки жителя. */
  residencies: Residency[];
  selectedId?: string;
  onSelect: (residency: Residency) => void;
  onAdd: () => void;
  onClose: () => void;
};

/** Лист «Адрес заявки» (макет S5): привязки жителя и «Добавить адрес». */
export function AddressSheet({
  visible,
  residencies,
  selectedId,
  onSelect,
  onAdd,
  onClose,
}: AddressSheetProps) {
  return (
    <BottomSheet visible={visible} title="Адрес заявки" onClose={onClose} testID="address-sheet">
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {residencies.map((item) => (
          <ActionRow
            key={item.id}
            icon="pin"
            title={`${item.address}, кв. ${item.apartment}`}
            subtitle={item.primary ? 'Основной адрес' : 'Добавлен жителем'}
            selected={item.id === selectedId}
            onPress={() => onSelect(item)}
            testID={`address-option-${item.id}`}
          />
        ))}
      </ScrollView>
      <Pressable accessibilityRole="button" onPress={onAdd} style={styles.add} testID="address-add">
        <Icon name="plus" size={18} color={colors.accentText} />
        <Text weight={700} size={14} color={colors.accentText}>
          Добавить адрес
        </Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 340 },
  listContent: { gap: 14 },
  add: {
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
