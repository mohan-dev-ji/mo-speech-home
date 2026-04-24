# Mo Speech — Design System: From Figma to Runtime
## YouTube Video Script

**Estimated runtime:** ~13–14 minutes  
**Format:** Screen recording of slides + voiceover  
**Audience:** Developers and designers interested in design tokens, Tailwind CSS 4, and runtime theming

---

> **Production notes**
> - Slides are in `design-system-slides.html` — run fullscreen in browser
> - Advance slides with arrow keys or spacebar
> - `[→]` = advance slide · `[PAUSE]` = natural breath beat
> - Each section shows `[~Xs]` estimated speaking time
> - The Tailwind failure diagram has a shake animation — let it finish before moving on, it's the visual payoff of that slide
> - This script is written in first person — it's your story, your design decisions

---

## INTRO (before title slide)

[~25s]

Hey — this video is about the design system behind Mo Speech, and specifically the journey from designing it in Figma all the way to getting it working in code at runtime.

It's not a straightforward path. I hit a wall with Tailwind that I didn't expect, and the reason why is actually a really useful thing to understand about how Tailwind CSS 4 works under the hood.

So let's go through the whole thing — design, export, the first attempt, the failure, the fix, and how it all works now.

[→ advance to title slide]

---

## SLIDE 1 — Title

[~20s]

The design system covers five themes, four design pillars — colour, spacing, typography, and border radius — and it switches between themes at runtime, instantly, without reloading the page.

Getting to that point took a few tries. Here's how it happened.

[→]

---

## SLIDE 2 — The Full Journey

[~70s]

Here's the whole story in one diagram. Let it animate through and then I'll walk you back through each step.

So — it starts in Figma, where I designed the variables. Those got exported to a JSON file. I then gave that JSON to Claude Code and asked it to generate both CSS custom properties and Tailwind token config from the same source.

Now here's where the path forks. You can see the diagram splits into two branches.

The top branch — the one marked with an X — was the first attempt. Tailwind tokens defined as static values. It looked great on paper. It did not work at runtime.

The bottom branch — the one that flows cleanly through to ThemeContext — is what we actually ended up with. CSS custom properties as the source of truth, with a thin bridge to Tailwind utilities, and a context object that handles the runtime switching.

[PAUSE]

I'll explain exactly why the first branch failed in a few slides. It's a specific behaviour of Tailwind CSS 4 that isn't obvious until you hit it.

[→]

---

## SLIDE 3 — Designing in Figma — The 4 Pillars

[~65s]

So the design work started in Figma's Variables panel.

I defined four things.

**Colour.** Each theme is a set of semantic colour tokens — `primary`, `alt-text`, `background`, `highlight`. Not raw hex values, not Tailwind colour names. Semantic names, so that when you switch theme the whole palette swaps and no component code needs to know about it.

Those colour swatches you can see — the default greys at the top are the default theme. The sky blue, the rose red, the forest green — those are alternative themes. Same token names, different values in each one.

**Spacing.** A four-step scale derived from a base unit — xs, sm, md, lg. Components reference the scale name, not a raw pixel value. That means you can change the density of the whole UI by touching one number.

**Typography.** A size ramp mapped to semantic roles. Heading, body, caption. Again, semantic names rather than raw sizes.

**Border radius.** A single token. This is the thing that controls the "personality" of the UI — whether it feels sharp and technical, soft and friendly, or pill-shaped and playful. One token affects every button, every card, every input in the entire app.

[PAUSE]

The important thing about all of these is that they're semantic. They describe *what the thing is*, not *what it looks like*. That's what makes runtime theme switching possible.

[→]

---

## SLIDE 4 — Export to JSON — The Bridge File

[~50s]

Figma can export your variable sets as JSON. What comes out is exactly what you see on the left — a nested object where each token has a name and a value.

`color.primary.value` is `#62748E`. `spacing.sm.value` is `8px`. `radius.default.value` is `12px`.

The structure itself is the contract. Every theme file has exactly the same keys with different values. If you change a key name in one theme file, you have to change it everywhere — and the code will tell you immediately if something's missing.

I had one JSON per theme. `tokens-default.json`, `tokens-sky.json`, `tokens-rose.json`. Same shape, different values.

Then I gave these to Claude Code and said: turn these into CSS custom properties and Tailwind token configuration. Generate both from the same source so they stay in sync.

Which it did. And then the fun started.

[→]

---

## SLIDE 5 — First Attempt — Tailwind Tokens

[~60s]

The generated Tailwind config looked clean. Token names mapped to semantic utility classes — `bg-primary`, `text-alt-text`, `rounded-default`. You could write component code that read like plain English. It felt right.

The idea was: define the tokens in Tailwind's `@theme` block, generate the utility classes at build time, and then when a user switches theme, ThemeContext would overwrite the underlying CSS variables and everything would update.

Except it didn't. Watch the diagram on this slide — in particular the circle in the middle that says "NO EFFECT."

ThemeContext was calling `setProperty` on the root element. It was changing the variable. But nothing in the UI was changing.

The new hex value was being written to the DOM. It just wasn't connected to anything visible.

[PAUSE]

And that took a while to figure out. Let me show you exactly why.

[→]

---

## SLIDE 6 — Why Tailwind Alone Couldn't Do Runtime Theming

[~75s]

This slide shows the root cause. Look at both columns.

On the left — `@theme` without the `inline` keyword. You define your token as a static value: `--color-primary: #62748E`. Tailwind reads that at build time and generates a utility class. But look at what it generates: `.bg-primary { background-color: #62748E }`. The hex value is right there, hardcoded, in the generated CSS. It's not a reference to the variable — it's the resolved value.

So when ThemeContext later calls `setProperty('--color-primary', '#00A6F4')`, there's nothing to cascade into. The utility class doesn't know the variable exists. It has the colour baked in. The variable change disappears into a void.

[PAUSE]

On the right — `@theme inline`. Now you define the token as a reference: `--color-primary: var(--theme-primary)`. And look at what Tailwind generates: `.bg-theme-primary { background-color: var(--theme-primary) }`. The variable reference is preserved in the generated CSS.

Now when ThemeContext calls `setProperty('--theme-primary', '#00A6F4')`, the utility class *does* cascade. The browser resolves the var at paint time, finds the new value, and repaints.

[PAUSE]

The `inline` keyword is the fix. It tells Tailwind: "don't resolve this — keep it as a variable reference in the generated output." Without it, Tailwind treats your tokens as build-time constants. With it, they become runtime-switchable.

[→]

---

## SLIDE 7 — `globals.css` — The Token Declaration

[~60s]

So this is what the working setup looks like in `globals.css`.

Three blocks.

**Block one** — the `:root` declaration. This is where the actual runtime values live. Every `--theme-*` variable is defined here. This is the only thing ThemeContext needs to overwrite when a theme switches. Default values ship with the app; ThemeContext replaces them at runtime.

**Block two** — `@theme inline`. This is the bridge to Tailwind. Each `--color-theme-*` entry maps a Tailwind namespace name to one of our runtime vars. The `inline` keyword means Tailwind generates `var(--theme-primary)` in the utility, not the resolved hex value.

This is why you can write `bg-theme-primary` in your JSX and have it respond to theme switches. Tailwind generates the utility. The utility references the var. ThemeContext changes the var. The browser repaints.

**Block three** — the font rule. This is completely separate from theming — it's driven by locale, not theme. The `[data-locale="hi"]` selector swaps the font-family to Devanagari. Theme has no effect on fonts.

[→]

---

## SLIDE 8 — ThemeContext — The Runtime Switcher

[~60s]

`THEME_TOKENS` is just a plain JavaScript object. Each key is a theme ID. Each value is an object of CSS custom property names mapped to their values for that theme.

So `default` has `--theme-primary: #62748E`. `sky` has `--theme-primary: #00A6F4`. Same key, different value. That's the whole theming model.

`applyThemeTokens` is the function that does the actual switching. It takes the token object for the chosen theme, loops through every entry, and calls `style.setProperty` on `document.documentElement` — which is the `:root` element. One pass, all tokens updated simultaneously.

[PAUSE]

The fact that this works without triggering a React re-render is worth dwelling on. React has no idea anything changed. There's no state update, no context propagation through the tree, no re-rendering of components. The CSS cascade handles all of it. The browser sees that the custom property values changed, and repaints the affected elements in the next frame. It's genuinely instant.

[→]

---

## SLIDE 9 — Token Flow — From Switch to Screen

[~65s]

Let me walk you through the full sequence once more, with the diagram to make it concrete.

The user taps "Sky" in the settings panel.

The panel calls `setTheme('sky', THEME_TOKENS.sky)` on the ThemeContext.

ThemeContext calls `applyThemeTokens` with the sky token set. That function loops through the object and calls `setProperty` for each key — `--theme-primary` gets `#00A6F4`, `--theme-background` gets `#EFF9FF`, and so on for every token.

Those property writes update `:root`. The CSS cascade immediately picks them up.

Every utility class that references one of those vars — `bg-theme-primary`, `text-theme-alt-text`, `rounded-theme` — now resolves to the new value. The browser repaints.

[PAUSE]

Look at the timing strip at the bottom of the diagram. Steps three, four, and five — the property write, the cascade, and the repaint — happen in a single browser paint cycle. From the user's perspective, it's instantaneous. No loading indicator, no transition, no delay. The UI just changes.

[→]

---

## SLIDE 10 — Adding a New Theme

[~45s]

Here's the payoff of the whole architecture. Adding a new theme is adding one object to `THEME_TOKENS`.

Same keys as every other theme. Different values. That's it.

No new CSS file. No Tailwind config change. No rebuild required for the theme itself. The `applyThemeTokens` function is generic — it takes whatever object you give it and writes those vars to the root. It doesn't need to know about specific theme names.

So when I add a `forest` theme — green primary, light green background — I put the object in `THEME_TOKENS`, add a button to `DevTestPanel`, and it works on the next hot reload.

[PAUSE]

And the reason this scales well is that every component in the app is theme-agnostic. They use `bg-theme-primary`, not `bg-slate-600`. They describe what role the colour plays, not what colour it is. So adding a theme is purely additive — you're not touching any component code.

In Mo Speech, every student profile has its own theme ID stored in Convex. When the profile loads, `setTheme()` is called once, and the entire UI reflects their preferences. Same code, different data.

---

## OUTRO

[~35s]

So the short version: design in Figma with semantic tokens. Export to JSON. Use CSS custom properties as your runtime source of truth. Bridge to Tailwind utilities with `@theme inline` so the utilities reference the variables instead of baking in the values. And use a ThemeContext to rewrite the variables whenever the theme changes.

The `inline` keyword is the thing that ties it all together — without it, Tailwind resolves your tokens at build time and runtime switching becomes impossible.

Thanks for watching. If you build something with this pattern, let me know in the comments. See you in the next one.

---

## Quick reference card

| Slide | Topic | Approx time |
|---|---|---|
| 1 | Title | 0:00 |
| 2 | The full journey | 0:45 |
| 3 | Designing in Figma — the 4 pillars | 1:55 |
| 4 | Export to JSON | 3:00 |
| 5 | First attempt — Tailwind tokens | 3:50 |
| 6 | Why Tailwind couldn't do runtime theming | 4:50 |
| 7 | globals.css — the token declaration | 6:05 |
| 8 | ThemeContext — the runtime switcher | 7:05 |
| 9 | Token flow — from switch to screen | 8:05 |
| 10 | Adding a new theme | 9:10 |
| Outro | Recap | 9:55 |

**Total: ~10 min 30 sec**

---

> **Key talking points to land clearly**
> - `@theme` vs `@theme inline` is the crux of the whole video — don't rush slide 6
> - The "semantic not literal" point on slide 3 sets up why runtime switching is even possible
> - The shake animation on slide 5 is timed to land right after you say "it did not work"
> - On slide 9, pause on the timing strip — it visually proves the "instant" claim
