# Phase 35 — AI Generate Create Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the AI Generate tab's empty state into a create stage that shows what each style looks like and what it is good for, before a single generation is spent.

**Architecture:** Three additive changes to one component plus its copy: style cards gain the committed thumbnails, the empty preview area becomes a per-style guidance blurb, and the prompt field gains a clear control. Nothing about generation, quota or the result view changes.

**Tech Stack:** Next.js 16 / React 19 · next-intl v4 · Tailwind CSS 4 (theme tokens only)

## Global Constraints

- **All UI copy via `useTranslations`; new keys go in `messages/en.json` ONLY.** Never hand-add a key to another locale — `i18n/request.ts` merges each locale over `en.json`, and the translation pipeline only translates keys *absent* from a locale, so a hand-added placeholder ships forever.
- **Theme tokens only** — no hard-coded colours, spacing, radii or font sizes. Tailwind CSS 4, no config file; `--theme-*` vars live in `:root` in `app/globals.css` and are rewritten at runtime per student profile, so a hard-coded value breaks theme switching.
- **There is no test framework in this repo** (`package.json`: dev / build / lint / pack:migrate). Do not write test files; do not add a framework. Verification is typecheck + lint + build + driving the real app.
- **Typecheck baseline is 0 errors.** `npx tsc --noEmit` is clean as of `da0f467`. Any error is yours.
- **Work on `main`.** No branch, no worktree.
- Never run `npm run dev` or `npx convex dev` — the owner runs both.
- **Do NOT touch the result view.** When an image exists the tab still shows it with Discard / Add to symbol. MOS-52 replaces that view with a tab switch to My Images; building anything there now is waste.
- Ticket: MOS-47. Related: MOS-52 (the gallery that will replace the result view), ADR-023, FEAT-008.

## File Structure

| file | change |
|---|---|
| `messages/en.json` | 6 keys added, 1 removed |
| `lib/ai-style-prompts.ts` | each preset gains a `thumbnail` path |
| `app/components/app/shared/modals/symbol-editor/AiGenerateTab.tsx` | style cards show thumbnails; empty state becomes the blurb; prompt gains a clear button |

The thumbnails already exist and are committed at `public/ai-styles/{style}.webp` (`860a4fa`) — a wooden rocking horse in each of the four styles, 320px webp, ~20 KB the set. **Do not regenerate them.**

---

### Task 1: Copy

**Files:**
- Modify: `messages/en.json` (the `symbolEditor` block, around lines 866–884)

**Interfaces:**
- Produces: `aiGuidanceLead`, `aiStyleBlurbPhotorealistic`, `aiStyleBlurbIconic`, `aiStyleBlurbStorybook`, `aiStyleBlurbClaymation`, `aiClearPrompt`

- [ ] **Step 1: Add the six new keys**

Add these beside the existing `aiStyle*` keys. Use the text verbatim — it has been reviewed, and each blurb deliberately does three jobs: what the style looks like, what it is for, and where it will surprise you.

```json
    "aiGuidanceLead": "Best for one everyday object that isn't in Symbols and can't be found by Image Search. Describe a thing, not a scene — \"a red kite\", not \"a boy flying a kite in the park\".",
    "aiStyleBlurbPhotorealistic": "Like a product photo — real materials, real light, plain white background. Best for objects a child meets in the real world: a particular fruit, a piece of equipment, something from around the house. It usually adds a soft shadow even though we ask it not to.",
    "aiStyleBlurbIconic": "Flat shapes and bold outlines, like a sticker. The closest match to the symbols already on the board, so it sits most naturally alongside them. Best for simple, recognisable shapes — fine detail gets flattened away.",
    "aiStyleBlurbStorybook": "A soft pastel picture-book illustration, warm and friendly. Good for characters, animals and imaginative words. Be aware it likes to give things faces — ask for a cup and you may get a cup with eyes.",
    "aiStyleBlurbClaymation": "Rounded and toy-like, as though modelled in clay. Playful and tactile — good for toys, food and animals. Very fine detail rounds off, so keep the subject chunky.",
    "aiClearPrompt": "Clear",
    "aiPromptPreviewLabel": "What we actually send:",
    "aiPromptSlotPlaceholder": "your object",
```

- [ ] **Step 2: Remove the key the blurb replaces**

Delete this line — `aiGuidanceLead` says the same thing better, and leaving both means two places to edit:

```json
    "aiEmptyState": "Pick a style and describe the symbol you'd like to generate.",
```

Leave the copies in `es.json` / `hi.json` alone. Nothing will read them, and deleting keys from other locales is not this task's business.

- [ ] **Step 3: Verify the JSON parses**

```bash
node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); console.log('valid')"
```

Expected: `valid`

- [ ] **Step 4: Confirm nothing still reads the removed key**

```bash
grep -rn "aiEmptyState" app lib --include="*.tsx" --include="*.ts"
```

Expected: one hit, in `AiGenerateTab.tsx`. That call site is replaced in Task 3 — leaving it broken between tasks is expected and fine, because next-intl renders the key name rather than throwing. Do not fix it here.

- [ ] **Step 5: Commit**

```bash
git add messages/en.json
git commit -m "copy(ai-generate): per-style guidance for the create stage

Each blurb says what the style looks like, what it is for, and where it will
surprise you. The photorealistic shadow and the storybook faces were both
found by generating the sample thumbnails and are invisible in the UI today.

en.json only — the pipeline skips keys already present in a locale.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Thumbnail paths on the style presets

**Files:**
- Modify: `lib/ai-style-prompts.ts`

**Interfaces:**
- Produces: `STYLE_PRESETS[id].thumbnail: string` — a public URL path, e.g. `/ai-styles/iconic.webp`

- [ ] **Step 1: Widen the type and add the paths**

Replace the `STYLE_PRESETS` declaration line and add a `thumbnail` to each preset. The templates themselves are unchanged — only the type and one new field per entry:

```ts
export const STYLE_PRESETS: Record<
  StyleId,
  { label: string; thumbnail: string; template: (prompt: string) => string }
> = {
```

Then add to each of the four entries, beside its `label`:

```ts
    thumbnail: '/ai-styles/photorealistic.webp',
```
```ts
    thumbnail: '/ai-styles/iconic.webp',
```
```ts
    thumbnail: '/ai-styles/storybook.webp',
```
```ts
    thumbnail: '/ai-styles/claymation.webp',
```

- [ ] **Step 2: Document why the path lives here**

Add above `STYLE_PRESETS`:

```ts
/**
 * `thumbnail` is a sample of what the style ACTUALLY produces, committed at
 * `public/ai-styles/`. It lives beside the template deliberately: the two are
 * a matched pair, and a thumbnail generated from a different template is worse
 * than no thumbnail because it misrepresents what the user will get.
 *
 * REGENERATE THE SET WHENEVER A TEMPLATE OR THE MODEL CHANGES —
 * `scripts/generate-style-thumbnails.mjs`, whose default subject is the
 * committed set's subject so a routine regeneration cannot silently swap it.
 */
```

- [ ] **Step 3: Confirm every file exists**

```bash
for s in photorealistic iconic storybook claymation; do
  test -f "public/ai-styles/$s.webp" && echo "$s ok" || echo "$s MISSING"
done
```

Expected: four `ok` lines. A `MISSING` means the assets were not committed — stop and report; do not regenerate them.

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no output. The baseline is 0 errors; anything here is yours.

- [ ] **Step 5: Commit**

```bash
git add lib/ai-style-prompts.ts
git commit -m "feat(ai-styles): each preset carries its sample thumbnail path

The template and the picture of what it produces are a matched pair, so they
live together. A thumbnail from a stale template is worse than none.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The create stage

**Files:**
- Modify: `app/components/app/shared/modals/symbol-editor/AiGenerateTab.tsx`

**Interfaces:**
- Consumes: `STYLE_PRESETS[id].thumbnail` (Task 2), the six copy keys (Task 1)

**Reference:** [Figma state 1](https://www.figma.com/design/3DAZYuK3A1TrkeZnyGwE1o/Mo-Speech---Finals?node-id=3332-6433). It is a **wireframe** — take the layout and the control count from it, take every colour, radius and spacing from the theme tokens. Top to bottom: blurb → **the wrapped prompt with the user's words highlighted** → thumbnails → style labels → prompt field with a clear (×) → full-width Generate.

- [ ] **Step 1: Add the blurb key map**

Beside the existing `STYLE_TRANSLATION_KEYS`:

```ts
const STYLE_BLURB_KEYS: Record<StyleId, string> = {
  photorealistic: "aiStyleBlurbPhotorealistic",
  iconic: "aiStyleBlurbIconic",
  storybook: "aiStyleBlurbStorybook",
  claymation: "aiStyleBlurbClaymation",
};
```

- [ ] **Step 2: Replace the empty state with the blurb**

In the preview block, replace the final `) : (` branch — the one currently rendering `t("aiEmptyState")` — with:

```tsx
        ) : (
          // THE CREATE STAGE. This area becomes the generated image in the
          // result view, so the guidance occupies exactly the space the
          // outcome will. The lead never changes; the second paragraph
          // follows the selected style, which is what makes clicking a
          // thumbnail informative rather than just a selection.
          <div className="flex flex-col gap-3 max-w-sm text-center">
            <p className="text-theme-s" style={{ color: "var(--theme-text)" }}>
              {t("aiGuidanceLead")}
            </p>
            <p
              className="text-theme-xs"
              style={{ color: "var(--theme-secondary-text)" }}
            >
              {t(STYLE_BLURB_KEYS[style])}
            </p>
          </div>
        )}
```

- [ ] **Step 3: Put the thumbnail into each style card**

Replace the whole `{/* Style cards */}` block with:

```tsx
      {/* Style cards — thumbnail above label, one control per column */}
      <div className="px-3 pb-2 shrink-0">
        <div className="grid grid-cols-4 gap-1.5">
          {STYLE_IDS.map((id) => {
            const isSelected = style === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setStyle(id)}
                aria-pressed={isSelected}
                className="flex flex-col items-center gap-1 rounded-theme-sm p-1 text-theme-xs font-medium"
                style={{
                  background: isSelected
                    ? "color-mix(in srgb, var(--theme-brand-primary) 15%, transparent)"
                    : "var(--theme-symbol-bg)",
                  border: `2px solid ${
                    isSelected ? "var(--theme-brand-primary)" : "transparent"
                  }`,
                  color: isSelected
                    ? "var(--theme-brand-primary)"
                    : "var(--theme-secondary-text)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={STYLE_PRESETS[id].thumbnail}
                  alt=""
                  aria-hidden="true"
                  className="w-full aspect-square object-contain rounded-theme-sm bg-white"
                  loading="lazy"
                />
                <span>{t(STYLE_TRANSLATION_KEYS[id])}</span>
              </button>
            );
          })}
        </div>
      </div>
```

Two deliberate choices: the image is `aria-hidden` with an empty `alt` because the visible label already names the style — announcing it twice is noise for a screen-reader user. And `STYLE_PRESETS` was already imported but unused (a standing lint warning); this is what it was imported for.

- [ ] **Step 4: Add the clear button to the prompt field**

Inside the prompt row, immediately after the `<input>`, add:

```tsx
          {prompt && (
            <button
              type="button"
              onClick={() => setPrompt("")}
              aria-label={t("aiClearPrompt")}
              className="shrink-0"
              style={{ color: "var(--theme-secondary-text)" }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
```

`X` is already imported. Note the prompt is the SHARED search query — clearing it here also clears it for the Symbols and Image Search tabs, which is the existing intended behaviour of that field, not a bug to work around.

- [ ] **Step 5: Show the real prompt, with the user's words highlighted inside it**

Directly below the blurb, inside the same create-stage container from Step 2, add a read-only box showing the full wrapped prompt that will actually be sent, updating as the user types and as the style changes.

**Derive the two halves by splitting the template on a sentinel — never by searching the wrapped string for what the user typed.** The templates contain words a user will plausibly type ("white", "text", "no ground", "single subject"), and a naive `.split(prompt)` would then highlight the template's own words instead of theirs. Splitting on a value that cannot occur in either is exact.

Add above the component:

```ts
// A value no template and no user can contain, used to find where the user's
// words land inside the wrapped prompt. Splitting on this is exact; searching
// the wrapped string for what the user typed is NOT — the templates contain
// words people plausibly type ("white", "text", "no ground"), and the
// highlight would land on the template's own wording instead of theirs.
const PROMPT_SLOT = "\u0000";
```

Inside the component, beside the other derived values:

```ts
  // Exactly what the route will send: it calls the same template with the
  // same trimmed prompt, so this display cannot drift from the real request.
  const typedPrompt = prompt.trim();
  const wrappedParts = STYLE_PRESETS[style].template(PROMPT_SLOT).split(PROMPT_SLOT);
```

Then, below the blurb paragraph in the create-stage block:

```tsx
            {wrappedParts.length === 2 && (
              <div
                className="w-full rounded-theme-sm p-2 text-left"
                style={{
                  background: "var(--theme-symbol-bg)",
                  border: "1px solid var(--theme-button-highlight)",
                }}
              >
                <p
                  className="text-theme-xs mb-1 font-medium"
                  style={{ color: "var(--theme-secondary-text)" }}
                >
                  {t("aiPromptPreviewLabel")}
                </p>
                <p
                  className="text-theme-xs leading-relaxed"
                  style={{ color: "var(--theme-secondary-text)" }}
                >
                  {wrappedParts[0]}
                  <span
                    style={{
                      color: "var(--theme-brand-primary)",
                      fontWeight: 600,
                    }}
                  >
                    {typedPrompt || t("aiPromptSlotPlaceholder")}
                  </span>
                  {wrappedParts[1]}
                </p>
              </div>
            )}
```

The `length === 2` guard is not defensive padding: every current template interpolates the prompt exactly once, and if one ever stops doing so this renders nothing rather than a mangled sentence with a stray null byte in it.

**It is read-only.** MOS-47 is explicit that user-editable prompts are a later step — *"for now it is static with one dynamic word that is the object for creation"*. Build the display so that step is not blocked; do not build editing.

- [ ] **Step 6: Make the create-stage area scroll**

The area now holds three blocks — lead, blurb, wrapped prompt — where it held one short line. On a short viewport that will overflow the preview region, which is `flex-1 ... min-h-0`.

Change the preview container's classes so the create stage can scroll rather than being clipped:

```tsx
      <div className="flex-1 flex items-center justify-center p-4 min-h-0 overflow-y-auto">
```

Confirm in the browser pass at a short window height that the Generate button stays visible and the guidance scrolls under it — the button must never be pushed off-screen, because that is the one control the whole tab exists to reach.

- [ ] **Step 7: Typecheck, lint, build**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Expected: typecheck clean (baseline 0); lint no worse than its 66 pre-existing problems, **and one fewer** — the unused `STYLE_PRESETS` warning in this file should be gone; build exits 0.

- [ ] **Step 8: Commit**

```bash
git add app/components/app/shared/modals/symbol-editor/AiGenerateTab.tsx
git commit -m "feat(ai-generate): the empty tab becomes a create stage

Style cards show what each style actually produces, and the area that will
hold the image holds per-style guidance until it does. Clicking a thumbnail
now teaches something rather than just selecting.

Prompt field gains a clear control.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Verify in the real app

**Files:** none — this is the controller's browser pass.

- [ ] **Step 1: Drive the tab**

With the owner's dev server running, open a symbol editor → AI Generate as a Max user and confirm:

1. Four thumbnails render, each visibly a different style of the same rocking horse.
2. Clicking a style selects it **and** swaps the second paragraph of the blurb.
3. The lead paragraph does not change.
4. Typing shows the clear (×); pressing it empties the field.
4b. The wrapped prompt updates **as you type**, with your words highlighted in the brand colour, and **changes wholesale when you switch style**. Type a word the template already contains — `white` is the sharpest test — and confirm the highlight is on YOUR word, not on the template's.
4c. With the field empty, the preview reads sensibly with the placeholder in the slot.
5. Generating still works and still shows the result view with Discard / Add to symbol — **unchanged**.
6. No console errors.

- [ ] **Step 2: Check it in a second theme**

Switch the student profile theme and confirm the blurb text and card borders follow the theme. Hard-coded colours are invisible until this step.

- [ ] **Step 3: Close out**

Move MOS-47 to Done with a comment covering what shipped and what was deliberately left to MOS-52. Retire this plan:

```bash
git mv docs/4-builds/plans/phase-35-ai-generate-create-stage-plan.md docs/4-builds/plans/_done/
git commit -m "docs(ai-generate): retire the phase-35 plan

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Notes for whoever executes this

- **Do not build a result view.** The tab still shows its existing single-image view after a generation. MOS-52 replaces it with a switch to the My Images tab; anything built there now is thrown away.
- **Do not regenerate the thumbnails.** They are committed and chosen. Regenerating spends quota and would produce a different horse.
- **The blurb and the prompt preview are BOTH built** (owner, 2026-09-04). An earlier draft of this plan said the blurb superseded the wrapped-prompt display; it does not. They do different jobs and sit together: the blurb says what the style is *for* in plain language, the preview shows the machinery and where the user's words land in it. The preview is read-only — editing is a later step MOS-47 explicitly defers.
- **The Generate button needs no change.** It is already full-width and already the only action when no image exists, which is what the Figma frame shows. If you find yourself editing it, re-read the frame.
- If a step's code does not match what is on disk, the file has moved on since 2026-09-04 — stop and re-read rather than forcing the patch.
