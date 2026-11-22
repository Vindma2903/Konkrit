import { beforeEach, describe, expect, it } from 'vitest';
import { createMockStaff } from './mockAuthApi';
import { setTokenProvider } from './token';
import { ApiError, type StaffSession } from './types';

const PASSWORD = 'Password1';

function setup() {
  const mock = createMockStaff({ latencyMs: 0 });
  async function loginAs(email: string): Promise<StaffSession> {
    const session = await mock.auth.login({ email, password: PASSWORD, remember: true });
    setTokenProvider(() => session.accessToken);
    return session;
  }
  return { ...mock, loginAs, mock };
}

const register = (auth: ReturnType<typeof setup>['auth'], email: string) =>
  auth.register({
    name: 'Нина Орлова',
    company: 'УК «Тест-Сервис»',
    email,
    phone: '+79001234567',
    password: PASSWORD,
    consent: true,
  });

beforeEach(() => setTokenProvider(() => null));

describe('мок: заявка на доступ от регистрации до входа', () => {
  it('заявка из регистрации видна руководителю; после подтверждения сотрудник входит с ролью и правами', async () => {
    const { auth, admin, loginAs } = setup();
    await register(auth, 'nina@uk.ru');
    await expect(auth.login({ email: 'nina@uk.ru', password: PASSWORD, remember: false })).rejects.toMatchObject({
      code: 'pending_approval',
    });

    await loginAs('manager@uk.ru');
    const before = await admin.listAccessRequests('pending');
    const created = before.items.find((item) => item.email === 'nina@uk.ru');
    expect(created).toMatchObject({ name: 'Нина Орлова', status: 'pending' });
    expect(before.pendingCount).toBe(3);

    await admin.approveAccessRequest(created!.id, {
      role: 'dispatcher',
      scope: { all: true, houseIds: [] },
      notify: true,
    });
    expect((await admin.listAccessRequests('pending')).pendingCount).toBe(2);
    const members = await admin.listMembers({ query: 'нина орлова' });
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ role: 'dispatcher', status: 'active' });

    const session = await auth.login({ email: 'nina@uk.ru', password: PASSWORD, remember: false });
    expect(session.user.role).toBe('dispatcher');
    expect(session.user.permissions).toContain('requests.assign');
    expect(session.user.permissions).not.toContain('staff.manage');
  });

  it('письмо «доступ открыт» уходит, только если флажок включён', async () => {
    const { auth, admin, loginAs, mails } = setup();
    await register(auth, 'a@uk.ru');
    await register(auth, 'b@uk.ru');
    await loginAs('manager@uk.ru');
    const { items } = await admin.listAccessRequests('pending');
    const scope = { all: true, houseIds: [] };
    await admin.approveAccessRequest(items.find((i) => i.email === 'a@uk.ru')!.id, { role: 'executor', scope, notify: true });
    await admin.approveAccessRequest(items.find((i) => i.email === 'b@uk.ru')!.id, { role: 'executor', scope, notify: false });
    expect(mails()).toEqual(['a@uk.ru']);
  });

  it('вторая обработка той же заявки — already_processed', async () => {
    const { admin, loginAs } = setup();
    await loginAs('manager@uk.ru');
    const input = { role: 'engineer' as const, scope: { all: true, houseIds: [] }, notify: false };
    await admin.approveAccessRequest('request-1', input);
    await expect(admin.approveAccessRequest('request-1', input)).rejects.toMatchObject({ code: 'already_processed' });
    await expect(admin.rejectAccessRequest('request-1')).rejects.toMatchObject({ code: 'already_processed' });
  });

  it('отклонение: вход говорит «отклонено», в списке «Отклонённые», позже можно подтвердить', async () => {
    const { auth, admin, loginAs } = setup();
    await register(auth, 'late@uk.ru');
    await loginAs('manager@uk.ru');
    const id = (await admin.listAccessRequests('pending')).items.find((i) => i.email === 'late@uk.ru')!.id;
    await admin.rejectAccessRequest(id);
    await expect(auth.login({ email: 'late@uk.ru', password: PASSWORD, remember: false })).rejects.toMatchObject({
      code: 'rejected',
    });
    expect((await admin.listAccessRequests('rejected')).items.map((i) => i.id)).toContain(id);
    await expect(admin.rejectAccessRequest(id)).rejects.toMatchObject({ code: 'already_processed' });

    await admin.approveAccessRequest(id, { role: 'executor', scope: { all: false, houseIds: ['area-1'] }, notify: false });
    expect((await auth.login({ email: 'late@uk.ru', password: PASSWORD, remember: false })).user.role).toBe('executor');
  });

  it('без домов подтвердить нельзя', async () => {
    const { admin, loginAs } = setup();
    await loginAs('manager@uk.ru');
    await expect(
      admin.approveAccessRequest('request-1', { role: 'executor', scope: { all: false, houseIds: [] }, notify: false }),
    ).rejects.toMatchObject({ code: 'validation', fields: { scope: 'Выберите хотя бы один дом или участок' } });
  });

  it('занятая почта: и у сотрудника, и у ожидающей заявки', async () => {
    const { auth } = setup();
    await expect(register(auth, 'manager@uk.ru')).rejects.toMatchObject({ code: 'email_taken' });
    await expect(register(auth, 'pending@uk.ru')).rejects.toMatchObject({ code: 'email_taken' });
  });
});

describe('мок: доступ по правам', () => {
  it('без токена — unauthorized, без права staff.manage — forbidden', async () => {
    const { admin, loginAs } = setup();
    await expect(admin.listMembers()).rejects.toMatchObject({ code: 'unauthorized' });
    await loginAs('dispatcher@uk.ru');
    await expect(admin.listMembers()).rejects.toMatchObject({ code: 'forbidden' });
    await expect(admin.listAccessRequests('pending')).rejects.toBeInstanceOf(ApiError);
  });

  it('право, выданное роли, действует сразу; снятое — тоже при следующем запросе', async () => {
    const { admin, loginAs } = setup();
    await loginAs('manager@uk.ru');
    const matrix = await admin.getRoles();
    matrix.dispatcher = [...matrix.dispatcher, 'staff.manage'];
    await admin.saveRoles(matrix);

    await loginAs('dispatcher@uk.ru');
    await expect(admin.listMembers()).resolves.toBeInstanceOf(Array);

    await loginAs('manager@uk.ru');
    matrix.dispatcher = matrix.dispatcher.filter((p) => p !== 'staff.manage');
    await admin.saveRoles(matrix);
    await loginAs('dispatcher@uk.ru');
    await expect(admin.listMembers()).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('у руководителя нельзя снять «Управлять сотрудниками»', async () => {
    const { admin, loginAs } = setup();
    await loginAs('manager@uk.ru');
    const matrix = await admin.getRoles();
    matrix.manager = matrix.manager.filter((p) => p !== 'staff.manage');
    await expect(admin.saveRoles(matrix)).rejects.toMatchObject({ code: 'validation' });
  });
});

describe('мок: сотрудники', () => {
  it('поиск и фильтры вместе', async () => {
    const { admin, loginAs } = setup();
    await loginAs('manager@uk.ru');
    expect((await admin.listMembers({ query: '7 900 333' })).map((m) => m.email)).toEqual(['engineer@uk.ru']);
    expect((await admin.listMembers({ role: 'executor' })).map((m) => m.email).sort()).toEqual([
      'executor2@uk.ru',
      'executor@uk.ru',
    ]);
    expect((await admin.listMembers({ role: 'executor', status: 'vacation' })).map((m) => m.email)).toEqual([
      'executor2@uk.ru',
    ]);
    // сотрудник со всеми домами попадает в фильтр по любому дому
    const house1 = (await admin.listMembers({ houseId: 'house-1' })).map((m) => m.email);
    expect(house1).toContain('manager@uk.ru');
    expect(house1).toContain('engineer@uk.ru');
    expect(house1).not.toContain('executor@uk.ru');
  });

  it('отключённый не входит, его сессия перестаёт работать', async () => {
    const { auth, admin, loginAs } = setup();
    await loginAs('manager@uk.ru');
    const target = (await admin.listMembers({ query: 'engineer@' }))[0]!;
    const engineer = await auth.login({ email: 'engineer@uk.ru', password: PASSWORD, remember: true });
    await admin.updateMember(target.id, { status: 'disabled' });
    await expect(auth.login({ email: 'engineer@uk.ru', password: PASSWORD, remember: true })).rejects.toMatchObject({
      code: 'blocked',
    });
    await expect(auth.refresh()).rejects.toMatchObject({ code: 'unauthorized' });
    setTokenProvider(() => engineer.accessToken);
    await expect(admin.listMembers()).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('нельзя отключить себя и понизить последнего руководителя', async () => {
    const { admin, loginAs } = setup();
    const me = await loginAs('manager@uk.ru');
    await expect(admin.updateMember(me.user.id, { status: 'disabled' })).rejects.toMatchObject({ code: 'validation' });
    await expect(admin.updateMember(me.user.id, { role: 'dispatcher' })).rejects.toMatchObject({ code: 'last_manager' });
    // со вторым руководителем понижать можно
    const other = (await admin.listMembers({ query: 'dispatcher@' }))[0]!;
    await admin.updateMember(other.id, { role: 'manager' });
    await expect(admin.updateMember(me.user.id, { role: 'dispatcher' })).resolves.toBeUndefined();
  });

  it('изменение роли и домов применяется сразу', async () => {
    const { admin, loginAs } = setup();
    await loginAs('manager@uk.ru');
    const target = (await admin.listMembers({ query: 'executor@' }))[0]!;
    await admin.updateMember(target.id, { role: 'engineer', scope: { all: false, houseIds: ['house-3'] } });
    const updated = (await admin.listMembers({ query: 'executor@' }))[0]!;
    expect(updated).toMatchObject({ role: 'engineer', scope: { all: false, houseIds: ['house-3'] } });
    await expect(admin.updateMember('missing', { status: 'vacation' })).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('мок: сессия прежнего формата', () => {
  it('запись с неизвестным идентификатором отбрасывается — вход заново', async () => {
    const { auth } = setup();
    localStorage.setItem('mock-staff-session', JSON.stringify({ id: 'staff-old', name: 'Старый', role: 'employee' }));
    await expect(auth.refresh()).rejects.toMatchObject({ code: 'unauthorized' });
  });
});
