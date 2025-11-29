import React from 'react';

const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => {
  return (
    <div {...props} className={`glass-panel p-4 ${className}`}>
      {children}
    </div>
  );
};

export default Card;
