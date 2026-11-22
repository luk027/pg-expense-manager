import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable } from 'react-native';
import { colors, radius, space } from '../../lib/tokens';

export interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'muted' | 'outline' | 'flat';
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
}

export function Card({ children, variant = 'default', style, onPress }: CardProps) {
  const cardStyle = [
    styles.base,
    variant === 'default' && styles.default,
    variant === 'muted' && styles.muted,
    variant === 'outline' && styles.outline,
    variant === 'flat' && styles.flat,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [...cardStyle, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    padding: space.lg,
  },
  default: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  muted: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderWidth: 1,
  },
  flat: {
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});
