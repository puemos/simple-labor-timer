import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

export function PulseDot({ active, color }: { active: boolean; color: string }) {
  const scale = useSharedValue(1);
  const halo = useSharedValue(0);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(withTiming(1.18, { duration: 800 }), -1, true);
      halo.value = withRepeat(withTiming(1, { duration: 1200 }), -1, false);
    } else {
      scale.value = withTiming(1, { duration: 220 });
      halo.value = withTiming(0, { duration: 160 });
    }
  }, [active, scale, halo]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - halo.value),
    transform: [{ scale: 1 + halo.value * 1.6 }],
  }));

  return (
    <View style={styles.wrap}>
      {active ? (
        <Animated.View pointerEvents="none" style={[styles.halo, { backgroundColor: color }, haloStyle]} />
      ) : null}
      <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  dot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  halo: {
    borderRadius: 9,
    height: 18,
    position: 'absolute',
    width: 18,
  },
});
