import type { IconName } from '@/ui';

export type ProfileSection = { key: string; title: string; icon: IconName };

/** Пункты меню профиля; разделы пока без содержимого (экран-заглушка). */
export const profileSections: readonly ProfileSection[] = [
  { key: 'addresses', title: 'Мои адреса', icon: 'pin' },
  { key: 'notifications', title: 'Уведомления', icon: 'bell' },
  { key: 'documents', title: 'Документы и акты', icon: 'file' },
  { key: 'payment', title: 'Оплата', icon: 'wallet' },
  { key: 'help', title: 'Помощь', icon: 'help' },
];

export const sectionTitle = (key: string | undefined) =>
  profileSections.find((section) => section.key === key)?.title ?? 'Раздел';
