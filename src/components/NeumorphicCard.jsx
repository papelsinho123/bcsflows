import React from 'react';

export default function NeumorphicCard({ className = '', children }) {
  return (
    <div className={`neumorphic-card ${className}`.trim()}>{children}</div>
  );
}
