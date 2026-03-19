import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import Popup from '../components/Popup';

/**
 * TLB Simulation — Dynamic Step Walkthrough
 *
 * FIXES (UI only — ALL original logic preserved):
 * 1. connect-line divs → SVG overlay with real arrowheads + overflow:visible (no clipping)
 * 2. EAT formula box animation is 100% original (slides left on final step, chips fly in)
 * 3. overflow:visible on all entity boxes so HIT/MISS badges never clip
 * 4. Popup z-index 15 — sits above boxes but below formula; arrows in SVG at z:3 are always visible
 * 5. All Hit/Miss routing logic untouched
 *
 * Path A (Hit):  maxSimSteps=9
 * Path B (Miss): maxSimSteps=11
 */

const H = 0.8;
const C = 10;
const M = 100;

function buildPageTable(userPage, userFrame) {
  const base = [
    { page: 0, frame: 3 },
    { page: 1, frame: 7 },
    { page: 2, frame: 1 },
    { page: 3, frame: 9 },
    { page: 5, frame: 15 },
  ];
  const filteredBase = base.filter(row => row.page !== userPage);
  const rows = [...filteredBase, { page: userPage, frame: userFrame }];
  rows.sort((a, b) => a.page - b.page);
  return rows;
}

const TLB_STORAGE_KEY = 'tlb_lru_entries';
const DEFAULT_TLB = [
  { page: 1, frame: 7 },
  { page: 2, frame: 1 },
  { page: null, frame: null }
];

function loadTlbFromStorage() {
  try {
    const stored = sessionStorage.getItem(TLB_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) { /* ignore */ }
  return DEFAULT_TLB;
}

function saveTlbToStorage(entries) {
  try {
    sessionStorage.setItem(TLB_STORAGE_KEY, JSON.stringify(entries));
  } catch (e) { /* ignore */ }
}

export default function TLB({ currentStep, setMaxSteps, onRestart }) {
  const containerRef = useRef(null);
  const cpuRef  = useRef(null);
  const tlbRef  = useRef(null);
  const ptRef   = useRef(null);
  const ramRef  = useRef(null);

  const [pageInput, setPageInput]     = useState('');
  const [offsetInput, setOffsetInput] = useState('');
  const [submitted, setSubmitted]     = useState(false);
  const [pageNum, setPageNum]         = useState(4);
  const [offset, setOffset]           = useState(196);
  const [frameNum, setFrameNum]       = useState(12);

  const [tlbEntries, setTlbEntries]   = useState(() => loadTlbFromStorage());

  const isInitialHit = tlbEntries.some(e => e.page === pageNum);
  const maxSimSteps  = isInitialHit ? 9 : 11;

  // Original EAT animation state — unchanged
  const [showFormula, setShowFormula]   = useState(false);
  const [showVarChips, setShowVarChips] = useState(false);
  const [isMerging, setIsMerging]       = useState(false);
  const [scrambleEat, setScrambleEat]   = useState(0);

  // SVG line data
  const [svgLines, setSvgLines] = useState([]);

  // ── Reset on restart ──────────────────────────────────────────
  useEffect(() => {
    if (currentStep === 2) {
      setPageInput('');
      setOffsetInput('');
      setSubmitted(false);
      setPageNum(4);
      setOffset(196);
      setFrameNum(12);
      setShowFormula(false);
      setShowVarChips(false);
      setIsMerging(false);
      setScrambleEat(0);
    }
  }, [currentStep]);

  // ── Restart key ───────────────────────────────────────────────
  useEffect(() => {
    if (currentStep !== maxSimSteps) return;
    const handleKey = (e) => {
      if (e.key === 'Enter' && onRestart) {
        saveTlbToStorage(tlbEntries);
        onRestart();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentStep, maxSimSteps, onRestart, tlbEntries]);

  useEffect(() => { setMaxSteps(maxSimSteps); }, [setMaxSteps, maxSimSteps]);

  // ── TLB LRU eviction (original) ───────────────────────────────
  useEffect(() => {
    const isMissUpdate = !isInitialHit && currentStep === 6;
    const isHitUpdate  = (isInitialHit && currentStep === 5) || (!isInitialHit && currentStep === 7);

    if (isMissUpdate || isHitUpdate) {
      const existing   = tlbEntries.filter(e => e.page !== null && e.page !== pageNum);
      const newEntries = [{ page: pageNum, frame: frameNum }, ...existing];
      while (newEntries.length < 3) newEntries.push({ page: null, frame: null });
      if (newEntries.length > 3) newEntries.length = 3;

      if (JSON.stringify(tlbEntries) !== JSON.stringify(newEntries)) {
        setTlbEntries(newEntries);
        saveTlbToStorage(newEntries);
      }
    }
  }, [currentStep, pageNum, frameNum, isInitialHit, tlbEntries]);

  // ── EAT animation (original — chip fly + slide left) ──────────
  useEffect(() => {
    if (currentStep === maxSimSteps - 2) {
      setShowVarChips(true);
      setIsMerging(false);
      setShowFormula(false);
    } else if (currentStep === maxSimSteps - 1) {
      setShowVarChips(true);
      setIsMerging(true);
      setShowFormula(false);
      const timer = setTimeout(() => {
        setShowVarChips(false);
        setShowFormula(true);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (currentStep === maxSimSteps) {
      setShowVarChips(false);
      setShowFormula(true);
    } else {
      setShowVarChips(false);
      setIsMerging(false);
      setShowFormula(false);
    }
  }, [currentStep, maxSimSteps]);

  // ── Scramble EAT (original) ────────────────────────────────────
  useEffect(() => {
    if (showFormula) {
      let ticks = 0;
      const interval = setInterval(() => {
        setScrambleEat(Math.floor(Math.random() * 999));
        ticks++;
        if (ticks > 25) { clearInterval(interval); setScrambleEat(null); }
      }, 50);
      return () => clearInterval(interval);
    }
  }, [showFormula]);

  // ── Auto-submit (original) ─────────────────────────────────────
  const resolveFrame = (p) => {
    const tlbMatch = tlbEntries.find(e => e.page === p);
    if (tlbMatch) return tlbMatch.frame;
    return ((p * 7 + 3) % 20);
  };

  useEffect(() => {
    if (currentStep === 3 && !submitted) {
      const p = parseInt(pageInput, 10);
      const d = parseInt(offsetInput, 10);
      if (!isNaN(p) && p >= 0 && !isNaN(d) && d >= 0) {
        setPageNum(p);
        setOffset(d);
        setFrameNum(resolveFrame(p));
      }
      setSubmitted(true);
    }
  }, [currentStep, submitted, pageInput, offsetInput]);

  const handleSubmit = () => {
    const p = parseInt(pageInput, 10);
    const d = parseInt(offsetInput, 10);
    if (!isNaN(p) && p >= 0 && !isNaN(d) && d >= 0) {
      setPageNum(p);
      setOffset(d);
      setFrameNum(resolveFrame(p));
      setSubmitted(true);
    }
  };

  const PAGE_TABLE  = buildPageTable(pageNum, frameNum);
  const logicalAddr = pageNum * 1000 + offset;
  const physAddr    = frameNum * 1000 + offset;
  const hitPath     = H * (C + M);
  const missPath    = (1 - H) * (C + 2 * M);
  const eat         = hitPath + missPath;

  // ── Popup configs (original) ───────────────────────────────────
  const hitPopups = {
    3: { text: `The CPU needs data at logical address ${logicalAddr}. It splits this into Page Number (p = ${pageNum}) and Offset (d = ${offset}).`, formula: `Logical Address = (p × Page Size) + d  →  ${pageNum}×1000 + ${offset} = ${logicalAddr}`, targetRef: cpuRef, position: 'right', theme: 'cpu', stepLabel: 'Step 3 — CPU Generates Address' },
    4: { text: `The CPU first checks the TLB — a tiny high-speed cache that holds recent Page→Frame translations. TLB access takes only C = ${C}ns.`, formula: `TLB Access Time = C = ${C} ns`, targetRef: tlbRef, position: 'bottom', theme: 'tlb', stepLabel: 'Step 4 — TLB Check' },
    5: { text: `Page ${pageNum} is found in the TLB! This is a TLB HIT. We can skip the slow Page Table lookup entirely.`, formula: `Hit Path Cost = C = ${C} ns`, targetRef: tlbRef, position: 'bottom', theme: 'tlb', stepLabel: 'Step 5 — TLB Hit' },
    6: { text: `Frame ${frameNum} is resolved. The CPU accesses Physical RAM directly at address (${frameNum} × 1000) + ${offset} = ${physAddr}.`, formula: `Physical Address = (f × Page Size) + d = ${physAddr}`, targetRef: ramRef, position: 'bottom', theme: 'ram', stepLabel: 'Step 6 — RAM Access' },
    7: { text: `Now that we've found the data, let's calculate the statistical Effective Access Time (EAT). H comes from the CPU cache logic, C from TLB, M from RAM.`, formula: `Preparing EAT Variables...`, targetRef: tlbRef, position: 'bottom', theme: 'tlb', stepLabel: 'Step 7 — EAT Variables Found' },
    8: { text: `Calculating statistical average EAT across billions of instructions...`, formula: `EAT Computation`, targetRef: ptRef, position: 'right', theme: 'cpu', stepLabel: 'Step 8 — EAT Calculation' },
    9: { text: `The simulation is complete! The final EAT resides to the left for reference.`, formula: `Total EAT = ${eat} ns`, targetRef: cpuRef, position: 'bottom', theme: 'cpu', stepLabel: 'Step 9 — Simulation Summary' },
  };

  const missPopups = {
    3:  { text: `The CPU needs data at logical address ${logicalAddr}. It splits this into Page Number (p = ${pageNum}) and Offset (d = ${offset}).`, formula: `Logical Address = (p × Page Size) + d  →  ${pageNum}×1000 + ${offset} = ${logicalAddr}`, targetRef: cpuRef, position: 'right', theme: 'cpu', stepLabel: 'Step 3 — CPU Generates Address' },
    4:  { text: `The CPU first checks the TLB — a tiny high-speed cache that holds recent Page→Frame translations. TLB access takes only C = ${C}ns.`, formula: `TLB Access Time = C = ${C} ns`, targetRef: tlbRef, position: 'bottom', theme: 'tlb', stepLabel: 'Step 4 — TLB Check' },
    5:  { text: `Page ${pageNum} is NOT in the TLB — TLB MISS! The CPU must walk to the Page Table stored in Main Memory. This costs an extra M = ${M}ns.`, formula: `Miss Penalty = C + M = ${C} + ${M} = ${C + M} ns`, targetRef: ptRef, position: 'right', theme: 'pt', stepLabel: 'Step 5 — TLB Miss → Page Table' },
    6:  { text: `The Page Table reveals that Page ${pageNum} lives in Frame ${frameNum}. This mapping is immediately written back into the TLB for future use.`, formula: `TLB ← [Page ${pageNum} → Frame ${frameNum}]`, targetRef: tlbRef, position: 'bottom', theme: 'tlb', stepLabel: 'Step 6 — TLB Update' },
    7:  { text: `The CPU requests Page ${pageNum} again. This time the TLB already has the mapping — TLB HIT! No second trip to the Page Table needed.`, formula: `Hit Path Cost = C + M = ${C} + ${M} = ${C + M} ns`, targetRef: tlbRef, position: 'bottom', theme: 'tlb', stepLabel: 'Step 7 — TLB Hit' },
    8:  { text: `Frame ${frameNum} is now known. The CPU accesses Physical RAM directly at address (${frameNum} × 1000) + ${offset} = ${physAddr}.`, formula: `Physical Address = (f × Page Size) + d = ${physAddr}`, targetRef: ramRef, position: 'bottom', theme: 'ram', stepLabel: 'Step 8 — RAM Access' },
    9:  { text: `Now that we've found the data, let's calculate the statistical Effective Access Time (EAT). H comes from the CPU cache logic, C from TLB, M from RAM.`, formula: `Preparing EAT Variables...`, targetRef: tlbRef, position: 'bottom', theme: 'tlb', stepLabel: 'Step 9 — EAT Variables Found' },
    10: { text: `Calculating statistical average EAT across billions of instructions...`, formula: `EAT Computation`, targetRef: ptRef, position: 'right', theme: 'cpu', stepLabel: 'Step 10 — EAT Calculation' },
    11: { text: `The simulation is complete! The final EAT resides to the left for reference.`, formula: `Total EAT = ${eat} ns`, targetRef: cpuRef, position: 'bottom', theme: 'cpu', stepLabel: 'Step 11 — Simulation Summary' },
  };

  const activePopup = isInitialHit ? (hitPopups[currentStep] ?? {}) : (missPopups[currentStep] ?? {});

  // ── Active states (original) ───────────────────────────────────
  const isCpuActive = currentStep >= 3 && currentStep <= 4;

  let isTlbActive = false, isTlbHit = false, isTlbMiss = false;
  if (isInitialHit) {
    if (currentStep === 4 || currentStep === 5) {
      isTlbActive = true;
      if (currentStep === 5) isTlbHit = true;
    }
  } else {
    if (currentStep === 4 || currentStep === 6 || currentStep === 7) isTlbActive = true;
    if (currentStep === 4 || currentStep === 5 || currentStep === 6) isTlbMiss = true;
    if (currentStep === 7) isTlbHit = true;
  }

  const isRamActive = isInitialHit ? currentStep >= 6 : currentStep >= 8;
  const isPtActive  = !isInitialHit && (currentStep === 5 || currentStep === 6);

  // ── SVG path helper — gentle horizontal arc ────────────────────
  const makeHorizArc = (x1, y1, x2, y2) => {
    const mx  = (x1 + x2) / 2;
    const sag = Math.abs(y2 - y1) < 5 ? 0 : (y2 - y1) * 0.3;
    return `M ${x1} ${y1} C ${mx} ${y1 + sag}, ${mx} ${y2 + sag}, ${x2} ${y2}`;
  };

  // ── SVG path helper — S-curve for vertical connections ─────────
  const makeVertSCurve = (x1, y1, x2, y2) => {
    const my = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
  };

  // ── Compute SVG lines from real DOM rects ──────────────────────
  useLayoutEffect(() => {
    const compute = () => {
      if (!containerRef.current || currentStep < 3) { setSvgLines([]); return; }
      const cb = containerRef.current.getBoundingClientRect();

      const getBox = (ref) => {
        if (!ref?.current) return null;
        const r = ref.current.getBoundingClientRect();
        return {
          cx:     r.left - cb.left + r.width  / 2,
          cy:     r.top  - cb.top  + r.height / 2,
          left:   r.left - cb.left,
          right:  r.left - cb.left + r.width,
          top:    r.top  - cb.top,
          bottom: r.top  - cb.top  + r.height,
        };
      };

      const cpu = getBox(cpuRef);
      const tlb = getBox(tlbRef);
      const pt  = getBox(ptRef);
      const ram = getBox(ramRef);
      const lines = [];

      // CPU → TLB (amber dashed) — same condition as original connect-line
      if (cpu && tlb && currentStep >= 4 && currentStep < maxSimSteps) {
        lines.push({
          key: 'cpu-tlb',
          path: makeHorizArc(cpu.right, cpu.cy, tlb.left, tlb.cy),
          color: '#F59E0B', animated: true,
        });
      }

      // TLB → Page Table (red dashed, MISS only) — steps 5-6
      if (!isInitialHit && tlb && pt && currentStep >= 5 && currentStep <= 6) {
        lines.push({
          key: 'tlb-pt',
          path: makeVertSCurve(tlb.cx, tlb.bottom, pt.cx, pt.top),
          color: '#EF4444', animated: true,
        });
      }

      // TLB → RAM (violet) — hit: step>=5, miss: step>=8
      if (tlb && ram && ((isInitialHit && currentStep >= 5) || (!isInitialHit && currentStep >= 8))) {
        lines.push({
          key: 'tlb-ram',
          path: makeHorizArc(tlb.right, tlb.cy, ram.left, ram.cy),
          color: '#8B5CF6', animated: currentStep < maxSimSteps,
        });
      }

      setSvgLines(lines);
    };

    const t = setTimeout(compute, 80);
    window.addEventListener('resize', compute);
    return () => { clearTimeout(t); window.removeEventListener('resize', compute); };
  }, [currentStep, isInitialHit, submitted, maxSimSteps]);

  return (
    <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'visible' }}>

      {/* Dash-flow animation for SVG lines */}
      <style>{`
        @keyframes tlbDashFlow { to { stroke-dashoffset: -20; } }
        .tlb-svg-flow { stroke-dasharray: 8,4; animation: tlbDashFlow 0.38s linear infinite; }
      `}</style>

      {/* ── SVG Arrow Overlay ──────────────────────────────────────
          z-index:3 — BELOW entity boxes (10) and popup (15)
          overflow:visible — arrowheads never clipped by container
      ──────────────────────────────────────────────────────── */}
      <svg style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        zIndex: 3,
        overflow: 'visible',
      }}>
        <defs>
          {svgLines.map(l => (
            <React.Fragment key={l.key}>
              <marker
                id={`tlb-arr-${l.key}`}
                markerWidth="10" markerHeight="8"
                refX="9" refY="4"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <polygon points="0 0, 10 4, 0 8" fill={l.color} />
              </marker>
              <filter id={`tlb-glow-${l.key}`} x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="2.5" result="b" />
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </React.Fragment>
          ))}
        </defs>

        {svgLines.map(l => (
          <path
            key={l.key}
            d={l.path}
            fill="none"
            stroke={l.color}
            strokeWidth="2.5"
            className={l.animated ? 'tlb-svg-flow' : ''}
            markerEnd={`url(#tlb-arr-${l.key})`}
            filter={`url(#tlb-glow-${l.key})`}
          />
        ))}
      </svg>

      {/* ── Step label ── */}
      {currentStep >= 0 && (
        <div className="step-label animate-in">
          {currentStep <= 1
            ? `Step ${currentStep} — Theory`
            : currentStep === 2
              ? 'Step 2 — Your Input'
              : activePopup.stepLabel ?? `Step ${currentStep}`}
        </div>
      )}

      {/* ── Theory Card 0 (original) ── */}
      <div className={`theory-card ${currentStep === 0 ? 'show' : ''}`} style={{ top: '45%' }}>
        <div className="theory-icon">🧠</div>
        <h2>What is a TLB?</h2>
        <p className="theory-text">
          The <strong>Translation Lookaside Buffer (TLB)</strong> is a tiny, ultra-fast cache
          built into the CPU. It stores recent <em>Page→Frame</em> translations so that the
          CPU can skip the slow Page Table lookup most of the time. The TLB uses an
          <strong> LRU (Least Recently Used)</strong> replacement policy — when it's full,
          the oldest unused entry is evicted to make room for the new one.
        </p>
        <div className="theory-analogy">
          <strong>📌 Analogy:</strong> Think of the giant Page Table as the Master Index Catalog
          at the front desk of a massive library. Walking there to find every single book takes hours.
          The TLB is a <strong>small sticky note you keep in your pocket</strong>. If you need a
          Biology book, you check your sticky note first. If it's blank (TLB Miss), you walk to the
          front desk. But once you find out Biology is on Floor 3, you write it on your sticky note.
          Next time, you just read the note and go straight to Floor 3 (TLB Hit)! If your sticky
          note is full, you erase the <strong>oldest entry (LRU)</strong> to make room.
        </div>
      </div>

      {/* ── Theory Card 1 (original) ── */}
      <div className={`theory-card ${currentStep === 1 ? 'show' : ''}`} style={{ top: '45%' }}>
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
          <strong> doubling memory speed</strong>. This simulation uses <strong>LRU caching</strong> to
          persist TLB entries across multiple runs — just like a real CPU would retain hot translations.
          <br /><br />
          We measure this speedup with the <strong>Effective Access Time (EAT)</strong> formula:
          <br />
          <code>EAT = H×(C+M) + (1-H)×(C+2M)</code>
        </div>
      </div>

      {/* ── CPU ─────────────────────────────────────────────────── */}
      {currentStep >= 2 && (
        <div
          ref={cpuRef}
          className={`entity-box entity-cpu ${isCpuActive ? 'active' : ''}`}
          style={{ top: '10%', left: '8%', width: '160px', minHeight: '130px', overflow: 'visible', zIndex: 10 }}
        >
          <span className="entity-icon">🖥️</span>
          <span className="entity-label">CPU</span>
          <span className="entity-sub">Processor</span>

          {currentStep === 2 && !submitted && (
            <div className="user-input-group">
              <label>Page Number</label>
              <input
                type="number" min="0" max="20" placeholder="e.g. 4"
                value={pageInput}
                onChange={e => setPageInput(e.target.value)}
                onKeyDown={e => e.stopPropagation()}
              />
              <label>Offset</label>
              <input
                type="number" min="0" max="999" placeholder="e.g. 196"
                value={offsetInput}
                onChange={e => setOffsetInput(e.target.value)}
                onKeyDown={e => e.stopPropagation()}
              />
              <button className="submit-btn" onClick={handleSubmit}>Submit →</button>
            </div>
          )}

          {(submitted || currentStep >= 3) && currentStep >= 2 && (
            <div style={{
              marginTop: '10px', padding: '6px 10px', borderRadius: '6px',
              background: 'var(--cpu-bg)', border: '1px solid var(--cpu-border)',
              fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--cpu-main)',
              textAlign: 'center', width: '100%',
              animation: currentStep === 3 ? 'fade-up 0.5s ease' : 'none',
            }}>
              <div>p = <strong>{pageNum}</strong></div>
              <div>d = <strong>{offset}</strong></div>
            </div>
          )}
        </div>
      )}

      {/* ── TLB ─────────────────────────────────────────────────── */}
      {currentStep >= 2 && (
        <div
          ref={tlbRef}
          className={`entity-box entity-tlb
            ${isTlbActive ? 'active'     : ''}
            ${isTlbMiss   ? 'miss-glow'  : ''}
            ${isTlbHit    ? 'hit-glow'   : ''}
          `}
          style={{ top: '6%', left: '42%', width: '210px', minHeight: '180px', overflow: 'visible', zIndex: 10 }}
        >
          {/* Badges — overflow:visible lets them show above the box */}
          <div
            className={`hit-badge hit ${isTlbHit ? 'show' : ''}`}
            style={{ top: '-20px', left: '50%', transform: 'translateX(-50%)', position: 'absolute', whiteSpace: 'nowrap' }}
          >
            ✓ TLB HIT
          </div>
          <div
            className={`hit-badge miss ${isTlbMiss && currentStep !== 6 && currentStep !== 7 ? 'show' : ''}`}
            style={{ top: '-20px', left: '50%', transform: 'translateX(-50%)', position: 'absolute', whiteSpace: 'nowrap' }}
          >
            ✗ TLB MISS
          </div>

          <span className="entity-icon">⚡</span>
          <span className="entity-label">TLB</span>
          <span className="entity-sub">Translation Lookaside Buffer</span>

          <table className="tlb-table" style={{ marginTop: '8px' }}>
            <thead><tr><th>PAGE</th><th>FRAME</th></tr></thead>
            <tbody>
              {tlbEntries.map((row, i) => (
                <tr key={i} className={
                  row.page === pageNum && (isTlbHit || (!isInitialHit && currentStep >= 6))
                    ? 'highlight' : ''
                }>
                  <td>{row.page  !== null ? row.page  : '—'}</td>
                  <td>{row.frame !== null ? row.frame : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Page Table ──────────────────────────────────────────── */}
      {currentStep >= 2 && (
        <div
          ref={ptRef}
          className={`entity-box entity-pt ${isPtActive ? 'active' : ''}`}
          style={{
            top: '38%', left: '41%', width: '230px', minHeight: '220px',
            overflow: 'visible', zIndex: 10,
            opacity: (!isInitialHit && currentStep >= 8) || (isInitialHit && currentStep > 3) ? 0.4 : 1,
            transition: 'opacity 0.5s ease, all 0.4s var(--ease-snap)',
          }}
        >
          <span className="entity-icon">📋</span>
          <span className="entity-label">Page Table</span>
          <span className="entity-sub">Stored in Main Memory</span>

          <table className="pt-table" style={{ marginTop: '8px' }}>
            <thead><tr><th>PAGE</th><th>FRAME</th><th>VALID</th></tr></thead>
            <tbody>
              {PAGE_TABLE.map(row => (
                <tr key={row.page} className={row.page === pageNum && isPtActive ? 'highlight' : ''}>
                  <td>{row.page}</td>
                  <td>{row.frame}</td>
                  <td style={{ color: 'var(--hit-color)' }}>✓</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Restart prompt — original position below Page Table ─── */}
      {currentStep === maxSimSteps && (
        <div
          className="prompt-cta"
          onClick={() => { saveTlbToStorage(tlbEntries); onRestart && onRestart(); }}
          style={{
            position: 'absolute',
            top: '80%', left: 'calc(37%)',
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
            textAlign: 'center',
            cursor: 'pointer',
            zIndex: 50,
            animation: 'font-glow-pulse 2s infinite ease-in-out',
          }}
        >
          Press Enter to Start Again
        </div>
      )}

      {/* ── Physical RAM ─────────────────────────────────────────── */}
      {currentStep >= 2 && (
        <div
          ref={ramRef}
          className={`entity-box entity-ram ${isRamActive ? 'active' : ''}`}
          style={{ top: '6%', left: '75%', width: '210px', minHeight: '260px', overflow: 'visible', zIndex: 10 }}
        >
          <span className="entity-icon">🗄️</span>
          <span className="entity-label">Physical RAM</span>
          <span className="entity-sub">Main Memory — Frames</span>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px',
            marginTop: '10px', width: '100%', padding: '0 4px',
          }}>
            {Array.from({ length: 18 }, (_, i) => (
              <div key={i} style={{
                padding: '4px 2px', borderRadius: '4px',
                background: i === frameNum && isRamActive ? 'var(--ram-main)' : 'var(--ram-bg)',
                border: `1px solid ${i === frameNum ? 'var(--ram-border)' : 'transparent'}`,
                fontFamily: 'var(--font-mono)', fontSize: '0.6rem', textAlign: 'center',
                color: i === frameNum && isRamActive ? 'white' : 'var(--text-muted)',
                fontWeight: i === frameNum ? '700' : '400', transition: 'all 0.4s ease',
              }}>
                F{i}
              </div>
            ))}
          </div>

          {isRamActive && (
            <div style={{
              marginTop: '10px', padding: '6px 10px', borderRadius: '6px',
              background: 'var(--ram-bg)', border: '1px solid var(--ram-border)',
              fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--ram-main)',
              textAlign: 'center', width: '100%', animation: 'fade-up 0.4s ease',
            }}>
              Addr: <strong>{physAddr}</strong>
            </div>
          )}
        </div>
      )}

      {/* ── Variable Chips — original fly-in / fly-to-center animation ── */}
      {showVarChips && (
        <>
          <div
            className={`floating-value violet ${isMerging ? 'merging' : ''}`}
            style={{
              top: '20%', left: '19%',
              animation: isMerging
                ? 'flyToCenterCPU 1s var(--ease-snap) forwards'
                : 'fade-up 0.4s ease forwards',
            }}
          >H = {H}</div>

          <div
            className={`floating-value amber ${isMerging ? 'merging' : ''}`}
            style={{
              top: '20%', left: '57%',
              animation: isMerging
                ? 'flyToCenterTLB 1s var(--ease-snap) forwards'
                : 'fade-up 0.4s ease 0.1s forwards',
            }}
          >C = {C}ns</div>

          <div
            className={`floating-value green ${isMerging ? 'merging' : ''}`}
            style={{
              top: '20%', left: '71%',
              animation: isMerging
                ? 'flyToCenterRAM 1s var(--ease-snap) forwards'
                : 'fade-up 0.4s ease 0.2s forwards',
            }}
          >M = {M}ns</div>
        </>
      )}

      {/* ── EAT Formula Box — 100% original animation ─────────────
          • During scramble/merge: centered at 50% 50%
          • On final step: slides to top-left at 8% 38% scaled 0.65
          This is the original behaviour — not changed at all.
      ──────────────────────────────────────────────────────── */}
      <div
        className={`eat-formula-box ${showFormula ? 'show' : ''}`}
        style={{
          opacity:       showFormula ? 1 : 0,
          transition:    'all 0.8s var(--ease-snap)',
          pointerEvents: showFormula ? 'auto' : 'none',
          position: 'absolute',
          top:       currentStep === maxSimSteps ? '38%' : '50%',
          left:      currentStep === maxSimSteps ? '8%'  : '50%',
          transform: currentStep === maxSimSteps
            ? 'translate(0, 0) scale(0.65)'
            : 'translate(-50%, -50%) scale(1)',
          transformOrigin: currentStep === maxSimSteps ? 'top left' : 'center center',
          zIndex: 20,
        }}
      >
        <h3>Effective Access Time (EAT)</h3>
        {scrambleEat !== null ? (
          <div style={{ textAlign: 'center', margin: '20px 0' }}>
            <div style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
              Simulating billions of memory accesses...
            </div>
            <div style={{
              fontSize: '3.5rem', fontFamily: 'var(--font-mono)',
              color: 'var(--eat-color, var(--pt-main))',
              textShadow: '0 0 20px rgba(139,92,246,0.5)', fontWeight: 'bold',
            }}>
              {scrambleEat} ns
            </div>
          </div>
        ) : (
          <>
            <div className="formula-line">
              EAT = <span className="var-violet">H</span> × (<span className="var-amber">C</span> + <span className="var-green">M</span>) + (1 − <span className="var-violet">H</span>) × (<span className="var-amber">C</span> + 2<span className="var-green">M</span>)
            </div>
            <div className="formula-line" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Substituting: <span className="var-violet">H={H}</span>, <span className="var-amber">C={C}ns</span>, <span className="var-green">M={M}ns</span>
            </div>
            <div className="formula-line">
              <span style={{ color: 'var(--hit-color)' }}>Hit Path:  {H} × ({C} + {M}) = {hitPath.toFixed(1)}ns</span>
            </div>
            <div className="formula-line">
              <span style={{ color: 'var(--miss-color)' }}>Miss Path: {(1 - H).toFixed(1)} × ({C} + {2 * M}) = {missPath.toFixed(1)}ns</span>
            </div>
            <div className="formula-result" style={{ fontSize: '2.5rem', margin: '15px 0', animation: 'pulse 2s infinite' }}>
              EAT = {eat} ns
            </div>
            <div style={{
              marginTop: '14px', padding: '10px 14px', borderRadius: '8px',
              background: 'rgba(139,92,246,0.1)',
              border: '1px solid var(--tlb-border)',
              fontFamily: 'var(--font-mono)', fontSize: '0.78rem',
              color: 'var(--tlb-main)', lineHeight: 1.6,
            }}>
              <div style={{ paddingBottom: '6px', marginBottom: '8px', borderBottom: '1px solid rgba(139,92,246,0.2)', fontSize: '0.7rem', opacity: 0.9 }}>
                <strong>H:</strong> Hit Ratio (TLB Success) | <strong>C:</strong> TLB Access Time | <strong>M:</strong> Main Memory Speed
              </div>
              Current Request Cost: <strong style={{ color: isInitialHit ? 'var(--hit-color)' : 'var(--miss-color)' }}>
                {isInitialHit ? (hitPath / H).toFixed(0) : (missPath / (1 - H)).toFixed(0)}ns
              </strong><br />
              Average EAT without TLB: <strong>{C + 2 * M}ns</strong>.<br />
              The TLB reduces overall time to <strong>{eat}ns</strong> — a{' '}
              <strong style={{ color: 'var(--hit-color)' }}>
                {(((C + 2 * M - eat) / (C + 2 * M)) * 100).toFixed(0)}% speedup
              </strong>.
            </div>
          </>
        )}
      </div>

      {/* ── Popup ──────────────────────────────────────────────────
          z-index 15: above entity boxes (10), below formula (20)
          SVG arrows at z:3 are always visible underneath
          For step 6 hit-path: popup anchors to ramRef from the left,
          which naturally positions it away from the TLB→RAM arrow path
      ──────────────────────────────────────────────────────── */}
      <Popup
        visible={currentStep >= 3 && currentStep < maxSimSteps && !showFormula && !isMerging}
        text={activePopup.text}
        formula={activePopup.formula}
        targetRef={activePopup.targetRef}
        position={activePopup.position}
        theme={activePopup.theme}
        stepLabel={activePopup.stepLabel}
      />
    </div>
  );
}