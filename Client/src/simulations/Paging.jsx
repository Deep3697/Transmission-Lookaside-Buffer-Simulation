import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import Popup from '../components/Popup';

/**
 * Paging Simulation — Fixed
 *
 * Fixes applied:
 * 1. Entity boxes no longer clip (overflow:visible on container, z-index fixed)
 * 2. SVG arrows now show with proper arrowhead markers
 * 3. "Press Enter to Start Again" shown BELOW the formula box at final step
 * 4. Persistent page table correctly updates via LRU/FIFO across runs
 *
 * ── HIT PATH (maxSteps=9) ──
 * 0  : Theory — What is Paging?
 * 1  : Theory — Page Table & Demand Paging
 * 2  : Input
 * 3  : Split address
 * 4  : Page Table lookup
 * 5  : Validity check → Hit
 * 6  : Frame resolved
 * 7  : Variables anchored near source components
 * 8  : Sci-fi merge + formula calculation
 * 9  : RAM access + Summary (final)
 *
 * ── FAULT PATH (maxSteps=11) ──
 * 6→'5a'  7→'5b'  8→6  9→7  10→8  11→9
 */

const INITIAL_TABLE = [
  { page: 0, frame: 3,    valid: true  },
  { page: 1, frame: 7,    valid: true  },
  { page: 2, frame: 1,    valid: true  },
  { page: 3, frame: 9,    valid: true  },
  { page: 4, frame: 12,   valid: true  },
  { page: 5, frame: 15,   valid: true  },
  { page: 6, frame: null, valid: false },
  { page: 7, frame: null, valid: false },
];
const INITIAL_FIFO = [0, 1, 2, 3, 4, 5];
const INITIAL_LRU  = [2, 0, 4, 1, 5, 3];

export default function Paging({ currentStep, setMaxSteps, onRestart }) {
  const containerRef = useRef(null);
  const cpuRef       = useRef(null);
  const ptRef        = useRef(null);
  const ramRef       = useRef(null);
  const hdRef        = useRef(null);
  const ptTbodyRef   = useRef(null);

  /* ── User input ── */
  const [addrInput, setAddrInput]         = useState('');
  const [pageSizeInput, setPageSizeInput] = useState('1000');
  const [algoInput, setAlgoInput]         = useState('FIFO');
  const [submitted, setSubmitted]         = useState(false);

  /* ── Persistent state ── */
  const [persistentTable, setPersistentTable] = useState(() => INITIAL_TABLE.map(r => ({ ...r })));
  const [fifoQueue, setFifoQueue]             = useState(INITIAL_FIFO);
  const [lruQueue, setLruQueue]               = useState(INITIAL_LRU);

  /* ── Simulation values ── */
  const [logicalAddr, setLogicalAddr]         = useState(4196);
  const [pageSize, setPageSize]               = useState(1000);
  const [pageNum, setPageNum]                 = useState(4);
  const [offset, setOffset]                   = useState(196);
  const [frameNum, setFrameNum]               = useState(12);
  const [pageTable, setPageTable]             = useState(() => INITIAL_TABLE.map(r => ({ ...r })));
  const [replacementAlgo, setReplacementAlgo] = useState('FIFO');

  /* ── Demand paging ── */
  const [isHit, setIsHit]             = useState(true);
  const [victimFrame, setVictimFrame] = useState(null);
  const [victimPage, setVictimPage]   = useState(null);

  /* ── Formula animation phases ── */
  const [showVarAnchors, setShowVarAnchors] = useState(false);
  const [showMerge, setShowMerge]           = useState(false);
  const [showFormula, setShowFormula]       = useState(false);

  /* ── SVG lines ── */
  const [svgLines, setSvgLines] = useState([]);

  /* ── Max steps ── */
  const maxSimSteps = isHit ? 9 : 11;
  useEffect(() => { setMaxSteps(maxSimSteps); }, [setMaxSteps, maxSimSteps]);

  /* ── displayStep mapping ── */
  const displayStep = isHit
    ? currentStep
    : currentStep <= 5 ? currentStep
    : currentStep === 6 ? '5a'
    : currentStep === 7 ? '5b'
    : currentStep - 2;

  const varAnchorStep = isHit ? 6  : 8;
  const mergeStep     = isHit ? 7  : 9;

  /* ── Restart key listener ── */
  useEffect(() => {
    if (currentStep !== maxSimSteps) return;
    const h = (e) => { if (e.key === 'Enter' && onRestart) onRestart(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [currentStep, maxSimSteps, onRestart]);

  /* ── Reset animation state on step 2 ── */
  useEffect(() => {
    if (currentStep === 2) {
      setSubmitted(false);
      setShowVarAnchors(false);
      setShowMerge(false);
      setShowFormula(false);
    }
  }, [currentStep]);

  /* ── Submission ── */
  const handleSubmission = () => {
    const addr = parseInt(addrInput, 10) || 4196;
    const size = parseInt(pageSizeInput, 10) || 1000;
    setLogicalAddr(addr);
    setPageSize(size);
    setReplacementAlgo(algoInput);

    const p = Math.floor(addr / size);
    const d = addr % size;
    setPageNum(p);
    setOffset(d);

    const table = persistentTable.map(r => ({ ...r }));
    if (!table.find(r => r.page === p)) {
      table.push({ page: p, frame: null, valid: false });
    }

    const entry = table.find(r => r.page === p);
    const hit   = entry ? entry.valid : false;
    setIsHit(hit);

    if (hit) {
      setFrameNum(entry.frame);
      setVictimFrame(null);
      setVictimPage(null);

      /* LRU: move accessed page to MRU end */
      setLruQueue(q => {
        const next = q.filter(pg => pg !== p);
        next.push(p);
        return next;
      });
    } else {
      const queue     = algoInput === 'FIFO' ? fifoQueue : lruQueue;
      const validPgs  = table.filter(r => r.valid).map(r => r.page);
      const vPage     = queue.find(pg => validPgs.includes(pg)) ?? validPgs[0];
      const vEntry    = table.find(r => r.page === vPage);
      const vFrame    = vEntry ? vEntry.frame : 3;
      setVictimPage(vPage);
      setVictimFrame(vFrame);
      setFrameNum(vFrame);
    }

    setPageTable(table);
    setSubmitted(true);
  };

  /* ── Commit persistent table update after fault is confirmed ── */
  const persistenceCommittedRef = useRef(false);
  useEffect(() => {
    if (
      !isHit &&
      displayStep === '5b' &&
      victimPage !== null &&
      submitted &&
      !persistenceCommittedRef.current
    ) {
      persistenceCommittedRef.current = true;

      setPersistentTable(prev => {
        const updated = prev.map(row => {
          if (row.page === victimPage) return { ...row, frame: null, valid: false };
          if (row.page === pageNum)    return { ...row, frame: frameNum, valid: true };
          return row;
        });
        if (!updated.find(r => r.page === pageNum)) {
          updated.push({ page: pageNum, frame: frameNum, valid: true });
        }
        return updated;
      });

      /* Update FIFO queue: remove victim, push loaded page at end */
      setFifoQueue(q => {
        const next = q.filter(pg => pg !== victimPage);
        if (!next.includes(pageNum)) next.push(pageNum);
        return next;
      });
      /* Update LRU queue: remove victim, push loaded page as MRU */
      setLruQueue(q => {
        const next = q.filter(pg => pg !== victimPage);
        if (!next.includes(pageNum)) next.push(pageNum);
        return next;
      });
    }
    if (currentStep === 2) {
      persistenceCommittedRef.current = false;
    }
  }, [displayStep, isHit, victimPage, pageNum, frameNum, submitted, currentStep]);

  /* ── Formula animation phases ── */
  useEffect(() => {
    if (currentStep === varAnchorStep) {
      setShowVarAnchors(true); setShowMerge(false); setShowFormula(false);
    } else if (currentStep === mergeStep) {
      setShowVarAnchors(false); setShowMerge(true); setShowFormula(false);
      const t = setTimeout(() => { setShowMerge(false); setShowFormula(true); }, 1500);
      return () => clearTimeout(t);
    } else if (currentStep > mergeStep) {
      setShowVarAnchors(false); setShowMerge(false); setShowFormula(true);
    } else {
      setShowVarAnchors(false); setShowMerge(false); setShowFormula(false);
    }
  }, [currentStep, varAnchorStep, mergeStep]);

  useEffect(() => { if (currentStep === 3 && !submitted) handleSubmission(); }, [currentStep, submitted]);

  const physAddr = frameNum * pageSize + offset;

  /* ── Build display table ── */
  const getDisplayTable = () => {
    if (!isHit && (displayStep === '5b' || (typeof displayStep === 'number' && displayStep >= 6))) {
      return pageTable.map(row => {
        if (row.page === victimPage) return { ...row, frame: null, valid: false };
        if (row.page === pageNum)    return { ...row, frame: frameNum, valid: true };
        return row;
      });
    }
    return pageTable;
  };
  const displayTable = getDisplayTable();

  /* ── Scroll highlighted row ── */
  useEffect(() => {
    if (!ptTbodyRef.current || currentStep < 4) return;
    const rows = ptTbodyRef.current.querySelectorAll('tr');
    rows.forEach(tr => {
      if (tr.classList.contains('highlight') || tr.classList.contains('fault-highlight')) {
        tr.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  }, [currentStep, pageNum, isHit]);

  /* ── Active states ── */
  const isCpuActive = currentStep >= 3 && currentStep <= 4;
  const isPtActive  = currentStep === 4 || currentStep === 5;
  const isHdActive  = !isHit && (displayStep === '5a' || displayStep === '5b');
  const isRamActive = isHit
    ? currentStep >= 6
    : (displayStep === '5b' || (typeof displayStep === 'number' && displayStep >= 6));

  /* ── SVG curved path ── */
  const makeCurvedPath = (x1, y1, x2, y2) => {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    if (dy > dx) {
      const my = (y1 + y2) / 2;
      return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
    }
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  };

  /* ── Compute SVG lines from real bounding boxes ── */
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
          width:  r.width,
          height: r.height,
        };
      };
      const cpu = getBox(cpuRef);
      const pt  = getBox(ptRef);
      const ram = getBox(ramRef);
      const hd  = getBox(hdRef);
      const lines = [];

      /* CPU → Page Table */
      if (cpu && pt && currentStep >= 3 && currentStep <= 5) {
        lines.push({
          key: 'cpu-pt',
          x1: cpu.cx, y1: cpu.bottom,
          x2: pt.cx,  y2: pt.top,
          color: '#38BDF8', animated: true,
        });
      }
      /* Page Table → Hard Drive (fault step 5a) */
      if (pt && hd && displayStep === '5a') {
        lines.push({
          key: 'pt-hd',
          x1: pt.right, y1: pt.cy,
          x2: hd.left,  y2: hd.cy,
          color: '#EF4444', animated: true,
        });
      }
      /* Hard Drive → RAM (fault step 5b) */
      if (hd && ram && displayStep === '5b') {
        lines.push({
          key: 'hd-ram',
          x1: hd.right, y1: hd.cy,
          x2: ram.left, y2: ram.cy,
          color: '#8B5CF6', animated: true,
        });
      }
      /* Page Table → RAM (steps 6-7) */
      if (pt && ram && typeof displayStep === 'number' && displayStep >= 6 && displayStep < 8) {
        lines.push({
          key: 'pt-ram',
          x1: pt.right, y1: pt.cy,
          x2: ram.left, y2: ram.cy,
          color: '#10B981', animated: false,
        });
      }
      /* CPU → RAM direct (steps 8+) */
      if (cpu && ram && typeof displayStep === 'number' && displayStep >= 8) {
        lines.push({
          key: 'cpu-ram',
          x1: cpu.right, y1: cpu.cy,
          x2: ram.left,  y2: ram.cy,
          color: '#F59E0B', animated: false,
        });
      }

      setSvgLines(lines);
    };
    const t = setTimeout(compute, 80);
    window.addEventListener('resize', compute);
    return () => { clearTimeout(t); window.removeEventListener('resize', compute); };
  }, [currentStep, displayStep, isHit, submitted]);

  /* ── Popup config ── */
  const popups = {
    3:   { text: `Splitting ${logicalAddr}: Page Number tells which page, Offset tells where inside it.`, formula: `p=⌊${logicalAddr}÷${pageSize}⌋=${pageNum}  |  d=${logicalAddr}mod${pageSize}=${offset}`, targetRef: cpuRef, position: 'right', theme: 'cpu', stepLabel: 'Step 3 — Split Address' },
    4:   { text: `OS looks up Page ${pageNum} in the Page Table to find which frame it lives in.`, formula: `Check Page Table[${pageNum}]...`, targetRef: ptRef, position: 'right', theme: 'pt', stepLabel: 'Step 4 — Page Table Lookup' },
    5:   { text: isHit ? `Hit! Page ${pageNum} is valid → Frame ${frameNum}.` : `Page Fault! Page ${pageNum} valid-bit = 0. It lives on the Hard Drive, not in RAM.`, formula: isHit ? `Valid=1 → Hit ✓` : `Valid=0 → Fault ✗`, targetRef: ptRef, position: 'right', theme: isHit ? 'pt' : 'miss', stepLabel: 'Step 5 — Validity Check' },
    '5a':{ text: `OS locates Page ${pageNum} on the Hard Drive. Disk access is ~1000× slower than RAM.`, formula: `Locate Page ${pageNum} on Disk...`, targetRef: hdRef, position: 'right', theme: 'miss', stepLabel: 'Step 5a — Disk Read' },
    '5b':{ text: `RAM full! ${replacementAlgo}: evict Page ${victimPage} (Frame ${victimFrame}) → disk, load Page ${pageNum} into Frame ${victimFrame}.`, formula: `${replacementAlgo}: Evict P${victimPage} → Load P${pageNum} → Frame ${victimFrame}`, targetRef: ramRef, position: 'left', theme: 'ram', stepLabel: `Step 5b — ${replacementAlgo} Replacement` },
    6:   { text: `Frame ${frameNum} is now confirmed in the Page Table for Page ${pageNum}.`, formula: `f = ${frameNum}`, targetRef: ptRef, position: 'right', theme: 'pt', stepLabel: 'Step 6 — Frame Resolved' },
    7:   { text: `Three values are needed. Each chip is anchored to its source: f from Page Table, PageSize from CPU input, d from the address split.`, formula: `f=${frameNum}  PageSize=${pageSize}  d=${offset}`, targetRef: cpuRef, position: 'right', theme: 'cpu', stepLabel: 'Step 7 — Variables Gathered' },
    8:   { text: `Chips merge using: Physical = (f × PageSize) + d`, formula: `Physical=(${frameNum}×${pageSize})+${offset}=${physAddr}`, targetRef: ramRef, position: 'left', theme: 'ram', stepLabel: 'Step 8 — Formula Merge' },
    9:   { text: `CPU accesses byte ${physAddr} in physical RAM — Frame ${frameNum}, offset ${offset}. ${isHit ? 'Page table changes persist for the next run.' : `${replacementAlgo} evicted P${victimPage}. Changes persist for the next run.`}`, formula: `Logical ${logicalAddr} → Physical ${physAddr}`, targetRef: ramRef, position: 'left', theme: 'ram', stepLabel: 'Step 9 — Summary' },
  };
  const activePopup = popups[displayStep] ?? {};

  const isFinalStep = currentStep === maxSimSteps;

  return (
    /* ── FIX: overflow:visible so entity boxes never clip ── */
    <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'visible' }}>

      {/* ══ Keyframes ══ */}
      <style>{`
        @keyframes svgDashFlow { to { stroke-dashoffset: -20; } }
        .svg-line-flow { stroke-dasharray: 8,4; animation: svgDashFlow 0.38s linear infinite; }

        @keyframes chipAppear {
          0%   { transform: scale(0.3) translateY(14px); opacity: 0; filter: blur(8px); }
          65%  { transform: scale(1.08) translateY(-3px); opacity: 1; filter: blur(0); }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes chipMergeF  { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(22vw,-20vh) scale(0.1);opacity:0;filter:blur(10px)} }
        @keyframes chipMergePS { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(28vw,34vh) scale(0.1);opacity:0;filter:blur(10px)} }
        @keyframes chipMergeD  { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(28vw,24vh) scale(0.1);opacity:0;filter:blur(10px)} }

        @keyframes formulaExplode {
          0%  { transform: translateX(-50%) scale(0.15); opacity: 0; filter: blur(20px); }
          55% { transform: translateX(-50%) scale(1.04); filter: blur(0); }
          100%{ transform: translateX(-50%) scale(1); opacity: 1; }
        }
        @keyframes answerZoom {
          0%  { transform: scale(0.2); opacity: 0; letter-spacing: 12px; filter: blur(6px); }
          60% { transform: scale(1.15); letter-spacing: 2px; }
          100%{ transform: scale(1); opacity: 1; letter-spacing: normal; filter: blur(0); }
        }
        @keyframes scanline {
          0%  { top: -4px; opacity: 0.7; }
          100%{ top: 110%; opacity: 0; }
        }
        @keyframes varChipFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes mergeFlash {
          0%  { opacity: 0; transform: translate(-50%,-50%) scale(0.2); }
          40% { opacity: 1; transform: translate(-50%,-50%) scale(1.2); }
          100%{ opacity: 0; transform: translate(-50%,-50%) scale(2); }
        }
        @keyframes restartPulse { 0%,100%{transform:translateX(-50%) scale(1)} 50%{transform:translateX(-50%) scale(1.04)} }
        @keyframes enterTextPulse { 0%,100%{letter-spacing:3px;opacity:0.9} 50%{letter-spacing:6px;opacity:1} }
        @keyframes keyGlow { 0%,100%{box-shadow:0 0 5px rgba(139,92,246,0.3)} 50%{box-shadow:0 0 18px rgba(139,92,246,0.9),0 0 40px rgba(139,92,246,0.3)} }
        @keyframes spinR { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes summaryTableFadeIn {
          from { opacity: 0; transform: translateY(18px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes font-glow-pulse-white {
          0%,100%{ text-shadow: 0 0 8px rgba(192,192,192,0.3); transform: scale(1); }
          50%    { text-shadow: 0 0 20px rgba(192,192,192,0.8), 0 0 35px rgba(192,192,192,0.5); transform: scale(1.05); }
        }

        .pt-scroller::-webkit-scrollbar        { width: 5px; }
        .pt-scroller::-webkit-scrollbar-track  { background: transparent; }
        .pt-scroller::-webkit-scrollbar-thumb  { background: rgba(139,92,246,0.3); border-radius: 10px; }
        .pt-scroller::-webkit-scrollbar-thumb:hover { background: rgba(139,92,246,0.55); }
        .pt-scroller { scrollbar-width: thin; scrollbar-color: rgba(139,92,246,0.3) transparent; }

        .scifi-box::after { content: ''; position: absolute; left: 0; right: 0; height: 2px; top: -4px; background: linear-gradient(90deg,transparent,rgba(16,185,129,0.7),transparent); animation: scanline 2.4s linear 0.5s infinite; pointer-events: none; }
      `}</style>

      {/* ══ SVG overlay — FIX: overflow:visible, correct marker positioning ══ */}
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 6, overflow: 'visible' }}>
        <defs>
          {svgLines.map(l => (
            <React.Fragment key={l.key}>
              <marker
                id={`arr-${l.key}`}
                markerWidth="10" markerHeight="8"
                refX="9" refY="4"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <polygon points="0 0, 10 4, 0 8" fill={l.color} />
              </marker>
              <filter id={`glow-${l.key}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="b" />
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </React.Fragment>
          ))}
        </defs>
        {svgLines.map(l => (
          <path
            key={l.key}
            d={makeCurvedPath(l.x1, l.y1, l.x2, l.y2)}
            fill="none"
            stroke={l.color}
            strokeWidth="2.5"
            className={l.animated ? 'svg-line-flow' : ''}
            markerEnd={`url(#arr-${l.key})`}
            filter={`url(#glow-${l.key})`}
          />
        ))}
      </svg>

      {/* ══ Step label ══ */}
      {currentStep >= 0 && (
        <div className="step-label animate-in">
          {displayStep <= 1 ? `Step ${displayStep} — Theory`
           : displayStep === 2 ? 'Step 2 — Your Input'
           : activePopup.stepLabel ?? `Step ${displayStep}`}
        </div>
      )}

      {/* ══ Theory cards ══ */}
      <div className={`theory-card ${currentStep === 0 ? 'show' : ''}`} style={{ top: '45%' }}>
        <div className="theory-icon">📄</div>
        <h2>What is Paging?</h2>
        <p className="theory-text">
          Programs are too large to fit into continuous blocks of RAM because RAM gets fragmented. The OS chops the program into equal-sized <strong>Pages</strong> and RAM into equal-sized <strong>Frames</strong>.
        </p>
        <div className="theory-analogy">
          <strong>📌 Analogy:</strong> A 10-page essay — put Page 1 in folder 8, Page 2 in folder 99, Page 3 in folder 2. A <strong>Page Table (Master List)</strong> tracks it all.
        </div>
      </div>

      <div className={`theory-card ${currentStep === 1 ? 'show' : ''}`} style={{ top: '45%' }}>
        <div className="theory-icon">📋</div>
        <h2>The Page Table & Demand Paging</h2>
        <p className="theory-text">
          The <strong>Page Table</strong> maps every page to a frame. <strong>Valid Bit = 1</strong> → page in RAM; <strong>0</strong> → page on disk. Accessing invalid page = <strong>Page Fault!</strong>
        </p>
        <div className="theory-analogy">
          <strong>🔑 Math:</strong><br />
          <code>p = ⌊Addr ÷ PageSize⌋</code> &nbsp;·&nbsp; <code>d = Addr mod PageSize</code><br />
          <code>Physical = (Frame × PageSize) + d</code><br /><br />
          <strong>FIFO</strong> evicts oldest loaded page · <strong>LRU</strong> evicts least-recently-used.
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          CPU BOX
          FIX: z-index:10 ensures badge never clips
      ══════════════════════════════════════════════════════ */}
      {currentStep >= 2 && (
        <div ref={cpuRef} className={`entity-box entity-cpu ${isCpuActive ? 'active' : ''}`}
          style={{ top: '6%', left: '5%', width: '200px', minHeight: '140px', zIndex: 10, overflow: 'visible' }}>
          <span className="entity-icon">🖥️</span>
          <span className="entity-label">CPU</span>
          <span className="entity-sub">Processor</span>

          {currentStep === 2 && !submitted && (
            <div className="user-input-group">
              <label>Logical Address (Try 6196 for fault)</label>
              <input
                type="number" min="0" max="99999"
                placeholder="e.g. 4196 or 6196"
                value={addrInput}
                onChange={e => setAddrInput(e.target.value)}
                onKeyDown={e => e.stopPropagation()}
              />
              <label>Page Size</label>
              <input
                type="number" min="1" max="9999"
                placeholder="e.g. 1000"
                value={pageSizeInput}
                onChange={e => setPageSizeInput(e.target.value)}
                onKeyDown={e => e.stopPropagation()}
              />
              <label>Replacement Algorithm</label>
              <select
                value={algoInput}
                onChange={e => setAlgoInput(e.target.value)}
                style={{ marginBottom: '10px', padding: '6px', borderRadius: '4px', border: '1px solid var(--cpu-border)', background: 'white', color: '#333', fontFamily: 'var(--font-mono)' }}
              >
                <option value="FIFO">FIFO (First In, First Out)</option>
                <option value="LRU">LRU (Least Recently Used)</option>
              </select>
              <button className="submit-btn" onClick={handleSubmission}>Submit →</button>
            </div>
          )}

          {(submitted || currentStep >= 3) && currentStep >= 2 && (
            <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '8px', background: 'var(--cpu-bg)', border: '1px solid var(--cpu-border)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--cpu-main)', textAlign: 'center', width: '100%', animation: 'fade-up 0.4s ease' }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '1px' }}>LOGICAL ADDR</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '700' }}>{logicalAddr}</div>
            </div>
          )}

          {submitted && currentStep >= 3 && (
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px', width: '100%' }}>
              <div style={{ flex: 1, padding: '6px 4px', borderRadius: '6px', background: 'rgba(139,92,246,0.1)', border: '1px solid var(--tlb-border)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--tlb-main)', textAlign: 'center', animation: 'fade-up 0.4s ease' }}>
                <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>PAGE</div>
                <div style={{ fontWeight: '700' }}>p = {pageNum}</div>
              </div>
              <div style={{ flex: 1, padding: '6px 4px', borderRadius: '6px', background: 'rgba(245,158,11,0.1)', border: '1px solid var(--cpu-border)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--cpu-main)', textAlign: 'center', animation: 'fade-up 0.4s ease 0.15s both' }}>
                <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>OFFSET</div>
                <div style={{ fontWeight: '700' }}>d = {offset}</div>
              </div>
            </div>
          )}

          {submitted && currentStep >= 3 && (
            <div style={{ marginTop: '6px', padding: '4px 8px', borderRadius: '6px', background: 'rgba(139,92,246,0.08)', border: '1px solid var(--tlb-border)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--tlb-main)', textAlign: 'center', width: '100%', letterSpacing: '1px' }}>
              {replacementAlgo}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          PAGE TABLE BOX
      ══════════════════════════════════════════════════════ */}
      {currentStep >= 2 && (
        <div style={{ position: 'absolute', top: '60%', left: '5%', width: '255px', zIndex: 10 }}>
          {/* Hit/Fault badge — rendered OUTSIDE the scroll container so it never clips */}
          <div className={`hit-badge ${isHit ? 'hit' : 'miss'} ${currentStep === 5 ? 'show' : ''}`}
            style={{ position: 'absolute', top: '-28px', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', zIndex: 15 }}>
            {isHit ? '✓ PAGE HIT' : '✗ PAGE FAULT'}
          </div>
          <div
            ref={ptRef}
            className={`entity-box entity-pt pt-scroller ${isPtActive ? 'active' : ''}`}
            style={{
              position: 'relative', width: '100%',
              maxHeight: '310px', overflowY: 'auto', overflowX: 'hidden',
              opacity: (typeof displayStep === 'number' && displayStep >= 8) ? 0.45 : 1,
              transition: 'opacity 0.5s ease',
            }}
          >

          <span className="entity-icon">📋</span>
          <span className="entity-label">Page Table</span>
          <span className="entity-sub">Virtual → Physical Map</span>

          <table className="pt-table" style={{ marginTop: '10px', width: '100%' }}>
            <thead><tr><th>PAGE #</th><th>FRAME #</th><th>VALID</th></tr></thead>
            <tbody ref={ptTbodyRef}>
              {displayTable.map(row => {
                const isTarget    = row.page === pageNum && currentStep >= 4;
                const isVictimRow = !isHit && row.page === victimPage &&
                  (displayStep === '5b' || (typeof displayStep === 'number' && displayStep >= 6));
                return (
                  <tr key={row.page}
                    className={isTarget ? (row.valid ? 'highlight' : 'fault-highlight') : isVictimRow ? 'victim-highlight' : ''}>
                    <td>{row.page}</td>
                    <td style={{ fontWeight: isTarget ? '700' : '400', color: row.frame === null ? 'var(--text-muted)' : 'inherit' }}>
                      {row.frame !== null ? row.frame : '—'}
                    </td>
                    <td style={{ color: row.valid ? 'var(--hit-color)' : 'var(--miss-color)', fontWeight: '700' }}>
                      {row.valid ? '✓' : '✗'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {typeof displayStep === 'number' && displayStep >= 6 && (
            <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '8px', background: 'var(--pt-bg)', border: '1px solid var(--pt-border)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--pt-main)', textAlign: 'center', width: '100%', animation: 'fade-up 0.4s ease' }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '2px' }}>FRAME FOUND</div>
              <div style={{ fontSize: '1rem', fontWeight: '700' }}>f = {frameNum}</div>
            </div>
          )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          HARD DRIVE BOX
          FIX: z-index:10, overflow:visible
      ══════════════════════════════════════════════════════ */}
      {currentStep >= 2 && (
        <div ref={hdRef}
          className={`entity-box entity-hd ${isHdActive ? 'active' : ''}`}
          style={{
            top: '60%', left: '44%', width: '230px', minHeight: '140px',
            zIndex: 10, overflow: 'visible',
            opacity: (typeof displayStep === 'number' && displayStep >= 8) ? 0.45 : 1,
            transition: 'opacity 0.5s ease',
          }}
        >
          <span className="entity-icon" style={{ filter: 'hue-rotate(320deg)' }}>💾</span>
          <span className="entity-label" style={{ color: 'var(--miss-main)' }}>Hard Drive</span>
          <span className="entity-sub">Secondary Storage (Disk)</span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px', justifyContent: 'center' }}>
            {pageTable.filter(r => !r.valid).map(r => (
              <div key={r.page} style={{
                padding: '4px 10px', borderRadius: '6px',
                background: displayStep === '5a' && r.page === pageNum ? 'rgba(239,68,68,0.15)' : 'var(--bg-secondary)',
                border: displayStep === '5a' && r.page === pageNum ? '2px solid var(--miss-main)' : '1px solid rgba(239,68,68,0.3)',
                fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
                color: r.page === pageNum ? 'var(--miss-main)' : 'var(--text-muted)',
                fontWeight: r.page === pageNum ? '700' : '400',
                animation: displayStep === '5a' && r.page === pageNum ? 'pulse 1s infinite' : 'none',
              }}>Page {r.page}</div>
            ))}
            {!isHit && displayStep === '5b' && victimPage !== null && (
              <div style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(245,158,11,0.1)', border: '1px solid var(--cpu-border)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--cpu-main)', animation: 'fade-up 0.5s ease' }}>
                P{victimPage} ← Evicted
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          RAM BOX
          FIX: z-index:10, overflow:visible
      ══════════════════════════════════════════════════════ */}
      {currentStep >= 2 && (
        <div ref={ramRef}
          className={`entity-box entity-ram ${isRamActive ? 'active' : ''}`}
          style={{ top: '6%', left: '72%', width: '230px', minHeight: '310px', zIndex: 10, overflow: 'visible' }}
        >
          <span className="entity-icon">🗄️</span>
          <span className="entity-label">Physical RAM</span>
          <span className="entity-sub">Frames of {pageSize} bytes each</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '4px', marginTop: '10px', width: '100%', padding: '0 4px' }}>
            {Array.from({ length: 20 }, (_, i) => {
              const isTgt   = i === frameNum;
              const isRFlsh = isTgt && displayStep === '5b';
              const isAcc   = isTgt && typeof displayStep === 'number' && displayStep >= 6;
              const bg  = isRFlsh ? 'var(--tlb-main)' : isAcc ? 'var(--ram-main)' : 'var(--ram-bg)';
              const clr = (isRFlsh || isAcc) ? 'white' : isTgt ? 'var(--ram-main)' : 'var(--text-muted)';
              return (
                <div key={i} style={{
                  padding: '5px 2px', borderRadius: '5px', background: bg,
                  border: `1px solid ${isTgt ? (isRFlsh ? 'var(--tlb-main)' : 'var(--ram-border)') : 'transparent'}`,
                  fontFamily: 'var(--font-mono)', fontSize: '0.58rem', textAlign: 'center', color: clr,
                  fontWeight: isTgt ? '700' : '400', transition: 'all 0.5s ease', position: 'relative',
                  boxShadow: isTgt && typeof displayStep === 'number' && displayStep >= 8 ? '0 0 10px var(--ram-glow)' : isRFlsh ? '0 0 10px var(--tlb-glow)' : 'none',
                }}>
                  F{i}
                  {isRFlsh && (
                    <div style={{ position: 'absolute', top: '-15px', color: 'var(--tlb-main)', fontSize: '10px', width: '100%', left: 0, animation: 'fade-up 0.5s forwards', textAlign: 'center' }}>
                      P{pageNum}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {typeof displayStep === 'number' && displayStep >= 8 && (
            <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '8px', background: 'var(--ram-bg)', border: '1px solid var(--ram-border)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--ram-main)', textAlign: 'center', width: '100%', animation: 'fade-up 0.4s ease' }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '2px' }}>PHYSICAL ADDR</div>
              <div style={{ fontSize: '1rem', fontWeight: '700' }}>{physAddr}</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '2px' }}>({frameNum}×{pageSize})+{offset}</div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          STEP 7 — VAR ANCHORS
      ══════════════════════════════════════════════════════ */}
      {showVarAnchors && (
        <>
          {/* f — near Page Table */}
          <div style={{ position: 'absolute', left: '28%', top: '62%', zIndex: 20, animation: 'chipAppear 0.55s cubic-bezier(0.34,1.56,0.64,1) 0s both' }}>
            <div style={{ padding: '10px 16px', borderRadius: '14px', background: 'rgba(16,185,129,0.12)', border: '2px solid #10B981', boxShadow: '0 0 18px #10B98155', fontFamily: 'var(--font-mono)', textAlign: 'center', animation: 'varChipFloat 2.2s ease-in-out 0.6s infinite' }}>
              <div style={{ fontSize: '1rem', fontWeight: '800', color: '#10B981' }}>f = {frameNum}</div>
              <div style={{ fontSize: '0.56rem', color: 'var(--text-muted)', marginTop: '3px' }}>Frame # from Page Table</div>
              <div style={{ fontSize: '0.52rem', color: 'rgba(16,185,129,0.6)', marginTop: '1px' }}>physical RAM slot</div>
            </div>
            <div style={{ width: '2px', height: '12px', background: 'linear-gradient(#10B981,transparent)', margin: '0 auto' }} />
          </div>
          {/* PageSize — near CPU upper */}
          <div style={{ position: 'absolute', left: '22%', top: '7%', zIndex: 20, animation: 'chipAppear 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.15s both' }}>
            <div style={{ padding: '10px 16px', borderRadius: '14px', background: 'rgba(56,189,248,0.12)', border: '2px solid #38BDF8', boxShadow: '0 0 18px #38BDF855', fontFamily: 'var(--font-mono)', textAlign: 'center', animation: 'varChipFloat 2.2s ease-in-out 0.75s infinite' }}>
              <div style={{ fontSize: '1rem', fontWeight: '800', color: '#38BDF8' }}>PS = {pageSize}</div>
              <div style={{ fontSize: '0.56rem', color: 'var(--text-muted)', marginTop: '3px' }}>Page Size (your input)</div>
              <div style={{ fontSize: '0.52rem', color: 'rgba(56,189,248,0.6)', marginTop: '1px' }}>bytes per page/frame</div>
            </div>
            <div style={{ width: '2px', height: '12px', background: 'linear-gradient(#38BDF8,transparent)', margin: '0 auto' }} />
          </div>
          {/* d — near CPU lower */}
          <div style={{ position: 'absolute', left: '22%', top: '24%', zIndex: 20, animation: 'chipAppear 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.3s both' }}>
            <div style={{ padding: '10px 16px', borderRadius: '14px', background: 'rgba(245,158,11,0.12)', border: '2px solid #F59E0B', boxShadow: '0 0 18px #F59E0B55', fontFamily: 'var(--font-mono)', textAlign: 'center', animation: 'varChipFloat 2.2s ease-in-out 0.9s infinite' }}>
              <div style={{ fontSize: '1rem', fontWeight: '800', color: '#F59E0B' }}>d = {offset}</div>
              <div style={{ fontSize: '0.56rem', color: 'var(--text-muted)', marginTop: '3px' }}>Offset within page</div>
              <div style={{ fontSize: '0.52rem', color: 'rgba(245,158,11,0.6)', marginTop: '1px' }}>from address split</div>
            </div>
            <div style={{ width: '2px', height: '12px', background: 'linear-gradient(#F59E0B,transparent)', margin: '0 auto' }} />
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          STEP 8 — MERGE ANIMATION
      ══════════════════════════════════════════════════════ */}
      {showMerge && (
        <>
          <div style={{ position: 'absolute', left: '28%', top: '62%', zIndex: 25, padding: '10px 16px', borderRadius: '14px', background: 'rgba(16,185,129,0.15)', border: '2px solid #10B981', boxShadow: '0 0 22px #10B98177', fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: '800', color: '#10B981', animation: 'chipMergeF 1s cubic-bezier(0.55,0,1,0.45) 0s forwards' }}>f = {frameNum}</div>
          <div style={{ position: 'absolute', left: '22%', top: '7%', zIndex: 25, padding: '10px 16px', borderRadius: '14px', background: 'rgba(56,189,248,0.15)', border: '2px solid #38BDF8', boxShadow: '0 0 22px #38BDF877', fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: '800', color: '#38BDF8', animation: 'chipMergePS 1s cubic-bezier(0.55,0,1,0.45) 0.1s forwards' }}>PS = {pageSize}</div>
          <div style={{ position: 'absolute', left: '22%', top: '24%', zIndex: 25, padding: '10px 16px', borderRadius: '14px', background: 'rgba(245,158,11,0.15)', border: '2px solid #F59E0B', boxShadow: '0 0 22px #F59E0B77', fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: '800', color: '#F59E0B', animation: 'chipMergeD 1s cubic-bezier(0.55,0,1,0.45) 0.2s forwards' }}>d = {offset}</div>
          <div style={{ position: 'absolute', left: '50%', top: '44%', width: '100px', height: '100px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(16,185,129,0.5) 0%,rgba(139,92,246,0.3) 45%,transparent 70%)', animation: 'mergeFlash 0.7s ease 0.85s forwards', zIndex: 24, pointerEvents: 'none' }} />
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          SCI-FI FORMULA BOX (steps 7+)
      ══════════════════════════════════════════════════════ */}
      {showFormula && (
        <div className="eat-formula-box scifi-box show"
          style={{
            bottom: '7%', top: 'auto',
            transform: 'translateX(-50%) scale(1)',
            borderColor: 'rgba(16,185,129,0.5)',
            boxShadow: '0 0 60px var(--ram-glow)',
            animation: 'formulaExplode 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards',
            overflow: 'hidden',
            position: 'absolute',
            zIndex: 20,
          }}
        >
          <h3 style={{ color: 'var(--ram-main)', letterSpacing: '2px', marginBottom: '10px' }}>⚡ Physical Address Calculation</h3>
          <div className="formula-line">
            Physical = (<span className="var-green">f</span> × <span className="var-sky">PageSize</span>) + <span className="var-amber">d</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', margin: '14px 0', width: '100%' }}>
            {[
              { sym: 'f',        val: frameNum, color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', desc: 'Frame # from Page Table', sub: 'physical RAM slot' },
              { sym: 'PageSize', val: pageSize,  color: '#38BDF8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.3)', desc: 'Size of each page',       sub: 'bytes per frame'  },
              { sym: 'd',        val: offset,    color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', desc: 'Offset within page',      sub: 'byte position'    },
            ].map((v, idx) => (
              <div key={v.sym} style={{ padding: '9px 6px', borderRadius: '10px', background: v.bg, border: `1.5px solid ${v.border}`, textAlign: 'center', fontFamily: 'var(--font-mono)', animation: `chipAppear 0.45s cubic-bezier(0.34,1.56,0.64,1) ${idx * 0.1}s both` }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '2px' }}>{v.sym}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: v.color }}>{v.val}</div>
                <div style={{ fontSize: '0.53rem', color: 'var(--text-muted)', marginTop: '3px', lineHeight: 1.3 }}>{v.desc}</div>
                <div style={{ fontSize: '0.5rem', color: `${v.color}88`, marginTop: '1px' }}>{v.sub}</div>
              </div>
            ))}
          </div>
          <div className="formula-line" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>= ({frameNum} × {pageSize}) + {offset}</div>
          <div className="formula-result" style={{ color: 'var(--ram-main)', animation: 'answerZoom 0.75s cubic-bezier(0.34,1.56,0.64,1) 0.35s both' }}>= {physAddr}</div>
          {typeof displayStep === 'number' && displayStep >= 8 && (
            <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(16,185,129,0.08)', border: '1px solid var(--ram-border)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--ram-main)', lineHeight: 1.6, animation: 'fade-up 0.4s ease' }}>
              ✓ Frame <strong>{frameNum}</strong>, offset <strong>{offset}</strong> → byte <strong>{physAddr}</strong> retrieved.
              {!isHit && <span> ({replacementAlgo} evicted P{victimPage}.)</span>}
            </div>
          )}

          {/* ── Press Enter to Start Again — inside formula box at final step ── */}
          {isFinalStep && onRestart && (
            <div
              onClick={() => onRestart()}
              style={{
                marginTop: '18px', paddingTop: '14px',
                borderTop: '1px solid rgba(16,185,129,0.2)',
                textAlign: 'center', cursor: 'pointer',
              }}
            >
              <span style={{
                fontFamily: 'var(--font-mono)', fontWeight: '700',
                color: '#c0c0c0', fontSize: '0.9rem',
                textTransform: 'uppercase', letterSpacing: '4px',
                animation: 'font-glow-pulse-white 2s infinite ease-in-out',
              }}>
                Press Enter to Start Again
              </span>
              {!isHit && (
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Page table changes will persist in the next run.
                </div>
              )}
            </div>
          )}
        </div>
      )}



      {/* ══ Popup ══ */}
      <Popup
        visible={
          displayStep >= 3 &&
          !!activePopup.text && !showFormula && !showMerge
        }
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