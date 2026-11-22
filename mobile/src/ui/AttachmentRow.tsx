import { Image, Pressable, StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';

import { Icon, type IconName } from './Icon';
import { ProgressBar } from './ProgressBar';
import { Text } from './Text';

export type AttachmentRowState =
  | { status: 'uploaded'; sizeLabel: string }
  | { status: 'uploading'; progress: number }
  | { status: 'failed'; message: string };

type AttachmentRowProps = {
  name: string;
  kind: 'image' | 'video' | 'document';
  /** Адрес картинки для миниатюры (только для фото). */
  thumbnailUri?: string;
  state: AttachmentRowState;
  onRemove: () => void;
  onCancel: () => void;
  onRetry: () => void;
  /** Блокировка во время отправки заявки. */
  disabled?: boolean;
  testID: string;
};

const icons: Record<AttachmentRowProps['kind'], IconName> = {
  image: 'photo',
  video: 'video',
  document: 'file',
};

/**
 * Строка файла в списке вложений (по правилам заказчика — список, не сетка):
 * миниатюра 48, имя, статус, крестик с зоной нажатия 44; «Повторить» на самой строке.
 */
export function AttachmentRow({
  name,
  kind,
  thumbnailUri,
  state,
  onRemove,
  onCancel,
  onRetry,
  disabled = false,
  testID,
}: AttachmentRowProps) {
  const failed = state.status === 'failed';
  return (
    <View style={[styles.row, failed ? styles.rowFailed : null]} testID={testID}>
      <View style={[styles.thumb, failed ? styles.thumbFailed : null]}>
        {kind === 'image' && thumbnailUri && !failed ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={styles.image}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Icon name={icons[kind]} size={22} color={failed ? colors.error : colors.textMuted} />
        )}
      </View>

      <View style={styles.texts}>
        <Text weight={700} size={14} numberOfLines={1} ellipsizeMode="tail">
          {name}
        </Text>
        {state.status === 'uploaded' ? (
          <View style={styles.statusRow}>
            <Icon name="check" size={14} color={colors.success} />
            <Text weight={600} size={12} color={colors.success}>
              {`${state.sizeLabel} · загружено`}
            </Text>
          </View>
        ) : state.status === 'uploading' ? (
          <View
            accessible
            accessibilityLabel={`${name}: загружается, ${Math.round(state.progress * 100)}%`}
            style={styles.statusRow}
          >
            <ProgressBar value={state.progress} testID={`${testID}-progress`} />
            <Text weight={700} size={12} color={colors.textMuted} testID={`${testID}-percent`}>
              {`${Math.round(state.progress * 100)}%`}
            </Text>
          </View>
        ) : (
          <Text weight={600} size={12} color={colors.error}>
            {state.message}
          </Text>
        )}
      </View>

      {failed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Повторить загрузку: ${name}`}
          disabled={disabled}
          onPress={onRetry}
          hitSlop={{ top: 5, bottom: 5 }}
          style={styles.retry}
          testID={`${testID}-retry`}
        >
          <Text weight={800} size={12} color={colors.onAccent}>
            Повторить
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={state.status === 'uploading' ? 'Отменить загрузку' : 'Удалить вложение'}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={state.status === 'uploading' ? onCancel : onRemove}
        style={styles.remove}
        testID={`${testID}-remove`}
      >
        <Icon name="close" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowFailed: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1.5,
    borderColor: colors.error,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbFailed: { backgroundColor: colors.surface },
  image: { width: 48, height: 48 },
  texts: { flex: 1, gap: 5 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  retry: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: {
    width: 44,
    height: 44,
    marginRight: -6,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
