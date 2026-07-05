# How a theme JSON flows to the user

> **What this is.** A code-level trace of what happens between editing a theme's
> token value (e.g. `convex/data/themes/amber.json`) and the colour changing on a
> user's screen. Companion to the plain-English [`theme-system-explained.md`](./theme-system-explained.md)
> and the architecture in [ADR-011 §2](../decisions/ADR-011-plugin-architecture-for-content-modules.md).
>
> The short version: theme token values are a **compile-time import chain**, not a
> runtime database fetch. A profile stores only a `themeSlug`; the colours are
> resolved live by that slug and written to CSS variables on every render.

---

## The chain, end to end

```
convex/data/themes/amber.json        ← edit "primary": "#E12AFB"
        │  imported by
        ▼
convex/data/themes/_index.ts         ← THEME_MODULES = { amber: amber.json, … }
        │  wrapped by
        ▼
lib/themes/registry.ts               ← getThemeTokens("amber") → amber.tokens
        │  read by
        ▼
app/contexts/ProfileContext.tsx      ← effect: getThemeTokens(activeThemeSlug)
        │                                       → setTheme("amber", tokens)
        ▼
app/contexts/ThemeContext.tsx        ← applyThemeTokens():
        │                                root.style.setProperty("--theme-primary", "#E12AFB") …
        ▼
app/globals.css  @theme inline       ← --theme-primary → bg-theme-primary / text-theme-* / …
        ▼
every component using bg-theme-*      ← repaints with the new colour
```

### Step by step

1. **The JSON is the source of truth for token *values*.** Each theme is one file:
   `convex/data/themes/<slug>.json` (`amber.json`, `sky.json`, …).
2. **The barrel bundles them.** `convex/data/themes/_index.ts` imports every JSON
   and exposes `THEME_MODULES` (a slug-keyed map). Because these are static
   `import` statements, the bundler treats them as **compile-time data** — they
   ship inside the JS bundle, not fetched at runtime.
3. **The registry is the lookup.** `lib/themes/registry.ts#getThemeTokens(slug)`
   returns `THEME_MODULES[slug].tokens`. This replaced the old hard-coded
   `THEME_TOKENS` object; resolution is still synchronous and live by slug.
4. **ProfileContext resolves the active slug.** `ProfileContext` computes
   `activeThemeSlug` (student-view → `studentProfile.themeSlug`, else
   `users.themeSlug`), then `getThemeTokens(activeThemeSlug)` →
   `setTheme(slug, tokens)`.
5. **ThemeContext writes CSS variables.** `applyThemeTokens()` loops the
   `TOKEN_TO_CSS` map and calls
   `document.documentElement.style.setProperty("--theme-primary", "#E12AFB")` for
   every token.
6. **globals.css maps variables to utilities.** The `@theme inline` block maps
   each `--theme-*` variable to a Tailwind utility (`bg-theme-primary`,
   `text-theme-text`, `rounded-theme`, …). Every component already uses those
   utilities, so updating one variable repaints everything referencing it —
   **no component re-render required.**

---

## Why the value reaches the right theme — the slug reference

The reason a value change propagates *at all* is that **a profile stores only the
slug, never a copy of the colours**:

```
studentProfiles.themeSlug = "amber"     ← just the name
        │  resolved live every render
        ▼
getThemeTokens("amber") → current amber tokens
```

So new values for `amber` are picked up the next time the slug resolves. Nobody
has to re-select their theme, and there is no per-account data to migrate. (This
is the same "don't photocopy — resolve live" model used for content/languages —
see [`theme-system-explained.md`](./theme-system-explained.md).)

---

## Why it updates *live* in dev

The colour appears to change "dynamically" in dev because the JSON is a
**compile-time module**, and the **Next.js dev server watches the file and
rebuilds** (Fast Refresh). Since a `.json` file isn't a React component, saving it
triggers a quick rebuild/refresh that re-mounts `ProfileContext`, which re-runs
the resolve → `setTheme` → `applyThemeTokens` path with the new bundled values.

It is the **bundler**, not a database, doing the work. There is no runtime fetch
of theme tokens.

---

## Dev vs production (the honest distinction)

| | Dev (the live update you see) | Production |
|---|---|---|
| Trigger to change a colour | Save the JSON → Fast Refresh rebuild | Commit + deploy (bundle rebuilt at build time) |
| Speed | Near-instant | After the deploy completes |
| Reaches existing users? | — | **Yes, automatically — no per-account migration** |
| Live in-app colour editing? | Effectively, via HMR | **No** — values are baked into the build artifact |

Because token values are build-time data, **there is no live colour editing in
production** — which is exactly why the admin dashboard does **lifecycle only**
(publish / unpublish / tier / featured / schedule, via the `themeLifecycle`
table) and the live-preview token editor was deferred. Token *values* are content
(change = deploy); lifecycle is the deploy-free half. See ADR-011 §2.0.

---

## Files in the flow

| File | Role |
|---|---|
| `convex/data/themes/<slug>.json` | Token values — source of truth |
| `convex/data/themes/_index.ts` | Barrel → `THEME_MODULES` (compile-time bundle) |
| `convex/data/themes/types.ts` | `ThemeTokens` / `ThemeModule` types |
| `lib/themes/registry.ts` | `getThemeTokens(slug)` — synchronous live lookup |
| `app/contexts/ProfileContext.tsx` | Resolves `activeThemeSlug` → `setTheme` |
| `app/contexts/ThemeContext.tsx` | `applyThemeTokens` → writes `--theme-*` CSS vars |
| `app/globals.css` (`@theme inline`) | Maps `--theme-*` → Tailwind `*-theme-*` utilities |
