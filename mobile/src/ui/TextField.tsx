import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fontFamily, radius, sizes } from '@/theme';

import { FieldError } from './FieldError';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type TextFieldProps = Pick<
  TextInputProps,
  | 'value'
  | 'onChangeText'
  | 'placeholder'
  | 'keyboardType'
  | 'inputMode'
  | 'autoComplete'
  | 'autoCapitalize'
  | 'autoCorrect'
  | 'autoFocus'
  | 'returnKeyType'
  | 'onSubmitEditing'
  | 'onBlur'
  | 'onFocus'
  | 'maxLength'
  | 'textContentType'
> & {
  label: string;
  hint?: string;
  error?: string;
  /** Многострочное поле высотой 112 с радиусом 20 (описание заявки). */
  multiline?: boolean;
  /** Показывать счётчик «N/max» в углу (нужен maxLength). */
  showCounter?: boolean;
  leftIcon?: IconName;
  testID?: string;
};

/** Поле ввода: подпись сверху, подсказка и ошибка снизу, рамка по состоянию. */
export function TextField({
  label,
  hint,
  error,
  multiline = false,
  showCounter = false,
  leftIcon,
  testID,
  value = '',
  onFocus,
  onBlur,
  maxLength,
  ...input
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  const frame = error
    ? { borderWidth: 1.5, borderColor: colors.error }
    : focused
      ? { borderWidth: 2, borderColor: colors.accent }
      : { borderWidth: 1, borderColor: colors.border };

  return (
    <View style={styles.wrap}>
      <Text weight={700} size={13} color={colors.textMuted}>
        {label}
      </Text>
      <View style={multiline ? styles.areaBox : styles.box}>
        {leftIcon ? (
          <View style={styles.leftIcon}>
            <Icon name={leftIcon} color={colors.textMuted} />
          </View>
        ) : null}
        <TextInput
          {...input}
          testID={testID}
          accessibilityLabel={label}
          maxFontSizeMultiplier={1.3}
          value={value}
          maxLength={maxLength}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          placeholderTextColor={colors.textMuted}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            styles.input,
            multiline ? styles.inputArea : styles.inputLine,
            leftIcon ? styles.inputWithIcon : null,
          ]}
        />
        {multiline && showCounter && maxLength ? (
          <Text weight={600} size={11} color={colors.textMuted} style={styles.counter}>
            {`${value.length}/${maxLength}`}
          </Text>
        ) : null}
        <View
          pointerEvents="none"
          style={[styles.frame, multiline ? styles.frameArea : null, frame]}
        />
      </View>
      {error ? (
        <FieldError message={error} testID={testID ? `${testID}-error` : undefined} />
      ) : hint ? (
        <Text size={12} color={colors.textMuted} lineHeight={17}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  box: {
    height: sizes.field,
    borderRadius: radius.field,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  areaBox: {
    height: 112,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  input: { color: colors.text },
  inputLine: {
    flex: 1,
    paddingHorizontal: 16,
    fontFamily: fontFamily[600],
    fontSize: 15,
  },
  inputArea: {
    flex: 1,
    padding: 16,
    paddingBottom: 28,
    fontFamily: fontFamily[500],
    fontSize: 15,
    lineHeight: 22,
  },
  inputWithIcon: { paddingLeft: 48 },
  leftIcon: { position: 'absolute', left: 16, zIndex: 1 },
  counter: { position: 'absolute', right: 14, bottom: 10 },
  frame: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.field,
  },
  frameArea: { borderRadius: radius.card },
});
