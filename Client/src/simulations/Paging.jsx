import React, { useRef, useState, useEffect } from 'react';
import Popup from '../components/Popup';

/**
 * Paging Simulation — Full Step Walkthrough
 *
 * Step 0  : Idle
 * Step 1  : Theory — What is Paging?
 * Step 2  : Theory — The Page Table
 * Step 3  : Input — User enters Logical Address & Page Size
 * Step 4  : Address splits into Page Number + Offset (animated)
 * Step 5  : Page Table lookup — row highlights, Frame found
 * Step 6  : Frame number resolved — chip floats out
 * Step 7  : Physical address calculation (formula)
 * Step 8  : RAM access — frame lights up
 * Step 9  : Final summary
 */

function generatePageTable(userPage, userFrame, pageCount) {
  const rows = [];
  const usedFrames = new Set([userFrame]);
  for (let i = 0; i < pageCount; i++) {
    if (i === userPage) {
      rows.push({ page: i, frame: userFrame, valid: true });
    } else {
      let f;
      do { f = Math.floor(Math.random() * 20); } while (usedFrames.has(f));
      usedFrames.add(f);
      rows.push({ page: i, frame: f, valid: i !== pageCount - 1 });
    }
  }
  // Make last entry invalid if it's not the user's page
  if (rows.length > 0 && rows[rows.length - 1].page !== userPage) {
    rows[rows.length - 1].valid = false;
  }
  return rows;
}

export default function Paging({ currentStep, setMaxSteps }) {
  const cpuRef = useRef(null);
  const ptRef = useRef(null);
  const ramRef = useRef(null);

  // User input
  const [addrInput, setAddrInput] = useState('');
  const [pageSizeInput, setPageSizeInput] = useState('1000');
  const [submitted, setSubmitted] = useState(false);
  const [logicalAddr, setLogicalAddr] = useState(4196);
  const [pageSize, setPageSize] = useState(1000);
  const [pageNum, setPageNum] = useState(4);
  const [offset, setOffset] = useState(196);
  const [frameNum, setFrameNum] = useState(12);
  const [pageTable, setPageTable] = useState([]);

  const [showFormula, setShowFormula] = useState(false);
  const [showVarChips, setShowVarChips] = useState(false);

  useEffect(() => { setMaxSteps(8); }, [setMaxSteps]);

  // Formula animation at step 6
  useEffect(() => {
    if (currentStep === 6) {
      setShowVarChips(true);
      setShowFormula(false);
      const timer = setTimeout(() => {
        setShowVarChips(false);
        setShowFormula(true);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setShowVarChips(false);
      setShowFormula(currentStep >= 7);  // keep formula visible after step 6
    }
  }, [currentStep]);

  const handleSubmit = () => {
    const addr = parseInt(addrInput, 10);
    const ps = parseInt(pageSizeInput, 10);
    if (!isNaN(addr) && addr >= 0 && !isNaN(ps) && ps > 0) {
      const p = Math.floor(addr / ps);
      const d = addr % ps;
      const f = ((p * 7 + 3) % 20); // deterministic frame
      setLogicalAddr(addr);
      setPageSize(ps);
      setPageNum(p);
      setOffset(d);
      setFrameNum(f);
      setPageTable(generatePageTable(p, f, Math.max(p + 2, 7)));
      setSubmitted(true);
    }
  };

  const physAddr = frameNum * pageSize + offset;

  /* ── Popup config per step ── */
  const popups = {
    3: {
      text: `We split the logical address ${logicalAddr} into two parts using page size ${pageSize}: Page Number (which page?) and Offset (where inside that page?).`,
      formula: `p = ⌊${logicalAddr} ÷ ${pageSize}⌋ = ${pageNum}   |   d = ${logicalAddr} mod ${pageSize} = ${offset}`,
      targetRef: cpuRef,
      position: 'right',
      theme: 'cpu',
      stepLabel: 'Step 3 — Split Address',
    },
    4: {
      text: `The OS looks up Page ${pageNum} in the Page Table — the master list that maps every page to its physical frame in RAM.`,
      formula: `Page Table[${pageNum}] → Frame ${frameNum}`,
      targetRef: ptRef,
      position: 'right',
      theme: 'pt',
      stepLabel: 'Step 4 — Page Table Lookup',
    },
    5: {
      text: `Found it! Page ${pageNum} is stored in Frame ${frameNum} of physical RAM. Now we can calculate the exact byte address.`,
      formula: `Frame Number f = ${frameNum}`,
      targetRef: ptRef,
      position: 'right',
      theme: 'pt',
      stepLabel: 'Step 5 — Frame Resolved',
    },
    7: {
      text: `The CPU accesses byte ${physAddr} directly in physical RAM — Frame ${frameNum}, offset ${offset}. Data retrieved successfully!`,
      formula: `Physical Address ${physAddr} → Frame ${frameNum} ✓`,
      targetRef: ramRef,
      position: 'left',
      theme: 'ram',
      stepLabel: 'Step 7 — RAM Access',
    },
    8: {
      text: `Paging lets the OS place program pages anywhere in RAM. The Page Table + address math makes this transparent to the CPU.`,
      formula: `Complete: Logical ${logicalAddr} → Physical ${physAddr}`,
      targetRef: ramRef,
      position: 'left',
      theme: 'ram',
      stepLabel: 'Step 8 — Summary',
    },
  };

  const activePopup = popups[currentStep] ?? {};

  return (
    <>
      {/* Step label */}
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
        <div className="theory-icon">📄</div>
        <h2>What is Paging?</h2>
        <p className="theory-text">
          Programs are too large to fit into continuous blocks of RAM because RAM gets
          fragmented over time. The OS solves this by chopping the program into equal-sized
          <strong> "Pages"</strong> and chopping the RAM into equal-sized <strong>"Frames"</strong>.
        </p>
        <div className="theory-analogy">
          <strong>📌 Analogy:</strong> Imagine writing a 10-page essay. Instead of needing 10
          empty folders perfectly lined up in a row in your filing cabinet, you put Page 1 in
          folder 8, Page 2 in folder 99, and Page 3 in folder 2. As long as you keep a
          <strong> "Master List" (the Page Table)</strong> of where everything is, your essay
          is perfectly safe.
        </div>
      </div>

      <div className={`theory-card ${currentStep === 1 ? 'show' : ''}`}>
        <div className="theory-icon">📋</div>
        <h2>The Page Table</h2>
        <p className="theory-text">
          The <strong>Page Table</strong> is the OS's master list. For every page of a program,
          it records which physical frame in RAM holds that page. When the CPU needs data at a
          specific address, it calculates the Page Number and Offset, looks up the frame in the
          Page Table, and computes the physical address.
        </p>
        <div className="theory-analogy">
          <strong>🔑 The Math:</strong><br />
          <code>Page Number (p) = ⌊Logical Address ÷ Page Size⌋</code><br />
          <code>Offset (d) = Logical Address mod Page Size</code><br />
          <code>Physical Address = (Frame × Page Size) + Offset</code>
        </div>
      </div>

      {/* ── Connection Lines ───────────────────────────────────── */}

      {/* CPU → Page Table (sky blue) */}
      {currentStep >= 4 && currentStep <= 5 && (
        <div className="connect-line sky" style={{
          top: '38%', left: '21%', width: '14%',
        }} />
      )}

      {/* Page Table → RAM (emerald) */}
      {currentStep >= 6 && (
        <div className="connect-line green" style={{
          top: '18%', left: '54%', width: '14%',
        }} />
      )}

      {/* CPU → RAM direct (amber, final step) */}
      {currentStep >= 7 && (
        <div className="connect-line amber" style={{
          top: '13%', left: '18%', width: '48%',
        }} />
      )}

      {/* ══════════════════════════════════════════════════════
          CPU BOX
      ══════════════════════════════════════════════════════ */}
      {currentStep >= 2 && (
        <div
          ref={cpuRef}
          className={`entity-box entity-cpu ${currentStep >= 3 && currentStep <= 4 ? 'active' : ''}`}
          style={{ top: '8%', left: '3%', width: '200px', minHeight: '160px' }}
        >
          <span className="entity-icon">🖥️</span>
          <span className="entity-label">CPU</span>
          <span className="entity-sub">Processor</span>

          {/* Input phase — step 2 */}
          {currentStep === 2 && !submitted && (
            <div className="user-input-group">
              <label>Logical Address</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 4196"
                value={addrInput}
                onChange={e => setAddrInput(e.target.value)}
              />
              <label>Page Size (bytes)</label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 1000"
                value={pageSizeInput}
                onChange={e => setPageSizeInput(e.target.value)}
              />
              <button className="submit-btn" onClick={handleSubmit}>
                Submit →
              </button>
            </div>
          )}

          {/* Logical address chip — after submit */}
          {submitted && currentStep >= 2 && (
            <div style={{
              marginTop: '10px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'var(--cpu-bg)',
              border: '1px solid var(--cpu-border)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--cpu-main)',
              textAlign: 'center',
              width: '100%',
              animation: 'fade-up 0.4s ease',
            }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '1px' }}>
                LOGICAL ADDR
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: '700' }}>{logicalAddr}</div>
            </div>
          )}

          {/* Split chips — step 3+ */}
          {submitted && currentStep >= 3 && (
            <div style={{
              display: 'flex',
              gap: '6px',
              marginTop: '8px',
              width: '100%',
            }}>
              <div style={{
                flex: 1,
                padding: '6px 4px',
                borderRadius: '6px',
                background: 'rgba(139,92,246,0.1)',
                border: '1px solid var(--tlb-border)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                color: 'var(--tlb-main)',
                textAlign: 'center',
                animation: 'fade-up 0.4s ease',
              }}>
                <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>PAGE</div>
                <div style={{ fontWeight: '700' }}>p = {pageNum}</div>
              </div>
              <div style={{
                flex: 1,
                padding: '6px 4px',
                borderRadius: '6px',
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid var(--cpu-border)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                color: 'var(--cpu-main)',
                textAlign: 'center',
                animation: 'fade-up 0.4s ease 0.15s both',
              }}>
                <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>OFFSET</div>
                <div style={{ fontWeight: '700' }}>d = {offset}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          PAGE TABLE BOX
      ══════════════════════════════════════════════════════ */}
      {currentStep >= 2 && (
        <div
          ref={ptRef}
          className={`entity-box entity-pt ${currentStep === 4 || currentStep === 5 ? 'active' : ''}`}
          style={{
            top: '28%', left: '28%', width: '240px', minHeight: '260px',
            opacity: currentStep >= 6 ? 0.45 : 1,
            transition: 'opacity 0.5s ease, all 0.4s var(--ease-snap)',
          }}
        >
          <span className="entity-icon">📋</span>
          <span className="entity-label">Page Table</span>
          <span className="entity-sub">Virtual → Physical Map</span>

          <table className="pt-table" style={{ marginTop: '10px', width: '100%' }}>
            <thead>
              <tr>
                <th>PAGE #</th>
                <th>FRAME #</th>
                <th>VALID</th>
              </tr>
            </thead>
            <tbody>
              {pageTable.map(row => (
                <tr
                  key={row.page}
                  className={row.page === pageNum && currentStep >= 4 ? 'highlight' : ''}
                >
                  <td>{row.page}</td>
                  <td style={{ fontWeight: row.page === pageNum && currentStep >= 4 ? '700' : '400' }}>
                    {row.frame}
                  </td>
                  <td style={{ color: row.valid ? 'var(--hit-color)' : 'var(--miss-color)' }}>
                    {row.valid ? '✓' : '✗'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Frame resolved chip — step 5+ */}
          {currentStep >= 5 && (
            <div style={{
              marginTop: '10px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'var(--pt-bg)',
              border: '1px solid var(--pt-border)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--pt-main)',
              textAlign: 'center',
              width: '100%',
              animation: 'fade-up 0.4s ease',
            }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '2px' }}>FRAME FOUND</div>
              <div style={{ fontSize: '1rem', fontWeight: '700' }}>f = {frameNum}</div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          RAM BOX
      ══════════════════════════════════════════════════════ */}
      {currentStep >= 2 && (
        <div
          ref={ramRef}
          className={`entity-box entity-ram ${currentStep >= 6 ? 'active' : ''}`}
          style={{ top: '6%', left: '62%', width: '230px', minHeight: '300px' }}
        >
          <span className="entity-icon">🗄️</span>
          <span className="entity-label">Physical RAM</span>
          <span className="entity-sub">Frames of {pageSize} bytes each</span>

          {/* Frame grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '4px',
            marginTop: '10px',
            width: '100%',
            padding: '0 4px',
          }}>
            {Array.from({ length: 20 }, (_, i) => (
              <div key={i} style={{
                padding: '5px 2px',
                borderRadius: '5px',
                background: i === frameNum && currentStep >= 6
                  ? 'var(--ram-main)'
                  : 'var(--ram-bg)',
                border: `1px solid ${i === frameNum ? 'var(--ram-border)' : 'transparent'}`,
                fontFamily: 'var(--font-mono)',
                fontSize: '0.58rem',
                textAlign: 'center',
                color: i === frameNum && currentStep >= 6
                  ? 'white'
                  : i === frameNum
                    ? 'var(--ram-main)'
                    : 'var(--text-muted)',
                fontWeight: i === frameNum ? '700' : '400',
                transition: 'all 0.5s ease',
                boxShadow: i === frameNum && currentStep >= 7
                  ? '0 0 10px var(--ram-glow)'
                  : 'none',
              }}>
                F{i}
              </div>
            ))}
          </div>

          {/* Physical address chip — step 6+ */}
          {currentStep >= 6 && (
            <div style={{
              marginTop: '10px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'var(--ram-bg)',
              border: '1px solid var(--ram-border)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              color: 'var(--ram-main)',
              textAlign: 'center',
              width: '100%',
              animation: 'fade-up 0.4s ease',
            }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '2px' }}>PHYSICAL ADDR</div>
              <div style={{ fontSize: '1rem', fontWeight: '700' }}>{physAddr}</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                ({frameNum} × {pageSize}) + {offset}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          FLOATING VARIABLE CHIPS — Step 6 (fly to center)
      ══════════════════════════════════════════════════════ */}
      {showVarChips && (
        <>
          <div className="floating-value green" style={{
            top: '10%', left: '60%',
            animation: 'flyToCenter 0.8s var(--ease-snap) forwards',
          }}>
            f = {frameNum}
          </div>
          <div className="floating-value sky" style={{
            top: '70%', left: '30%',
            animation: 'flyToCenter 0.8s var(--ease-snap) 0.1s forwards',
          }}>
            Size = {pageSize}
          </div>
          <div className="floating-value amber" style={{
            top: '70%', right: '10%',
            animation: 'flyToCenter 0.8s var(--ease-snap) 0.2s forwards',
          }}>
            d = {offset}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          PHYSICAL ADDRESS FORMULA BOX — Step 6+
      ══════════════════════════════════════════════════════ */}
      <div className={`eat-formula-box ${showFormula ? 'show' : ''}`}
        style={{
          bottom: '12%',
          top: 'auto',
          transform: showFormula
            ? 'translateX(-50%) scale(1)'
            : 'translateX(-50%) scale(0.9)',
          borderColor: 'rgba(16,185,129,0.4)',
          boxShadow: '0 0 60px var(--ram-glow)',
        }}
      >
        <h3 style={{ color: 'var(--ram-main)' }}>Physical Address Calculation</h3>

        <div className="formula-line">
          Physical = (<span className="var-green">f</span> ×{' '}
          <span className="var-sky">Page Size</span>) +{' '}
          <span className="var-amber">d</span>
        </div>

        <div className="formula-line" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Substituting:{' '}
          <span className="var-green">f = {frameNum}</span>,{' '}
          <span className="var-sky">Page Size = {pageSize}</span>,{' '}
          <span className="var-amber">d = {offset}</span>
        </div>

        <div className="formula-line">
          = ({frameNum} × {pageSize}) + {offset}
        </div>

        <div className="formula-result" style={{ color: 'var(--ram-main)' }}>
          = {physAddr}
        </div>

        {currentStep >= 7 && (
          <div style={{
            marginTop: '14px',
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid var(--ram-border)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.78rem',
            color: 'var(--ram-main)',
            lineHeight: 1.6,
            animation: 'fade-up 0.4s ease',
          }}>
            ✓ Data at Frame <strong>{frameNum}</strong>, byte offset <strong>{offset}</strong> retrieved successfully.
          </div>
        )}
      </div>

      {/* ── Popup ─────────────────────────────────────────────── */}
      <Popup
        visible={currentStep >= 3 && currentStep <= 8 && !!activePopup.text}
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