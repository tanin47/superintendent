import React from 'react';

export default function Button({
  onClick,
  isLoading,
  disabled,
  icon,
  children,
  testId,
}: {
  onClick?: () => void | null,
  isLoading?: boolean,
  disabled?: boolean,
  icon?: JSX.Element | null,
  children?: any,
  testId?: string | null
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      data-testid={testId}
    >
      {isLoading ? (<span className="spinner" />) : (icon ? <span className="icon">{icon}</span> : null)}
      {children}
    </button>
  );
}
