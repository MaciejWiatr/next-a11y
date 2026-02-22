"use client";
// Violations: button-label (icon-only), button-type (no type)
export function Sidebar() {
  const toggle = () => {};
  const close = () => {};

  return (
    <aside>
      <button onClick={toggle} type="button"><MenuIcon /></button>
      <button onClick={close} type="button"><XIcon /></button>
    </aside>
  );
}

function MenuIcon() {
  return <svg viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18" /></svg>;
}

function XIcon() {
  return <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>;
}
