import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';

/**
 * Cache Memory Simulation — Complete Rewrite
 *
 * Features:
 * - User inputs ONE block at a time (case-sensitive)
 * - Cache slots visually reorder on every access:
 *     LRU  → MRU at top (slot 1), LRU at bottom (evicted first)
 *     FIFO → Newest at top, Oldest at bottom (evicted first)
 * - Animations:
 *     HIT  → block glows + jumps to top (LRU) / stays but glows (FIFO)
 *     MISS → bottom slot flashes red + exits; new block slides into top
 * - Persistent cache via sessionStorage: survives page refresh; clears only when tab is closed
 * - Clean end: "End Simulation" → var anchors → merge → formula → "Press Enter to Start Again"
 * - Single info panel (no overlapping Popup + bottom panel)
 *
 * Steps:
 *   0       Theory — What is Cache?
 *   1       Theory — LRU vs FIFO
 *   2       Setup (policy + slot count)
 *   3…2+N  Block result steps (N = history.length this run)
 *   3+N     Frontier — input next block OR end simulation
 *   4+N     Var anchors
 *   5+N     Merge → formula
 *   6+N     Final summary (Press Enter)
 */

/* ─────────────────────────────────────────────────────────────────────────────
   PERSISTENT CACHE  —  sessionStorage backed
   ✔ Survives page refresh (F5 / Ctrl+R)
   ✔ Survives "Start Again" restarts
   ✔ Cleared automatically when the browser tab is closed (sessionStorage lifetime)
─────────────────────────────────────────────────────────────────────────────── */
const STORAGE_KEY = 'cache_sim_state';

const DEFAULT_CACHE_STATE = {
  slots: [],
  colorMap: {},
  time: 0,
  insertCounter: 0,
  policy: 'LRU',
  maxSlots: 3,
};

/** Load from sessionStorage, falling back to defaults. */
function loadCacheState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge to ensure all keys exist even if storage was written by an older version
      return { ...DEFAULT_CACHE_STATE, ...parsed };
    }
  } catch (e) { /* corrupt storage — ignore */ }
  return { ...DEFAULT_CACHE_STATE };
}

/** Persist current _cache object to sessionStorage. */
function saveCacheState() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      slots: _cache.slots,
      colorMap: _cache.colorMap,
      time: _cache.time,
      insertCounter: _cache.insertCounter,
      policy: _cache.policy,
      maxSlots: _cache.maxSlots,
    }));
  } catch (e) { /* storage full or unavailable — ignore */ }
}

// Initialise from sessionStorage on first module load
const _loaded = loadCacheState();
const _cache = {
  slots: _loaded.slots,
  colorMap: _loaded.colorMap,
  time: _loaded.time,
  insertCounter: _loaded.insertCounter,
  policy: _loaded.policy,
  maxSlots: _loaded.maxSlots,
};

const C_NS = 10;
const M_NS = 100;

const COLOR_PALETTE = [
  { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.5)', text: '#f59e0b' },
  { bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.5)', text: '#8b5cf6' },
  { bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.5)', text: '#0ea5e9' },
  { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.5)', text: '#10b981' },
  { bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.5)', text: '#ec4899' },
  { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.5)', text: '#eab308' },
  { bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.5)', text: '#06b6d4' },
  { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.5)', text: '#f97316' },
];

function blockColor(block) {
  if (!_cache.colorMap[block]) {
    const idx = Object.keys(_cache.colorMap).length % COLOR_PALETTE.length;
    _cache.colorMap[block] = COLOR_PALETTE[idx];
  }
  return _cache.colorMap[block];
}

/**
 * Sort slots for visual display:
 *   top = safest (most recently used / newest)
 *   bottom = next-to-evict (LRU: least recently used; FIFO: oldest)
 */
function sortedSlots(slots) {
  if (!slots || slots.length === 0) return [];
  if (_cache.policy === 'LRU') {
    // Highest lruTime → top (most recently used)
    return [...slots].sort((a, b) => b.lruTime - a.lruTime);
  }
  // FIFO: Highest insertOrder → top (newest), lowest → bottom (evicted first)
  return [...slots].sort((a, b) => b.insertOrder - a.insertOrder);
}

/** Process one block against the live cache. Returns a snapshot. */
function processBlock(block) {
  _cache.time++;
  const slots = _cache.slots;
  const idx = slots.findIndex(s => s.block === block); // CASE-SENSITIVE

  let hit = false, evicted = null, evictReason = '';

  if (idx !== -1) {
    // HIT
    hit = true;
    slots[idx].lruTime = _cache.time;   // update recency (matters for LRU reorder)
  } else {
    // MISS
    if (slots.length >= _cache.maxSlots) {
      let evictIdx;
      if (_cache.policy === 'FIFO') {
        evictIdx = slots.reduce((m, s, j) => s.insertOrder < slots[m].insertOrder ? j : m, 0);
        evictReason = `FIFO: "${slots[evictIdx].block}" was first loaded (#${slots[evictIdx].insertOrder})`;
      } else {
        evictIdx = slots.reduce((m, s, j) => s.lruTime < slots[m].lruTime ? j : m, 0);
        evictReason = `LRU: "${slots[evictIdx].block}" was least recently used (t=${slots[evictIdx].lruTime})`;
      }
      evicted = slots[evictIdx].block;
      slots.splice(evictIdx, 1);
    }
    _cache.insertCounter++;
    slots.push({ block, lruTime: _cache.time, insertOrder: _cache.insertCounter });
  }

  saveCacheState(); // persist after every mutation
  return {
    block, hit, evicted, evictReason,
    slotsAfter: slots.map(s => ({ ...s })),
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   COMPONENT
─────────────────────────────────────────────────────────────────────────────── */
export default function Cache({ currentStep, setMaxSteps, onRestart }) {
  const containerRef = useRef(null);
  const cpuRef = useRef(null);
  const cacheBoxRef = useRef(null);
  const ramRef = useRef(null);
  const inputRef = useRef(null);

  /* Setup */
  const [setupDone, setSetupDone] = useState(false);
  const [policyInput, setPolicyInput] = useState('LRU');
  const [slotsInput, setSlotsInput] = useState('3');

  /* Per-run block history */
  const [history, setHistory] = useState([]);

  /* Frontier block input */
  const [blockInput, setBlockInput] = useState('');

  /* Animation key — bumped on each check to re-trigger slot animations */
  const [animKey, setAnimKey] = useState(0);

  /* Formula phases */
  const [showVarAnchors, setShowVarAnchors] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [showFormula, setShowFormula] = useState(false);

  /* SVG arrows */
  const [svgLines, setSvgLines] = useState([]);
  const [anchorPositions, setAnchorPositions] = useState(null); // {cpu, cache, ram} bounding boxes

  /* ── Dynamic step structure ── */
  const histLen = history.length;
  const frontierStep = 3 + histLen;
  const varAnchorStep = frontierStep + 1;
  const mergeStep = varAnchorStep + 1;
  const finalStep = mergeStep + 1;
  useEffect(() => { setMaxSteps(finalStep); }, [setMaxSteps, finalStep]);

  const isBlockResultStep = currentStep >= 3 && currentStep < frontierStep;
  const isFrontierStep = currentStep === frontierStep;
  const isPostSim = currentStep > frontierStep;

  /* Entry for the currently displayed block-result step */
  const stepEntry = isBlockResultStep ? (history[currentStep - 3] ?? null) : null;

  /* Slots to render */
  const rawSlots = stepEntry ? stepEntry.slotsAfter : _cache.slots;
  const dispSlots = sortedSlots(rawSlots);

  /* Run statistics */
  const hits = history.filter(h => h.hit).length;
  const misses = histLen - hits;
  const H = histLen > 0 ? hits / histLen : 0;

  /* ── Setup handler ── */
  const handleSetup = () => {
    const ms = Math.max(1, Math.min(8, parseInt(slotsInput, 10) || 3));
    _cache.policy = policyInput;
    _cache.maxSlots = ms;
    saveCacheState();
    setSlotsInput(String(ms));
    setSetupDone(true);
  };

  /* ── Block check handler ── */
  const handleCheck = () => {
    const block = blockInput.trim(); // NO .toUpperCase() — case-sensitive
    if (!block) return;
    blockColor(block);
    const result = processBlock(block);
    setHistory(prev => [...prev, result]);
    setBlockInput('');
    setAnimKey(k => k + 1);
  };

  /* ── Restart: preserve _cache, reset run ── */
  const handleRestart = () => {
    setHistory([]);
    setSetupDone(false);
    setBlockInput('');
    setAnimKey(0);
    setShowVarAnchors(false);
    setShowMerge(false);
    setShowFormula(false);
    if (onRestart) onRestart();
  };

  /* ── Reset animation state on step 2 ── */
  useEffect(() => {
    if (currentStep === 2) {
      setSetupDone(false);
      setShowVarAnchors(false);
      setShowMerge(false);
      setShowFormula(false);
    }
  }, [currentStep]);

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

  /* ── Focus input on frontier ── */
  useEffect(() => {
    if (isFrontierStep && setupDone) setTimeout(() => inputRef.current?.focus(), 120);
  }, [isFrontierStep, setupDone, currentStep]);

  /* ── Enter key → restart at final step ── */
  useEffect(() => {
    if (currentStep !== finalStep) return;
    const h = (e) => { if (e.key === 'Enter') handleRestart(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [currentStep, finalStep]);

  /* ── Compute var-anchor positions from real box bounds ── */
  useLayoutEffect(() => {
    if (!showVarAnchors && !showMerge) return;
    const compute = () => {
      if (!containerRef.current) return;
      const cb = containerRef.current.getBoundingClientRect();
      const box = (ref) => {
        if (!ref?.current) return null;
        const r = ref.current.getBoundingClientRect();
        return {
          cx: r.left - cb.left + r.width / 2,
          cy: r.top - cb.top + r.height / 2,
          bottom: r.top - cb.top + r.height,
          width: r.width,
        };
      };
      setAnchorPositions({
        cpu: box(cpuRef),
        cache: box(cacheBoxRef),
        ram: box(ramRef),
      });
    };
    const t = setTimeout(compute, 60);
    return () => clearTimeout(t);
  }, [showVarAnchors, showMerge]);

  /* ── SVG path helper ── */
  const makePath = (x1, y1, x2, y2) => {
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  };

  /* ── Compute SVG arrows ── */
  useLayoutEffect(() => {
    const compute = () => {
      if (!containerRef.current || !(isBlockResultStep || isFrontierStep)) {
        setSvgLines([]); return;
      }
      const cb = containerRef.current.getBoundingClientRect();
      const box = (ref) => {
        if (!ref?.current) return null;
        const r = ref.current.getBoundingClientRect();
        return {
          cx: r.left - cb.left + r.width / 2, cy: r.top - cb.top + r.height / 2,
          left: r.left - cb.left, right: r.left - cb.left + r.width,
        };
      };
      const cpu = box(cpuRef);
      const cache = box(cacheBoxRef);
      const ram = box(ramRef);
      const lines = [];
      const isHit = stepEntry?.hit === true;
      const isMiss = stepEntry?.hit === false;

      if (cpu && cache)
        lines.push({ key: 'cpu-cache', path: makePath(cpu.right + 4, cpu.cy, cache.left - 4, cache.cy), color: '#F59E0B', animated: true });
      if (cache && ram && isMiss)
        lines.push({ key: 'cache-ram', path: makePath(cache.right + 4, cache.cy - 18, ram.left - 4, ram.cy - 18), color: '#EF4444', animated: true });
      if (cache && ram && isMiss)
        lines.push({ key: 'ram-cache', path: makePath(ram.left - 4, ram.cy + 18, cache.right + 4, cache.cy + 18), color: '#8B5CF6', animated: true });
      if (cpu && cache && isHit)
        lines.push({ key: 'cache-cpu', path: makePath(cache.left - 4, cache.cy + 18, cpu.right + 4, cpu.cy + 18), color: '#10B981', animated: true });

      setSvgLines(lines);
    };
    const t = setTimeout(compute, 80);
    window.addEventListener('resize', compute);
    return () => { clearTimeout(t); window.removeEventListener('resize', compute); };
  }, [currentStep, stepEntry, isBlockResultStep, isFrontierStep, histLen, animKey]);

  /* ── Step label ── */
  const stepLabel = (() => {
    if (currentStep <= 1) return `Step ${currentStep} — Theory`;
    if (currentStep === 2) return 'Step 2 — Setup';
    if (isFrontierStep) return `Step ${frontierStep} — Enter Block`;
    if (currentStep === varAnchorStep) return `Step ${currentStep} — Variables Gathered`;
    if (currentStep === mergeStep) return `Step ${currentStep} — Formula Merge`;
    if (currentStep === finalStep) return `Step ${currentStep} — Summary`;
    if (stepEntry) {
      if (stepEntry.hit) return `Step ${currentStep} — Cache Hit (${stepEntry.block})`;
      if (stepEntry.evicted) return `Step ${currentStep} — ${_cache.policy} Eviction (${stepEntry.block})`;
      return `Step ${currentStep} — Cache Miss (${stepEntry.block})`;
    }
    return `Step ${currentStep}`;
  })();

  /* ── Info panel content ── */
  const infoPanel = (() => {
    if (!stepEntry) return null;
    const { block, hit, evicted, evictReason } = stepEntry;
    if (hit) return {
      title: `Cache Hit — Block "${block}"`,
      body: `CPU requests Block "${block}". Found in Cache — Cache HIT! Served instantly (${C_NS}ns). No RAM access needed.`
        + (_cache.policy === 'LRU' ? ` LRU: "${block}" promoted to top (most recently used). All other blocks shift down one position.` : ` FIFO: slot order unchanged on hit.`),
      formula: `Hit Path: Access Time = C = ${C_NS}ns`,
      color: '#10b981',
    };
    if (evicted) return {
      title: `${_cache.policy} Eviction — Miss for "${block}"`,
      body: `CPU requests Block "${block}". Not in Cache — MISS! Cache full → ${_cache.policy} evicts "${evicted}" from bottom slot. "${block}" fetched from RAM (${M_NS}ns), placed at top. ${evictReason}.`,
      formula: `${_cache.policy}: Evict "${evicted}" (bottom) → Load "${block}" (top) | Cost = M = ${M_NS}ns`,
      color: '#ef4444',
    };
    return {
      title: `Cache Miss — Block "${block}"`,
      body: `CPU requests Block "${block}". Not in Cache — MISS! Empty slot available. "${block}" fetched from RAM (${M_NS}ns) and placed at top.`,
      formula: `Miss Path: Access Time = M = ${M_NS}ns`,
      color: '#ef4444',
    };
  })();

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════════ */
  return (
    <div ref={containerRef}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'visible' }}>

      {/* ══ Keyframes ══ */}
      <style>{`
        @keyframes cacheDash { to { stroke-dashoffset: -20; } }
        .cache-dash { stroke-dasharray:8,4; animation:cacheDash 1.5s linear infinite; }

        /* New block enters: slides down from above into slot */
        @keyframes cacheEnter {
          0%   { opacity:0; transform:translateY(-26px) scale(0.88); }
          55%  { opacity:1; transform:translateY(4px) scale(1.03); }
          100% { opacity:1; transform:translateY(0) scale(1); }
        }
        /* HIT — block promoted/highlighted */
        @keyframes cachePromote {
          0%   { box-shadow:none; transform:scale(1); }
          30%  { box-shadow:0 0 24px 5px rgba(16,185,129,0.65); transform:scale(1.05); }
          65%  { box-shadow:0 0 14px 2px rgba(16,185,129,0.3); transform:scale(1.01); }
          100% { box-shadow:none; transform:scale(1); }
        }
        /* FIFO HIT — no reorder, just glow */
        @keyframes cacheFifoHit {
          0%   { box-shadow:none; }
          30%  { box-shadow:0 0 20px 4px rgba(245,158,11,0.6); }
          100% { box-shadow:none; }
        }
        /* Evicted slot — flashes red and exits right */
        @keyframes cacheEvict {
          0%   { opacity:1; transform:scale(1) translateX(0); }
          35%  { opacity:0.85; transform:scale(1.04) translateX(4px); background:rgba(239,68,68,0.28) !important; box-shadow:0 0 20px rgba(239,68,68,0.6); }
          100% { opacity:0; transform:scale(0.85) translateX(28px); }
        }
        /* Non-top slots shift position on reorder */
        @keyframes cacheShift {
          from { opacity:0.6; transform:translateY(-8px); }
          to   { opacity:1;   transform:translateY(0); }
        }

        /* Chip animations */
        @keyframes cacheChipAppear {
          0%   { transform:scale(0.3)translateY(14px); opacity:0; filter:blur(8px); }
          65%  { transform:scale(1.08)translateY(-3px); opacity:1; filter:blur(0); }
          100% { transform:scale(1)translateY(0); opacity:1; }
        }
        @keyframes cacheChipFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes cacheChipMergeH { 0%{opacity:1;transform:translate(0,0)scale(1)} 100%{opacity:0;transform:var(--merge-h-to) scale(0.1);filter:blur(10px)} }
        @keyframes cacheChipMergeC { 0%{opacity:1;transform:translate(0,0)scale(1)} 100%{opacity:0;transform:var(--merge-c-to) scale(0.1);filter:blur(10px)} }
        @keyframes cacheChipMergeM { 0%{opacity:1;transform:translate(0,0)scale(1)} 100%{opacity:0;transform:var(--merge-m-to) scale(0.1);filter:blur(10px)} }
        @keyframes cacheMergeFlash {
          0%  { opacity:0; transform:translate(-50%,-50%)scale(0.2); }
          40% { opacity:1; transform:translate(-50%,-50%)scale(1.2); }
          100%{ opacity:0; transform:translate(-50%,-50%)scale(2); }
        }
        @keyframes cacheFormulaExplode {
          0%  { transform:translateX(-50%)scale(0.15); opacity:0; filter:blur(20px); }
          55% { transform:translateX(-50%)scale(1.04); filter:blur(0); }
          100%{ transform:translateX(-50%)scale(1); opacity:1; }
        }
        @keyframes cacheAnswerZoom {
          0%  { transform:scale(0.2); opacity:0; letter-spacing:12px; filter:blur(6px); }
          60% { transform:scale(1.15); letter-spacing:2px; }
          100%{ transform:scale(1); opacity:1; letter-spacing:normal; filter:blur(0); }
        }
        @keyframes cacheScanline {
          0%  { top:-4px; opacity:0.7; }
          100%{ top:110%; opacity:0; }
        }
        @keyframes cacheGlowPulse {
          0%,100%{ text-shadow:0 0 8px rgba(192,192,192,0.3); transform:scale(1); }
          50%    { text-shadow:0 0 20px rgba(192,192,192,0.8),0 0 35px rgba(192,192,192,0.5); transform:scale(1.05); }
        }
        @keyframes cacheInfoIn {
          from { opacity:0; transform:translateX(-50%) translateY(12px); }
          to   { opacity:1; transform:translateX(-50%) translateY(0); }
        }
        @keyframes cacheBadgeIn {
          0%   { transform:translateX(-50%) scale(0.4); opacity:0; }
          65%  { transform:translateX(-50%) scale(1.1); opacity:1; }
          100% { transform:translateX(-50%) scale(1); opacity:1; }
        }

        .cache-scifi-box::after {
          content:''; position:absolute; left:0; right:0; height:2px; top:-4px;
          background:linear-gradient(90deg,transparent,rgba(139,92,246,0.7),transparent);
          animation:cacheScanline 2.4s linear 0.5s infinite; pointer-events:none;
        }
      `}</style>

      {/* ══ SVG Arrows ══ */}
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 11, overflow: 'visible' }}>
        <defs>
          {svgLines.map(l => (
            <React.Fragment key={l.key}>
              <marker id={`ca-${l.key}`} markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="strokeWidth">
                <polygon points="0 0,10 4,0 8" fill={l.color} />
              </marker>
              <filter id={`cg-${l.key}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </React.Fragment>
          ))}
        </defs>
        {svgLines.map(l => (
          <path key={l.key} d={l.path} fill="none" stroke={l.color} strokeWidth="2.5"
            className={l.animated ? 'cache-dash' : ''}
            markerEnd={`url(#ca-${l.key})`} filter={`url(#cg-${l.key})`} />
        ))}
      </svg>

      {/* ══ Step Label ══ */}
      {currentStep >= 0 && <div className="step-label animate-in">{stepLabel}</div>}

      {/* ═══════════════════════════════════════════════════════════════════
          THEORY 0
      ═══════════════════════════════════════════════════════════════════ */}
      <div className={`theory-card ${currentStep === 0 ? 'show' : ''}`} style={{ top: '45%' }}>
        <div className="theory-icon">⚡</div>
        <h2>What is Cache Memory?</h2>
        <p className="theory-text">
          The CPU is millions of times faster than Main RAM. A <strong>Cache</strong> is a tiny,
          ultra-fast memory built close to the CPU, holding the most-used data blocks.
        </p>
        <div className="theory-analogy">
          <strong>📌 Analogy:</strong> You are a chef (CPU). Cache = <strong>tiny spice rack</strong> on
          the counter. RAM = giant basement pantry.<br /><br />
          Salt on the rack? Grab it instantly → <strong>Cache Hit ({C_NS}ns)</strong>.<br />
          Saffron only in the basement? Walk down and back → <strong>Cache Miss ({M_NS}ns)</strong>.
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          THEORY 1
      ═══════════════════════════════════════════════════════════════════ */}
      <div className={`theory-card ${currentStep === 1 ? 'show' : ''}`} style={{ top: '45%' }}>
        <div className="theory-icon">🔄</div>
        <h2>Eviction Policies: LRU vs FIFO</h2>
        <p className="theory-text">
          When Cache is full and a new block must be loaded, one existing block must be
          <strong> evicted</strong>. The ordering and eviction depends on the policy.
        </p>
        <div className="theory-analogy">
          <strong>🔵 LRU — Least Recently Used:</strong><br />
          Slot order = recency. <strong>Top = Most Recently Used</strong> (safest).
          <strong> Bottom = Least Recently Used</strong> (evicted first).
          On a HIT, the block <em>moves to the top</em>.<br /><br />
          <strong>🟢 FIFO — First In, First Out:</strong><br />
          Slot order = insertion time. <strong>Top = Newest</strong>.
          <strong> Bottom = Oldest</strong> (evicted first). HITs don't reorder slots.<br /><br />
          Formula: <code>Avg = H×C + (1−H)×M</code>&emsp;
          <strong>H</strong>=Hit Ratio · <strong>C={C_NS}ns</strong> · <strong>M={M_NS}ns</strong><br /><br />
          <em>Block names are case-sensitive: "A" ≠ "a" ≠ "block1".</em>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          STEP 2 — SETUP
      ═══════════════════════════════════════════════════════════════════ */}
      {currentStep === 2 && (
        <div style={{
          position: 'absolute', top: '15%', left: '38%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
        }}>
          <div style={{ pointerEvents: 'all' }}>
            <div className="entity-box entity-cpu" style={{ width: '340px', padding: '28px 32px', textAlign: 'center', margin: '0 auto' }}>
            <span className="entity-icon">⚙️</span>
            <span className="entity-label">Setup Cache Simulation</span>
            <span className="entity-sub">Configure before you begin</span>

            {!setupDone ? (
              <div className="user-input-group" style={{ marginTop: '18px' }}>
                <label>Eviction Policy</label>
                <select value={policyInput} onChange={e => setPolicyInput(e.target.value)}
                  onKeyDown={e => e.stopPropagation()}
                  style={{
                    marginBottom: '12px', padding: '7px 10px', borderRadius: '6px',
                    border: '1px solid var(--cpu-border)', background: 'white', color: '#333',
                    fontFamily: 'var(--font-mono)', width: '100%', fontSize: '0.8rem'
                  }}>
                  <option value="LRU">LRU — Least Recently Used</option>
                  <option value="FIFO">FIFO — First In, First Out</option>
                </select>

                <label>Cache Slots (1 – 8)</label>
                <input type="number" min="1" max="8" value={slotsInput}
                  onChange={e => setSlotsInput(e.target.value)}
                  onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') handleSetup(); }}
                  style={{ marginBottom: '14px' }} />

                {_cache.slots.length > 0 && (
                  <div style={{
                    padding: '10px 12px', borderRadius: '8px',
                    background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.3)',
                    fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#10b981',
                    marginBottom: '12px', textAlign: 'left', lineHeight: 1.6,
                  }}>
                    ♻️ <strong>Cache carries over from last run:</strong><br />
                    {_cache.slots.map(s => (
                      <span key={s.block} style={{
                        display: 'inline-block', marginRight: '5px', marginTop: '4px',
                        padding: '2px 7px', borderRadius: '10px',
                        background: blockColor(s.block).bg,
                        border: `1px solid ${blockColor(s.block).border}`,
                        color: blockColor(s.block).text, fontWeight: '700',
                      }}>"{s.block}"</span>
                    ))}
                  </div>
                )}
                <button className="submit-btn" onClick={handleSetup}>Start Simulation →</button>
              </div>
            ) : (
              <div style={{ marginTop: '16px', fontFamily: 'var(--font-mono)', color: 'var(--cpu-main)', lineHeight: 2 }}>
                <div>Policy: <strong>{_cache.policy}</strong></div>
                <div>Slots: <strong>{_cache.maxSlots}</strong></div>
                {_cache.slots.length > 0 && (
                  <div style={{ fontSize: '0.7rem', color: '#10b981', marginTop: '4px' }}>
                    {_cache.slots.length} block(s) already in cache
                  </div>
                )}
                <div style={{ marginTop: '10px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Press <strong>Next →</strong> to begin
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

      {/* ═══════════════════════════════════════════════════════════════════
          STEPS 3 … finalStep  —  SIMULATION & RESULTS
      ═══════════════════════════════════════════════════════════════════ */}
      {currentStep >= 3 && (
        <>
      {/* ── HIT / MISS badge ── */}
      {isBlockResultStep && stepEntry && (
        <div className={`hit-badge ${stepEntry.hit ? 'hit' : 'miss'} show`}
          style={{
            position: 'absolute', top: '3%', left: '50%',
            animation: 'cacheBadgeIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
            zIndex: 15, whiteSpace: 'nowrap',
          }}>
          {stepEntry.hit ? '✓ CACHE HIT' : '✗ CACHE MISS'}
        </div>
      )}

      {/* ════════ CPU BOX ════════ */}
      <div ref={cpuRef}
        className={`entity-box entity-cpu ${isFrontierStep || isBlockResultStep ? 'active' : ''}`}
        style={{ top: '8%', left: '4%', width: '215px', minHeight: '130px', zIndex: 10, overflow: 'visible' }}>
        <span className="entity-icon">🖥️</span>
        <span className="entity-label">CPU</span>
        <span className="entity-sub">Requesting Data</span>

        {/* Result step — show what was requested */}
        {isBlockResultStep && stepEntry && (
          <div style={{
            marginTop: '10px', padding: '8px 10px', borderRadius: '8px', width: '100%',
            background: stepEntry.hit ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1.5px solid ${stepEntry.hit ? '#10b981' : '#ef4444'}`,
            fontFamily: 'var(--font-mono)', textAlign: 'center',
            animation: 'cacheEnter 0.4s ease both',
          }}>
            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '3px' }}>REQUESTING</div>
            <div style={{
              fontSize: '1.1rem', fontWeight: '800',
              color: stepEntry.hit ? '#10b981' : '#ef4444',
            }}>
              Block {stepEntry.block}
            </div>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
              <span style={{
                padding: '2px 8px', borderRadius: '10px', fontSize: '0.6rem', fontWeight: '700',
                background: stepEntry.hit ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                color: stepEntry.hit ? '#10b981' : '#ef4444',
              }}>
                {stepEntry.hit ? `HIT · ${C_NS}ns` : `MISS · ${M_NS}ns`}
              </span>
              <span style={{
                padding: '2px 8px', borderRadius: '10px', fontSize: '0.6rem',
                background: 'rgba(139,92,246,0.1)', color: 'var(--tlb-main)',
              }}>
                {_cache.policy}
              </span>
            </div>
          </div>
        )}

        {/* Frontier step — block input */}
        {isFrontierStep && (
          <div style={{ marginTop: '10px', width: '100%' }}>
            <div style={{
              fontSize: '0.54rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
              letterSpacing: '1px', marginBottom: '5px',
            }}>BLOCK NAME (case-sensitive)</div>
            <input ref={inputRef} type="text" placeholder='e.g. A, block1, X3'
              value={blockInput}
              onChange={e => setBlockInput(e.target.value)}
              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') handleCheck(); }}
              style={{
                width: '100%', padding: '7px 9px', borderRadius: '7px',
                border: '1.5px solid var(--cpu-border)', background: 'var(--cpu-bg)',
                fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--cpu-main)',
                outline: 'none', boxSizing: 'border-box', marginBottom: '7px',
              }} />
            <button onClick={handleCheck}
              style={{
                width: '100%', padding: '8px', borderRadius: '7px',
                background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                border: 'none', color: 'white', fontFamily: 'var(--font-mono)',
                fontSize: '0.76rem', fontWeight: '700', cursor: 'pointer', letterSpacing: '0.5px',
              }}>
              CHECK CACHE →
            </button>
          </div>
        )}

        {!isFrontierStep && (
          <div style={{
            marginTop: '7px', padding: '3px 8px', borderRadius: '6px',
            background: 'rgba(139,92,246,0.08)', border: '1px solid var(--tlb-border)',
            fontFamily: 'var(--font-mono)', fontSize: '0.6rem',
            color: 'var(--tlb-main)', letterSpacing: '1px', textAlign: 'center',
          }}>{_cache.policy}</div>
        )}
      </div>

      {/* ════════ CACHE BOX ════════ */}
      <div ref={cacheBoxRef}
        className="entity-box entity-tlb"
        style={{
          top: '5%', left: '36%', width: '245px',
          minHeight: `${110 + _cache.maxSlots * 62}px`,
          zIndex: 10, overflow: 'visible',
          ...(isBlockResultStep && stepEntry ? {
            border: `2px solid ${stepEntry.hit ? '#10b981' : '#ef4444'}`,
            boxShadow: `0 0 28px ${stepEntry.hit ? '#10b98140' : '#ef444440'}`,
          } : {}),
          transition: 'border-color 1.2s ease, box-shadow 1.2s ease',
        }}>
        <span className="entity-icon" style={{ fontSize: '1.3rem' }}>⚡</span>
        <span className="entity-label" style={{
          color: isBlockResultStep && stepEntry
            ? (stepEntry.hit ? 'var(--hit-color)' : 'var(--miss-color)')
            : 'var(--tlb-main)',
        }}>Cache</span>
        <span className="entity-sub">{_cache.maxSlots} Slots — Ultra-Fast Memory</span>

        {/* Ordering hint */}
        <div style={{
          fontSize: '0.5rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
          textAlign: 'center', letterSpacing: '0.4px', marginTop: '4px', opacity: 0.75,
          display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 2px',
        }}>
          <span>↑ {_cache.policy === 'LRU' ? 'Most Recent' : 'Newest'}</span>
          <span>↓ {_cache.policy === 'LRU' ? 'Evict next' : 'Oldest → Evict'}</span>
        </div>

        {/* ── Slot list (policy-sorted) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', marginTop: '8px' }}>
          {Array.from({ length: _cache.maxSlots }, (_, i) => {
            const slot = dispSlots[i];
            const col = slot ? blockColor(slot.block) : null;

            // Animation classification
            const isTop = i === 0;
            const isNewBlock = slot && stepEntry && !stepEntry.hit && slot.block === stepEntry.block;
            const isPromoted = slot && stepEntry && stepEntry.hit && slot.block === stepEntry.block && _cache.policy === 'LRU' && isTop;
            const isFifoHit = slot && stepEntry && stepEntry.hit && slot.block === stepEntry.block && _cache.policy === 'FIFO';

            /* animation string per slot */
            const animStr = isNewBlock
              ? `cacheEnter 0.48s cubic-bezier(0.34,1.56,0.64,1) 0s both`
              : isPromoted
                ? `cachePromote 0.55s ease 0s both`
                : isFifoHit
                  ? `cacheFifoHit 0.55s ease 0s both`
                  : slot
                    ? `cacheShift 1s ease ${i * 0.15}s both`
                    : 'none';

            /* active border/bg for hit/miss block */
            const isActive = isNewBlock || isPromoted || isFifoHit;
            const activeBg = isActive
              ? (stepEntry?.hit ? 'rgba(16,185,129,0.14)' : 'rgba(139,92,246,0.14)')
              : slot ? col.bg : 'var(--bg-secondary)';
            const activeBorder = isActive
              ? `1.5px solid ${stepEntry?.hit ? '#10b981' : '#8b5cf6'}`
              : slot ? `1.5px solid ${col.border}` : '1.5px dashed rgba(255,255,255,0.08)';

            /* Top/bottom labels */
            const topLabel = isTop && slot && dispSlots.length > 1
              ? (_cache.policy === 'LRU' ? '🟢 MRU' : '🆕 NEW')
              : null;
            const bottomLabel = i === dispSlots.length - 1 && dispSlots.length === _cache.maxSlots
              ? '🔴 EVICT NEXT'
              : null;

            return (
              <div key={`slot-${animKey}-${i}-${slot?.block ?? 'empty'}`}
                style={{
                  padding: '7px 10px', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  position: 'relative',
                  background: activeBg,
                  border: activeBorder,
                  boxShadow: isPromoted ? '0 0 16px #10b98155' : isNewBlock ? '0 0 16px #8b5cf655' : isFifoHit ? '0 0 14px #f59e0b44' : 'none',
                  animation: animStr,
                }}>

                {/* Slot number bubble */}
                <span style={{
                  width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                  background: slot ? col.border : 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.64rem', fontWeight: '700', color: 'white',
                }}>{i + 1}</span>

                {slot ? (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: '800',
                      color: isActive ? (stepEntry?.hit ? '#10b981' : '#8b5cf6') : col.text,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      Block {slot.block}
                    </div>
                    <div style={{ fontSize: '0.53rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {_cache.policy === 'LRU' ? `last used: t=${slot.lruTime}` : `loaded: #${slot.insertOrder}`}
                    </div>
                  </div>
                ) : (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    — empty —
                  </span>
                )}

                {/* MRU / EVICT NEXT badges */}
                {slot && (topLabel || bottomLabel) && (
                  <span style={{
                    fontSize: '0.46rem', fontFamily: 'var(--font-mono)', fontWeight: '700',
                    color: topLabel ? '#10b981' : '#ef4444',
                    background: topLabel ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    padding: '2px 5px', borderRadius: '6px', whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {topLabel ?? bottomLabel}
                  </span>
                )}
              </div>
            );
          })}

          {/* Evicted block tombstone (briefly shown during eviction) */}
          {isBlockResultStep && stepEntry?.evicted && (
            <div style={{
              padding: '6px 10px', borderRadius: '8px',
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(239,68,68,0.08)',
              border: '1.5px solid rgba(239,68,68,0.4)',
              animation: 'cacheEvict 0.55s ease forwards',
              overflow: 'hidden',
            }}>
              <span style={{
                width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                background: 'rgba(239,68,68,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.64rem', color: 'white',
              }}>✕</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: '800',
                  color: '#ef4444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  Block {stepEntry.evicted}
                </div>
                <div style={{ fontSize: '0.52rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  evicted ({_cache.policy})
                </div>
              </div>
              <span style={{
                fontSize: '0.48rem', fontFamily: 'var(--font-mono)', fontWeight: '700',
                color: '#ef4444', background: 'rgba(239,68,68,0.1)',
                padding: '2px 5px', borderRadius: '6px', whiteSpace: 'nowrap', flexShrink: 0,
              }}>REMOVED</span>
            </div>
          )}
        </div>

        {/* Bottom chips */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', justifyContent: 'center' }}>
          <span style={{
            padding: '2px 9px', borderRadius: '10px',
            border: '1px solid var(--tlb-border)',
            fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--tlb-main)',
          }}>{_cache.policy}</span>
          <span style={{
            padding: '2px 9px', borderRadius: '10px',
            border: '1px solid var(--cpu-border)',
            fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--cpu-main)',
          }}>C = {C_NS}ns</span>
        </div>
      </div>

      {/* ════════ MAIN RAM BOX ════════ */}
      <div ref={ramRef}
        className={`entity-box entity-ram ${isBlockResultStep && stepEntry && !stepEntry.hit ? 'active' : ''}`}
        style={{ top: '6%', right: '4%', width: '210px', minHeight: '270px', zIndex: 10, overflow: 'visible' }}>
        <span className="entity-icon">🗄️</span>
        <span className="entity-label">Main RAM</span>
        <span className="entity-sub">Slow — Basement Pantry</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '5px', marginTop: '10px', width: '100%' }}>
          {Object.keys(_cache.colorMap).slice(0, 8).map(b => {
            const col = blockColor(b);
            const isFetching = isBlockResultStep && stepEntry && b === stepEntry.block && !stepEntry.hit;
            const inCache = dispSlots.some(s => s.block === b);
            return (
              <div key={b} style={{
                padding: '5px 4px', borderRadius: '6px', textAlign: 'center',
                background: isFetching ? 'rgba(139,92,246,0.15)' : inCache ? 'rgba(16,185,129,0.07)' : col.bg,
                border: `1px solid ${isFetching ? '#8b5cf6' : inCache ? '#10b981' : col.border}`,
                fontFamily: 'var(--font-mono)',
                color: isFetching ? '#8b5cf6' : inCache ? '#10b981' : col.text,
                fontWeight: (isFetching || inCache) ? '700' : '400', transition: 'all 1.2s ease',
              }}>
                <div style={{ fontSize: '0.63rem', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Block {b}
                </div>
                <div style={{ fontSize: '0.5rem', color: 'var(--text-muted)' }}>
                  {isFetching ? 'fetching…' : inCache ? 'in cache' : 'stored'}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{
          marginTop: '8px', padding: '5px 8px', borderRadius: '6px',
          background: 'rgba(16,185,129,0.06)', border: '1px solid var(--ram-border)',
          fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
          color: 'var(--ram-main)', textAlign: 'center', width: '100%',
        }}>Access Time: M = {M_NS}ns</div>
      </div>

      {/* ════════ RUN HISTORY ════════ */}
      {history.length > 0 && (
        <div style={{
          position: 'absolute', bottom: '14%', right: '4%',
          width: '195px', maxHeight: '188px', overflowY: 'auto',
          zIndex: 10, background: 'var(--bg-secondary)',
          border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '8px 10px',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '0.53rem', color: 'var(--text-muted)',
            letterSpacing: '1px', marginBottom: '5px', textTransform: 'uppercase',
          }}>
            This Run · {hits}H / {misses}M
          </div>
          {history.map((h, i) => {
            const col = blockColor(h.block);
            const isCur = i === currentStep - 3;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '3px 5px', borderRadius: '5px', marginBottom: '2px',
                background: isCur ? (h.hit ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)') : 'transparent',
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--text-muted)', minWidth: '18px' }}>
                  #{i + 1}
                </span>
                <span style={{
                  fontFamily: 'var(--font-display)', fontSize: '0.72rem', fontWeight: '700',
                  color: col.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {h.block}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.56rem', fontWeight: '700',
                  color: h.hit ? 'var(--hit-color)' : 'var(--miss-color)', whiteSpace: 'nowrap',
                }}>
                  {h.hit ? 'HIT' : 'MISS'}{h.evicted ? ` −${h.evicted}` : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ════════ INFO PANEL (single — no duplicate Popup) ════════ */}
      {isBlockResultStep && infoPanel && (
        <div style={{
          position: 'absolute', bottom: '14%', left: '50%',
          transform: 'translateX(-50%)',
          width: 'clamp(300px, 48vw, 540px)',
          padding: '15px 18px', borderRadius: '12px', zIndex: 10,
          background: '#0d1117',
          border: `1.5px solid ${infoPanel.color}55`,
          boxShadow: `0 0 28px ${infoPanel.color}22`,
          fontFamily: 'var(--font-mono)',
          animation: 'cacheInfoIn 0.4s ease both',
        }}>
          <div style={{
            fontSize: '0.57rem', letterSpacing: '2px', marginBottom: '7px',
            color: infoPanel.color, opacity: 0.9, textTransform: 'uppercase',
          }}>
            Step {currentStep} — {infoPanel.title}
          </div>
          <div style={{ fontSize: '0.76rem', lineHeight: 1.65, color: '#e2e8f0' }}>
            {infoPanel.body}
          </div>
          <div style={{
            marginTop: '8px', padding: '7px 10px', borderRadius: '6px',
            background: 'rgba(255,255,255,0.04)',
            fontSize: '0.7rem', color: infoPanel.color,
            wordBreak: 'break-word',
          }}>
            {infoPanel.formula}
          </div>
        </div>
      )}

      {/* ════════ FRONTIER HINT ════════ */}
      {isFrontierStep && (
        <div style={{
          position: 'absolute', bottom: '14%', left: '50%',
          transform: 'translateX(-50%)',
          width: 'clamp(280px, 46vw, 500px)',
          padding: '15px 18px', borderRadius: '12px', zIndex: 10,
          background: '#0d1117', border: '1.5px solid rgba(245,158,11,0.4)',
          fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
          color: '#e2e8f0', lineHeight: 1.65,
          animation: 'cacheInfoIn 0.4s ease both',
        }}>
          <div style={{ color: '#f59e0b', fontSize: '0.57rem', letterSpacing: '2px', marginBottom: '6px', textTransform: 'uppercase' }}>
            {history.length === 0 ? 'Ready — Enter First Block' : `Continue — Block #${history.length + 1}`}
          </div>
          {history.length === 0
            ? <>Type a block name above and press <strong style={{ color: '#f59e0b' }}>CHECK CACHE</strong>.
              {_cache.slots.length > 0 && <> Cache has <strong style={{ color: '#10b981' }}>{_cache.slots.length}</strong> block(s) from the previous run already loaded!</>}</>
            : <>Enter another block, or press <strong style={{ color: '#a78bfa' }}>Next →</strong> to end the simulation and view the performance formula.</>}
        </div>
      )}
    </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          VAR ANCHORS — chips appear just below each source component
      ═══════════════════════════════════════════════════════════════════ */}
      {showVarAnchors && anchorPositions && (() => {
    const GAP = 18; // px gap between box bottom and chip top
    const chips = [
      {
        key: 'H', src: anchorPositions.cpu,
        color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',
        label: `H = ${H.toFixed(2)}`, sub: 'Hit Ratio', subsub: `${hits} ÷ ${histLen}`,
        delay: '0s',
      },
      {
        key: 'C', src: anchorPositions.cache,
        color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',
        label: `C = ${C_NS}ns`, sub: 'Cache Time', subsub: 'ultra-fast',
        delay: '0.15s',
      },
      {
        key: 'M', src: anchorPositions.ram,
        color: '#10B981', bg: 'rgba(16,185,129,0.12)',
        label: `M = ${M_NS}ns`, sub: 'RAM Time', subsub: 'slow memory',
        delay: '0.3s',
      },
    ];
    return (
      <>
        {chips.map(v => {
          if (!v.src) return null;
          const chipW = 120;
          const left = v.src.cx - chipW / 2;
          const top = v.src.bottom + GAP;
          return (
            <div key={v.key} style={{
              position: 'absolute',
              left: `${left}px`,
              top: `${top}px`,
              width: `${chipW}px`,
              zIndex: 20,
              animation: `cacheChipAppear 0.55s cubic-bezier(0.34,1.56,0.64,1) ${v.delay} both`,
            }}>
              {/* connector line from box bottom to chip */}
              <div style={{
                width: '2px', height: `${GAP}px`,
                background: `linear-gradient(${v.color},${v.color}88)`,
                margin: '0 auto',
                transform: 'translateY(-100%)',
                position: 'absolute', left: '50%', top: 0,
                marginLeft: '-1px',
              }} />
              <div style={{
                padding: '10px 12px', borderRadius: '14px', background: v.bg,
                border: `2px solid ${v.color}`, boxShadow: `0 0 18px ${v.color}55`,
                fontFamily: 'var(--font-mono)', textAlign: 'center',
                animation: `cacheChipFloat 2.2s ease-in-out ${v.delay} infinite`,
              }}>
                <div style={{ fontSize: '0.95rem', fontWeight: '800', color: v.color, whiteSpace: 'nowrap' }}>{v.label}</div>
                <div style={{ fontSize: '0.54rem', color: 'var(--text-muted)', marginTop: '3px' }}>{v.sub}</div>
                <div style={{ fontSize: '0.5rem', color: `${v.color}99`, marginTop: '1px', whiteSpace: 'nowrap' }}>{v.subsub}</div>
              </div>
            </div>
          );
        })}
      </>
    );
  })()}

      {/* ═══════════════════════════════════════════════════════════════════
          MERGE ANIMATION — chips fly from source boxes toward centre
      ═══════════════════════════════════════════════════════════════════ */}
      {showMerge && anchorPositions && (() => {
    const GAP = 18;
    const chipW = 120;
    // Target: cache box centre (chips fly there and shrink)
    const tgtX = anchorPositions.cache ? anchorPositions.cache.cx : 0;
    const tgtY = anchorPositions.cache ? anchorPositions.cache.cy : 0;

    const chipPos = (src) => src
      ? { left: src.cx - chipW / 2, top: src.bottom + GAP }
      : { left: 0, top: 0 };

    const toVar = (src) => {
      if (!src) return 'translate(0,0)';
      const pos = chipPos(src);
      const chipCx = pos.left + chipW / 2;
      const chipCy = pos.top + 24; // approx chip mid height
      const dx = tgtX - chipCx;
      const dy = tgtY - chipCy;
      return `translate(${dx}px,${dy}px)`;
    };

    const chips = [
      { key: 'H', src: anchorPositions.cpu, color: '#8B5CF6', label: `H = ${H.toFixed(2)}`, animName: 'cacheChipMergeH', cssVar: '--merge-h-to', delay: '0s' },
      { key: 'C', src: anchorPositions.cache, color: '#F59E0B', label: `C = ${C_NS}ns`, animName: 'cacheChipMergeC', cssVar: '--merge-c-to', delay: '0.1s' },
      { key: 'M', src: anchorPositions.ram, color: '#10B981', label: `M = ${M_NS}ns`, animName: 'cacheChipMergeM', cssVar: '--merge-m-to', delay: '0.2s' },
    ];
    return (
      <>
        {chips.map(v => {
          if (!v.src) return null;
          const pos = chipPos(v.src);
          return (
            <div key={v.key} style={{
              position: 'absolute',
              left: `${pos.left}px`, top: `${pos.top}px`,
              width: `${chipW}px`,
              zIndex: 25,
              padding: '10px 12px', borderRadius: '14px',
              background: `${v.color}25`, border: `2px solid ${v.color}`,
              boxShadow: `0 0 22px ${v.color}77`,
              fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: '800',
              color: v.color, textAlign: 'center',
              [v.cssVar]: toVar(v.src),
              animation: `${v.animName} 1s cubic-bezier(0.55,0,1,0.45) ${v.delay} forwards`,
            }}>{v.label}</div>
          );
        })}
        {/* Flash burst at cache box centre */}
        <div style={{
          position: 'absolute',
          left: `${tgtX - 50}px`,
          top: `${tgtY - 50}px`,
          width: '100px', height: '100px', borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(139,92,246,0.5) 0%,rgba(16,185,129,0.3) 45%,transparent 70%)',
          animation: 'cacheMergeFlash 0.7s ease 0.85s forwards',
          zIndex: 24, pointerEvents: 'none',
        }} />
      </>
    );
  })()}

      {/* ═══════════════════════════════════════════════════════════════════
          FORMULA / SUMMARY
      ═══════════════════════════════════════════════════════════════════ */}
      {showFormula && (
    <div className="eat-formula-box cache-scifi-box show"
      style={{
        bottom: '14%', top: 'auto', transform: 'translateX(-50%) scale(1)',
        borderColor: 'rgba(139,92,246,0.5)', boxShadow: '0 0 60px var(--tlb-glow)',
        animation: 'cacheFormulaExplode 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards',
        overflow: 'hidden', position: 'absolute', zIndex: 20,
      }}>
      <h3 style={{ color: 'var(--tlb-main)', letterSpacing: '2px', marginBottom: '10px' }}>
        ⚡ Cache Performance Summary
      </h3>
      <div className="formula-line">
        <span className="var-green">Hits</span> = {hits}&nbsp;|&nbsp;
        <span className="var-amber">Misses</span> = {misses}&nbsp;|&nbsp;
        Total = {histLen}
      </div>
      <div className="formula-line">
        <span className="var-violet">H</span> = {hits} ÷ {histLen} ={' '}
        <strong style={{ color: 'var(--tlb-main)' }}>{H.toFixed(2)}</strong>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', margin: '14px 0', width: '100%' }}>
        {[
          { sym: 'H', val: H.toFixed(2), color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.3)', desc: 'Hit Ratio', sub: 'hits ÷ total' },
          { sym: 'C', val: `${C_NS}ns`, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', desc: 'Cache Time', sub: 'ultra-fast' },
          { sym: 'M', val: `${M_NS}ns`, color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', desc: 'RAM Time', sub: 'slow memory' },
        ].map((v, i) => (
          <div key={v.sym} style={{
            padding: '9px 6px', borderRadius: '10px', background: v.bg,
            border: `1.5px solid ${v.border}`, textAlign: 'center', fontFamily: 'var(--font-mono)',
            animation: `cacheChipAppear 0.45s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.1}s both`,
          }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '2px' }}>{v.sym}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: '800', color: v.color }}>{v.val}</div>
            <div style={{ fontSize: '0.53rem', color: 'var(--text-muted)', marginTop: '3px', lineHeight: 1.3 }}>{v.desc}</div>
            <div style={{ fontSize: '0.5rem', color: `${v.color}88`, marginTop: '1px' }}>{v.sub}</div>
          </div>
        ))}
      </div>
      <div className="formula-line">
        Avg = <span className="var-violet">H</span>×<span className="var-amber">C</span> + (1−<span className="var-violet">H</span>)×<span className="var-green">M</span>
      </div>
      <div className="formula-line" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        = {H.toFixed(2)}×{C_NS} + {(1 - H).toFixed(2)}×{M_NS}
      </div>
      <div className="formula-result" style={{
        color: 'var(--tlb-main)',
        animation: 'cacheAnswerZoom 0.75s cubic-bezier(0.34,1.56,0.64,1) 0.35s both',
      }}>
        = {(H * C_NS + (1 - H) * M_NS).toFixed(1)} ns
      </div>
      <div style={{
        marginTop: '14px', padding: '10px 14px', borderRadius: '8px',
        background: 'rgba(139,92,246,0.08)', border: '1px solid var(--tlb-border)',
        fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--tlb-main)', lineHeight: 1.6,
      }}>
        Policy: <strong>{_cache.policy}</strong> · Slots: <strong>{_cache.maxSlots}</strong> ·
        Cache retains <strong>{_cache.slots.length}</strong> block(s) for the next run.
      </div>

      {/* ── Press Enter to Start Again ── */}
      {currentStep === finalStep && (
        <div onClick={handleRestart} style={{
          marginTop: '18px', paddingTop: '14px',
          borderTop: '1px solid rgba(139,92,246,0.2)',
          textAlign: 'center', cursor: 'pointer',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontWeight: '700', color: '#c0c0c0',
            fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '4px',
            animation: 'cacheGlowPulse 2s infinite ease-in-out',
          }}>
            Press Enter · Click to Start Again
          </span>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '6px' }}>
          </div>
        </div>
      )}
    </div>
      )}
  </div>
  );
}