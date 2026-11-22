import { attachmentLimits } from '@/config';

import type { PickedFile } from './pickers';

const MB = 1024 * 1024;

function hasAllowedDocumentType(file: PickedFile): boolean {
  if (file.mimeType) {
    return (attachmentLimits.documentMimeTypes as readonly string[]).includes(file.mimeType);
  }
  // Система не всегда сообщает тип: тогда смотрим на расширение.
  return /\.(pdf|doc|docx)$/i.test(file.name);
}

/** Сообщение, почему файл нельзя добавить; null — файл подходит. */
export function validateFile(file: PickedFile): string | null {
  if (file.kind === 'document' && !hasAllowedDocumentType(file)) {
    return `${file.name}: такой тип файла не поддерживается`;
  }
  const limitMb = file.kind === 'video' ? attachmentLimits.videoMb : attachmentLimits.fileMb;
  if (file.size !== undefined && file.size > limitMb * MB) {
    return `${file.name}: файл больше ${limitMb} МБ`;
  }
  return null;
}

export type AddPlan = {
  accepted: PickedFile[];
  /** Сообщения для жителя: отклонённые файлы и обрезка по лимиту. */
  messages: string[];
};

/** Что из выбранного можно добавить при текущем числе вложений. */
export function planAdd(files: PickedFile[], currentCount: number): AddPlan {
  const messages: string[] = [];
  const valid: PickedFile[] = [];
  for (const file of files) {
    const problem = validateFile(file);
    if (problem) messages.push(problem);
    else valid.push(file);
  }
  const free = Math.max(attachmentLimits.maxFiles - currentCount, 0);
  const accepted = valid.slice(0, free);
  if (valid.length > free) {
    messages.push(
      `Добавлено ${accepted.length} из ${valid.length}: максимум ${attachmentLimits.maxFiles} вложений`,
    );
  }
  return { accepted, messages };
}

/** Размер для строки файла: «1,2 МБ». Неизвестный размер — «— МБ». */
export function formatMb(bytes?: number): string {
  if (bytes === undefined) return '— МБ';
  const value = bytes / MB;
  const rounded = value < 0.1 ? 0.1 : Math.round(value * 10) / 10;
  return `${String(rounded).replace('.', ',')} МБ`;
}
