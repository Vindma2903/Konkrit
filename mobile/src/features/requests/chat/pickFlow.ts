import { Platform } from 'react-native';

import { planAdd } from '../attachmentRules';
import type { PickedFile, PickResult } from '../pickers';

const IOS_SHEET_CLOSE_MS = 400;
const PICK_ERROR = 'Не удалось выбрать файл. Попробуйте ещё раз';

export type PickOutcome = {
  /** Файлы, прошедшие проверку по размеру и типу. */
  accepted: PickedFile[];
  /** Сообщения для жителя: отклонённые файлы и ошибки выбора. */
  messages: string[];
  /** Отказ в доступе к камере или фото. */
  denied: 'camera' | 'library' | null;
};

/**
 * Запускает системный выбор файла и проверяет результат теми же правилами, что и форма заявки.
 * На iOS даёт листу закрыться, иначе системное окно не откроется.
 */
export async function runPick(
  run: () => Promise<PickResult>,
  currentCount = 0,
): Promise<PickOutcome> {
  try {
    if (Platform.OS === 'ios') {
      await new Promise((resolve) => setTimeout(resolve, IOS_SHEET_CLOSE_MS));
    }
    const result = await run();
    if (result.status === 'denied') return { accepted: [], messages: [], denied: result.source };
    if (result.status !== 'picked') return { accepted: [], messages: [], denied: null };
    const plan = planAdd(result.files, currentCount);
    return { accepted: plan.accepted, messages: plan.messages, denied: null };
  } catch {
    return { accepted: [], messages: [PICK_ERROR], denied: null };
  }
}
