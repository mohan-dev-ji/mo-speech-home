export type CategoryColour = {
  /** Tailwind 700-weight — banner + talker background */
  c700: string;
  /** Tailwind 500-weight — folder tab + symbol border */
  c500: string;
  /** Tailwind 100-weight — symbol card background */
  c100: string;
};

export const CATEGORY_COLOURS: Record<string, CategoryColour> = {
  orange:  { c700: '#C2410C', c500: '#F97316', c100: '#FFEDD5' },
  amber:   { c700: '#B45309', c500: '#F59E0B', c100: '#FEF3C7' },
  yellow:  { c700: '#A16207', c500: '#EAB308', c100: '#FEF9C3' },
  red:     { c700: '#B91C1C', c500: '#EF4444', c100: '#FEE2E2' },
  rose:    { c700: '#BE123C', c500: '#F43F5E', c100: '#FFE4E6' },
  pink:    { c700: '#BE185D', c500: '#EC4899', c100: '#FCE7F3' },
  fuchsia: { c700: '#A21CAF', c500: '#D946EF', c100: '#FAE8FF' },
  purple:  { c700: '#7E22CE', c500: '#A855F7', c100: '#F3E8FF' },
  violet:  { c700: '#6D28D9', c500: '#8B5CF6', c100: '#EDE9FE' },
  indigo:  { c700: '#4338CA', c500: '#6366F1', c100: '#E0E7FF' },
  blue:    { c700: '#1D4ED8', c500: '#3B82F6', c100: '#DBEAFE' },
  sky:     { c700: '#0369A1', c500: '#0EA5E9', c100: '#E0F2FE' },
  cyan:    { c700: '#0E7490', c500: '#06B6D4', c100: '#CFFAFE' },
  teal:    { c700: '#0F766E', c500: '#14B8A6', c100: '#CCFBF1' },
  emerald: { c700: '#047857', c500: '#10B981', c100: '#D1FAE5' },
  green:   { c700: '#15803D', c500: '#22C55E', c100: '#DCFCE7' },
  lime:    { c700: '#4D7C0F', c500: '#84CC16', c100: '#ECFCCB' },
};

// Reverse map — existing seeded data stores hex values, resolve to named pairs
const LEGACY_HEX: Record<string, CategoryColour> = {
  '#F97316': CATEGORY_COLOURS.orange,
  '#F59E0B': CATEGORY_COLOURS.amber,
  '#D97706': CATEGORY_COLOURS.amber,
  '#EAB308': CATEGORY_COLOURS.yellow,
  '#EF4444': CATEGORY_COLOURS.red,
  '#F43F5E': CATEGORY_COLOURS.rose,
  '#EC4899': CATEGORY_COLOURS.pink,
  '#F472B6': CATEGORY_COLOURS.pink,
  '#D946EF': CATEGORY_COLOURS.fuchsia,
  '#A855F7': CATEGORY_COLOURS.purple,
  '#8B5CF6': CATEGORY_COLOURS.violet,
  '#7C3AED': CATEGORY_COLOURS.violet,
  '#6366F1': CATEGORY_COLOURS.indigo,
  '#3B82F6': CATEGORY_COLOURS.blue,
  '#0EA5E9': CATEGORY_COLOURS.sky,
  '#06B6D4': CATEGORY_COLOURS.cyan,
  '#14B8A6': CATEGORY_COLOURS.teal,
  '#10B981': CATEGORY_COLOURS.emerald,
  '#22C55E': CATEGORY_COLOURS.green,
};

export function getCategoryColour(colour: string): CategoryColour {
  if (colour in CATEGORY_COLOURS) return CATEGORY_COLOURS[colour];
  if (colour in LEGACY_HEX) return LEGACY_HEX[colour];
  // Unknown value — use directly for c500, derive rough c700/c100 as neutrals
  return { c700: colour, c500: colour, c100: '#F5F5F5' };
}
