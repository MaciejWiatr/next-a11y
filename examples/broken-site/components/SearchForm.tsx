"use client";
// Violations: button-label (icon-only button), input-label (input without label)
export function SearchForm() {
  return (
    <form role="search">
      <input type="text" placeholder="Search products..." />
      <button><SearchIcon /></button>
    </form>
  );
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>;
}
