import type { SourceFile } from "ts-morph";
import { SyntaxKind } from "ts-morph";
import type { Rule, Violation } from "../../scan/types.js";

export const buttonLabelRule: Rule = {
  id: "button-label",
  type: "ai",
  scan(file: SourceFile): Violation[] {
    const violations: Violation[] = [];
    const filePath = file.getFilePath();

    const elements = [
      ...file.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
      ...file.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
    ];

    for (const el of elements) {
      const tagName = el.getTagNameNode().getText();
      if (tagName !== "button") continue;

      // Check for aria-label or aria-labelledby
      if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")) {
        continue;
      }

      // Check if there's text content
      if (el.getKind() === SyntaxKind.JsxOpeningElement) {
        const parent = el.getParent();
        if (parent) {
          const hasTextContent = parent
            .getDescendantsOfKind(SyntaxKind.JsxText)
            .some((t) => t.getText().trim().length > 0);

          if (hasTextContent) continue;

          // Check for JSX expression children like {t("key")}, {variable}, {cond ? "a" : "b"}
          const hasExpressionContent = parent
            .getDescendantsOfKind(SyntaxKind.JsxExpression)
            .some((expr) => expr.getExpression() != null);

          if (hasExpressionContent) continue;

          // Check for nested elements with text
          const nestedElements = parent.getDescendantsOfKind(
            SyntaxKind.JsxOpeningElement
          );
          const hasAccessibleChild = nestedElements.some((nested) => {
            const nestedTag = nested.getTagNameNode().getText();
            // Skip if it's an icon or svg (no text)
            return (
              nestedTag !== "svg" &&
              !nestedTag.endsWith("Icon") &&
              nested
                .getParent()
                ?.getDescendantsOfKind(SyntaxKind.JsxText)
                .some((t) => t.getText().trim().length > 0)
            );
          });

          if (hasAccessibleChild) continue;
        }
      }

      // Check self-closing buttons (always need label)
      if (el.getKind() === SyntaxKind.JsxSelfClosingElement) {
        // Self-closing <button /> always needs a label
      }

      // Get icon context for AI prompt
      const iconName = getIconName(el);

      violations.push({
        rule: "button-label",
        filePath,
        line: el.getStartLineNumber(),
        column: el.getStart() - el.getStartLinePos(),
        element: el.getText().slice(0, 80),
        message: "Button has no accessible name",
        fix: {
          type: "insert-attr",
          attribute: "aria-label",
          value: async () => {
            // Fallback heuristic from icon name
            if (iconName) {
              return iconNameToLabel(iconName);
            }
            return "Button";
          },
        },
      });
    }

    return violations;
  },
};

function getIconName(
  el: ReturnType<SourceFile["getDescendantsOfKind"]>[number]
): string | undefined {
  const parent = el.getParent();
  if (!parent) return undefined;

  // Look for icon components or SVGs in children
  const selfClosingChildren = parent.getDescendantsOfKind(
    SyntaxKind.JsxSelfClosingElement
  );
  for (const child of selfClosingChildren) {
    const tag = child.getTagNameNode().getText();
    if (tag.endsWith("Icon") || tag === "svg") {
      return tag;
    }
  }

  const openingChildren = parent.getDescendantsOfKind(
    SyntaxKind.JsxOpeningElement
  );
  for (const child of openingChildren) {
    const tag = child.getTagNameNode().getText();
    if (tag.endsWith("Icon") || tag === "svg") {
      return tag;
    }
  }

  return undefined;
}

function iconNameToLabel(iconName: string): string {
  // TrashIcon → Delete, XIcon → Close, MenuIcon → Menu, etc.
  const nameMap: Record<string, string> = {
    TrashIcon: "Delete",
    DeleteIcon: "Delete",
    XIcon: "Close",
    CloseIcon: "Close",
    MenuIcon: "Menu",
    HamburgerIcon: "Menu",
    SearchIcon: "Search",
    EditIcon: "Edit",
    PencilIcon: "Edit",
    SettingsIcon: "Settings",
    GearIcon: "Settings",
    ChevronLeftIcon: "Go back",
    ChevronRightIcon: "Go forward",
    ArrowLeftIcon: "Go back",
    ArrowRightIcon: "Go forward",
    PlusIcon: "Add",
    MinusIcon: "Remove",
    HeartIcon: "Favorite",
    StarIcon: "Star",
    ShareIcon: "Share",
    DownloadIcon: "Download",
    UploadIcon: "Upload",
    CopyIcon: "Copy",
    RefreshIcon: "Refresh",
    FilterIcon: "Filter",
    SortIcon: "Sort",
    ExpandIcon: "Expand",
    CollapseIcon: "Collapse",
    PlayIcon: "Play",
    PauseIcon: "Pause",
    StopIcon: "Stop",
    MuteIcon: "Mute",
    VolumeIcon: "Volume",
    BellIcon: "Notifications",
    UserIcon: "User profile",
    LogoutIcon: "Log out",
    LoginIcon: "Log in",
    EyeIcon: "Show",
    EyeOffIcon: "Hide",
    LockIcon: "Lock",
    UnlockIcon: "Unlock",
    InfoIcon: "Information",
    HelpIcon: "Help",
    WarningIcon: "Warning",
    CheckIcon: "Confirm",
    SaveIcon: "Save",
    PrintIcon: "Print",
    HomeIcon: "Home",
    CalendarIcon: "Calendar",
    ClockIcon: "Clock",
    MapIcon: "Map",
    PhoneIcon: "Phone",
    MailIcon: "Email",
    SendIcon: "Send",
    AttachIcon: "Attach",
    LinkIcon: "Link",
    ExternalLinkIcon: "Open in new tab",
    MoreIcon: "More options",
    DotsVerticalIcon: "More options",
    DotsHorizontalIcon: "More options",
    GridIcon: "Grid view",
    ListIcon: "List view",
    SunIcon: "Light mode",
    MoonIcon: "Dark mode",
  };

  if (nameMap[iconName]) return nameMap[iconName];

  // Generic conversion: RemoveCircleIcon → "Remove circle"
  const name = iconName
    .replace(/Icon$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();

  return name.charAt(0).toUpperCase() + name.slice(1);
}
