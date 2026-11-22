import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { getApi, type Category } from '@/api';
import { colors, fontFamily, radius } from '@/theme';
import { ActionRow, BottomSheet, Button, Icon, Text } from '@/ui';

type CategorySheetProps = {
  visible: boolean;
  selectedId?: string;
  onSelect: (category: Category) => void;
  onClose: () => void;
};

/** Лист «Категория» (макет S12): поиск по названию и список с отметкой выбранной. */
export function CategorySheet({ visible, selectedId, onSelect, onClose }: CategorySheetProps) {
  return (
    <BottomSheet visible={visible} title="Категория" onClose={onClose} testID="category-sheet">
      <CategoryContent selectedId={selectedId} onSelect={onSelect} />
    </BottomSheet>
  );
}

/** Содержимое существует, только пока лист открыт: закрыли — поиск начинается заново. */
function CategoryContent({
  selectedId,
  onSelect,
}: {
  selectedId?: string;
  onSelect: (category: Category) => void;
}) {
  const [query, setQuery] = useState('');
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => getApi().getCategories(),
    staleTime: Infinity,
  });

  const needle = query.trim().toLowerCase();
  const list = (categories.data ?? []).filter((item) => item.name.toLowerCase().includes(needle));

  return (
    <>
      <View style={styles.search}>
        <Icon name="search" size={20} color={colors.textMuted} />
        <TextInput
          accessibilityLabel="Поиск по категориям"
          placeholder="Поиск по категориям"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          maxFontSizeMultiplier={1.3}
          style={styles.input}
          testID="category-search"
        />
      </View>

      {categories.isError ? (
        <View style={styles.state}>
          <Text weight={600} size={14} color={colors.error}>
            Не удалось загрузить категории
          </Text>
          <Button
            title="Повторить"
            onPress={() => void categories.refetch()}
            testID="category-retry"
          />
        </View>
      ) : categories.isPending ? (
        <Text weight={600} size={14} color={colors.textMuted}>
          Загружаем категории…
        </Text>
      ) : list.length === 0 ? (
        <Text size={14} color={colors.textMuted} lineHeight={20} testID="category-empty">
          Такой категории нет. Выберите «Другое»
        </Text>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {list.map((item) => (
            <ActionRow
              key={item.id}
              title={item.name}
              selected={item.id === selectedId}
              onPress={() => onSelect(item)}
              testID={`category-option-${item.id}`}
            />
          ))}
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  search: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: radius.field,
    backgroundColor: colors.bg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily[500],
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  state: { gap: 12 },
  list: { maxHeight: 340 },
  listContent: { gap: 8 },
});
