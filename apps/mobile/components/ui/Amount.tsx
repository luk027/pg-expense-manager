import React from 'react';
import { View, Text, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { colors } from '../../lib/tokens';
import { formatPaise } from '../../lib/utils';

export interface AmountProps {
  paise: number | bigint;
  semantic?: 'owed' | 'received' | 'pending' | 'neutral' | 'primary';
  size?: 'hero' | 'title' | 'body' | 'caption';
  prefix?: string;
  style?: TextStyle | TextStyle[];
  containerStyle?: ViewStyle | ViewStyle[];
}

export function Amount({
  paise,
  semantic = 'neutral',
  size = 'body',
  prefix,
  style,
  containerStyle,
}: AmountProps) {
  const formatted = formatPaise(paise);

  return (
    <View style={[styles.container, containerStyle]}>
      {prefix && (
        <Text style={[styles.prefix, styles[`${semantic}Color` as keyof typeof styles]]}>
          {prefix}{' '}
        </Text>
      )}
      <Text
        style={[
          styles.base,
          styles[size],
          styles[`${semantic}Color` as keyof typeof styles],
          { fontVariant: ['tabular-nums'] },
          style,
        ]}
      >
        {formatted}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  base: {
    fontWeight: '700',
  },
  prefix: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Sizes
  hero: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '800',
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  // Colors
  owedColor: {
    color: colors.danger,
  },
  receivedColor: {
    color: colors.success,
  },
  pendingColor: {
    color: colors.warning,
  },
  neutralColor: {
    color: colors.ink,
  },
  primaryColor: {
    color: colors.primary,
  },
});
