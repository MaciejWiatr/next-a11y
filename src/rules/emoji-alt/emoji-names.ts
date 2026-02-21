/**
 * Lookup table mapping common emoji characters to human-readable English names.
 * Used by the emoji-alt rule to generate aria-label attributes.
 */
export const EMOJI_NAMES: Record<string, string> = {
  // Smileys & people
  "\u{1F600}": "grinning face",
  "\u{1F601}": "beaming face with smiling eyes",
  "\u{1F602}": "face with tears of joy",
  "\u{1F603}": "grinning face with big eyes",
  "\u{1F604}": "grinning face with smiling eyes",
  "\u{1F605}": "grinning face with sweat",
  "\u{1F606}": "grinning squinting face",
  "\u{1F609}": "winking face",
  "\u{1F60A}": "smiling face with smiling eyes",
  "\u{1F60D}": "smiling face with heart-eyes",
  "\u{1F60E}": "smiling face with sunglasses",
  "\u{1F60F}": "smirking face",
  "\u{1F612}": "unamused face",
  "\u{1F614}": "pensive face",
  "\u{1F618}": "face blowing a kiss",
  "\u{1F621}": "pouting face",
  "\u{1F622}": "crying face",
  "\u{1F62D}": "loudly crying face",
  "\u{1F62E}": "face with open mouth",
  "\u{1F631}": "face screaming in fear",
  "\u{1F633}": "flushed face",
  "\u{1F634}": "sleeping face",
  "\u{1F637}": "face with medical mask",
  "\u{1F914}": "thinking face",
  "\u{1F923}": "rolling on the floor laughing",
  "\u{1F929}": "star-struck",
  "\u{1F970}": "smiling face with hearts",
  "\u{1F973}": "partying face",

  // Hands & gestures
  "\u{1F44D}": "thumbs up",
  "\u{1F44E}": "thumbs down",
  "\u{1F44F}": "clapping hands",
  "\u{1F44B}": "waving hand",
  "\u{1F4AA}": "flexed biceps",
  "\u{1F64F}": "folded hands",
  "\u{270C}\uFE0F": "victory hand",
  "\u{1F91D}": "handshake",

  // Hearts & love
  "\u{2764}\uFE0F": "red heart",
  "\u{1F494}": "broken heart",
  "\u{1F495}": "two hearts",
  "\u{1F496}": "sparkling heart",
  "\u{1F499}": "blue heart",
  "\u{1F49A}": "green heart",
  "\u{1F49B}": "yellow heart",
  "\u{1F49C}": "purple heart",
  "\u{1F5A4}": "black heart",
  "\u{1F90D}": "white heart",
  "\u{1F9E1}": "orange heart",

  // Nature & animals
  "\u{1F525}": "fire",
  "\u{2B50}": "star",
  "\u{1F31F}": "glowing star",
  "\u{2600}\uFE0F": "sun",
  "\u{1F308}": "rainbow",
  "\u{26A1}": "high voltage",
  "\u{1F4A7}": "droplet",
  "\u{2744}\uFE0F": "snowflake",
  "\u{1F33A}": "hibiscus",
  "\u{1F339}": "rose",
  "\u{1F335}": "cactus",
  "\u{1F343}": "leaf fluttering in wind",
  "\u{1F436}": "dog face",
  "\u{1F431}": "cat face",
  "\u{1F98B}": "butterfly",

  // Objects & symbols
  "\u{1F680}": "rocket",
  "\u{2705}": "check mark",
  "\u{274C}": "cross mark",
  "\u{26A0}\uFE0F": "warning",
  "\u{1F6A8}": "police car light",
  "\u{1F4A1}": "light bulb",
  "\u{1F389}": "party popper",
  "\u{1F381}": "wrapped gift",
  "\u{1F3AF}": "bullseye",
  "\u{1F3C6}": "trophy",
  "\u{1F4E2}": "loudspeaker",
  "\u{1F514}": "bell",
  "\u{1F4CC}": "pushpin",
  "\u{1F4DD}": "memo",
  "\u{1F4DA}": "books",
  "\u{1F4BB}": "laptop",
  "\u{1F4F1}": "mobile phone",
  "\u{1F510}": "locked with key",
  "\u{1F512}": "locked",
  "\u{1F513}": "unlocked",
  "\u{1F504}": "counterclockwise arrows",
  "\u{1F4B0}": "money bag",
  "\u{1F3E0}": "house",
  "\u{1F4E7}": "e-mail",

  // Food & drink
  "\u{2615}": "hot beverage",
  "\u{1F355}": "pizza",
  "\u{1F382}": "birthday cake",
  "\u{1F37A}": "beer mug",
  "\u{1F377}": "wine glass",

  // Miscellaneous symbols
  "\u{2728}": "sparkles",
  "\u{1F4AF}": "hundred points",
  "\u{1F44C}": "OK hand",
  "\u{270D}\uFE0F": "writing hand",
  "\u{1F4A5}": "collision",
  "\u{1F4AB}": "dizzy",
  "\u{1F440}": "eyes",
  "\u{1F4AC}": "speech balloon",
  "\u{23F0}": "alarm clock",
  "\u{1F30D}": "globe showing Europe-Africa",
  "\u{1F30E}": "globe showing Americas",
  "\u{1F30F}": "globe showing Asia-Australia",
};

/**
 * Returns the human-readable name for an emoji character.
 * Falls back to "emoji" if the emoji is not found in the lookup table.
 */
export function getEmojiName(emoji: string): string {
  return EMOJI_NAMES[emoji] ?? "emoji";
}
