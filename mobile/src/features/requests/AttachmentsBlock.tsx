import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { attachmentLimits } from '@/config';
import { plural } from '@/lib/plural';
import { colors, radius } from '@/theme';
import {
  AttachmentRow,
  FieldError,
  Icon,
  LinkText,
  Notice,
  Text,
  type AttachmentRowState,
  type IconName,
} from '@/ui';

import { formatMb } from './attachmentRules';
import type { Attachment } from './draftStore';

type AttachmentsBlockProps = {
  attachments: Attachment[];
  /** Идёт отправка заявки: добавлять и удалять файлы нельзя. */
  locked: boolean;
  /** Сообщения об отклонённых файлах и обрезке по лимиту. */
  messages: string[];
  /** Отказ в доступе к камере или галерее. */
  permissionIssue: 'camera' | 'library' | null;
  onOpenSheet: () => void;
  onRemove: (localId: string) => void;
  onRetry: (localId: string) => void;
  onRetryAll: () => void;
};

const tiles: { icon: IconName; label: string }[] = [
  { icon: 'photo', label: 'Фото' },
  { icon: 'video', label: 'Видео' },
  { icon: 'file', label: 'Файл' },
];

const failureText: Record<NonNullable<Attachment['error']>, string> = {
  network: 'Не загрузилось · нет связи',
  missing: 'Файл больше недоступен',
  rejected: 'Не загрузилось · файл не принят',
};

function rowState(item: Attachment): AttachmentRowState {
  if (item.status === 'uploaded') return { status: 'uploaded', sizeLabel: formatMb(item.size) };
  if (item.status === 'uploading') return { status: 'uploading', progress: item.progress };
  return { status: 'failed', message: failureText[item.error ?? 'network'] };
}

/** Блок «Вложения»: кнопки, подсказки, плашка ошибок и список файлов друг под другом (макеты S7a–S7f). */
export function AttachmentsBlock({
  attachments,
  locked,
  messages,
  permissionIssue,
  onOpenSheet,
  onRemove,
  onRetry,
  onRetryAll,
}: AttachmentsBlockProps) {
  const count = attachments.length;
  const max = attachmentLimits.maxFiles;
  const atLimit = count >= max;
  const failed = attachments.filter((item) => item.status === 'failed');
  const anyNetwork = failed.some((item) => item.error === 'network' || item.error === undefined);
  const tilesDisabled = atLimit || locked;

  const counter = atLimit
    ? `Максимум ${max}`
    : count === 0
      ? `До ${max} файлов`
      : `${count} из ${max}`;

  return (
    <View style={styles.wrap}>
      <View style={styles.title}>
        <Text weight={700} size={13} color={colors.textMuted}>
          Вложения
        </Text>
        <Text
          weight={700}
          size={12}
          color={atLimit ? colors.error : colors.textMuted}
          testID="attachments-counter"
        >
          {counter}
        </Text>
      </View>

      <View style={[styles.tiles, tilesDisabled ? styles.tilesDisabled : null]}>
        {tiles.map((tile) => (
          <Pressable
            key={tile.label}
            accessibilityRole="button"
            accessibilityLabel={tile.label}
            accessibilityState={{ disabled: tilesDisabled }}
            disabled={tilesDisabled}
            onPress={onOpenSheet}
            style={styles.tile}
            testID={`attach-${tile.icon}`}
          >
            <Icon name={tile.icon} color={colors.accentText} />
            <Text weight={700} size={12}>
              {tile.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {atLimit ? (
        <Text size={12} color={colors.textMuted} lineHeight={17} testID="attachments-limit-hint">
          Чтобы добавить новое, удалите одно из вложений.
        </Text>
      ) : count === 0 ? (
        <Text size={12} color={colors.textMuted} lineHeight={17} testID="attachments-empty-hint">
          {`Фото и видео до ${attachmentLimits.videoMb} МБ, документы PDF и DOC до ${attachmentLimits.fileMb} МБ. Вложения необязательны.`}
        </Text>
      ) : null}

      {messages.map((message, index) => (
        <FieldError key={`${index}-${message}`} message={message} testID="attachments-message" />
      ))}

      {permissionIssue ? (
        <View style={styles.permission} testID="attachments-permission">
          <FieldError
            message={
              permissionIssue === 'camera'
                ? 'Нет доступа к камере. Разрешите его в настройках телефона'
                : 'Нет доступа к фото. Разрешите его в настройках телефона'
            }
          />
          <LinkText size={13} onPress={() => void Linking.openSettings()}>
            Открыть настройки
          </LinkText>
        </View>
      ) : null}

      {failed.length > 0 ? (
        <Notice
          message={`Не загрузилось: ${failed.length} ${plural(failed.length, ['файл', 'файла', 'файлов'])}.${anyNetwork ? ' Нет связи.' : ''}`}
          actionLabel="Повторить все"
          onAction={onRetryAll}
          testID="attachments-notice"
        />
      ) : null}

      {count > 0 ? (
        <View style={styles.list}>
          {attachments.map((item) => (
            <AttachmentRow
              key={item.localId}
              name={item.name}
              kind={item.kind}
              thumbnailUri={item.kind === 'image' ? item.uri : undefined}
              state={rowState(item)}
              disabled={locked}
              onRemove={() => onRemove(item.localId)}
              onCancel={() => onRemove(item.localId)}
              onRetry={() => onRetry(item.localId)}
              testID={`attachment-${item.localId}`}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  title: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  tiles: { flexDirection: 'row', gap: 10 },
  tilesDisabled: { opacity: 0.45 },
  tile: {
    width: 96,
    height: 88,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  permission: { gap: 4 },
  list: { gap: 8, paddingTop: 4 },
});
