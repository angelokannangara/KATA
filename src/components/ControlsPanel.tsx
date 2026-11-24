import React, { useEffect, useState } from 'react';
import { ArrowLeft, Keyboard, MousePointer2, RotateCcw, X } from 'lucide-react';
import {
  CONTROL_ACTIONS,
  ControlAction,
  clearBinding,
  codeLabel,
  getBindings,
  resetBindings,
  setBinding,
  subscribeBindings,
} from '../game/controls';

interface ControlsPanelProps {
  onBack: () => void;
}

const MODIFIER_ONLY = new Set(['MetaLeft', 'MetaRight', 'ContextMenu']);

export const ControlsPanel: React.FC<ControlsPanelProps> = ({ onBack }) => {
  const [, force] = useState(0);
  const [listening, setListening] = useState<{ action: ControlAction; slot: 0 | 1 } | null>(null);

  useEffect(() => subscribeBindings(() => force((n) => n + 1)), []);

  // While waiting for input, capture keys before the rest of the app sees them
  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setListening(null);
        return;
      }
      if (e.code === 'Backspace' || e.code === 'Delete') {
        clearBinding(listening.action, listening.slot);
        setListening(null);
        return;
      }
      if (MODIFIER_ONLY.has(e.code)) return;
      setBinding(listening.action, listening.slot, e.code);
      setListening(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listening]);

  const bindings = getBindings();
  const groups = Array.from(new Set(CONTROL_ACTIONS.map((a) => a.group)));
  const current = listening ? CONTROL_ACTIONS.find((a) => a.id === listening.action) : null;

  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="kata-btn inline-flex items-center gap-1.5 px-3 py-2 text-sm cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back</span>
        </button>
        <h3 className="font-display font-bold text-xl text-[var(--ink)] flex items-center gap-2">
          <Keyboard className="w-5 h-5" aria-hidden="true" />
          Controls
        </h3>
      </div>

      <p className="mt-3 text-xs text-[var(--ink-muted)] flex items-center gap-1.5">
        <MousePointer2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        Click a slot, then press a key or mouse button. Each action has two slots.
      </p>

      <div className="mt-3 max-h-[52vh] overflow-y-auto pr-1 space-y-4">
        {groups.map((g) => (
          <div key={g}>
            <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-[var(--crimson)] mb-1.5">
              {g}
            </div>
            <div className="space-y-1.5">
              {CONTROL_ACTIONS.filter((a) => a.group === g).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 py-1 border-b border-[var(--ink-border)]/60"
                >
                  <span className="text-sm text-[var(--ink)]">{a.label}</span>
                  <div className="flex items-center gap-1.5">
                    {([0, 1] as const).map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        data-bind={`${a.id}-${slot}`}
                        onClick={() => setListening({ action: a.id, slot })}
                        className="kata-btn min-w-[84px] px-2 py-1.5 text-xs font-mono cursor-pointer"
                      >
                        {codeLabel(bindings[a.id][slot])}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-[11px] text-[var(--ink-muted)]">
          Stances 1 / 2 / 3 stay fixed. Versus P2 uses the arrow cluster.
        </span>
        <button
          type="button"
          onClick={resetBindings}
          className="kata-btn inline-flex items-center gap-1.5 px-3 py-2 text-xs cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Defaults</span>
        </button>
      </div>

      {listening && current && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onPointerDown={(e) => {
            if (e.pointerType !== 'mouse') return;
            e.preventDefault();
            setBinding(listening.action, listening.slot, `Mouse${e.button}`);
            setListening(null);
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="max-w-sm w-full text-center border-2 border-[var(--ink)] bg-[var(--paper)] p-6">
            <div className="text-xs font-mono uppercase tracking-widest text-[var(--crimson)]">
              Rebinding
            </div>
            <div className="font-display font-bold text-2xl text-[var(--ink)] mt-1">{current.label}</div>
            <p className="mt-3 text-sm text-[var(--ink-muted)]">
              Press a key or click a mouse button.
              <br />
              Esc cancels · Backspace clears the slot.
            </p>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setListening(null)}
              className="kata-btn mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
