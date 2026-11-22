import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, space } from '../../lib/tokens';

export type StatusPillType =
  | 'confirmed'
  | 'settled'
  | 'awaiting'
  | 'pending'
  | 'owed'
  | 'draft'
  | 'cancelled'
  | 'reversed';

export interface StatusPillProps {
  status: StatusPillType;
  customLabel?: string;
}

export function StatusPill({ status, customLabel }: StatusPillProps) {
  const config = getStatusConfig(status);

  return (
    <View style={[styles.pill, config.style]}>
      <Feather name={config.icon as any} size={11} color={config.color} />
      <Text style={[styles.text, { color: config.color }]}>
        {customLabel || config.label}
      </Text>
    </View>
  );
}

function getStatusConfig(status: StatusPillType) {
  switch (status) {
    case 'confirmed':
    case 'settled':
      return {
        label: 'Confirmed',
        color: colors.success,
        style: styles.success,
        icon: 'check-circle',
      };
    case 'awaiting':
      return {
        label: 'Awaiting Receipt',
        color: colors.warning,
        style: styles.warning,
        icon: 'clock',
      };
    case 'pending':
    case 'owed':
      return {
        label: 'Pending',
        color: colors.danger,
        style: styles.danger,
        icon: 'alert-circle',
      };
    case 'draft':
      return {
        label: 'Draft',
        color: colors.primary,
        style: styles.primary,
        icon: 'edit-2',
      };
    case 'cancelled':
    case 'reversed':
      return {
        label: status === 'reversed' ? 'Reversed' : 'Cancelled',
        color: colors.inkTertiary,
        style: styles.neutral,
        icon: 'x-circle',
      };
  }
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
  success: {
    backgroundColor: colors.successSoft,
  },
  warning: {
    backgroundColor: colors.warningSoft,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
  },
  primary: {
    backgroundColor: colors.primarySoft,
  },
  neutral: {
    backgroundColor: colors.surfaceMuted,
  },
});
