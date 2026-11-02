import React from 'react';

export const TechText = ({ text = "Mirai", className = "", children, ...props }) => {
  return (
    <span className={`font-mono tracking-wider ${className}`} {...props}>
      {children || text}
    </span>
  );
};

export default TechText;
