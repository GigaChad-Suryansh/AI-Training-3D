/**
 * Appearance: follows the system by default. The toolbar can pin Light or Dark.
 * The choice is saved in localStorage when it is available.
 */
const KEY = 'ai-training-3d:appearance';
const dark = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

function stored() { try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'system'; } catch (e) { return 'system'; } }
function save(mode) { try { mode === 'system' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, mode); } catch (e) { /* storage can be blocked */ } }

export function resolved(mode) { return mode === 'system' ? (dark && dark.matches ? 'dark' : 'light') : mode; }

/** Wires the three-way control. onChange receives 'light' or 'dark'. */
export function initAppearance(group, onChange) {
  let mode = stored();
  const apply = () => {
    if (mode === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = mode;
    group.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === mode ? 'true' : 'false'));
    onChange(resolved(mode));
  };
  group.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; save(mode); apply(); }));
  if (dark) dark.addEventListener('change', () => { if (mode === 'system') apply(); });
  apply();
}
