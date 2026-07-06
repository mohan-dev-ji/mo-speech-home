// The shared "now playing" glow — a yellow ring + bloom in `--theme-play-glow`.
// The block CompositionPlayModal steps it through each block in time with the
// audio; the SentencePlayModal holds it on the whole symbol group while its
// single clip plays. One constant so both stay identical.
export const PLAY_GLOW =
  '0 0 0 3px var(--theme-play-glow), 0 0 20px 6px var(--theme-play-glow)';
