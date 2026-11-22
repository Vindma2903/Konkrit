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
    let digits = text.replace(/\D/g, '');
    if (digits.length === 0) {
      // Стёрли цифру в этой ячейке; в пустой ячейке стирать нечего.
      if (value[index]) commit(value.slice(0, index) + value.slice(index + 1), index);
      return;
    }
    // Вставили код целиком (например, из SMS): он заменяет всё, что было введено.
    if (digits.length >= length) {
      commit(digits.slice(0, length), length - 1);
      return;
    }
    // В заполненную ячейку дописали цифру: берём новую, а не обе.
    const current = value[index];
    if (current && digits.length === 2) digits = digits[0] === current ? digits[1] : digits[0];
    // Цифра ложится сразу за введёнными: пустых «дырок» в коде не бывает.
    const at = Math.min(index, value.length);
    const next = (value.slice(0, at) + digits + value.slice(at + digits.length)).slice(0, length);
    commit(next, at + digits.length);
  }

  function handleKeyPress(index: number, event: TextInputKeyPressEvent) {
    if (event.nativeEvent.key === 'Backspace' && !value[index] && index > 0) {
      commit(value.slice(0, index - 1) + value.slice(index), index - 1);
    }
  }

  return (
    <View style={styles.row}>
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
              accessibilityLabel={`${accessibilityLabel}: цифра ${index + 1} из ${length}`}
              maxFontSizeMultiplier={1.3}
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
