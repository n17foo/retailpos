import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { lightColors, spacing, borderRadius, elevation } from '../utils/theme';

export type CardElevation = 'none' | 'low' | 'medium' | 'high';

interface CardProps {
  children: React.ReactNode;
  /** Elevation level */
  elevationLevel?: CardElevation;
  /** Custom padding */
  padding?: number;
  /** If provided, card becomes pressable */
  onPress?: () => void;
  /** Custom style */
  style?: ViewStyle;
  /** Border highlight color */
  borderColor?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  elevationLevel = 'medium',
  padding = spacing.md,
  onPress,
  style,
  borderColor,
}) => {
  const elevationStyle = elevation[elevationLevel] || elevation.none;

  const cardStyle: ViewStyle[] = [
    styles.card,
    elevationStyle,
    { padding },
    borderColor ? { borderWidth: 2, borderColor } : undefined,
    style,
  ].filter(Boolean) as ViewStyle[];

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.7}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
});

export default Card;
