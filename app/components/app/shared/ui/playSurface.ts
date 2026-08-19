// The tap-to-replay surface shared by the fullscreen play modals (ADR-015):
// symbols on the module colour at 50%, tapped to replay, answering with a zoom
// pulse. Held here so a fluent sentence and a block sentence read as the same
// object rather than drifting apart.

// Fluent's height is set by its content — symbol group (100px tiles, 140px from
// `sm`) + gap + the sentence pill, measured at 212px / 252px. The block modal has
// no pill under its symbols, so without this it would come up short of a fluent
// sentence opened seconds earlier.
export const PLAY_SURFACE_MIN_H = 'min-h-[212px] sm:min-h-[252px]';

// Tailwind can't express the pulse (the scale is driven by state), so the
// transition lives here and the transform is applied inline.
export const PLAY_SURFACE_ZOOM_CLASS =
  'cursor-pointer transition-transform duration-200 ease-out will-change-transform motion-reduce:transition-none';

export const playSurfaceTransform = (zoom: boolean) => (zoom ? 'scale(1.04)' : 'scale(1)');
