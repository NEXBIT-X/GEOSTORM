import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'ghost' | 'primary';
};

const VARIANT_CLASSES: Record<string, string> = {
  default: 'bg-gray-800 text-gray-100 hover:bg-gray-700',
  ghost: 'bg-transparent text-gray-200 hover:bg-gray-800/50',
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
};

const Button: React.FC<ButtonProps> = ({ variant = 'default', className = '', children, ...props }) => {
  const classes = `inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition touch-manipulation ${VARIANT_CLASSES[variant]} ${className}`;
  return (
    <button {...props} className={classes}>
      {children}
    </button>
  );
};

export default Button;
