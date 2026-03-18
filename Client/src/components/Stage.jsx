import React from 'react';

/**
 * Stage serves as the main absolute positioned container.
 * Specific simulations will render their elements here.
 */
export default function Stage({ children }) {
  return (
    <main className="stage">
      {children}
    </main>
  );
}
