import React from 'react';
import { View, Text, StyleSheet, Image, ViewStyle, ImageStyle, StyleProp } from 'react-native';
import { colors } from '../../lib/tokens';

export interface AvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  style?: StyleProp<ViewStyle>;
}

export function Avatar({ name, imageUrl, size = 'md', style }: AvatarProps) {
  const initial = name ? name[0].toUpperCase() : '?';
  const sizeValue = getSize(size);

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[
          styles.image,
          { width: sizeValue, height: sizeValue, borderRadius: sizeValue / 2 },
          style as StyleProp<ImageStyle>,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.avatar,
        {
          width: sizeValue,
          height: sizeValue,
          borderRadius: sizeValue / 2,
          backgroundColor: getAvatarBg(name),
        },
        style,
      ]}
      accessible={true}
      accessibilityLabel={`Avatar of ${name}`}
    >
      <Text style={[styles.initial, { fontSize: sizeValue * 0.42 }]}>{initial}</Text>
    </View>
  );
}

function getSize(size: 'sm' | 'md' | 'lg' | 'xl'): number {
  switch (size) {
    case 'sm':
      return 28;
    case 'md':
      return 38;
    case 'lg':
      return 48;
    case 'xl':
      return 64;
  }
}

function getAvatarBg(name: string): string {
  const charCode = name ? name.charCodeAt(0) : 0;
  if (charCode % 3 === 0) return colors.primarySoft;
  if (charCode % 3 === 1) return '#E0F2FE';
  return colors.successSoft;
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    backgroundColor: colors.surfaceMuted,
  },
  initial: {
    fontWeight: '800',
    color: colors.primary,
  },
});
