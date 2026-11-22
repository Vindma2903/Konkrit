import { useMutation } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getApi } from '@/api';
import { useSessionStore } from '@/features/auth/sessionStore';
import { colors, radius } from '@/theme';
import {
  Button,
  Chip,
  FieldError,
  Icon,
  RadioRow,
  Screen,
  ScreenHeader,
  Text,
  TextField,
} from '@/ui';

import { useOnboardingStore } from './onboardingStore';

const SUBMIT_ERROR = 'Не удалось отправить данные. Проверьте соединение и попробуйте снова';
const ACCOUNT_ERROR = 'Введите номер лицевого счёта';

const onlyDigits = (text: string) => text.replace(/\D/g, '');

/** Онбординг: привязка квартиры. */
export function ApartmentScreen() {
  const { house, apartment, account, role, verification, setField } = useOnboardingStore();
  const markResidency = useSessionStore((state) => state.markResidency);
  const [accountTouched, setAccountTouched] = useState(false);
  const inFlight = useRef(false);

  const submit = useMutation({
    mutationFn: () =>
      getApi().submitResidency({
        houseId: house?.id ?? '',
        apartment,
        account: verification === 'receipt' ? account : undefined,
        role,
        verification,
      }),
    onSuccess: async () => {
      await markResidency();
      router.replace('/residency-sent');
    },
  });

  // Без выбранного дома привязывать нечего: возвращаемся к выбору.
  if (!house) return <Redirect href="/choose-home" />;

  const accountRequired = verification === 'receipt';
  const accountMissing = accountRequired && account.length === 0;
  const valid = apartment.length > 0 && !accountMissing;

  function send() {
    if (!valid || inFlight.current) return;
    inFlight.current = true;
    submit.mutate(undefined, { onSettled: () => (inFlight.current = false) });
  }

  return (
    <Screen
      header={<ScreenHeader title="Привязка квартиры" />}
      contentGap={16}
      footer={
        <>
          <Button
            title="Отправить на подтверждение"
            onPress={send}
            disabled={!valid}
            loading={submit.isPending}
            testID="apartment-submit"
          />
          <FieldError
            message={submit.isError ? SUBMIT_ERROR : undefined}
            testID="apartment-error"
          />
          <Text size={12} color={colors.textMuted} lineHeight={17} style={styles.center}>
            УК проверит данные и подтвердит привязку. Статус придёт в MAX и push.
          </Text>
        </>
      }
    >
      <View style={styles.house} testID="apartment-house">
        <Icon name="home" color={colors.accentText} />
        <View style={styles.houseTexts}>
          <Text weight={700} size={14}>
            {house.address}
          </Text>
          <Text weight={600} size={12} color={colors.textMuted}>
            {`УК ${house.company}`}
          </Text>
        </View>
      </View>

      <TextField
        label="Квартира"
        placeholder="№"
        value={apartment}
        onChangeText={(text) => setField('apartment', onlyDigits(text))}
        keyboardType="number-pad"
        maxLength={5}
        testID="apartment-number"
      />

      <TextField
        label={accountRequired ? 'Лицевой счёт' : 'Лицевой счёт (необязательно)'}
        placeholder="Номер счёта"
        value={account}
        onChangeText={(text) => setField('account', onlyDigits(text))}
        onBlur={() => setAccountTouched(true)}
        keyboardType="number-pad"
        maxLength={20}
        error={accountMissing && accountTouched ? ACCOUNT_ERROR : undefined}
        testID="apartment-account"
      />

      <View style={styles.group}>
        <Text weight={700} size={13} color={colors.textMuted}>
          Ваша роль
        </Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          <Chip
            label="Собственник"
            selected={role === 'owner'}
            onPress={() => setField('role', 'owner')}
            testID="role-owner"
          />
          <Chip
            label="Жилец"
            selected={role === 'tenant'}
            onPress={() => setField('role', 'tenant')}
            testID="role-tenant"
          />
        </View>
      </View>

      <View style={styles.group} accessibilityRole="radiogroup">
        <Text weight={700} size={13} color={colors.textMuted}>
          Способ подтверждения
        </Text>
        <RadioRow
          label="По коду из квитанции"
          selected={verification === 'receipt'}
          onPress={() => setField('verification', 'receipt')}
          testID="verification-receipt"
        />
        <RadioRow
          label="По документу"
          selected={verification === 'document'}
          onPress={() => setField('verification', 'document')}
          testID="verification-document"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  house: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  houseTexts: { flex: 1, gap: 2 },
  group: { gap: 8 },
  chips: { flexDirection: 'row', gap: 8 },
  center: { textAlign: 'center' },
});
