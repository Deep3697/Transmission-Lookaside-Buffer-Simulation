import React, { useRef, useState, useEffect } from 'react';
import Popup from '../components/Popup';

/**
 * TLB Simulation — Full Step Walkthrough
 *
 * Step 0  : Idle
 * Step 1  : Theory — What is a TLB?
 * Step 2  : Theory — Why does TLB exist?
 * Step 3  : Input  — User enters Page Number & Offset
 * Step 4  : CPU generates logical address (values float to CPU chip)
 * Step 5  : CPU → TLB check (TLB MISS, empty)
 * Step 6  : Miss path → Page Table lookup (row highlights, frame found)
 * Step 7  : Page Table → TLB update (entry floats into TLB)
 * Step 8  : Second request — TLB HIT
 * Step 9  : TLB → RAM access (physical address)
 * Step 10 : EAT formula — variables fly to center, formula calculates
 */

const H = 0.8;
const C = 10;
const M = 100;

/* Pre-filled Page Table rows — frame for user's page is generated dynamically */
function buildPageTable(userPage, userFrame) {
  const base = [
    { page: 0, frame: 3 },
    { page: 1, frame: 7 },
    { page: 2, frame: 1 },
    { page: 3, frame: 9 },
    { page: 5, frame: 15 },
  ];
  // Insert user's page at the correct sorted position
  const rows = [...base, { page: userPage, frame: userFrame }];
  rows.sort((a, b) => a.page - b.page);
  return rows;
}

export default function TLB({ currentStep, setMaxSteps }) {
  const cpuRef = useRef(null);
  const tlbRef = useRef(null);
  const ptRef = useRef(null);
  const ramRef = useRef(null);

  // User input state
  const [pageInput, setPageInput] = useState('');
  const [offsetInput, setOffsetInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [pageNum, setPageNum] = useState(4);
  const [offset, setOffset] = useState(196);
  const [frameNum, setFrameNum] = useState(12);

  const [tlbEntry, setTlbEntry] = useState(null);
  const [showFormula, setShowFormula] = useState(false);
  const [showVarChips, setShowVarChips] = useState(false);

  useEffect(() => { setMaxSteps(9); }, [setMaxSteps]);

  /* populate TLB entry after step 6 */
  useEffect(() => {
    if (currentStep >= 6) setTlbEntry({ page: pageNum, frame: frameNum });
    else setTlbEntry(null);
  }, [currentStep, pageNum, frameNum]);

  /* EAT animation: show chips first, then formula */
  useEffect(() => {
    if (currentStep === 9) {
      setShowVarChips(true);
      setShowFormula(false);
      const timer = setTimeout(() => {
        setShowVarChips(false);
        setShowFormula(true);
      }, 1200);
      return () => clearTimeout(timer);
    } else {
      setShowVarChips(false);
      setShowFormula(false);
    }
  }, [currentStep]);

  const handleSubmit = () => {
    const p = parseInt(pageInput, 10);
    const d = parseInt(offsetInput, 10);
    if (!isNaN(p) && p >= 0 && !isNaN(d) && d >= 0) {
      setPageNum(p);
      setOffset(d);
      // Generate a pseudo-random frame number based on page
      setFrameNum(((p * 7 + 3) % 20));
      setSubmitted(true);
    }
  };

  const PAGE_TABLE = buildPageTable(pageNum, frameNum);
  const logicalAddr = pageNum * 1000 + offset;
  const physAddr = frameNum * 1000 + offset;

  /* ── Popup config per step ── */
  const popups = {
    3: { text: `The CPU needs data at logical address ${logicalAddr}. It splits this into Page Number (p = ${pageNum}) and Offset (d = ${offset}).`, formula: `Logical Address = (p × Page Size) + d  →  ${pageNum}×1000 + ${offset} = ${logicalAddr}`, targetRef: cpuRef, position: 'right', theme: 'cpu', stepLabel: 'Step 3 — CPU Generates Address' },
    4: { text: `The CPU first checks the TLB — a tiny high-speed cache that holds recent Page→Frame translations. TLB access takes only C = ${C}ns.`, formula: `TLB Access Time = C = ${C} ns`, targetRef: tlbRef, position: 'bottom', theme: 'tlb', stepLabel: 'Step 4 — TLB Check' },
    5: { text: `Page ${pageNum} is NOT in the TLB — TLB MISS! The CPU must walk all the way to the Page Table stored in Main Memory. This costs an extra M = ${M}ns.`, formula: `Miss Penalty = C + M = ${C} + ${M} = ${C + M} ns`, targetRef: ptRef, position: 'right', theme: 'pt', stepLabel: 'Step 5 — TLB Miss → Page Table' },
    6: { text: `The Page Table reveals that Page ${pageNum} lives in Frame ${frameNum}. This mapping is immediately written back into the TLB for future use.`, formula: `TLB ← [Page ${pageNum} → Frame ${frameNum}]`, targetRef: tlbRef, position: 'bottom', theme: 'tlb', stepLabel: 'Step 6 — TLB Update' },
    7: { text: `The CPU requests Page ${pageNum} again. This time the TLB already has the mapping — TLB HIT! No trip to the Page Table needed.`, formula: `Hit Path Cost = C + M = ${C} + ${M} = ${C + M} ns`, targetRef: tlbRef, position: 'bottom', theme: 'tlb', stepLabel: 'Step 7 — TLB Hit' },
    8: { text: `Frame ${frameNum} is now known. The CPU accesses Physical RAM directly at address (${frameNum} × 1000) + ${offset} = ${physAddr}.`, formula: `Physical Address = (f × Page Size) + d = ${physAddr}`, targetRef: ramRef, position: 'left', theme: 'ram', stepLabel: 'Step 8 — RAM Access' },
  };

  const activePopup = popups[currentStep] ?? {};

  /* ── EAT calculation values ── */
  const hitPath = H * (C + M);
  const missPath = (1 - H) * (C + 2 * M);
  const eat = hitPath + missPath;

  return (
    <>
      {/* ── Step label strip ─────────────────────────────────── */}
      {currentStep >= 0 && (
        <div className="step-label animate-in">
          {currentStep <= 1 ? `Step ${currentStep} — Theory` :
            currentStep === 2 ? 'Step 2 — Your Input' :
              activePopup.stepLabel ?? `Step ${currentStep}`}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          THEORY CARDS (Steps 0-1)
      ══════════════════════════════════════════════════════ */}
      <div className={`theory-card ${currentStep === 0 ? 'show' : ''}`}>
        <div className="theory-icon">🧠</div>
        <h2>What is a TLB?</h2>
        <p className="theory-text">
          The <strong>Translation Lookaside Buffer (TLB)</strong> is a tiny, ultra-fast cache
          built into the CPU. It stores recent <em>Page→Frame</em> translations so that the
          CPU can skip the slow Page Table lookup most of the time.
        </p>
        <div className="theory-analogy">
          <strong>📌 Analogy:</strong> Think of the giant Page Table as the Master Index Catalog
          at the front desk of a massive library. Walking there to find every single book takes hours.
          The TLB is a <strong>small sticky note you keep in your pocket</strong>. If you need a
          Biology book, you check your sticky note first. If it's blank (TLB Miss), you walk to the
          front desk. But once you find out Biology is on Floor 3, you write it on your sticky note.
          Next time, you just read the note and go straight to Floor 3 (TLB Hit)!
        </div>
      </div>

      <div className={`theory-card ${currentStep === 1 ? 'show' : ''}`}>
        <div className="theory-icon">⚡</div>
        <h2>Why Does the TLB Exist?</h2>
        <p className="theory-text">
          Every memory access requires <strong>address translation</strong> — converting a virtual
          address to a physical one using the Page Table. But the Page Table itself is stored in
          <strong> Main Memory (RAM)</strong>, which is slow!
        </p>
        <div className="theory-analogy">
          <strong>🔑 Key Insight:</strong> Without the TLB, every single memory access would require
          <strong> TWO trips to RAM</strong> — one to read the Page Table, and another to fetch the
          actual data. The TLB eliminates the first trip for frequently accessed pages, nearly
          <strong> doubling memory speed</strong>.
          <br /><br />
          We measure this speedup with the <strong>Effective Access Time (EAT)</strong> formula:
          <br />
          <code>EAT = H×(C+M) + (1-H)×(C+2M)</code>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          CONNECTION LINES (Steps 3+)
      ══════════════════════════════════════════════════════ */}

      {/* CPU → TLB  (amber) */}
      {currentStep >= 4 && currentStep <= 8 && (
        <div className="connect-line amber" style={{
          top: '18%', left: '17%', width: '11%',
        }} />
      )}

      {/* TLB → Page Table (dashed miss) */}
      {currentStep >= 5 && currentStep <= 6 && (
        <div className="connect-line sky" style={{
          top: '38%', left: '34%', width: '0',
          height: '50px',
          background: 'none',
          borderLeft: '2px dashed var(--miss-color)',
          boxShadow: 'none',
        }} />
      )}

      {/* TLB → RAM  (violet) */}
      {currentStep >= 8 && (
        <div className="connect-line violet" style={{
          top: '18%', left: '50%', width: '18%',
        }} />
      )}

      {/* ══════════════════════════════════════════════════════
          ENTITY BOXES (Steps 2+)
      ══════════════════════════════════════════════════════ */}

      {/* CPU */}
      {currentStep >= 2 && (
        <div
          ref={cpuRef}
          className={`entity-box entity-cpu ${currentStep >= 3 && currentStep <= 4 ? 'active' : ''}`}
          style={{ top: '10%', left: '3%', width: '160px', minHeight: '130px' }}
        >
          <span className="entity-icon">🖥️</span>
          <span className="entity-label">CPU</span>
          <span className="entity-sub">Processor</span>

          {/* Input phase — step 2 */}
          {currentStep === 2 && !submitted && (
            <div className="user-input-group">
              <label>Page Number</label>
              <input
                type="number"
                min="0"
                max="20"
                placeholder="e.g. 4"
                value={pageInput}
                onChange={e => setPageInput(e.target.value)}
              />
              <label>Offset</label>
              <input
                type="number"
                min="0"
                max="999"
                placeholder="e.g. 196"
                value={offsetInput}
                onChange={e => setOffsetInput(e.target.value)}
              />
              <button className="submit-btn" onClick={handleSubmit}>
                Submit →
              </button>
            </div>
          )}

          {/* Show values after submit */}
          {(submitted && currentStep >= 2) && (
            <div style={{
              marginTop: '10px',
              padding: '6px 10px',
              borderRadius: '6px',
              background: 'var(--cpu-bg)',
              border: '1px solid var(--cpu-border)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              color: 'var(--cpu-main)',
              textAlign: 'center',
              width: '100%',
              animation: currentStep === 3 ? 'fade-up 0.5s ease' : 'none',
            }}>
              <div>p = <strong>{pageNum}</strong></div>
              <div>d = <strong>{offset}</strong></div>
            </div>
          )}
        </div>
      )}

      {/* TLB */}
      {currentStep >= 2 && (
        <div
          ref={tlbRef}
          className={`entity-box entity-tlb ${(currentStep === 4 || currentStep === 6 || currentStep === 7) ? 'active' : ''}`}
          style={{ top: '6%', left: '24%', width: '210px', minHeight: '180px' }}
        >
          {/* HIT badge */}
          <div className={`hit-badge hit ${currentStep === 7 ? 'show' : ''}`}>
            ✓ TLB HIT
          </div>
          {/* MISS badge */}
          <div className={`hit-badge miss ${currentStep === 4 || currentStep === 5 ? 'show' : ''}`}
            style={{ top: '-16px' }}>
            ✗ TLB MISS
          </div>

          <span className="entity-icon">⚡</span>
          <span className="entity-label">TLB</span>
          <span className="entity-sub">Translation Lookaside Buffer</span>

          {/* TLB table */}
          <table className="tlb-table" style={{ marginTop: '8px' }}>
            <thead>
              <tr>
                <th>PAGE</th>
                <th>FRAME</th>
              </tr>
            </thead>
            <tbody>
              {tlbEntry ? (
                <tr className="highlight" style={{ animation: 'fade-up 0.4s ease' }}>
                  <td>{tlbEntry.page}</td>
                  <td>{tlbEntry.frame}</td>
                </tr>
              ) : (
                <>
                  <tr><td>—</td><td>—</td></tr>
                  <tr><td>—</td><td>—</td></tr>
                  <tr><td>—</td><td>—</td></tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Page Table */}
      {currentStep >= 2 && (
        <div
          ref={ptRef}
          className={`entity-box entity-pt ${currentStep === 5 || currentStep === 6 ? 'active' : ''}`}
          style={{
            top: '48%', left: '20%', width: '230px', minHeight: '220px',
            opacity: currentStep >= 8 ? 0.4 : 1,
            transition: 'opacity 0.5s ease, all 0.4s var(--ease-snap)',
          }}
        >
          <span className="entity-icon">📋</span>
          <span className="entity-label">Page Table</span>
          <span className="entity-sub">Stored in Main Memory</span>

          <table className="pt-table" style={{ marginTop: '8px' }}>
            <thead>
              <tr>
                <th>PAGE</th>
                <th>FRAME</th>
                <th>VALID</th>
              </tr>
            </thead>
            <tbody>
              {PAGE_TABLE.map(row => (
                <tr key={row.page} className={row.page === pageNum && currentStep >= 5 ? 'highlight' : ''}>
                  <td>{row.page}</td>
                  <td>{row.frame}</td>
                  <td style={{ color: 'var(--hit-color)' }}>✓</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* RAM */}
      {currentStep >= 2 && (
        <div
          ref={ramRef}
          className={`entity-box entity-ram ${currentStep === 8 ? 'active' : ''}`}
          style={{ top: '6%', left: '72%', width: '210px', minHeight: '260px' }}
        >
          <span className="entity-icon">🗄️</span>
          <span className="entity-label">Physical RAM</span>
          <span className="entity-sub">Main Memory — Frames</span>

          {/* Frame grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '4px',
            marginTop: '10px',
            width: '100%',
            padding: '0 4px',
          }}>
            {Array.from({ length: 18 }, (_, i) => (
              <div key={i} style={{
                padding: '4px 2px',
                borderRadius: '4px',
                background: i === frameNum && currentStep >= 8
                  ? 'var(--ram-main)'
                  : 'var(--ram-bg)',
                border: `1px solid ${i === frameNum ? 'var(--ram-border)' : 'transparent'}`,
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6rem',
                textAlign: 'center',
                color: i === frameNum && currentStep >= 8
                  ? 'white'
                  : 'var(--text-muted)',
                fontWeight: i === frameNum ? '700' : '400',
                transition: 'all 0.4s ease',
              }}>
                F{i}
              </div>
            ))}
          </div>

          {currentStep >= 8 && (
            <div style={{
              marginTop: '10px',
              padding: '6px 10px',
              borderRadius: '6px',
              background: 'var(--ram-bg)',
              border: '1px solid var(--ram-border)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              color: 'var(--ram-main)',
              textAlign: 'center',
              width: '100%',
              animation: 'fade-up 0.4s ease',
            }}>
              Addr: <strong>{physAddr}</strong>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          FLOATING VARIABLE CHIPS — Step 9 (fly to center)
      ══════════════════════════════════════════════════════ */}
      {showVarChips && (
        <>
          <div className="floating-value violet" style={{
            top: '8%', left: '8%',
            animation: 'flyToCenter 1s var(--ease-snap) forwards',
          }}>
            H = {H}
          </div>
          <div className="floating-value amber" style={{
            top: '8%', right: '8%',
            animation: 'flyToCenter 1s var(--ease-snap) 0.15s forwards',
          }}>
            C = {C}ns
          </div>
          <div className="floating-value green" style={{
            bottom: '20%', left: '50%',
            animation: 'flyToCenter 1s var(--ease-snap) 0.3s forwards',
          }}>
            M = {M}ns
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          EAT FORMULA BOX — Step 9 (after chips merge)
      ══════════════════════════════════════════════════════ */}
      <div className={`eat-formula-box ${showFormula ? 'show' : ''}`}>
        <h3>Effective Access Time (EAT)</h3>

        <div className="formula-line">
          EAT = <span className="var-violet">H</span> × (
          <span className="var-amber">C</span> +{' '}
          <span className="var-green">M</span>
          ) + (1 − <span className="var-violet">H</span>) × (
          <span className="var-amber">C</span> + 2
          <span className="var-green">M</span>)
        </div>

        <div className="formula-line" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Substituting:{' '}
          <span className="var-violet">H={H}</span>,{' '}
          <span className="var-amber">C={C}ns</span>,{' '}
          <span className="var-green">M={M}ns</span>
        </div>

        <div className="formula-line">
          <span style={{ color: 'var(--hit-color)' }}>
            Hit Path:  {H} × ({C} + {M}) = {hitPath}ns
          </span>
        </div>

        <div className="formula-line">
          <span style={{ color: 'var(--miss-color)' }}>
            Miss Path: {(1 - H).toFixed(1)} × ({C} + {2 * M}) = {missPath}ns
          </span>
        </div>

        <div className="formula-result">
          EAT = {eat} ns
        </div>

        <div style={{
          marginTop: '14px',
          padding: '10px 14px',
          borderRadius: '8px',
          background: 'rgba(139,92,246,0.1)',
          border: '1px solid var(--tlb-border)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.78rem',
          color: 'var(--tlb-main)',
          lineHeight: 1.6,
        }}>
          Without TLB every request costs C + 2M = <strong>{C + 2 * M}ns</strong>.
          The TLB reduces this to <strong>{eat}ns</strong> — a{' '}
          <strong style={{ color: 'var(--hit-color)' }}>
            {(((C + 2 * M - eat) / (C + 2 * M)) * 100).toFixed(0)}% speedup
          </strong>.
        </div>
      </div>

      {/* ── Popup ─────────────────────────────────────────────── */}
      <Popup
        visible={currentStep >= 3 && currentStep <= 8}
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