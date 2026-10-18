import React, { useRef, useMemo } from 'react';
import { View, Animated, PanResponder } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors } from '../../../shared/utils/theme';
import { basketPanelStyles as styles } from './basketPanelStyles';

/** Swipe distance that commits a remove */
const SWIPE_THRESHOLD = 96;

interface SwipeableLineProps {
  onRemove?: () => void;
  children: React.ReactNode;
}

/** Touch-only swipe-left-to-remove wrapper for basket lines. */
export const SwipeableLine: React.FC<SwipeableLineProps> = ({ onRemove, children }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const removedRef = useRef(false);

  const panResponder = useMemo(
    () =>
      onRemove
        ? PanResponder.create({
            onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) && g.dx < 0,
            onPanResponderMove: (_e, g) => {
              if (g.dx < 0) translateX.setValue(Math.max(g.dx, -140));
            },
            onPanResponderRelease: (_e, g) => {
              if (g.dx <= -SWIPE_THRESHOLD && !removedRef.current) {
                removedRef.current = true;
                Animated.timing(translateX, { toValue: -400, duration: 150, useNativeDriver: true }).start(() => onRemove());
              } else {
                Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
              }
            },
          })
        : null,
    [onRemove, translateX]
  );

  return (
    <View style={styles.swipeContainer}>
      {onRemove && (
        <View style={styles.swipeDelete}>
          <MaterialIcons name="delete" size={22} color={lightColors.textOnPrimary} />
        </View>
      )}
      <Animated.View style={{ transform: [{ translateX }] }} {...(panResponder?.panHandlers ?? {})}>
        {children}
      </Animated.View>
    </View>
  );
};
