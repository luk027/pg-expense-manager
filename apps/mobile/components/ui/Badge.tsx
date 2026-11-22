import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, space } from '../../lib/tokens';

export interface BadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'neutral';
  icon?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

export function Badge({ label, variant = 'neutral', icon, style }: BadgeProps) {
  return (
    <View
      style={[styles.badge, styles[variant], style]}
      accessible={true}
      accessibilityLabel={`Badge: ${label}`}
    >
      {icon && <View style={styles.iconWrapper}>{icon}</View>}
      <Text style={[styles.text, styles[`${variant}Text` as keyof typeof styles]]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  iconWrapper: {
    marginRight: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Variants
  primary: {
    backgroundColor: colors.primarySoft,
  },
  primaryText: {
    color: colors.primary,
  },
  success: {
    backgroundColor: colors.successSoft,
  },
  successText: {
    color: colors.success,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
  },
  dangerText: {
    color: colors.danger,
  },
  warning: {
    backgroundColor: colors.warningSoft,
  },
  warningText: {
    color: colors.warning,
  },
  neutral: {
    backgroundColor: colors.surfaceMuted,
  },
  neutralText: {
    color: colors.inkSecondary,
  },
});
