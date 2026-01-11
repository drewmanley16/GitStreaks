import React from 'react';
import { View, StyleSheet, Text } from 'react-native';

export const Logo = ({ size = 40 }: { size?: number }) => {
  return (
    <View style={[styles.container, { width: size * 2.5, height: size }]}>
      <View style={[styles.square, { width: size * 0.8, height: size * 0.8 }]}>
        <View style={styles.dot} />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.text, { fontSize: size * 0.5 }]}>GIT</Text>
        <Text style={[styles.textBold, { fontSize: size * 0.5 }]}>STREAKS</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  square: {
    backgroundColor: '#f1e05a',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    transform: [{ rotate: '45deg' }],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0d1117',
    transform: [{ rotate: '-45deg' }],
  },
  textContainer: {
    flexDirection: 'row',
  },
  text: {
    color: '#ffffff',
    fontWeight: '300',
    letterSpacing: 1,
  },
  textBold: {
    color: '#f1e05a',
    fontWeight: '900',
    letterSpacing: 1,
  },
});

