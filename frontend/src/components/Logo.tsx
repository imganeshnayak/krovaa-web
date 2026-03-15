import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'text' | 'image';
}

const Logo = ({ className = "", size = 'md', variant = 'text' }: LogoProps) => {
  const sizeClasses = {
    sm: variant === 'text' ? "text-lg" : "h-6",
    md: variant === 'text' ? "text-2xl" : "h-8",
    lg: variant === 'text' ? "text-3xl" : "h-10",
    xl: variant === 'text' ? "text-5xl md:text-6xl" : "h-16 md:h-20"
  };

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
        className={`${sizeClasses[size]} font-bold tracking-tight text-white transition-all`}
        style={{ fontFamily: "'Outfit', sans-serif" }}
      >
        krovaa
      </span>
    </div>
  );
};

export default Logo;
