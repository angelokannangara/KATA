/**
 * Remappable controls (keyboard + mouse) for Player 1.
 * Bindings persist in localStorage. Each action has two slots; mouse buttons are
 * stored as pseudo key codes: Mouse0 (left), Mouse1 (middle), Mouse2 (right).
 */
export type ControlAction =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'block'
  | 'light'
  | 'heavy'
  | 'kick'
  | 'dash'
  | 'stance_prev'
  | 'stance_next'
  | 'skill_0'
  | 'skill_1'
  | 'skill_2'
  | 'ultimate';

export const CONTROL_ACTIONS: { id: ControlAction; label: string; group: string }[] = [
  { id: 'left', label: 'Move Left', group: 'Movement' },
  { id: 'right', label: 'Move Right', group: 'Movement' },
  { id: 'up', label: 'Jump', group: 'Movement' },
  { id: 'down', label: 'Crouch', group: 'Movement' },
  { id: 'dash', label: 'Dash', group: 'Movement' },
  { id: 'light', label: 'Light Strike', group: 'Combat' },
  { id: 'heavy', label: 'Heavy Strike', group: 'Combat' },
  { id: 'kick', label: 'Kick', group: 'Combat' },
  { id: 'block', label: 'Parry / Block', group: 'Combat' },
  { id: 'stance_prev', label: 'Stance Previous', group: 'Stance & Skills' },
  { id: 'stance_next', label: 'Stance Next', group: 'Stance & Skills' },
  { id: 'skill_0', label: 'Skill 1', group: 'Stance & Skills' },
  { id: 'skill_1', label: 'Skill 2', group: 'Stance & Skills' },
  { id: 'skill_2', label: 'Skill 3', group: 'Stance & Skills' },
  { id: 'ultimate', label: 'Ultimate', group: 'Stance & Skills' },
];

export type Binding = [string, string];

export const DEFAULT_BINDINGS: Record<ControlAction, Binding> = {
  left: ['KeyA', ''],
  right: ['KeyD', ''],
  up: ['KeyW', ''],
  down: ['KeyS', ''],
  dash: ['Space', ''],
  light: ['KeyJ', 'Mouse0'],
  heavy: ['KeyK', 'Mouse2'],
  kick: ['KeyF', 'Mouse1'],
  block: ['KeyL', ''],
  stance_prev: ['KeyQ', ''],
  stance_next: ['KeyE', ''],
  skill_0: ['KeyU', ''],
  skill_1: ['KeyI', ''],
  skill_2: ['KeyO', ''],
  ultimate: ['KeyP', ''],
};

const STORAGE_KEY = 'kata.controls.v1';
const listeners = new Set<() => void>();
let bindings: Record<ControlAction, Binding> = clone(DEFAULT_BINDINGS);
let reverse = new Map<string, ControlAction>();

function clone(b: Record<ControlAction, Binding>): Record<ControlAction, Binding> {
  const out = {} as Record<ControlAction, Binding>;
  (Object.keys(b) as ControlAction[]).forEach((k) => {
    out[k] = [b[k][0], b[k][1]];
  });
  return out;
}

function rebuild(): void {
  reverse = new Map();
  (Object.keys(bindings) as ControlAction[]).forEach((a) => {
    bindings[a].forEach((code) => {
      if (code) reverse.set(code, a);
    });
  });
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    /* storage unavailable */
  }
  rebuild();
  listeners.forEach((fn) => fn());
}

function load(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<ControlAction, Binding>>;
      (Object.keys(DEFAULT_BINDINGS) as ControlAction[]).forEach((a) => {
        const v = parsed[a];
        if (Array.isArray(v) && v.length === 2) bindings[a] = [String(v[0] ?? ''), String(v[1] ?? '')];
      });
    }
  } catch {
    bindings = clone(DEFAULT_BINDINGS);
  }
  rebuild();
}
load();

export function getBindings(): Record<ControlAction, Binding> {
  return bindings;
}

export function actionForCode(code: string): ControlAction | undefined {
  return reverse.get(code);
}

export function isActionHeld(action: ControlAction, held: Set<string>): boolean {
  const b = bindings[action];
  return (b[0] !== '' && held.has(b[0])) || (b[1] !== '' && held.has(b[1]));
}

/** Assign a code to an action slot; any other action using that code loses it. */
export function setBinding(action: ControlAction, slot: 0 | 1, code: string): void {
  (Object.keys(bindings) as ControlAction[]).forEach((a) => {
    ([0, 1] as const).forEach((s) => {
      if (bindings[a][s] === code) bindings[a][s] = '';
    });
  });
  bindings[action][slot] = code;
  persist();
}

export function clearBinding(action: ControlAction, slot: 0 | 1): void {
  bindings[action][slot] = '';
  persist();
}

export function resetBindings(): void {
  bindings = clone(DEFAULT_BINDINGS);
  persist();
}

export function subscribeBindings(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function codeLabel(code: string): string {
  if (!code) return '—';
  if (code === 'Mouse0') return 'Left Click';
  if (code === 'Mouse1') return 'Middle Click';
  if (code === 'Mouse2') return 'Right Click';
  if (code.startsWith('Mouse')) return `Mouse ${code.slice(5)}`;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  const map: Record<string, string> = {
    Space: 'Space',
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ShiftLeft: 'L-Shift',
    ShiftRight: 'R-Shift',
    ControlLeft: 'L-Ctrl',
    ControlRight: 'R-Ctrl',
    AltLeft: 'L-Alt',
    AltRight: 'R-Alt',
    Comma: ',',
    Period: '.',
    Slash: '/',
    Semicolon: ';',
    Quote: "'",
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Minus: '-',
    Equal: '=',
    Backquote: '`',
  };
  return map[code] ?? code;
}
