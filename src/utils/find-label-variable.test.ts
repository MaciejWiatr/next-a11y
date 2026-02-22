import { describe, it, expect } from "vitest";
import { Project, SyntaxKind } from "ts-morph";
import {
  findLabelVariableInScope,
  wrapLabelWithVariable,
} from "./find-label-variable.js";

function createFile(code: string) {
  const project = new Project({ useInMemoryFileSystem: true });
  return project.createSourceFile("test.tsx", code);
}

describe("findLabelVariableInScope", () => {
  it("returns section.label when button is inside sections.map", () => {
    const file = createFile(`
      const sections = [{ id: "a", label: "Intro" }];
      return (
        <div>
          {sections.map((section) => (
            <button key={section.id} onClick={() => scrollToSection(section.id)}>
              <Hash className="h-3 w-3" />
              {section.label}
            </button>
          ))}
        </div>
      );
    `);
    const buttons = file.getDescendantsOfKind(SyntaxKind.JsxOpeningElement);
    const button = buttons.find((el) => el.getTagNameNode().getText() === "button");
    expect(button).toBeDefined();
    const result = findLabelVariableInScope(file, button!.getStartLineNumber());
    expect(result).toBe("section.label");
  });

  it("returns item.name when inside items.map with item.name", () => {
    const file = createFile(`
      {items.map((item) => (
        <button key={item.id}>{item.name}</button>
      ))}
    `);
    const buttons = file.getDescendantsOfKind(SyntaxKind.JsxOpeningElement);
    const button = buttons.find((el) => el.getTagNameNode().getText() === "button");
    expect(button).toBeDefined();
    const result = findLabelVariableInScope(file, button!.getStartLineNumber());
    expect(result).toBe("item.name");
  });

  it("returns undefined when not inside map", () => {
    const file = createFile(`<button><HashIcon /></button>`);
    const buttons = file.getDescendantsOfKind(SyntaxKind.JsxOpeningElement);
    const button = buttons.find((el) => el.getTagNameNode().getText() === "button");
    expect(button).toBeDefined();
    const result = findLabelVariableInScope(file, button!.getStartLineNumber());
    expect(result).toBeUndefined();
  });

  it("returns undefined when variable not used in content (usedInContent: true)", () => {
    const file = createFile(`
      {sections.map((section) => (
        <button aria-label="Go to section">
          <HashIcon />
        </button>
      ))}
    `);
    const buttons = file.getDescendantsOfKind(SyntaxKind.JsxOpeningElement);
    const button = buttons.find((el) => el.getTagNameNode().getText() === "button");
    expect(button).toBeDefined();
    const result = findLabelVariableInScope(file, button!.getStartLineNumber(), {
      usedInContent: true,
    });
    expect(result).toBeUndefined();
  });

  it("returns section.label when variable used in content (usedInContent: true)", () => {
    const file = createFile(`
      {sections.map((section) => (
        <button aria-label="Go to section">
          {section.label}
        </button>
      ))}
    `);
    const buttons = file.getDescendantsOfKind(SyntaxKind.JsxOpeningElement);
    const button = buttons.find((el) => el.getTagNameNode().getText() === "button");
    expect(button).toBeDefined();
    const result = findLabelVariableInScope(file, button!.getStartLineNumber(), {
      usedInContent: true,
    });
    expect(result).toBe("section.label");
  });

  it("prefers label over name when both exist", () => {
    const file = createFile(`
      {items.map((item) => (
        <button>{item.label} - {item.name}</button>
      ))}
    `);
    const buttons = file.getDescendantsOfKind(SyntaxKind.JsxOpeningElement);
    const button = buttons.find((el) => el.getTagNameNode().getText() === "button");
    const result = findLabelVariableInScope(file, button!.getStartLineNumber());
    expect(result).toBe("item.label");
  });
});

describe("wrapLabelWithVariable", () => {
  it("produces valid JSX expression", () => {
    const result = wrapLabelWithVariable("Go to section", "section.label");
    expect(result).toBe("{\`Go to section ${section.label}\`}");
  });

  it("handles empty base", () => {
    const result = wrapLabelWithVariable("", "item.name");
    expect(result).toContain("item.name");
  });

  it("produces expression that starts with brace for apply", () => {
    const result = wrapLabelWithVariable("Go to section", "section.label");
    expect(result.startsWith("{")).toBe(true);
  });
});
