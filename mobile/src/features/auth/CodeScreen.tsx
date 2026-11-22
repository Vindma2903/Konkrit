import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ApiError, getApi, type Channel } from '@/api';
import { formatPhone } from '@/lib/phone';
import { useSingleFlight } from '@/lib/useSingleFlight';
import { colors, sizes } from '@/theme';
import { Button, FieldError, Icon, OtpInput, Screen, ScreenHeader, Text } from '@/ui';

import { isInvalidCode, sendCodeErrorText, verifyCodeErrorText } from './errors';
import { useLoginDraft } from './loginDraftStore';
import { useSessionStore } from './sessionStore';
import { useCountdown } from './useCountdown';

const CODE_LENGTH = 6;
const DEFAULT_RESEND_SEC = 60;

const copy = {
  phone: {
    title: 'Код из SMS',
    sent: 'Мы отправили код на номер',
    change: 'Изменить номер',
    group: 'Код из SMS',
    hint: 'Не пришёл код? Проверьте номер или запросите новый, когда закончится таймер.',
    switchTo: 'Войти по почте',
    switchChannel: 'email' as Channel,
  },
  email: {
    title: 'Код из письма',
    sent: 'Мы отправили код на почту',
    change: 'Изменить почту',
    group: 'Код из письма',
    hint: 'Не пришёл код? Проверьте папку «Спам» или запросите новый, когда закончится таймер.',
    switchTo: 'Войти по телефону',
    switchChannel: 'phone' as Channel,
  },
};

/** Ввод кода из SMS или из письма. Параметры маршрута: channel, value, retryAfter (секунды до повторной отправки). */
export function CodeScreen() {
  const params = useLocalSearchParams<{ channel?: string; value?: string; retryAfter?: string }>();
  const channel: Channel = params.channel === 'email' ? 'email' : 'phone';
  const value = params.value ?? '';
  const retryAfter = Number(params.retryAfter) > 0 ? Number(params.retryAfter) : DEFAULT_RESEND_SEC;
  const text = copy[channel];

  const [code, setCode] = useState('');
  const runOnce = useSingleFlight();
  // Меняется после ошибки: пересоздаёт ячейки, чтобы очистить их и вернуть фокус в первую.
  const [attempt, setAttempt] = useState(0);
  const { seconds, restart } = useCountdown(retryAfter);
  const signIn = useSessionStore((state) => state.signIn);
  const setChannel = useLoginDraft((state) => state.setChannel);

  const verify = useMutation({
    mutationFn: (entered: string) => getApi().verifyCode({ channel, value, code: entered }),
    // После входа переход делает защита маршрутов в корневом layout.
    onSuccess: (result) =>
      signIn({
        tokens: { accessToken: result.accessToken, refreshToken: result.refreshToken },
        user: result.user,
        hasResidency: result.hasResidency,
      }),
    onError: (error) => {
      // Неверный код стираем и возвращаем фокус в первую ячейку; при сбое сети введённое остаётся.
      if (isInvalidCode(error)) {
        setCode('');
        setAttempt((current) => current + 1);
      }
    },
  });

  const resend = useMutation({
    mutationFn: () => getApi().requestCode({ channel, value }),
    onSuccess: (result) => {
      verify.reset();
      setCode('');
      setAttempt((current) => current + 1);
      restart(result.retryAfterSec || DEFAULT_RESEND_SEC);
    },
    onError: (error) => {
      // Сервер просит подождать: таймер показывает оставшееся время.
      if (error instanceof ApiError && error.code === 'rate_limited' && error.retryAfterSec) {
        restart(error.retryAfterSec);
      }
    },
  });

  function submit(entered: string) {
    if (entered.length !== CODE_LENGTH) return;
    void runOnce(() => verify.mutateAsync(entered));
  }

  const shownValue = channel === 'phone' ? formatPhone(value) : value;
  const error = verify.isError
    ? verifyCodeErrorText(verify.error)
    : resend.isError
      ? sendCodeErrorText(resend.error)
      : undefined;

  return (
    <Screen
      header={<ScreenHeader title={text.title} />}
      contentGap={24}
      footer={
        <>
          <Button
            title="Подтвердить"
            onPress={() => submit(code)}
            disabled={code.length !== CODE_LENGTH}
            loading={verify.isPending}
            testID="code-submit"
          />
          <Text size={12} color={colors.textMuted} lineHeight={17} style={styles.center}>
            {text.hint}
          </Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => {
              setChannel(text.switchChannel);
              router.dismissTo('/login');
            }}
            style={[styles.link, styles.linkCenter]}
            testID="code-switch"
          >
            <Text weight={700} size={14} color={colors.accentText}>
              {text.switchTo}
            </Text>
          </Pressable>
        </>
      }
    >
      <View style={styles.sent}>
        <Text size={15} color={colors.textMuted} lineHeight={22}>
          {text.sent}
        </Text>
        <View style={styles.valueRow}>
          <Text weight={800} size={18} style={styles.value} testID="code-target">
            {shownValue}
          </Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.back()}
            style={styles.link}
            testID="code-change"
          >
            <Text weight={700} size={14} color={colors.accentText}>
              {text.change}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.codeBlock}>
        <OtpInput
          key={attempt}
          value={code}
          onChange={setCode}
          onComplete={submit}
          error={verify.isError && isInvalidCode(verify.error)}
          autoFocus
          accessibilityLabel={text.group}
          length={CODE_LENGTH}
        />
        <FieldError message={error} testID="code-error" />
      </View>

      {seconds > 0 ? (
        <View style={styles.timer}>
          <Icon name="clock" size={20} color={colors.textMuted} />
          <Text weight={600} size={14} color={colors.textMuted} testID="code-timer">
            {`Отправить код повторно через ${seconds} с`}
          </Text>
        </View>
      ) : (
        <Pressable
          accessibilityRole="link"
          disabled={resend.isPending}
          onPress={() => void runOnce(() => resend.mutateAsync())}
          style={styles.link}
          testID="code-resend"
        >
          <Text weight={700} size={14} color={colors.accentText}>
            Отправить код ещё раз
          </Text>
        </Pressable>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sent: { gap: 8 },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  value: { flexShrink: 1 },
  codeBlock: { gap: 12 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  center: { textAlign: 'center' },
  link: { minHeight: sizes.touch, justifyContent: 'center', alignSelf: 'flex-start' },
  linkCenter: { alignSelf: 'center' },
});
