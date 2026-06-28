import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Info, X } from 'lucide-react';

interface Props {
  text: string;
}

export default function InfoButton({ text }: Props) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const calcPosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const popupWidth = 288;
    const margin = 8;
    let left = rect.left;

    // Shift left if it would overflow the right edge
    if (left + popupWidth > window.innerWidth - margin) {
      left = window.innerWidth - popupWidth - margin;
    }
    // Never go past the left edge
    if (left < margin) left = margin;

    setStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      left,
      width: Math.min(popupWidth, window.innerWidth - margin * 2),
    });
  }, []);

  const handleToggle = () => {
    if (!open) calcPosition();
    setOpen(v => !v);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Recalc on scroll/resize so popup follows
  useEffect(() => {
    if (!open) return;
    const update = () => calcPosition();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, calcPosition]);

  return (
    <div className="relative inline-flex items-center shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full border transition-colors cursor-pointer ${
          open
            ? 'bg-blue-600 border-blue-600 text-white'
            : 'border-neutral-300 text-neutral-400 hover:border-blue-400 hover:text-blue-500'
        }`}
        title={open ? 'Hide info' : 'What is this?'}
      >
        <Info className="w-3 h-3" />
      </button>

      {open && (
        <div
          ref={popupRef}
          style={style}
          className="z-[200] flex items-start gap-2 bg-white border border-blue-100 rounded-xl px-3 py-2.5 text-xs text-blue-700 leading-relaxed shadow-lg"
        >
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-400" />
          <span className="flex-1">{text}</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="shrink-0 text-blue-300 hover:text-blue-500 cursor-pointer mt-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
