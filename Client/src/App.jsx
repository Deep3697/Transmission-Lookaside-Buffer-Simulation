import React, { useState } from 'react';
import SideMenu from './components/SideMenu';
import Stage from './components/Stage';
import { useKeyboard } from './hooks/useKeyboard';
import TLB from './simulations/TLB';
import Paging from './simulations/Paging';
import Cache from './simulations/Cache';
import './index.css';

/* Map each simulation to its header gradient style */
const SIM_META = {
  TLB:    { label: 'Translation Lookaside Buffer', short: 'TLB',    accent: 'var(--tlb-color)' },
  Paging: { label: 'Paging Simulation',            short: 'PAGING', accent: 'var(--pt-color)'  },
  Cache:  { label: 'Cache Memory',                 short: 'CACHE',  accent: 'var(--ram-color)' },
};

function App() {
  const [activeSimulation, setActiveSimulation]   = useState('TLB');
  const [isSimulationActive, setIsSimulationActive] = useState(false);
  const [currentStep, setCurrentStep]             = useState(0);
  const [maxSteps, setMaxSteps]                   = useState(0);
  const [isMenuOpen, setIsMenuOpen]               = useState(false);

  useKeyboard({
    isSimulationActive,
    setIsSimulationActive,
    currentStep,
    setCurrentStep,
    maxSteps,
  });

  const handleSetSimulation = (sim) => {
    setActiveSimulation(sim);
    setCurrentStep(0);
    setIsSimulationActive(false);
    setIsMenuOpen(false);
  };

  const renderSimulation = () => {
    const props = { currentStep, setMaxSteps };
    switch (activeSimulation) {
      case 'TLB':    return <TLB    {...props} />;
      case 'Paging': return <Paging {...props} />;
      case 'Cache':  return <Cache  {...props} />;
      default:       return <TLB    {...props} />;
    }
  };

  const meta        = SIM_META[activeSimulation];
  const progressPct = maxSteps > 0 ? (currentStep / maxSteps) * 100 : 0;

  return (
    <>
      {/* ── Prompt Overlay ────────────────────────────────────── */}
      {!isSimulationActive && (
        <div className="prompt-overlay">
          <p className="prompt-subtitle">OS Memory Management</p>

          <h1 className="prompt-title">
            {activeSimulation === 'TLB' ? (
              <>
                <span className="word-tlb">TLB</span>{' '}
                <span className="word-sim">Simulation</span>
              </>
            ) : (
              <span style={{ color: meta.accent }}>{meta.label}</span>
            )}
          </h1>

          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
            maxWidth: '400px',
            lineHeight: 1.7,
            position: 'relative',
          }}>
            {activeSimulation === 'TLB' &&
              'Step through how a CPU uses the TLB to accelerate virtual-to-physical address translation.'}
            {activeSimulation === 'Paging' &&
              'Visualise how the OS splits logical addresses into page numbers and offsets.'}
            {activeSimulation === 'Cache' &&
              'Watch the CPU exploit cache locality — hits, misses, and eviction policies.'}
          </p>

          <div
            className="prompt-cta"
            onClick={() => setIsSimulationActive(true)}
          >
            Press Enter to start simulation
          </div>
        </div>
      )}

      {/* ── Overlay to close menu on outside click ─────────── */}
      {isMenuOpen && (
        <div className="menu-overlay" onClick={() => setIsMenuOpen(false)} />
      )}

      {/* ── Header ────────────────────────────────────────────── */}
      <header>
        <h1 
          key={activeSimulation}
          style={{ '--header-accent': meta.accent }}
        >
          {meta.label}
        </h1>

        {isSimulationActive && (
          <span className="step-counter">
            {currentStep} / {maxSteps}
          </span>
        )}

        <SideMenu
          isOpen={isMenuOpen}
          toggleMenu={() => setIsMenuOpen(prev => !prev)}
          setActiveSimulation={handleSetSimulation}
          activeSimulation={activeSimulation}
        />
      </header>

      {/* ── Stage ─────────────────────────────────────────────── */}
      <Stage>
        {/* Progress bar at top of stage */}
        {isSimulationActive && (
          <div className="progress-bar-wrap">
            <div
              className="progress-bar-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}

        {renderSimulation()}

        {/* Navigation hint */}
        {isSimulationActive && (
          <div className="nav-hint">
            <span className="key-badge">← PREV</span>
            <span>navigate steps</span>
            <span className="key-badge">NEXT →</span>
          </div>
        )}
      </Stage>
    </>
  );
}

export default App;