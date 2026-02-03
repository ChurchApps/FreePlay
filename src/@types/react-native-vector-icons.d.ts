declare module 'react-native-vector-icons/MaterialIcons' {
  import * as React from 'react';
  import {TextProps} from 'react-native';
  export interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
  }
  const Icon: React.ComponentType<IconProps>;
  export default Icon;
}
