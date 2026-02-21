"use client";
// Violations: button-label (icon-only), button-type (no type attribute)
export function ThemeToggle() {
  const toggle = () => {};

  return (
    <div>
      <button onClick={toggle}><SunIcon /></button>
      <button onClick={toggle}><MoonIcon /></button>
    </div>
  );
}

function SunIcon() {
  return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" /></svg>;
}

function MoonIcon() {
  return <svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3" /></svg>;
}
