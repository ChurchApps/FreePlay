import React from 'react';
import {View, Image, StyleSheet} from 'react-native';

type Props = {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  color?: string; // Kept for API compatibility but not used with image-based logo
};

// Import logo images
const LogoWhite = require('../images/logo-white.png');
const LogoIcon = require('../images/logo-icon.png');

export const FreePlayLogo = ({
  size = 'medium',
  showText = true,
}: Props) => {
  const sizes = {
    small: {height: 30, iconSize: 30},
    medium: {height: 35, iconSize: 35},
    large: {height: 100, iconSize: 100},
  };

  const s = sizes[size];

  // Use full logo with text or just the icon
  const logoSource = showText ? LogoWhite : LogoIcon;

  return (
    <View style={[styles.container, showText && styles.containerExpanded]}>
      <Image
        source={logoSource}
        style={showText ? {
          width: s.height * 4,
          height: s.height,
        } : {
          width: s.iconSize,
          height: s.iconSize,
        }}
        resizeMode="contain"
      />
    </View>
  );
};

// White version for dark backgrounds (same as default since we use white logo)
export const FreePlayLogoWhite = ({
  size = 'medium',
  showText = true,
}: Omit<Props, 'color'>) => {
  return <FreePlayLogo size={size} showText={showText} />;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  containerExpanded: {
    width: '100%',
  },
});
