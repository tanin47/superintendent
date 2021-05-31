import React from 'react';

export default function Button({
  onClick,
  isLoading,
  icon,
  children,
}: {
  onClick?: () => void | null,
  isLoading?: boolean,
  icon?: JSX.Element | null,
  children?: any
}): JSX.Element {
  return (
    <button onClick={onClick} disabled={isLoading}>
      {isLoading ? (<span className="spinner" />) : (<span className="icon">{icon}</span>)}
      {children}
    </button>
  );
}
