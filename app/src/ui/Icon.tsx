import { serviceTypeDef } from '@renewals/shared';
import Svg, { Path } from 'react-native-svg';
import { icons, type IconName } from './icons';
import { colors } from './theme';

interface PathIconProps {
  paths: readonly string[];
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function PathIcon({ paths, size = 22, color = colors.text, strokeWidth = 2 }: PathIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {paths.map((d) => (
        <Path
          key={d}
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </Svg>
  );
}

export function Icon({ name, ...rest }: { name: IconName } & Omit<PathIconProps, 'paths'>) {
  return <PathIcon paths={icons[name]} {...rest} />;
}

export function ServiceIcon({ type, ...rest }: { type: string } & Omit<PathIconProps, 'paths'>) {
  return <PathIcon paths={serviceTypeDef(type).icon} {...rest} />;
}
