import { useEffect } from 'react';

/**
 * useKeyboard hook listens for Arrow keys and Enter
 * to control the state machine of the simulation.
 */
export function useKeyboard({
  isSimulationActive,
  setIsSimulationActive,
  currentStep,
  setCurrentStep,
  maxSteps
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // If simulation hasn't started, only listen for Enter
      if (!isSimulationActive) {
        if (e.key === 'Enter') {
          setIsSimulationActive(true);
        }
        return;
      }

      // If active, listen for navigation arrows
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        setCurrentStep((prev) => Math.min(prev + 1, maxSteps));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        setCurrentStep((prev) => Math.max(prev - 1, 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSimulationActive, setIsSimulationActive, currentStep, setCurrentStep, maxSteps]);
}
