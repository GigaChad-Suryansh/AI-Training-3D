/**
 * Drag a token onto the 3D scene to add something, using pointer events so it works
 * with a mouse, a finger or a pen. A plain tap or the Enter / Space key adds too,
 * so nobody is forced to drag.
 */
export function initTokenDrag({ token, host, scene, makeGhost, canAdd, onAdd, onRefuse, onMiss }) {
  let drag = null, ghost = null;

  const over = e => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    return !!(el && host.contains(el));
  };
  const cleanup = () => {
    if (ghost) { ghost.remove(); ghost = null; }
    token.classList.remove('dragging'); scene.classList.remove('dropping'); drag = null;
  };

  token.addEventListener('pointerdown', e => {
    if (e.button !== undefined && e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    try { token.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
  });

  token.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
      if (!canAdd()) { cleanup(); onRefuse(); return; }
      drag.moved = true; ghost = makeGhost(); document.body.appendChild(ghost); token.classList.add('dragging');
    }
    ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
    const ready = over(e);
    ghost.classList.toggle('ready', ready); scene.classList.toggle('dropping', ready);
  });

  token.addEventListener('pointerup', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const { moved } = drag, hit = moved && over(e);
    cleanup();
    if (!moved) { canAdd() ? onAdd() : onRefuse(); }
    else if (hit) onAdd();
    else onMiss();
  });
  token.addEventListener('pointercancel', cleanup);

  token.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault(); canAdd() ? onAdd() : onRefuse();
  });
}
