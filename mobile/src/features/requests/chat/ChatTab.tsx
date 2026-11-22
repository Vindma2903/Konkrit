import { ChatPanel } from './ChatPanel';
import { requestChannel } from './outbox';

type ChatTabProps = {
  requestId: string;
  /** Вкладка «Чат» открыта и виден экран: только тогда идёт опрос. */
  active: boolean;
};

/** Вкладка «Чат» карточки заявки: переписка с исполнителем и куратором (макет «Карточка заявки»). */
export function ChatTab({ requestId, active }: ChatTabProps) {
  return (
    <ChatPanel
      channel={requestChannel(requestId)}
      active={active}
      emptyText="Сообщений пока нет. Напишите исполнителю или куратору"
    />
  );
}
