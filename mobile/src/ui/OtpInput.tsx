import { useEffect, useRef } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputKeyPressEvent,
} from 'react-native';

import { colors, fontFamily, radius, sizes } from '@/theme';

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  error?: boolean;
  autoFocus?: boolean;
  accessibilityLabel: string;
  /** Вызывается один раз, когда введены все цифры. */
  onComplete?: (value: string) => void;
};

/** Ввод кода из N ячеек: автопереход, backspace, вставка целиком. */
export function OtpInput({
  value,
  onChange,
  length = 6,
  error = false,
  autoFocus = false,
  accessibilityLabel,
  onComplete,
}: OtpInputProps) {
  const refs = useRef<(TextInputInstance | null)[]>([]);
  const completed = useRef(false);

  useEffect(() => {
    if (value.length === length) {
      if (!completed.current) {
        completed.current = true;
        onComplete?.(value);
      }
    } else {
      completed.current = false;
    }
  }, [value, length, onComplete]);

  function commit(next: string, focusIndex: number) {
    onChange(next);
    refs.current[Math.min(focusIndex, length - 1)]?.focus();
  }

  function handleChange(index: number, text: string) {
    const digits = text.replace(/\D/g, '');
    if (digits.length === 0) {
      // Стёрли цифру в этой ячейке.
      commit(value.slice(0, index) + value.slice(index + 1), index);
      return;
    }
    // Одна цифра заменяет текущую, несколько (вставка) заполняют подряд.
    const next = (value.slice(0, index) + digits + value.slice(index + digits.length)).slice(
      0,
      length,
    );
    commit(next, index + digits.length);
  }

  function handleKeyPress(index: number, event: TextInputKeyPressEvent) {
    if (event.nativeEvent.key === 'Backspace' && !value[index] && index > 0) {
      commit(value.slice(0, index - 1) + value.slice(index), index - 1);
    }
  }

  return (
    <View accessibilityRole="none" accessibilityLabel={accessibilityLabel} style={styles.row}>
      {Array.from({ length }, (_, index) => {
        const filled = Boolean(value[index]);
        const active = index === Math.min(value.length, length - 1);
        return (
          <View key={index} style={styles.cell}>
            <TextInput
              ref={(node) => {
                refs.current[index] = node;
              }}
              testID={`otp-cell-${index}`}
              accessibilityLabel={`Цифра ${index + 1} из ${length}`}
              value={value[index] ?? ''}
              onChangeText={(text) => handleChange(index, text)}
              onKeyPress={(event) => handleKeyPress(index, event)}
              keyboardType="number-pad"
              inputMode="numeric"
              autoComplete={index === 0 ? 'sms-otp' : 'off'}
              textContentType={index === 0 ? 'oneTimeCode' : 'none'}
              autoFocus={autoFocus && index === 0}
              selectTextOnFocus
              caretHidden={false}
              style={styles.input}
            />
            <View
              pointerEvents="none"
              style={[
                styles.frame,
                error
                  ? { borderWidth: 2, borderColor: colors.error }
                  : active && !filled
                    ? { borderWidth: 2, borderColor: colors.accent }
                    : { borderWidth: 1, borderColor: colors.border },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  cell: {
    width: sizes.otpCellWidth,
    height: sizes.otpCellHeight,
    borderRadius: radius.field,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fontFamily[800],
    fontSize: 22,
    color: colors.text,
    padding: 0,
  },
  frame: { ...StyleSheet.absoluteFill, borderRadius: radius.field },
});
