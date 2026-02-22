/**
 * Icon name → accessible label overrides (default: en).
 * Prefer action-oriented labels: "Add to cart" not "Cart", "Visit Twitter" not "Twitter".
 */
export const ICON_LABEL_OVERRIDES: Record<string, string> = {
  CartIcon: "Add to cart",
  HeartIcon: "Add to favorites",
  ShareIcon: "Share",
  TrashIcon: "Delete",
  DeleteIcon: "Delete",
  XIcon: "Close",
  CloseIcon: "Close",
  HamburgerIcon: "Menu",
  PencilIcon: "Edit",
  GearIcon: "Settings",
  ChevronLeftIcon: "Go back",
  ChevronRightIcon: "Go forward",
  ArrowLeftIcon: "Go back",
  ArrowRightIcon: "Go forward",
  MinusIcon: "Remove",
  BellIcon: "Notifications",
  UserIcon: "User profile",
  LogoutIcon: "Log out",
  LoginIcon: "Log in",
  EyeIcon: "Show",
  EyeOffIcon: "Hide",
  CheckIcon: "Confirm",
  MailIcon: "Email",
  ExternalLinkIcon: "Open in new tab",
  DotsVerticalIcon: "More options",
  DotsHorizontalIcon: "More options",
  HashIcon: "Go to section",
  Hash: "Go to section",
  SunIcon: "Light mode",
  MoonIcon: "Dark mode",
  TwitterIcon: "Visit Twitter",
  InstagramIcon: "Visit Instagram",
  FacebookIcon: "Visit Facebook",
  LinkedInIcon: "Visit LinkedIn",
  YoutubeIcon: "Visit YouTube",
  GithubIcon: "Visit GitHub",
};

/** Locale overrides for icon labels. Falls back to ICON_LABEL_OVERRIDES (en) when missing. */
export const ICON_LABEL_OVERRIDES_LOCALE: Record<string, Record<string, string>> = {
  pl: {
    CartIcon: "Dodaj do koszyka",
    HeartIcon: "Dodaj do ulubionych",
    ShareIcon: "Udostępnij",
    TrashIcon: "Usuń",
    DeleteIcon: "Usuń",
    XIcon: "Zamknij",
    CloseIcon: "Zamknij",
    HamburgerIcon: "Menu",
    TwitterIcon: "Odwiedź Twittera",
    InstagramIcon: "Odwiedź Instagrama",
    FacebookIcon: "Odwiedź Facebooka",
    LinkedInIcon: "Odwiedź LinkedIn",
    GithubIcon: "Odwiedź GitHub",
  },
  de: {
    CartIcon: "In den Warenkorb",
    HeartIcon: "Zu Favoriten hinzufügen",
    ShareIcon: "Teilen",
    TrashIcon: "Löschen",
    DeleteIcon: "Löschen",
    XIcon: "Schließen",
    CloseIcon: "Schließen",
    HamburgerIcon: "Menü",
    TwitterIcon: "Twitter besuchen",
    InstagramIcon: "Instagram besuchen",
  },
  es: {
    CartIcon: "Añadir al carrito",
    HeartIcon: "Añadir a favoritos",
    ShareIcon: "Compartir",
    TrashIcon: "Eliminar",
    DeleteIcon: "Eliminar",
    XIcon: "Cerrar",
    CloseIcon: "Cerrar",
    TwitterIcon: "Visitar Twitter",
    InstagramIcon: "Visitar Instagram",
  },
  fr: {
    CartIcon: "Ajouter au panier",
    HeartIcon: "Ajouter aux favoris",
    ShareIcon: "Partager",
    TrashIcon: "Supprimer",
    DeleteIcon: "Supprimer",
    XIcon: "Fermer",
    CloseIcon: "Fermer",
    TwitterIcon: "Visiter Twitter",
    InstagramIcon: "Visiter Instagram",
  },
};

export function getIconLabel(iconName: string, locale: string): string {
  const localeMap = ICON_LABEL_OVERRIDES_LOCALE[locale];
  if (localeMap?.[iconName]) return localeMap[iconName];
  return ICON_LABEL_OVERRIDES[iconName] ?? iconNameToLabelFallback(iconName);
}

const GENERIC_LABELS: Record<string, Record<string, string>> = {
  en: { Button: "Button", Link: "Link" },
  pl: { Button: "Przycisk", Link: "Link" },
  de: { Button: "Schaltfläche", Link: "Link" },
  es: { Button: "Botón", Link: "Enlace" },
  fr: { Button: "Bouton", Link: "Lien" },
};

export function getGenericLabel(term: "Button" | "Link", locale: string): string {
  return GENERIC_LABELS[locale]?.[term] ?? GENERIC_LABELS.en[term];
}

function iconNameToLabelFallback(iconName: string): string {
  const name = iconName
    .replace(/Icon$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
  return name.charAt(0).toUpperCase() + name.slice(1);
}
