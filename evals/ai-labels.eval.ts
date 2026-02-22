import { evalite } from "evalite";
import { wrapAISDKModel } from "evalite/ai-sdk";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { ARIA_LABEL_SYSTEM, buildAriaLabelPrompt } from "../src/ai/aria-label-prompt.js";

const model = wrapAISDKModel(openai("gpt-4o-mini"));

/** Scores 1 if output matches any expected value (case-insensitive). Strips surrounding quotes. */
function oneOf({ output, expected }: { output: string; expected: string | string[] }) {
  const out = output.trim().replace(/^["']|["']$/g, "").toLowerCase();
  const vals = Array.isArray(expected) ? expected : [expected];
  const match = vals.some((e) => out === e.trim().toLowerCase());
  return { name: "One Of", description: "Output matches an acceptable label", score: match ? 1 : 0 };
}

evalite("AI aria-label generation", {
  data: [
    {
      input: {
        iconName: "ShoppingCartIcon",
        element: "<button><ShoppingCartIcon /></button>",
        componentName: "AddToCartButton",
        locale: "en",
        rule: "button-label" as const,
      },
      expected: ["Add to cart", "Add to Cart", "Add item to cart"],
    },
    {
      input: {
        iconName: "HeartIcon",
        element: "<button><HeartIcon /></button>",
        componentName: "FavoriteButton",
        locale: "en",
        rule: "button-label" as const,
      },
      expected: ["Add to favorites", "Add to Favorites", "Add to favourites", "Favorite"],
    },
    {
      input: {
        iconName: "ShareIcon",
        element: "<button><ShareIcon /></button>",
        componentName: "ShareButton",
        locale: "en",
        rule: "button-label" as const,
      },
      expected: ["Share", "Share this"],
    },
    {
      input: {
        iconName: "XMarkIcon",
        element: "<button><XMarkIcon /></button>",
        componentName: "Modal",
        locale: "en",
        rule: "button-label" as const,
      },
      expected: ["Close", "Close modal", "Dismiss"],
    },
    {
      input: {
        iconName: "Bars3Icon",
        element: "<button><Bars3Icon /></button>",
        componentName: "Navbar",
        locale: "en",
        rule: "button-label" as const,
      },
      expected: ["Open menu", "Open Menu", "Toggle menu", "Menu"],
    },
    {
      input: {
        iconName: "MagnifyingGlassIcon",
        element: "<button><MagnifyingGlassIcon /></button>",
        componentName: "SearchForm",
        locale: "en",
        rule: "button-label" as const,
      },
      expected: ["Search", "Search..."],
    },
    {
      input: {
        iconName: undefined,
        element: '<a href="https://twitter.com"><TwitterIcon /></a>',
        componentName: "Footer",
        locale: "en",
        rule: "link-label" as const,
      },
      expected: ["Visit Twitter", "Visit X", "Open Twitter", "Twitter"],
    },
    {
      input: {
        iconName: "ShoppingCartIcon",
        element: "<button><ShoppingCartIcon /></button>",
        componentName: "CartButton",
        locale: "pl",
        rule: "button-label" as const,
      },
      expected: ["Dodaj do koszyka", "Dodaj do Koszyka"],
    },
    // Polish (pl)
    {
      input: {
        iconName: "HeartIcon",
        element: "<button><HeartIcon /></button>",
        componentName: "FavoriteButton",
        locale: "pl",
        rule: "button-label" as const,
      },
      expected: ["Dodaj do ulubionych", "Dodaj do Ulubionych", "Zapisz jako ulubione"],
    },
    {
      input: {
        iconName: "ShareIcon",
        element: "<button><ShareIcon /></button>",
        componentName: "ShareButton",
        locale: "pl",
        rule: "button-label" as const,
      },
      expected: ["Udostępnij", "Udostępnij ten", "Podziel się"],
    },
    {
      input: {
        iconName: "XMarkIcon",
        element: "<button><XMarkIcon /></button>",
        componentName: "Modal",
        locale: "pl",
        rule: "button-label" as const,
      },
      expected: ["Zamknij", "Zamknij okno", "Zamknij okno dialogowe", "Zamknij modalne okno"],
    },
    {
      input: {
        iconName: undefined,
        element: '<a href="https://instagram.com"><InstagramIcon /></a>',
        componentName: "Footer",
        locale: "pl",
        rule: "link-label" as const,
      },
      expected: ["Odwiedź Instagrama", "Odwiedź Instagram"],
    },
    // German (de)
    {
      input: {
        iconName: "ShoppingCartIcon",
        element: "<button><ShoppingCartIcon /></button>",
        componentName: "AddToCartButton",
        locale: "de",
        rule: "button-label" as const,
      },
      expected: ["In den Warenkorb", "In den Warenkorb legen", "Zum Warenkorb hinzufügen"],
    },
    {
      input: {
        iconName: "HeartIcon",
        element: "<button><HeartIcon /></button>",
        componentName: "FavoriteButton",
        locale: "de",
        rule: "button-label" as const,
      },
      expected: ["Zu Favoriten hinzufügen", "Zu den Favoriten hinzufügen"],
    },
    {
      input: {
        iconName: "XMarkIcon",
        element: "<button><XMarkIcon /></button>",
        componentName: "Modal",
        locale: "de",
        rule: "button-label" as const,
      },
      expected: ["Schließen", "Schließen"],
    },
    {
      input: {
        iconName: "MagnifyingGlassIcon",
        element: "<button><MagnifyingGlassIcon /></button>",
        componentName: "SearchForm",
        locale: "de",
        rule: "button-label" as const,
      },
      expected: ["Suchen", "Suche"],
    },
    // Spanish (es)
    {
      input: {
        iconName: "ShoppingCartIcon",
        element: "<button><ShoppingCartIcon /></button>",
        componentName: "AddToCartButton",
        locale: "es",
        rule: "button-label" as const,
      },
      expected: ["Añadir al carrito", "Agregar al carrito"],
    },
    {
      input: {
        iconName: "HeartIcon",
        element: "<button><HeartIcon /></button>",
        componentName: "FavoriteButton",
        locale: "es",
        rule: "button-label" as const,
      },
      expected: ["Añadir a favoritos", "Agregar a favoritos"],
    },
    {
      input: {
        iconName: "XMarkIcon",
        element: "<button><XMarkIcon /></button>",
        componentName: "Modal",
        locale: "es",
        rule: "button-label" as const,
      },
      expected: ["Cerrar", "Cerrar modal"],
    },
    // French (fr)
    {
      input: {
        iconName: "ShoppingCartIcon",
        element: "<button><ShoppingCartIcon /></button>",
        componentName: "AddToCartButton",
        locale: "fr",
        rule: "button-label" as const,
      },
      expected: ["Ajouter au panier"],
    },
    {
      input: {
        iconName: "HeartIcon",
        element: "<button><HeartIcon /></button>",
        componentName: "FavoriteButton",
        locale: "fr",
        rule: "button-label" as const,
      },
      expected: ["Ajouter aux favoris"],
    },
    {
      input: {
        iconName: "ShareIcon",
        element: "<button><ShareIcon /></button>",
        componentName: "ShareButton",
        locale: "fr",
        rule: "button-label" as const,
      },
      expected: ["Partager"],
    },
  ],
  task: async (input) => {
    const prompt = buildAriaLabelPrompt({
      iconName: input.iconName,
      element: input.element,
      componentName: input.componentName,
      locale: input.locale,
      rule: input.rule,
    });
    const result = await generateText({
      model,
      system: ARIA_LABEL_SYSTEM,
      prompt,
    });
    return result.text.trim();
  },
  scorers: [{ scorer: oneOf }],
});
