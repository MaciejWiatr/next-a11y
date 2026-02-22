// Test: button inside map with section.label - should get aria-label with variable
const sections = [
  { id: "intro", label: "Introduction" },
  { id: "features", label: "Features" },
  { id: "contact", label: "Contact" },
];

export function TableOfContents() {
  return (
    <nav>
      {sections.map((section) => (
        <button
          key={section.id}
          onClick={() => {}}
          aria-label="Przejdź do sekcji"
          type="button"
        >
          <span>{section.label}</span>
        </button>
      ))}
    </nav>
  );
}
