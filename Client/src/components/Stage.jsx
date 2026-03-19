import React from 'react';

/**
 * Stage serves as the main absolute positioned container.
 * Specific simulations will render their elements here.
 */
export default function Stage({ children, currentStep }) {
  const isSimulation = currentStep !== undefined && currentStep >= 2;
  return (
    <main className="stage" style={{ minHeight: isSimulation ? '115vh' : '100vh' }}>
      {children}
    </main>
  );
}
