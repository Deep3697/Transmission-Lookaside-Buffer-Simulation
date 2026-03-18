import React, { useRef, useEffect, useState } from 'react';

/**
 * Popup component
 * Props:
 *   text       — explanation string
 *   formula    — math/formula string (rendered in mono block)
 *   targetRef  — ref to the DOM element to anchor near
 *   position   — 'top' | 'bottom' | 'left' | 'right'
 *   visible    — boolean
 *   stepLabel  — e.g. "Step 2" shown as a tiny badge
 *   theme      — 'cpu' | 'tlb' | 'pt' | 'ram'  (controls accent color)
 */
export default function Popup({
  text,
  formula,
  targetRef,
  position = 'bottom',
  visible,
  stepLabel = '',
  theme = 'tlb',
}) {
  const popupRef = useRef(null);
  const [style, setStyle] = useState({ opacity: 0 });
  const [mounted, setMounted] = useState(false);

  /* Mount after first visible=true so the transition works */
  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  useEffect(() => {
    if (!mounted) return;

    if (visible && targetRef?.current && popupRef?.current) {
      const target = targetRef.current.getBoundingClientRect();
      const popup = popupRef.current.getBoundingClientRect();
      const GAP = 16;
      const VP_W = window.innerWidth;
      const VP_H = window.innerHeight;

      let top = 0;
      let left = 0;

      switch (position) {
        case 'bottom':
          top = target.bottom + GAP;
          left = target.left + target.width / 2 - popup.width / 2;
          break;
        case 'top':
          top = target.top - popup.height - GAP;
          left = target.left + target.width / 2 - popup.width / 2;
          break;
        case 'right':
          top = target.top + target.height / 2 - popup.height / 2;
          left = target.right + GAP;
          break;
        case 'left':
          top = target.top + target.height / 2 - popup.height / 2;
          left = target.left - popup.width - GAP;
          break;
        default:
          top = target.bottom + GAP;
          left = target.left;
      }

      /* Clamp so popup never goes off-screen */
      left = Math.max(12, Math.min(left, VP_W - popup.width - 12));
      top = Math.max(12, Math.min(top, VP_H - popup.height - 12));

      setStyle({ top, left });
    } else {
      setStyle({ opacity: 0 });
    }
  }, [visible, mounted, targetRef, position, text, formula]);

  if (!mounted) return null;

  /* Theme → CSS class mapping */
  const themeClass = `popup-${theme}`;

  return (
    <div
      ref={popupRef}
      className={`floating-popup ${themeClass} ${visible ? 'visible' : ''}`}
      style={style}
    >
      {/* Step badge */}
      {stepLabel && (
        <div className="popup-step-label">{stepLabel}</div>
      )}

      {/* Connector dot */}
      <div style={{
        position: 'absolute',
        top: '-5px',
        left: '20px',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: themeToColor(theme),
        boxShadow: `0 0 8px ${themeToColor(theme)}`,
        display: position === 'bottom' ? 'block' : 'none',
      }} />

      {/* Explanation text */}
      {text && <p>{text}</p>}

      {/* Formula / math block */}
      {formula && (
        <div className="math-block">
          {formula}
        </div>
      )}
    </div>
  );
}

/* Helper — returns CSS variable string per theme */
function themeToColor(theme) {
  const map = {
    cpu: 'var(--cpu-color)',
    tlb: 'var(--tlb-color)',
    pt: 'var(--pt-color)',
    ram: 'var(--ram-color)',
  };
  return map[theme] ?? 'var(--tlb-color)';
}