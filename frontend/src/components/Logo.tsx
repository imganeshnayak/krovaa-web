import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'text' | 'image';
  theme?: 'dark' | 'light';
}

const Logo = ({ className = "", size = 'md', variant = 'text', theme = 'light' }: LogoProps) => {
  const sizeClasses = {
    sm: variant === 'text' ? "text-lg" : "h-6",
    md: variant === 'text' ? "text-2xl" : "h-8",
    lg: variant === 'text' ? "text-3xl md:text-4xl" : "h-10",
    xl: variant === 'text' ? "text-5xl md:text-6xl" : "h-16 md:h-20"
  };

  const textColor = theme === 'dark' ? "text-[#0A0E27]" : "text-white";

  if (variant === 'image') {
    return (
      <div className={`flex items-center select-none ${className}`}>
        <img 
          src="/krovaa-logo.svg" 
          alt="Krovaa Logo" 
          className={sizeClasses[size]}
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center select-none ${className}`}>
      <span 
        className={`${sizeClasses[size]} font-black tracking-tight ${textColor} transition-all duration-200`}
        style={{ fontFamily: "'Outfit', sans-serif" }}
      >
        krovaa
      </span>
    </div>
  );
};

export default Logo;
