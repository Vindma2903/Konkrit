/**
 * Адреса юридических документов. Пока это адреса-заменители:
 * настоящие появятся вместе с публикацией документов.
 */
export const legalLinks = {
  terms: 'https://example.com/terms',
  privacy: 'https://example.com/privacy',
} as const;

/** Ограничения вложений заявки. В макетах стояли заглушки «[N] МБ»: значения приняты по спеке. */
export const attachmentLimits = {
  maxFiles: 10,
  /** Фото и документы, МБ. */
  fileMb: 20,
  videoMb: 100,
  /** Одновременных загрузок. */
  parallelUploads: 3,
  documentMimeTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
} as const;
