import type { Permission } from '@/api';

export type NavItem = {
  key: string;
  title: string;
  icon:
    | 'requests'
    | 'tasks'
    | 'acts'
    | 'chats'
    | 'contractors'
    | 'staff'
    | 'analytics'
    | 'directories';
  /** Право, без которого пункт скрыт. */
  permission?: Permission;
};

/** Разделы CRM: пока готов только «Сотрудники»; остальные открывают заглушку. */
export const NAV: readonly NavItem[] = [
  { key: 'requests', title: 'Заявки', icon: 'requests' },
  { key: 'tasks', title: 'Задачи', icon: 'tasks' },
  { key: 'acts', title: 'Акты', icon: 'acts', permission: 'acts.use' },
  { key: 'chats', title: 'Чаты', icon: 'chats' },
  { key: 'contractors', title: 'Подрядчики', icon: 'contractors', permission: 'contractors.manage' },
  { key: 'staff', title: 'Сотрудники', icon: 'staff', permission: 'staff.manage' },
  { key: 'analytics', title: 'Аналитика', icon: 'analytics', permission: 'analytics.view' },
  { key: 'directories', title: 'Справочники', icon: 'directories', permission: 'directories.manage' },
];

export const sectionTitle = (key: string | undefined) =>
  NAV.find((item) => item.key === key)?.title ?? 'Раздел';
