import React, { useRef, useState, useEffect } from 'react';
import Popup from '../components/Popup';

/**
 * Cache Memory Simulation — Full Step Walkthrough
 *
 * Step 0  : Idle
 * Step 1  : Theory — What is Cache?
 * Step 2  : Theory — Hit vs Miss, LRU vs FIFO
 * Step 3  : Input — Pick cache policy (LRU / FIFO toggle)
 * Step 4  : CPU requests Block A → Cache MISS
 * Step 5  : CPU requests Block B → Cache MISS
 * Step 6  : CPU requests Block C → Cache MISS (cache now full) + Block A hit
 * Step 7  : CPU requests Block D → Cache MISS + Eviction (policy-dependent)
 * Step 8  : Hit Ratio calculation (formula)
 */

const CACHE_SLOTS = 3;

/* All requests in order */
const REQUESTS = [
  { id: 1, block: 'A', hit: false },
  { id: 2, block: 'B', hit: false },
  { id: 3, block: 'C', hit: false },
  { id: 4, block: 'A', hit: true },
  { id: 5, block: 'D', hit: false },
];

/* Block color map for visual distinction */
const BLOCK_COLORS = {
  A: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.5)', text: '#f59e0b' },
  B: { bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.5)', text: '#8b5cf6' },
  C: { bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.5)', text: '#0ea5e9' },
  D: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.5)', text: '#10b981' },
};

/* Derive cache state after N requests using specified policy */
function getCacheState(upToStep, policy) {
  const slots = []; // [{block, lruTime, insertOrder}]
  let time = 0;
  let insertCounter = 0;
  let evictedBlock = null;

  for (let i = 0; i < upToStep && i < REQUESTS.length; i++) {
    const req = REQUESTS[i];
    time++;
    const idx = slots.findIndex(s => s.block === req.block);
    if (idx !== -1) {
      // HIT — update LRU time
      slots[idx].lruTime = time;
      evictedBlock = null;
    } else {
      // MISS — evict if full
      if (slots.length >= CACHE_SLOTS) {
        let evictIdx;
        if (policy === 'FIFO') {
          // FIFO: evict the one inserted first
          evictIdx = slots.reduce(
            (min, s, i) => s.insertOrder < slots[min].insertOrder ? i : min, 0
          );
        } else {
          // LRU: evict the one used least recently
          evictIdx = slots.reduce(
            (min, s, i) => s.lruTime < slots[min].lruTime ? i : min, 0
          );
        }
        evictedBlock = slots[evictIdx].block;
        slots.splice(evictIdx, 1);
      } else {
        evictedBlock = null;
      }
      insertCounter++;
      slots.push({ block: req.block, lruTime: time, insertOrder: insertCounter });
    }
  }
  return { slots, evictedBlock };
}

export default function Cache({ currentStep, setMaxSteps }) {
  const cpuRef = useRef(null);
  const cacheRef = useRef(null);
  const ramRef = useRef(null);

  const [cachePolicy, setCachePolicy] = useState('LRU');
  const [showFormula, setShowFormula] = useState(false);
  const [showVarChips, setShowVarChips] = useState(false);

  useEffect(() => { setMaxSteps(7); }, [setMaxSteps]);

  // Formula animation at step 7
  useEffect(() => {
    if (currentStep === 7) {
      setShowVarChips(true);
      setShowFormula(false);
      const timer = setTimeout(() => {
        setShowVarChips(false);
        setShowFormula(true);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setShowVarChips(false);
      setShowFormula(false);
    }
  }, [currentStep]);

  /* Derive visible requests up to current step */
  const simStep = Math.max(0, currentStep - 2); // simulation starts at step 3
  const visibleRequests = REQUESTS.slice(0, Math.min(simStep, REQUESTS.length));
  const { slots: cacheState, evictedBlock } = getCacheState(
    Math.min(simStep, REQUESTS.length), cachePolicy
  );
  const currentReq = simStep >= 1 && simStep <= 5
    ? REQUESTS[simStep - 1]
    : null;

  /* Score tally */
  const hits = visibleRequests.filter(r => r.hit).length;
  const misses = visibleRequests.filter(r => !r.hit).length;
  const total = visibleRequests.length;
  const H = total > 0 ? (hits / total) : 0;
  const C = 10;   // cache time ns
  const M_val = 100;  // memory time ns

  /* ── Popup config per step ── */
  const popups = {
    3: {
      text: 'CPU requests Block A. The Cache is empty — Cache MISS! The CPU must fetch Block A from slow RAM and copy it into the Cache.',
      formula: `Miss Path: RAM access = M = ${M_val}ns`,
      targetRef: cacheRef,
      position: 'bottom',
      theme: 'cpu',
      stepLabel: 'Step 3 — Cache Miss (A)',
    },
    4: {
      text: 'CPU requests Block B. Not in Cache — another Miss! Block B is fetched from RAM and loaded into a second Cache slot.',
      formula: `Miss Path: RAM access = M = ${M_val}ns`,
      targetRef: cacheRef,
      position: 'bottom',
      theme: 'cpu',
      stepLabel: 'Step 4 — Cache Miss (B)',
    },
    5: {
      text: 'CPU requests Block C (Miss → Cache full). Then Block A is requested again — Cache HIT! Data is returned instantly without touching RAM.',
      formula: `Hit Path: Cache access = C = ${C}ns  (10× faster!)`,
      targetRef: cacheRef,
      position: 'bottom',
      theme: 'ram',
      stepLabel: 'Step 5 — Cache Full + Hit (A)',
    },
    6: {
      text: `CPU requests Block D. Cache is full! ${cachePolicy} policy decides which block to evict: ${evictedBlock ? `Block ${evictedBlock}` : 'the oldest block'} is removed. Block D is loaded from RAM.`,
      formula: `${cachePolicy} Evict: ${evictedBlock || '?'} removed → D inserted`,
      targetRef: cacheRef,
      position: 'bottom',
      theme: 'pt',
      stepLabel: `Step 6 — ${cachePolicy} Eviction (D)`,
    },
    7: {
      text: `Simulation complete. We had ${hits} Hit(s) and ${misses} Miss(es) across ${total} requests.`,
      formula: `H = Hits / Total = ${hits} / ${total} = ${H.toFixed(2)}`,
      targetRef: cpuRef,
      position: 'right',
      theme: 'tlb',
      stepLabel: 'Step 7 — Hit Ratio',
    },
  };

  const activePopup = popups[currentStep] ?? {};

  return (
    <>
      {/* Step label */}
      {currentStep >= 0 && (
        <div className="step-label animate-in">
          {currentStep <= 1 ? `Step ${currentStep} — Theory` :
            currentStep === 2 ? 'Step 2 — Choose Policy' :
              activePopup.stepLabel ?? `Step ${currentStep}`}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          THEORY CARDS (Steps 0-1)
      ══════════════════════════════════════════════════════ */}
      <div className={`theory-card ${currentStep === 0 ? 'show' : ''}`}>
        <div className="theory-icon">⚡</div>
        <h2>What is Cache Memory?</h2>
        <p className="theory-text">
          The CPU is millions of times faster than Main Memory (RAM). If the CPU has to wait
          for RAM every time it needs data, the whole computer crawls. A <strong>Cache</strong> is
          a tiny, expensive memory built into the CPU to hold the most frequently used data.
        </p>
        <div className="theory-analogy">
          <strong>📌 Analogy:</strong> You are a chef (CPU). The Cache is a <strong>tiny spice
            rack right next to your cutting board</strong>. RAM is the giant basement pantry. If you
          need salt, grabbing it from the spice rack takes 1 second (<strong>Cache Hit</strong>).
          If you need saffron and it's not on the rack, you have to walk all the way to the
          basement — that takes 5 minutes (<strong>Cache Miss</strong>).
        </div>
      </div>

      <div className={`theory-card ${currentStep === 1 ? 'show' : ''}`}>
        <div className="theory-icon">🔄</div>
        <h2>Eviction Policies: LRU vs FIFO</h2>
        <p className="theory-text">
          When the Cache is full and a new block arrives, we must <strong>evict</strong> one block.
          Two common policies decide which block to remove:
        </p>
        <div className="theory-analogy">
          <strong>🔵 LRU (Least Recently Used):</strong> Evict the block that hasn't been
          accessed for the longest time. If you haven't used salt in 3 hours, it goes back to
          the basement.
          <br /><br />
          <strong>🟢 FIFO (First In, First Out):</strong> Evict the block that was loaded
          <strong> earliest</strong>, regardless of usage. The first spice you put on the rack
          is the first one removed — like a queue.
          <br /><br />
          LRU tends to perform better for most workloads because it keeps "hot" data,
          but FIFO is simpler to implement in hardware.
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          POLICY SELECTION (Step 2)
      ══════════════════════════════════════════════════════ */}
      {currentStep === 2 && (
        <div className="theory-card show" style={{
          maxWidth: '400px',
          padding: '30px 36px',
        }}>
          <div className="theory-icon">⚙️</div>
          <h2>Choose Cache Policy</h2>
          <p className="theory-text" style={{ marginBottom: '16px' }}>
            Select an eviction policy and press → to start the simulation.
          </p>
          <div className="cache-mode-switch">
            <button
              className={cachePolicy === 'LRU' ? 'active' : ''}
              onClick={() => setCachePolicy('LRU')}
            >
              LRU
            </button>
            <button
              className={cachePolicy === 'FIFO' ? 'active' : ''}
              onClick={() => setCachePolicy('FIFO')}
            >
              FIFO
            </button>
          </div>
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
            marginTop: '12px',
          }}>
            Selected: <strong style={{ color: 'var(--tlb-main)' }}>{cachePolicy}</strong>
          </p>
        </div>
      )}

      {/* ── Connection Lines ───────────────────────────────── */}

      {/* CPU → Cache  (amber, always once active) */}
      {currentStep >= 3 && currentStep <= 6 && (
        <div className="connect-line amber" style={{
          top: '20%', left: '19%', width: '14%',
        }} />
      )}

      {/* Cache → RAM  (miss = sky) */}
      {currentStep >= 3 && currentStep <= 6 && currentReq && !currentReq.hit && (
        <div className="connect-line sky" style={{
          top: '20%', left: '55%', width: '14%',
        }} />
      )}

      {/* RAM → Cache  return line on miss */}
      {currentStep >= 3 && currentStep <= 6 && currentReq && !currentReq.hit && (
        <div style={{
          position: 'absolute',
          top: '29%', left: '55%', width: '14%',
          height: '2px',
          background: 'linear-gradient(270deg, var(--pt-main), rgba(14,165,233,0.3))',
          boxShadow: '0 0 8px var(--pt-glow)',
          zIndex: 1,
        }} />
      )}

      {/* Hit path — green pulse */}
      {currentReq?.hit && (
        <div className="connect-line green" style={{
          top: '20%', left: '19%', width: '14%',
        }} />
      )}

      {/* ══════════════════════════════════════════════════════
          CPU BOX
      ══════════════════════════════════════════════════════ */}
      {currentStep >= 3 && (
        <div
          ref={cpuRef}
          className={`entity-box entity-cpu ${currentStep >= 3 && currentStep <= 6 ? 'active' : ''}`}
          style={{ top: '10%', left: '2%', width: '175px', minHeight: '180px' }}
        >
          <span className="entity-icon">🖥️</span>
          <span className="entity-label">CPU</span>
          <span className="entity-sub">Requesting Data</span>

          {/* Current request display */}
          {currentReq && (
            <div style={{
              marginTop: '10px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: BLOCK_COLORS[currentReq.block]?.bg,
              border: `1px solid ${BLOCK_COLORS[currentReq.block]?.border}`,
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: BLOCK_COLORS[currentReq.block]?.text,
              textAlign: 'center',
              width: '100%',
              animation: 'fade-up 0.3s ease',
            }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                REQUESTING
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: '700' }}>
                Block {currentReq.block}
              </div>
            </div>
          )}

          {/* HIT / MISS inline badge */}
          {currentReq && (
            <div style={{
              marginTop: '8px',
              padding: '5px 14px',
              borderRadius: '20px',
              fontFamily: 'var(--font-display)',
              fontSize: '0.7rem',
              fontWeight: '700',
              letterSpacing: '2px',
              background: currentReq.hit ? 'var(--hit-color)' : 'var(--miss-color)',
              color: 'white',
              boxShadow: currentReq.hit
                ? '0 4px 12px rgba(16,185,129,0.4)'
                : '0 4px 12px rgba(239,68,68,0.4)',
              animation: 'fade-up 0.3s ease',
            }}>
              {currentReq.hit ? '✓ HIT' : '✗ MISS'}
            </div>
          )}

          {/* Score tally */}
          {currentStep >= 3 && (
            <div style={{
              marginTop: '8px',
              display: 'flex',
              gap: '6px',
              width: '100%',
              justifyContent: 'center',
            }}>
              <span style={{
                padding: '3px 10px',
                borderRadius: '12px',
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid var(--ram-border)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                color: 'var(--hit-color)',
              }}>
                {hits}H
              </span>
              <span style={{
                padding: '3px 10px',
                borderRadius: '12px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.4)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                color: 'var(--miss-color)',
              }}>
                {misses}M
              </span>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          CACHE BOX
      ══════════════════════════════════════════════════════ */}
      {currentStep >= 3 && (
        <div
          ref={cacheRef}
          className={`entity-box entity-tlb ${currentStep >= 3 ? 'active' : ''}`}
          style={{ top: '6%', left: '30%', width: '240px', minHeight: '260px' }}
        >
          <span className="entity-icon">⚡</span>
          <span className="entity-label">Cache</span>
          <span className="entity-sub">{CACHE_SLOTS} Slots — Ultra-Fast Memory</span>

          {/* Cache slots */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginTop: '12px',
            width: '100%',
          }}>
            {Array.from({ length: CACHE_SLOTS }, (_, i) => {
              const slot = cacheState[i];
              const isEvicted = evictedBlock && simStep === REQUESTS.length &&
                currentReq?.evicts === slot?.block;
              const isNewlyLoaded = slot && !currentReq?.hit &&
                currentReq?.block === slot.block;
              const colors = slot ? BLOCK_COLORS[slot.block] : null;

              return (
                <div key={i} style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: slot ? colors.bg : 'var(--bg-secondary)',
                  border: `1px solid ${slot ? colors.border : 'var(--border-soft)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.4s ease',
                  boxShadow: isNewlyLoaded
                    ? `0 0 14px ${colors?.border}`
                    : 'none',
                  opacity: isEvicted ? 0.3 : 1,
                }}>
                  {/* Slot number */}
                  <div style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: slot ? colors.border : 'var(--border-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.65rem',
                    color: 'white',
                    flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>

                  {slot ? (
                    <>
                      <div style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        color: colors.text,
                        letterSpacing: '1px',
                      }}>
                        Block {slot.block}
                      </div>
                      {/* LRU time / insert order indicator */}
                      <div style={{
                        marginLeft: 'auto',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.6rem',
                        color: 'var(--text-muted)',
                      }}>
                        {cachePolicy === 'LRU' ? `t=${slot.lruTime}` : `#${slot.insertOrder}`}
                      </div>
                    </>
                  ) : (
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      letterSpacing: '2px',
                    }}>
                      — empty —
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Policy badge + cache access time */}
          <div style={{
            marginTop: '10px',
            display: 'flex',
            gap: '6px',
            width: '100%',
            justifyContent: 'center',
          }}>
            <div style={{
              padding: '4px 10px',
              borderRadius: '20px',
              background: 'var(--tlb-bg)',
              border: '1px solid var(--tlb-border)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: 'var(--tlb-main)',
            }}>
              {cachePolicy}
            </div>
            <div style={{
              padding: '4px 10px',
              borderRadius: '20px',
              background: 'var(--tlb-bg)',
              border: '1px solid var(--tlb-border)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: 'var(--tlb-main)',
            }}>
              C = {C}ns
            </div>
          </div>

          {/* Policy toggle switch */}
          <div className="cache-mode-switch" style={{ marginTop: '8px' }}>
            <button
              className={cachePolicy === 'LRU' ? 'active' : ''}
              onClick={() => setCachePolicy('LRU')}
            >
              LRU
            </button>
            <button
              className={cachePolicy === 'FIFO' ? 'active' : ''}
              onClick={() => setCachePolicy('FIFO')}
            >
              FIFO
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          RAM BOX
      ══════════════════════════════════════════════════════ */}
      {currentStep >= 3 && (
        <div
          ref={ramRef}
          className={`entity-box entity-ram ${currentReq && !currentReq.hit ? 'active' : ''}`}
          style={{ top: '6%', left: '68%', width: '220px', minHeight: '260px' }}
        >
          <span className="entity-icon">🗄️</span>
          <span className="entity-label">Main RAM</span>
          <span className="entity-sub">Slow — Basement Pantry</span>

          {/* RAM blocks */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '6px',
            marginTop: '12px',
            width: '100%',
          }}>
            {['A', 'B', 'C', 'D'].map(block => {
              const colors = BLOCK_COLORS[block];
              const isBeingFetched = currentReq?.block === block && !currentReq.hit;
              return (
                <div key={block} style={{
                  padding: '12px 8px',
                  borderRadius: '8px',
                  background: isBeingFetched ? colors.bg : 'var(--bg-secondary)',
                  border: `1px solid ${isBeingFetched ? colors.border : 'var(--border-soft)'}`,
                  textAlign: 'center',
                  transition: 'all 0.4s ease',
                  boxShadow: isBeingFetched ? `0 0 12px ${colors.border}` : 'none',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1rem',
                    fontWeight: '700',
                    color: isBeingFetched ? colors.text : 'var(--text-muted)',
                    letterSpacing: '1px',
                    transition: 'color 0.3s',
                  }}>
                    Block {block}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.6rem',
                    color: 'var(--text-muted)',
                    marginTop: '2px',
                  }}>
                    {isBeingFetched ? 'fetching...' : 'stored'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* RAM access time badge */}
          <div style={{
            marginTop: '10px',
            padding: '5px 12px',
            borderRadius: '20px',
            background: 'var(--ram-bg)',
            border: '1px solid var(--ram-border)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            color: 'var(--ram-main)',
          }}>
            Access Time: M = {M_val}ns
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          REQUEST HISTORY LOG (bottom-left)
      ══════════════════════════════════════════════════════ */}
      {currentStep >= 3 && visibleRequests.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '70px',
          left: '2%',
          width: '175px',
          background: 'var(--surface)',
          border: '1px solid var(--border-soft)',
          borderRadius: '12px',
          padding: '12px',
          boxShadow: 'var(--shadow-sm)',
          zIndex: 10,
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.6rem',
            letterSpacing: '2px',
            color: 'var(--text-muted)',
            marginBottom: '8px',
            textTransform: 'uppercase',
          }}>
            Request Log
          </div>
          {visibleRequests.map((req, i) => (
            <div key={req.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 6px',
              borderRadius: '6px',
              marginBottom: '4px',
              background: i === simStep - 1
                ? (req.hit ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)')
                : 'transparent',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.65rem',
                color: 'var(--text-muted)',
              }}>
                #{req.id}
              </span>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.75rem',
                fontWeight: '700',
                color: BLOCK_COLORS[req.block]?.text,
              }}>
                Block {req.block}
              </span>
              <span style={{
                marginLeft: 'auto',
                fontFamily: 'var(--font-display)',
                fontSize: '0.6rem',
                fontWeight: '700',
                color: req.hit ? 'var(--hit-color)' : 'var(--miss-color)',
              }}>
                {req.hit ? 'HIT' : 'MISS'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          FLOATING VARIABLE CHIPS — Step 7 (fly to center)
      ══════════════════════════════════════════════════════ */}
      {showVarChips && (
        <>
          <div className="floating-value violet" style={{
            top: '8%', left: '8%',
            animation: 'flyToCenter 0.8s var(--ease-snap) forwards',
          }}>
            H = {H.toFixed(2)}
          </div>
          <div className="floating-value amber" style={{
            top: '8%', right: '8%',
            animation: 'flyToCenter 0.8s var(--ease-snap) 0.1s forwards',
          }}>
            C = {C}ns
          </div>
          <div className="floating-value green" style={{
            bottom: '30%', left: '50%',
            animation: 'flyToCenter 0.8s var(--ease-snap) 0.2s forwards',
          }}>
            M = {M_val}ns
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          HIT RATIO FORMULA BOX — Step 7
      ══════════════════════════════════════════════════════ */}
      <div
        className={`eat-formula-box ${showFormula ? 'show' : ''}`}
        style={{
          borderColor: 'rgba(139,92,246,0.4)',
          boxShadow: '0 0 60px var(--tlb-glow)',
        }}
      >
        <h3 style={{ color: 'var(--tlb-main)' }}>Cache Performance Summary</h3>

        <div className="formula-line">
          <span className="var-green">Hits</span> = {hits} &nbsp;|&nbsp;
          <span className="var-amber">Misses</span> = {misses} &nbsp;|&nbsp;
          Total = {total}
        </div>

        <div className="formula-line">
          <span className="var-violet">H</span> = Hits ÷ Total ={' '}
          {hits} ÷ {total} ={' '}
          <strong style={{ color: 'var(--tlb-main)' }}>{H.toFixed(2)}</strong>
        </div>

        <div className="formula-line">
          Avg Access Time = <span className="var-violet">H</span>×
          <span className="var-amber">C</span> + (1−
          <span className="var-violet">H</span>)×
          <span className="var-green">M</span>
        </div>

        <div className="formula-line" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          = {H.toFixed(2)}×{C} + {(1 - H).toFixed(2)}×{M_val}
        </div>

        <div className="formula-result" style={{ color: 'var(--tlb-main)' }}>
          = {(H * C + (1 - H) * M_val).toFixed(1)} ns
        </div>

        <div style={{
          marginTop: '14px',
          padding: '10px 14px',
          borderRadius: '8px',
          background: 'rgba(139,92,246,0.08)',
          border: '1px solid var(--tlb-border)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.78rem',
          color: 'var(--tlb-main)',
          lineHeight: 1.6,
        }}>
          Policy: <strong>{cachePolicy}</strong> |
          A perfect Cache (H=1.0) would give <strong>{C}ns</strong> always.
          Improving hit ratio is key to faster CPUs.
        </div>
      </div>

      {/* ── Popup ─────────────────────────────────────────── */}
      <Popup
        visible={currentStep >= 3 && currentStep <= 6 && !!activePopup.text}
        text={activePopup.text}
        formula={activePopup.formula}
        targetRef={activePopup.targetRef}
        position={activePopup.position}
        theme={activePopup.theme}
        stepLabel={activePopup.stepLabel}
      />
    </>
  );
}