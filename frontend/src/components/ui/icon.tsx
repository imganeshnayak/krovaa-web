import React from "react";
import * as Icons from "lucide-react";

// 1. Explicitly map valid, verified Lucide equivalents for safety
const customIconMap = {
  User: Icons.User,
  X: Icons.X,
  Settings: Icons.Settings,
  FileText: Icons.FileText,
  ShieldCheck: Icons.ShieldCheck,
  MapPin: Icons.MapPin,
  LogOut: Icons.LogOut,
  UserX: Icons.UserX,
  
  // Mapping missing/imaginary icon names to actual Lucide items
  Telefon: Icons.Phone,
  Call: Icons.PhoneCall,
  CallOff: Icons.PhoneOff,
  Messages: Icons.MessageSquareCustom ?? Icons.MessageSquare,
  Chat: Icons.MessageCircle,
  ChatDots: Icons.MessageSquareText,
  ChatDotsLeftRight: Icons.MessagesSquare,
  Shipping: Icons.Truck,
  MapPed: Icons.Footprints,
};

// 2. Combine the full Lucide library with our custom layout aliases
const lucideIcons = {
  ...Icons,
  ...customIconMap,
};

export type IconName = keyof typeof lucideIcons;

type IconProps = {
  name: IconName;
  size?: number | string;
  color?: string;
  className?: string;
  title?: string;
  "aria-label"?: string;
  strokeWidth?: number;
  variant?: 'solid' | 'outline' | 'bold';
};

const getStrokeWidth = (variant: IconProps['variant'] | undefined): number => {
  switch (variant) {
    case 'solid': return 1.8;
    case 'bold': return 2.4;
    case 'outline':
    default: return 1.5;
  }
};

const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  color = "currentColor",
  className = "",
  title,
  "aria-label": ariaLabel,
  strokeWidth,
  variant
}) => {
  const IconComponent = lucideIcons[name] as React.ComponentType<any>;

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in lucide-react mapping pipeline.`);
    return null;
  }

  const finalStrokeWidth = strokeWidth ?? getStrokeWidth(variant);

  // If size is passed as a string (e.g. "h-6 w-6"), use it as className, else pass as numeric prop
  const isCustomClassSize = typeof size === "string";

  return (
    <IconComponent
      size={isCustomClassSize ? undefined : size}
      strokeWidth={finalStrokeWidth}
      color={color}
      className={`${isCustomClassSize ? size : ""} ${className}`.trim()}
      title={title}
      aria-label={ariaLabel}
      {...(variant === 'solid' ? { fill: color } : {})}
    />
  );
};

export default Icon;