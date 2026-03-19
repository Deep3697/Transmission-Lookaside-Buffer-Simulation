import React from 'react';
import tlbImg from '../assets/tlb_3d.png';
import pagingImg from '../assets/paging_3d.png';
import cacheImg from '../assets/cache_3d.png';

/* Meta for each simulation — colors match index.css identities */
const SIM_META = {
  TLB: {
    id: 'TLB',
    title: 'TLB',
    subtitle: 'Translation Lookaside Buffer',
    image: tlbImg,
    accent: 'var(--tlb-main)',
  },
  Paging: {
    id: 'Paging',
    title: 'Paging',
    subtitle: 'Paging Simulation',
    image: pagingImg,
    accent: 'var(--pt-main)',
  },
  Cache: {
    id: 'Cache',
    title: 'Cache Memory',
    subtitle: 'Cache Memory',
    image: cacheImg,
    accent: 'var(--ram-main)',
  },
};

export default function SideMenu({
  isOpen,
  toggleMenu,
  setActiveSimulation,
  activeSimulation,
}) {
  const others = Object.values(SIM_META).filter(s => s.id !== activeSimulation);

  return (
    <div className="menu-container">
      {/* Trigger button */}
      <button
        className={`menu-trigger ${isOpen ? 'active' : ''}`}
        onClick={toggleMenu}
        aria-label="Toggle simulation menu"
        title="Switch simulation"
      >
        <span style={{ transform: 'rotate(90deg)', display: 'inline-block' }}>⋮</span>
      </button>

      {/* Large Selection Overlay */}
      <aside 
        className={`selection-overlay ${isOpen ? 'open' : ''}`}
        onClick={toggleMenu}
      >
        <div 
          className="selection-content"
          onClick={(e) => e.stopPropagation()}
        >
          {others.map((sim) => (
            <div
              key={sim.id}
              className="sim-selection-card"
              onClick={() => {
                setActiveSimulation(sim.id);
              }}
            >
              <div className="sim-image-box">
                <img src={sim.image} alt={sim.title} />
              </div>
              <h2 style={{ color: sim.accent }}>{sim.title}</h2>
              <p>{sim.subtitle}</p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}