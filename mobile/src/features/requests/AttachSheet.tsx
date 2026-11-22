import { attachmentLimits } from '@/config';
import { ActionRow, BottomSheet } from '@/ui';

type AttachSheetProps = {
  visible: boolean;
  onCamera: () => void;
  onGallery: () => void;
  onDocument: () => void;
  onClose: () => void;
};

/** Лист «Добавить вложение» (макет S6): камера, галерея, документ. */
export function AttachSheet({
  visible,
  onCamera,
  onGallery,
  onDocument,
  onClose,
}: AttachSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      title="Добавить вложение"
      onClose={onClose}
      testID="attach-sheet"
    >
      <ActionRow
        icon="camera"
        title="Снять фото или видео"
        onPress={onCamera}
        testID="attach-camera"
      />
      <ActionRow
        icon="photo"
        title="Выбрать из галереи"
        subtitle={`До ${attachmentLimits.maxFiles} файлов, видео до ${attachmentLimits.videoMb} МБ`}
        onPress={onGallery}
        testID="attach-gallery"
      />
      <ActionRow
        icon="file"
        title="Файл"
        subtitle={`PDF, DOC, до ${attachmentLimits.fileMb} МБ`}
        onPress={onDocument}
        testID="attach-document"
      />
    </BottomSheet>
  );
}
