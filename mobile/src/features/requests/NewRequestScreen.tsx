import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View, type ScrollViewInstance } from 'react-native';

import { ApiError, getApi } from '@/api';
import { attachmentLimits } from '@/config';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useSingleFlight } from '@/lib/useSingleFlight';
import { colors } from '@/theme';
import { Button, Screen, ScreenHeader, SelectField, Text, TextField } from '@/ui';

import { AddressSheet } from './AddressSheet';
import { AttachmentsBlock } from './AttachmentsBlock';
import { AttachSheet } from './AttachSheet';
import { planAdd } from './attachmentRules';
import { CategorySheet } from './CategorySheet';
import { useCreatedRequest } from './createdRequestStore';
import { DiscardSheet } from './DiscardSheet';
import { flushDraftWrites, isDraftDirty, useRequestDraft } from './draftStore';
import { getPickers, type PickResult } from './pickers';
import { DESCRIPTION_MAX, DESCRIPTION_MIN, isFormEmpty, validateRequest } from './schema';
import { SuggestionPlate } from './SuggestionPlate';
import {
  addAndUpload,
  discardDraft,
  removeAttachment,
  retryAllFailed,
  retryUpload,
} from './uploader';

const SUGGEST_DELAY_MS = 500;
const NO_RESIDENCY_ERROR = 'Привяжите квартиру, чтобы отправить заявку';
const RESIDENCY_LOAD_ERROR = 'Не удалось загрузить адрес. Проверьте соединение и попробуйте снова';
const PICK_ERROR = 'Не удалось выбрать файл. Попробуйте ещё раз';

type FieldKey = 'category' | 'description' | 'address';
type SheetName = 'category' | 'address' | 'attach' | null;

/** Новая заявка жителя: форма, листы выбора, вложения, отправка и выход с черновиком (S1–S12). */
export function NewRequestScreen() {
  const { retry } = useLocalSearchParams<{ retry?: string }>();
  const {
    category,
    description,
    residencyId,
    attachments,
    setCategory,
    setDescription,
    setResidencyId,
  } = useRequestDraft();

  const [showErrors, setShowErrors] = useState(false);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [attachMessages, setAttachMessages] = useState<string[]>([]);
  const [permissionIssue, setPermissionIssue] = useState<'camera' | 'library' | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const fieldY = useRef<Partial<Record<FieldKey, number>>>({});
  const autoRetried = useRef(false);
  const runOnce = useSingleFlight();

  const residencies = useQuery({
    queryKey: ['residencies'],
    queryFn: () => getApi().getResidencies(),
  });
  const confirmed = (residencies.data ?? []).filter((item) => item.status === 'confirmed');
  const residency =
    confirmed.find((item) => item.id === residencyId) ??
    confirmed.find((item) => item.primary) ??
    confirmed[0];

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

  const uploadingCount = attachments.filter((item) => item.status === 'uploading').length;
  const failedCount = attachments.filter((item) => item.status === 'failed').length;
  const filesBlock = uploadingCount > 0 || failedCount > 0;

  // Выход: при несохранённых данных или отправке экран не закрывается сам.
  const dirty = isDraftDirty({ category, description, residencyId, attachments });
  const sending = useRef(false);
  const disablePrevention = usePreventRemove(dirty && !leaving, () => {
    if (sending.current) return;
    setDiscardOpen(true);
  });

  function leaveScreen() {
    setLeaving(true);
    disablePrevention();
  }

  const create = useMutation({
    mutationFn: () => {
      sending.current = true;
      return getApi().createRequest({
        categoryId: category?.id ?? '',
        description: trimmed,
        residencyId: residency?.id ?? '',
        attachmentIds: attachments.flatMap((item) => (item.remoteId ? [item.remoteId] : [])),
      });
    },
    onSuccess: (result) => {
      useCreatedRequest.getState().setSummary({
        id: result.id,
        number: result.number,
        createdAt: result.createdAt,
        categoryName: category?.name ?? '',
        address: residency ? `${residency.address}, кв. ${residency.apartment}` : '',
        answerWithinMin: result.answerWithinMin,
      });
      leaveScreen();
      discardDraft();
      router.replace('/requests/sent');
    },
    onError: (error) => {
      // Черновик остаётся: сохраняем его сразу, не дожидаясь задержки записи.
      void flushDraftWrites().catch(() => undefined);
      leaveScreen();
      router.replace({
        pathname: '/requests/failed',
        params: {
          reason: error instanceof ApiError && error.code === 'validation' ? 'rejected' : 'network',
        },
      });
    },
    onSettled: () => {
      sending.current = false;
    },
  });
  const locked = create.isPending;

  const errors = validateRequest({ categoryId: category?.id ?? null, description });
  const addressError = residencies.isError
    ? RESIDENCY_LOAD_ERROR
    : !residency && !residencies.isPending
      ? NO_RESIDENCY_ERROR
      : undefined;
  const hasErrors = Boolean(errors.category || errors.description || addressError);

  function scrollToFirstError() {
    const first: FieldKey = errors.category
      ? 'category'
      : errors.description
        ? 'description'
        : 'address';
    const y = fieldY.current[first] ?? 0;
    scrollRef.current?.scrollTo({ y: Math.max(y - 8, 0), animated: true });
  }

  function submit() {
    // Пока адрес не загрузился или файлы грузятся, отправлять нечего.
    if (residencies.isPending || filesBlock) return;
    if (hasErrors) {
      setShowErrors(true);
      if (residencies.isError) void residencies.refetch();
      scrollToFirstError();
      return;
    }
    void runOnce(() => create.mutateAsync());
  }

  // Повтор после экрана «Не удалось отправить»: форма открывается и отправляет сама, один раз.
  useEffect(() => {
    if (retry !== '1' || autoRetried.current || residencies.isPending || filesBlock) return;
    autoRetried.current = true;
    submit();
  });

  async function pick(run: () => Promise<PickResult>) {
    setSheet(null);
    setPermissionIssue(null);
    setAttachMessages([]);
    let result: PickResult;
    try {
      result = await run();
    } catch {
      setAttachMessages([PICK_ERROR]);
      return;
    }
    if (result.status === 'denied') {
      setPermissionIssue(result.source);
      return;
    }
    if (result.status !== 'picked') return;
    const plan = planAdd(result.files, useRequestDraft.getState().attachments.length);
    setAttachMessages(plan.messages);
    if (plan.accepted.length > 0) addAndUpload(plan.accepted);
  }

  const pickers = getPickers();
  const free = Math.max(attachmentLimits.maxFiles - attachments.length, 1);

  const empty = isFormEmpty({ categoryId: category?.id ?? null, description });
  const caption =
    failedCount > 0
      ? 'Повторите загрузку или удалите файлы с ошибкой.'
      : uploadingCount > 0
        ? 'Дождитесь окончания загрузки вложений.'
        : attachments.length === 0 && !empty
          ? 'Можно отправить без вложений.'
          : 'Заявку получит диспетчер. Статус придёт в MAX и push.';

  return (
    <Screen
      scrollRef={scrollRef}
      header={<ScreenHeader title="Новая заявка" />}
      footer={
        <>
          <Button
            title="Отправить заявку"
            loadingLabel="Отправляем…"
            onPress={submit}
            disabled={empty || filesBlock}
            loading={create.isPending || (residencies.isPending && !empty)}
            testID="request-submit"
          />
          <Text
            size={12}
            color={colors.textMuted}
            lineHeight={17}
            style={{ textAlign: 'center' }}
            testID="request-caption"
          >
            {caption}
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
          onPress={locked ? undefined : () => setSheet('category')}
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
          editable={!locked}
          maxLength={DESCRIPTION_MAX}
          error={showErrors ? errors.description : undefined}
          testID="request-description"
        />
        {suggested && !locked ? (
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
          onPress={locked ? undefined : () => setSheet('address')}
          testID="request-address"
        />
      </View>

      <AttachmentsBlock
        attachments={attachments}
        locked={locked}
        messages={attachMessages}
        permissionIssue={permissionIssue}
        onOpenSheet={() => setSheet('attach')}
        onRemove={removeAttachment}
        onRetry={retryUpload}
        onRetryAll={retryAllFailed}
      />

      <CategorySheet
        visible={sheet === 'category'}
        selectedId={category?.id}
        onSelect={(item) => {
          setCategory(item);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <AddressSheet
        visible={sheet === 'address'}
        residencies={confirmed}
        selectedId={residency?.id}
        onSelect={(item) => {
          setResidencyId(item.id);
          setSheet(null);
        }}
        onAdd={() => {
          setSheet(null);
          router.push('/choose-home');
        }}
        onClose={() => setSheet(null)}
      />
      <AttachSheet
        visible={sheet === 'attach'}
        onCamera={() => void pick(() => pickers.takeMedia('any'))}
        onGallery={() => void pick(() => pickers.pickFromGallery({ limit: free, mode: 'any' }))}
        onDocument={() => void pick(() => pickers.pickDocument())}
        onClose={() => setSheet(null)}
      />
      <DiscardSheet
        visible={discardOpen}
        onSave={() => {
          void flushDraftWrites().catch(() => undefined);
          setDiscardOpen(false);
          leaveScreen();
          router.back();
        }}
        onDelete={() => {
          setDiscardOpen(false);
          leaveScreen();
          discardDraft();
          router.back();
        }}
        onContinue={() => setDiscardOpen(false)}
      />
    </Screen>
  );
}
