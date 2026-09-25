import { useRef, type ReactNode } from 'react';
import { Animated, Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from './motion';
import { motion } from './theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  /** How far the element shrinks while pressed. */
  scaleTo?: number;
};

/** Pressable with a short scale-down on press (150ms), skipped under reduced motion. */
export function Press({ style, children, scaleTo = 0.97, disabled, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  const animate = (to: number) => {
    if (reduced) return;
    Animated.timing(scale, {
      toValue: to,
      duration: motion.press,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        animate(scaleTo);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animate(1);
        rest.onPressOut?.(e);
      }}
      accessibilityState={{ ...rest.accessibilityState, disabled: Boolean(disabled) }}
      style={[style, { transform: [{ scale }] }, disabled ? { opacity: 0.45 } : null]}
    >
      {children}
    </AnimatedPressable>
  );
}
