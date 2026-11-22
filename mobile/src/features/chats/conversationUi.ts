import type { ConversationKind } from '@/api';
import type { IconName } from '@/ui';

/** Идентификатор чата с УК: сервер всегда отдаёт его как псевдоним, даже если список не загрузился. */
export const MANAGEMENT_CHAT_ID = 'management';

export const conversationIcons: Record<ConversationKind, IconName> = {
  management: 'chat',
  house: 'building',
  entrance: 'door',
  council: 'people',
  neighbors: 'home',
};

/** В групповых чатах над чужим сообщением показывается имя автора. */
export const isGroupChat = (kind: ConversationKind) => kind !== 'management';
