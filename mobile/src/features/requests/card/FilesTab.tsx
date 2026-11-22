import { useQuery } from '@tanstack/react-query';
import { Image, ScrollView, StyleSheet, View } from 'react-native';

import { getApi, type RequestFile } from '@/api';
import { colors } from '@/theme';
import { Button, Icon, Text, type IconName } from '@/ui';

import { formatMb } from '../attachmentRules';

const icons: Record<RequestFile['kind'], IconName> = {
  image: 'photo',
  video: 'video',
  document: 'file',
};

function FileRow({ file }: { file: RequestFile }) {
  return (
    <View style={styles.row} testID={`file-${file.id}`}>
      <View style={styles.thumb}>
        {/* Иконка лежит под картинкой: видна, пока фото не загрузилось или не открылось. */}
        <Icon name={icons[file.kind]} size={22} color={colors.textMuted} />
        {file.kind === 'image' ? (
          <Image source={{ uri: file.url }} style={styles.image} accessibilityIgnoresInvertColors />
        ) : null}
      </View>
      <View style={styles.texts}>
        <Text weight={700} size={14} numberOfLines={1}>
          {file.name}
        </Text>
        <Text weight={500} size={12} color={colors.textMuted}>
          {formatMb(file.size)}
        </Text>
      </View>
    </View>
  );
}

/** Вкладка «Файлы»: вложения заявки и файлы переписки списком друг под другом. */
export function FilesTab({ requestId }: { requestId: string }) {
  const files = useQuery({
    queryKey: ['request', requestId, 'files'],
    queryFn: () => getApi().listFiles(requestId),
  });

  if (files.isError) {
    return (
      <View style={styles.state}>
        <Text weight={600} size={14} color={colors.error}>
          Не удалось загрузить файлы
        </Text>
        <Button title="Повторить" onPress={() => void files.refetch()} testID="files-retry" />
      </View>
    );
  }
  if (files.isPending) {
    return (
      <Text weight={600} size={14} color={colors.textMuted}>
        Загружаем файлы…
      </Text>
    );
  }
  if (files.data.length === 0) {
    return (
      <Text size={14} color={colors.textMuted}>
        Файлов пока нет
      </Text>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.list} testID="files-list">
      {files.data.map((file) => (
        <FileRow key={file.id} file={file} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  state: { gap: 12 },
  list: { gap: 8, paddingBottom: 16 },
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
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { ...StyleSheet.absoluteFill },
  texts: { flex: 1, gap: 4 },
});
