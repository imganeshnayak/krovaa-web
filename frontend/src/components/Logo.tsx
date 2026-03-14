import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Logo = ({ className = "", size = 'md' }: LogoProps) => {
  const sizeClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-3xl",
    xl: "text-5xl md:text-6xl"
  };

  return (
    <div className={`flex items-center select-none ${className}`}>
      <span 
        className={`${sizeClasses[size]} font-extrabold tracking-tighter text-white transition-all`}
        style={{ fontFamily: "'Syne', sans-serif", letterSpacing: "-0.04em" }}
      >
        krovaa
        <span className="text-blue-500 inline-block ml-0.5">.</span>
      </span>
    </div>
  );
};

export default Logo;
