import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { View, type ScrollViewInstance } from 'react-native';

import { getApi } from '@/api';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { colors } from '@/theme';
import { Button, FieldError, Screen, ScreenHeader, SelectField, Text, TextField } from '@/ui';

import { AttachButtons } from './AttachButtons';
import { useRequestDraft } from './draftStore';
import { DESCRIPTION_MAX, DESCRIPTION_MIN, isFormEmpty, validateRequest } from './schema';
import { SuggestionPlate } from './SuggestionPlate';

const SUGGEST_DELAY_MS = 500;
const NO_RESIDENCY_ERROR = 'Привяжите квартиру, чтобы отправить заявку';
const SEND_ERROR = 'Не удалось отправить заявку. Попробуйте снова';

type FieldKey = 'category' | 'description' | 'address';

/** Новая заявка жителя: состояния S1 (пустая), S2 (ввод), S3 (заполнена), S4 (ошибки). */
export function NewRequestScreen() {
  const { category, description, setCategory, setDescription, reset } = useRequestDraft();
  const [showErrors, setShowErrors] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const fieldY = useRef<Partial<Record<FieldKey, number>>>({});
  // Защита от двойного нажатия: состояние мутации обновляется с задержкой.
  const inFlight = useRef(false);

  const residencies = useQuery({
    queryKey: ['residencies'],
    queryFn: () => getApi().getResidencies(),
  });
  const residency =
    residencies.data?.find((item) => item.status === 'confirmed') ?? residencies.data?.[0];

  // Подсказка категории: после паузы в наборе, если категория ещё не выбрана.
  const trimmed = description.trim();
  const pausedText = useDebouncedValue(trimmed, SUGGEST_DELAY_MS);
  const wantSuggestion =
    !category && pausedText.length >= DESCRIPTION_MIN && pausedText === trimmed;
  const suggestion = useQuery({
    queryKey: ['suggest-category', pausedText],
    queryFn: ({ signal }) => getApi().suggestCategory({ text: pausedText, signal }),
    enabled: wantSuggestion,
    retry: false,
    staleTime: Infinity,
  });
  const suggested = wantSuggestion ? suggestion.data : null;

  const create = useMutation({
    mutationFn: () =>
      getApi().createRequest({
        categoryId: category?.id ?? '',
        description: trimmed,
        residencyId: residency?.id ?? '',
      }),
    onSuccess: () => {
      reset();
      router.replace('/requests/sent');
    },
  });

  const errors = validateRequest({ categoryId: category?.id ?? null, description });
  const addressError = !residency && !residencies.isPending ? NO_RESIDENCY_ERROR : undefined;
  const hasErrors = Boolean(errors.category || errors.description || addressError);

  function scrollToFirstError() {
    const first: FieldKey | undefined = errors.category
      ? 'category'
      : errors.description
        ? 'description'
        : 'address';
    const y = fieldY.current[first] ?? 0;
    scrollRef.current?.scrollTo({ y: Math.max(y - 8, 0), animated: true });
  }

  function submit() {
    if (inFlight.current) return;
    if (hasErrors) {
      setShowErrors(true);
      scrollToFirstError();
      return;
    }
    inFlight.current = true;
    create.mutate(undefined, { onSettled: () => (inFlight.current = false) });
  }

  const empty = isFormEmpty({ categoryId: category?.id ?? null, description });

  return (
    <Screen
      scrollRef={scrollRef}
      header={<ScreenHeader title="Новая заявка" />}
      footer={
        <>
          <Button
            title="Отправить заявку"
            onPress={submit}
            disabled={empty}
            loading={create.isPending}
            testID="request-submit"
          />
          <FieldError
            message={create.isError ? SEND_ERROR : undefined}
            testID="request-send-error"
          />
          <Text size={12} color={colors.textMuted} lineHeight={17} style={{ textAlign: 'center' }}>
            Заявку получит диспетчер. Статус придёт в MAX и push.
          </Text>
        </>
      }
    >
      <View
        onLayout={(event) => {
          fieldY.current.category = event.nativeEvent.layout.y;
        }}
      >
        <SelectField
          label="Категория"
          placeholder="Выберите категорию"
          value={category?.name}
          error={showErrors ? errors.category : undefined}
          testID="request-category"
        />
      </View>

      <View
        onLayout={(event) => {
          fieldY.current.description = event.nativeEvent.layout.y;
        }}
        style={{ gap: 14 }}
      >
        <TextField
          label="Что случилось"
          placeholder="Опишите проблему"
          value={description}
          onChangeText={(text) => setDescription(text.slice(0, DESCRIPTION_MAX))}
          multiline
          showCounter
          maxLength={DESCRIPTION_MAX}
          error={showErrors ? errors.description : undefined}
          testID="request-description"
        />
        {suggested ? (
          <SuggestionPlate categoryName={suggested.name} onChoose={() => setCategory(suggested)} />
        ) : null}
      </View>

      <View
        onLayout={(event) => {
          fieldY.current.address = event.nativeEvent.layout.y;
        }}
      >
        <SelectField
          label="Адрес"
          leftIcon="pin"
          placeholder="Адрес не указан"
          value={residency ? `${residency.address}, кв. ${residency.apartment}` : undefined}
          error={showErrors ? addressError : undefined}
          testID="request-address"
        />
      </View>

      <AttachButtons />
    </Screen>
  );
}
