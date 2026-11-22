import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { getApi, type Channel } from '@/api';
import { legalLinks } from '@/config';
import { formatPhone, toE164 } from '@/lib/phone';
import { useSingleFlight } from '@/lib/useSingleFlight';
import { colors } from '@/theme';
import { Button, LinkText, Logo, Screen, SegmentedTabs, Text, TextField } from '@/ui';

import { sendCodeErrorText } from './errors';
import { useLoginDraft } from './loginDraftStore';
import { isValidEmail, isValidPhone } from './validation';

const tabs = [
  { key: 'phone', label: 'Телефон' },
  { key: 'email', label: 'Почта' },
] as const;

/** Вход: телефон / почта (один экран, два режима). */
export function LoginScreen() {
  const { channel, phone, email, setChannel, setPhone, setEmail } = useLoginDraft();

  const send = useMutation({
    mutationFn: (input: { channel: Channel; value: string }) => getApi().requestCode(input),
    onSuccess: (result, input) =>
      router.push({
        pathname: '/code',
        params: { retryAfter: String(result.retryAfterSec) },
      }),
  });
  const runOnce = useSingleFlight();

  const valid = channel === 'phone' ? isValidPhone(phone) : isValidEmail(email);

  // Ошибку показываем у того способа, с которым она случилась.
  const sendError =
    send.isError && send.variables?.channel === channel ? sendCodeErrorText(send.error) : undefined;

  function submit() {
    if (!valid) return;
    const input =
      channel === 'phone'
        ? { channel, value: toE164(phone) }
        : { channel, value: email.trim().toLowerCase() };
    void runOnce(() => send.mutateAsync(input));
  }

  return (
    <Screen
      footer={
        <>
          <Button
            title="Получить код"
            onPress={submit}
            disabled={!valid}
            loading={send.isPending}
            testID="login-submit"
          />
          <Text size={12} color={colors.textMuted} lineHeight={17} style={styles.consent}>
            {'Нажимая «Получить код», вы соглашаетесь с '}
            <LinkText href={legalLinks.terms}>условиями использования</LinkText>
            {' и '}
            <LinkText href={legalLinks.privacy}>политикой обработки персональных данных</LinkText>
            {'.'}
          </Text>
        </>
      }
    >
      <View style={styles.hero}>
        <Logo />
        <View style={styles.heroTexts}>
          <Text weight={800} size={28} lineHeight={34} accessibilityRole="header">
            Добро пожаловать в Конкрит
          </Text>
          <Text size={15} color={colors.textMuted} lineHeight={22}>
            Заявки, платежи и чат с управляющей компанией в одном приложении. Войдите по номеру
            телефона или по почте.
          </Text>
        </View>
      </View>

      <SegmentedTabs
        options={tabs}
        value={channel}
        onChange={setChannel}
        accessibilityLabel="Способ входа"
      />

      {channel === 'phone' ? (
        <TextField
          label="Номер телефона"
          placeholder="+7 (000) 000-00-00"
          value={phone}
          onChangeText={(text) => setPhone(formatPhone(text))}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          hint="Код придёт в SMS."
          error={sendError}
          testID="login-phone"
        />
      ) : (
        <TextField
          label="Электронная почта"
          placeholder="name@example.ru"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          hint="Код придёт в письме. Проверьте папку «Спам», если не нашли."
          error={sendError}
          testID="login-email"
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 20, alignItems: 'flex-start', paddingTop: 32 },
  heroTexts: { gap: 8 },
  consent: { textAlign: 'center' },
});
