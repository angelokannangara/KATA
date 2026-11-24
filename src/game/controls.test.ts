import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal localStorage shim for node
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

const controls = await import('./controls');

test('defaults: WASD movement and mouse buttons strike', () => {
  controls.resetBindings();
  assert.equal(controls.actionForCode('KeyA'), 'left');
  assert.equal(controls.actionForCode('Mouse0'), 'light');
  assert.equal(controls.actionForCode('Mouse2'), 'heavy');
  assert.equal(controls.actionForCode('Mouse1'), 'kick');
});

test('rebinding moves a code and clears the previous owner', () => {
  controls.resetBindings();
  controls.setBinding('dash', 0, 'KeyJ');
  assert.equal(controls.actionForCode('KeyJ'), 'dash');
  assert.equal(controls.getBindings().light[0], '');
  assert.equal(controls.getBindings().light[1], 'Mouse0');
  assert.equal(JSON.parse(store.get('kata.controls.v1')!).dash[0], 'KeyJ');
});

test('isActionHeld honours both slots; reset restores defaults', () => {
  controls.resetBindings();
  assert.ok(controls.isActionHeld('light', new Set(['Mouse0'])));
  assert.ok(controls.isActionHeld('light', new Set(['KeyJ'])));
  assert.ok(!controls.isActionHeld('light', new Set(['KeyZ'])));
  controls.setBinding('light', 0, 'KeyZ');
  controls.resetBindings();
  assert.equal(controls.getBindings().light[0], 'KeyJ');
});

test('codeLabel is human friendly', () => {
  assert.equal(controls.codeLabel('KeyJ'), 'J');
  assert.equal(controls.codeLabel('Mouse2'), 'Right Click');
  assert.equal(controls.codeLabel('Space'), 'Space');
  assert.equal(controls.codeLabel(''), '—');
});
