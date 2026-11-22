import { memo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors, fontFamily, sizes } from '@/theme';
import { Icon } from '@/ui';

export const MESSAGE_MAX = 1000;

type ChatInputBarProps = {
  onSend: (text: string) => void;
  onAttach: () => void;
};

/**
 * Строка ввода: скрепка, поле «Сообщение», «Отправить». Текст хранится здесь, чтобы набор не
 * перерисовывал всю переписку.
 */
export const ChatInputBar = memo(function ChatInputBar({ onSend, onAttach }: ChatInputBarProps) {
  const [text, setText] = useState('');
  const canSend = text.trim().length > 0;

  function send() {
    if (!canSend) return;
    onSend(text);
    setText('');
  }

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Прикрепить файл"
        onPress={onAttach}
        style={[styles.round, styles.attach]}
        testID="chat-attach"
      >
        <Icon name="attach" size={24} color={colors.text} />
      </Pressable>
      <TextInput
        accessibilityLabel="Сообщение"
        placeholder="Сообщение"
        placeholderTextColor={colors.textMuted}
        value={text}
        onChangeText={(value) => setText(value.slice(0, MESSAGE_MAX))}
        maxLength={MESSAGE_MAX}
        maxFontSizeMultiplier={1.3}
        returnKeyType="send"
        blurOnSubmit={false}
        onSubmitEditing={send}
        style={styles.input}
        testID="chat-input"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Отправить"
        accessibilityState={{ disabled: !canSend }}
        disabled={!canSend}
        onPress={send}
        style={[styles.round, canSend ? styles.send : styles.sendOff]}
        testID="chat-send"
      >
        <Icon name="send" size={24} color={canSend ? colors.onAccent : colors.disabledText} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 8 },
  round: {
    width: sizes.touch,
    height: sizes.touch,
    borderRadius: sizes.touch / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attach: { backgroundColor: colors.surface },
  send: { backgroundColor: colors.accent },
  sendOff: { backgroundColor: colors.disabledBg },
  input: {
    flex: 1,
    height: sizes.touch,
    paddingHorizontal: 16,
    borderRadius: sizes.touch / 2,
    backgroundColor: colors.surface,
    fontFamily: fontFamily[500],
    fontSize: 14,
    color: colors.text,
  },
});
