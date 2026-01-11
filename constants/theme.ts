/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#9a6700'; // GitHub Yellow (Darker for light mode)
const tintColorDark = '#f1e05a';  // GitHub Yellow

export const Colors = {
  light: {
    text: '#1f2328',
    background: '#ffffff',
    tint: tintColorLight,
    icon: '#656d76',
    tabIconDefault: '#656d76',
    tabIconSelected: tintColorLight,
    border: '#d0d7de',
    card: '#f6f8fa',
  },
  dark: {
    text: '#c9d1d9',
    background: '#0d1117',
    tint: tintColorDark,
    icon: '#8b949e',
    tabIconDefault: '#8b949e',
    tabIconSelected: tintColorDark,
    border: '#30363d',
    card: '#161b22',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
