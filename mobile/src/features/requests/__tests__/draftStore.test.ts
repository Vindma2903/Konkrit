import AsyncStorage from '@react-native-async-storage/async-storage';

import { flushDraftWrites, isDraftDirty, useRequestDraft, type Attachment } from '../draftStore';

const attachment = (patch: Partial<Attachment>): Attachment => ({
  localId: 'att-1',
  uri: 'file:///a.jpg',
  name: 'a.jpg',
  kind: 'image',
  status: 'uploaded',
  progress: 1,
  ...patch,
});

const empty = { category: null, description: '', residencyId: null, attachments: [] };

async function stored() {
  const raw = await AsyncStorage.getItem('konkrit.requestDraft');
  return raw ? (JSON.parse(raw) as { state: typeof empty }).state : null;
}

describe('черновик заявки', () => {
  beforeEach(async () => {
    useRequestDraft.setState(empty);
    await flushDraftWrites();
    await AsyncStorage.clear();
  });

  it('пишет в хранилище с задержкой, а при уходе в фон — сразу', async () => {
    useRequestDraft.getState().setDescription('Нет отопления');
    expect(await stored()).toBeNull();

    await flushDraftWrites();

    expect((await stored())?.description).toBe('Нет отопления');
  });

  it('несколько быстрых правок дают одну запись с последним значением', async () => {
    const setItem = jest.spyOn(AsyncStorage, 'setItem');
    setItem.mockClear();
    useRequestDraft.getState().setDescription('Н');
    useRequestDraft.getState().setDescription('Нет');
    useRequestDraft.getState().setDescription('Нет отопления');
    await flushDraftWrites();

    expect(setItem).toHaveBeenCalledTimes(1);
    expect((await stored())?.description).toBe('Нет отопления');
  });

  it('восстанавливает поля и вложения из хранилища', async () => {
    useRequestDraft.setState({
      category: { id: 'heating', name: 'Отопление' },
      description: 'Нет отопления',
      residencyId: 'residency-2',
      attachments: [attachment({ remoteId: 'remote-1' })],
    });
    await flushDraftWrites();
    useRequestDraft.setState(empty);

    await useRequestDraft.persist.rehydrate();

    expect(useRequestDraft.getState()).toMatchObject({
      category: { id: 'heating', name: 'Отопление' },
      description: 'Нет отопления',
      residencyId: 'residency-2',
      attachments: [{ status: 'uploaded', remoteId: 'remote-1' }],
    });
  });

  it('загрузка, которая шла при закрытии, после запуска «не загрузилось»', async () => {
    useRequestDraft.setState({
      ...empty,
      attachments: [attachment({ status: 'uploading', progress: 0.6 })],
    });
    await flushDraftWrites();
    useRequestDraft.setState(empty);

    await useRequestDraft.persist.rehydrate();

    expect(useRequestDraft.getState().attachments[0]).toMatchObject({
      status: 'failed',
      progress: 0,
      error: 'network',
    });
  });

  it('повреждённая запись даёт пустую форму', async () => {
    await AsyncStorage.setItem('konkrit.requestDraft', '{не json');
    useRequestDraft.setState({ ...empty, description: 'старое' });

    await useRequestDraft.persist.rehydrate();

    expect(useRequestDraft.getState()).toMatchObject(empty);
    expect(await AsyncStorage.getItem('konkrit.requestDraft')).toBeNull();
  });

  it('запись неожиданной формы не ломает форму', async () => {
    await AsyncStorage.setItem(
      'konkrit.requestDraft',
      JSON.stringify({ state: { description: 42, attachments: 'нет' }, version: 1 }),
    );

    await useRequestDraft.persist.rehydrate();

    expect(useRequestDraft.getState()).toMatchObject(empty);
  });

  it('очистка хранилища убирает сохранённую копию', async () => {
    useRequestDraft.getState().setDescription('Нет отопления');
    await flushDraftWrites();
    expect(await stored()).not.toBeNull();

    useRequestDraft.persist.clearStorage();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(await stored()).toBeNull();
  });

  it('форма «грязная» при категории, тексте или вложении, но не при пробелах', () => {
    expect(isDraftDirty(empty)).toBe(false);
    expect(isDraftDirty({ ...empty, description: '   ' })).toBe(false);
    expect(isDraftDirty({ ...empty, description: 'а' })).toBe(true);
    expect(isDraftDirty({ ...empty, category: { id: 'x', name: 'Х' } })).toBe(true);
    expect(isDraftDirty({ ...empty, attachments: [attachment({})] })).toBe(true);
  });
});
