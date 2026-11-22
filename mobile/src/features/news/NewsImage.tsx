import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { colors } from '@/theme';
import { Icon } from '@/ui';

type NewsImageProps = {
  uri?: string;
  height: number;
  radius: number;
  testID?: string;
};

/** Картинка новости; если её нет или она не загрузилась — серая заглушка с иконкой фото. */
export function NewsImage({ uri, height, radius, testID }: NewsImageProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(uri) && !failed;
  return (
    <View style={[styles.box, { height, borderRadius: radius }]} testID={testID}>
      {showImage ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
          testID={testID ? `${testID}-image` : undefined}
        />
      ) : (
        <Icon name="photo" size={32} color={colors.textMuted} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    backgroundColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
