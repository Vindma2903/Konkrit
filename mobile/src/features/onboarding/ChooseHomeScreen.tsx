import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { getApi } from '@/api';
import { useSessionStore } from '@/features/auth/sessionStore';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { colors, sizes } from '@/theme';
import { Button, SelectableCard, Screen, ScreenHeader, Text, TextField } from '@/ui';

import { useOnboardingStore } from './onboardingStore';

const SEARCH_DELAY_MS = 400;

/** Онбординг: выбор дома. */
export function ChooseHomeScreen() {
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query.trim(), SEARCH_DELAY_MS);
  const house = useOnboardingStore((state) => state.house);
  const selectHouse = useOnboardingStore((state) => state.selectHouse);

  const houses = useQuery({
    queryKey: ['houses', debounced],
    queryFn: () => getApi().searchHouses({ query: debounced }),
    // Пока идёт новый поиск, прежний список не пропадает.
    placeholderData: keepPreviousData,
  });

  function goBack() {
    // Первый экран после входа: «Назад» возвращает к входу, то есть выходит из сессии.
    if (router.canGoBack()) router.back();
    else void useSessionStore.getState().signOut();
  }

  const list = houses.data ?? [];

  return (
    <Screen
      header={<ScreenHeader title="Ваш дом" onBack={goBack} />}
      contentGap={16}
      footer={
        <Button
          title="Продолжить"
          disabled={!house || !list.some((item) => item.id === house.id)}
          onPress={() => router.push('/apartment')}
          testID="choose-home-continue"
        />
      }
    >
      <TextField
        label="Адрес дома"
        placeholder="Город, улица, дом"
        value={query}
        onChangeText={setQuery}
        leftIcon="search"
        autoCorrect={false}
        returnKeyType="search"
        testID="house-search"
      />

      {houses.isError ? (
        <View style={styles.state}>
          <Text weight={600} size={14} color={colors.error}>
            Не удалось загрузить список домов. Проверьте соединение.
          </Text>
          <Button title="Повторить" onPress={() => void houses.refetch()} style={styles.retry} />
        </View>
      ) : houses.isPending ? (
        <Text weight={700} size={13} color={colors.textMuted}>
          Ищем дома…
        </Text>
      ) : (
        <>
          <Text weight={700} size={13} color={colors.textMuted} testID="houses-count">
            {`Найдено: ${list.length}`}
          </Text>
          {list.length === 0 ? (
            <Text size={14} color={colors.textMuted} lineHeight={20} testID="houses-empty">
              Ничего не найдено. Уточните адрес или выберите «Моего дома нет в списке».
            </Text>
          ) : (
            <View style={styles.list} accessibilityRole="radiogroup">
              {list.map((item) => (
                <SelectableCard
                  key={item.id}
                  title={item.title}
                  subtitle={item.address}
                  caption={`УК ${item.company}`}
                  selected={house?.id === item.id}
                  onPress={() => selectHouse(item)}
                  testID={`house-${item.id}`}
                />
              ))}
            </View>
          )}
        </>
      )}

      <Pressable
        accessibilityRole="link"
        onPress={() => Alert.alert('Моего дома нет в списке', 'Эта возможность скоро появится')}
        style={styles.link}
        testID="house-missing"
      >
        <Text weight={700} size={14} color={colors.accentText}>
          Моего дома нет в списке
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  state: { gap: 12 },
  retry: { width: 160 },
  link: { minHeight: sizes.touch, justifyContent: 'center', alignSelf: 'flex-start' },
});
