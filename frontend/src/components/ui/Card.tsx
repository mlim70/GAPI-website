import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg' | 'none';
  shadow?: 'sm' | 'md' | 'lg' | 'none';
  border?: boolean;
}

export default function Card({ 
  children, 
  className = '', 
  padding = 'md',
  shadow = 'md',
  border = true 
}: CardProps) {
  const paddingClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
    none: ''
  };
  
  const shadowClasses = {
    sm: 'shadow-sm',
    md: 'shadow-lg',
    lg: 'shadow-xl',
    none: ''
  };
  
  const borderClasses = border ? 'border border-neutral-light' : '';
  
  const classes = `bg-white rounded-lg ${paddingClasses[padding]} ${shadowClasses[shadow]} ${borderClasses} ${className}`;
  
  return (
    <div className={classes}>
      {children}
    </div>
  );
} 