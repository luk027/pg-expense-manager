import React from 'react';
import {
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
  StyleProp,
} from 'react-native';
import { colors, radius, space } from '../../lib/tokens';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
}: ButtonProps) {
  const isInteractive = !disabled && !loading;

  return (
    <Pressable
      onPress={isInteractive ? onPress : undefined}
      style={({ pressed }) => [
        btnStyles.base,
        btnStyles[variant],
        btnStyles[size],
        disabled && btnStyles.disabled,
        pressed && isInteractive && btnStyles[`${variant}Pressed` as keyof typeof btnStyles],
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !isInteractive }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? colors.primary : '#FFFFFF'}
        />
      ) : (
        <View style={btnStyles.contentRow}>
          {icon && <View style={btnStyles.iconWrapper}>{icon}</View>}
          <Text
            style={[
              textStyles.base,
              textStyles[variant],
              textStyles[size],
              disabled && textStyles.disabled,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const btnStyles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    marginRight: space.xs + 2,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  primaryPressed: {
    backgroundColor: colors.primaryPressed,
  },
  secondary: {
    backgroundColor: colors.primarySoft,
  },
  secondaryPressed: {
    backgroundColor: '#E0E7FF',
  },
  destructive: {
    backgroundColor: colors.danger,
  },
  destructivePressed: {
    backgroundColor: '#912018',
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderWidth: 1,
  },
  outlinePressed: {
    backgroundColor: colors.surfaceMuted,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  ghostPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  sm: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    minHeight: 36,
  },
  md: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
    minHeight: 48,
  },
  lg: {
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    minHeight: 54,
  },
  disabled: {
    opacity: 0.5,
  },
});

const textStyles = StyleSheet.create({
  base: {
    fontWeight: '700',
    textAlign: 'center',
  },
  primary: {
    color: '#FFFFFF',
  },
  secondary: {
    color: colors.primary,
  },
  destructive: {
    color: '#FFFFFF',
  },
  outline: {
    color: colors.ink,
  },
  ghost: {
    color: colors.primary,
  },
  sm: {
    fontSize: 12,
  },
  md: {
    fontSize: 14,
  },
  lg: {
    fontSize: 16,
  },
  disabled: {
    color: colors.inkTertiary,
  },
});
