import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';
import { Colors } from '../helpers';

type Props = {
  width: number | string;
  height: number;
  borderRadius?: number;
};

export const SkeletonCard = ({ width, height, borderRadius = 12 }: Props) => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: Colors.surface,
        opacity: pulseAnim,
      }}
    />
  );
};
