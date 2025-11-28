import React from 'react';

const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => {
  return (
    <div {...props} className={`bg-gray-900/80 border border-gray-700 rounded-lg p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
};

export default Card;
