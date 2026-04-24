# Mo Speech — i18n & Theme Switching
## YouTube Video Script

**Estimated runtime:** ~12–15 minutes  
**Format:** Screen recording of slides + voiceover  
**Audience:** Developers learning Next.js App Router + next-intl

---

> **Production notes**
> - Slides are in `I18N-slides.html` — run fullscreen in browser
> - Advance slides with arrow keys or spacebar
> - Each section shows `[~Xs]` estimated speaking time
> - `[→]` = advance slide, `[PAUSE]` = natural breath beat

---

## INTRO (before title slide appears)

[~20s]

Hey — in this video I'm going to walk you through exactly how internationalisation and theme switching work inside a Next.js 16 app using the App Router.

These two features look similar on the surface — both "change what the user sees" — but they work in completely different ways, and understanding *why* is what makes the code actually make sense.

Let's get into it.

[→ advance to title slide]

---

## SLIDE 1 — Title

[~25s]

So the app here is Mo Speech — an AAC platform built on Next.js 16, React 19, and next-intl v4 for localisation.

We support English and Hindi. And we have a full theme-switching system where each student profile gets its own colour theme — applied instantly without reloading the page.

Those two systems — locale switching and theme switching — are what this whole video is about.

[→]

---

## SLIDE 2 — Two Kinds of Switch

[~60s]

Before any code, I want to lock in the mental model, because this is the thing that makes everything else click.

There are two kinds of switch in this app.

**The locale switch** — going from English to Hindi — works through the URL. It triggers a full server render. The URL changes, a new page loads, and the server sends back HTML with all the text already in the right language. No client-side message fetching. No hydration trick. Just a new page.

**The theme switch** — going from the default colour scheme to sky blue — works entirely in memory. No page load. No server round trip. We just overwrite some CSS custom properties on the root element, and the browser repaints instantly.

That green callout at the bottom is the key point: these two things are *deliberately independent*. They don't affect each other. You can switch theme without touching the locale, and vice versa.

Hold onto that — the rest of the video is just filling in *how* each one works.

[→]

---

## SLIDE 3 — Locale Pipeline

[~90s]

OK, so let's walk through the locale pipeline step by step. This is what happens on *every single page load*.

**Step one.** The browser makes a GET request — say, `/en/home`. That `/en/` prefix is doing real work. Next.js uses it to know which locale this render is for.

**Step two.** The request hits `next.config.ts`, which wraps the Next.js config with `withNextIntl`. That plugin intercepts the request and activates the whole localisation system — no middleware file needed.

**Step three.** We land in `app/[locale]/layout.tsx`. That `[locale]` in the folder name is a dynamic segment — Next.js extracts `en` from the URL and passes it as a param. The layout calls `setRequestLocale('en')`, which tells next-intl which locale *this server render* is for.

**Step four.** Then it calls `getMessages()`, which goes to `i18n/request.ts`. That function validates the locale, then dynamically imports the right JSON file — `messages/en.json` in this case.

**Step five.** That JSON gets passed into `NextIntlClientProvider`, which wraps the entire page tree.

And from that point on, any component in the tree can call `useTranslations()` and get the right strings.

Nothing is fetched on the client. The messages travel down as part of the initial HTML. That's why there's no flash of untranslated content.

[→]

---

## SLIDE 4 — Key Files

[~45s]

Here's a map of all the files involved. I'll refer back to this as we go deeper.

On the left — the i18n layer. `routing.ts` is the single source of truth for which locales exist. `request.ts` is the server-side message loader. `navigation.ts` wraps next-intl's locale-aware router for client components.

On the right — the app layer. The `[locale]/layout.tsx` is the orchestrator — it sets the locale context, loads messages, loads fonts, sets the `data-locale` attribute, and wraps everything in the provider. From there, any component using `useTranslations` just works.

And then `ThemeContext.tsx` — that's entirely separate. It has nothing to do with the URL. It lives in the browser, in memory, manipulating CSS vars.

[→]

---

## SLIDE 5 — `routing.ts`

[~40s]

`routing.ts` is short but important. It defines three things.

`locales` — the array of valid locale codes. Right now that's English and Hindi.

`defaultLocale` — if a URL somehow doesn't have a valid locale prefix, fall back to English.

And `localePrefix: 'always'` — this means the locale is *always* in the URL. There's no bare `/home`. It's always `/en/home` or `/hi/home`. That makes the system predictable and debuggable — you always know what locale a URL is for just by looking at it.

The reason this file matters so much is that `request.ts`, `layout.tsx`, and `navigation.ts` all import from here. There's one place to add a new locale, and everything else picks it up.

[→]

---

## SLIDE 6 — `request.ts`

[~50s]

This is the function that actually loads your translation strings, server-side, per request.

It receives `requestLocale` — which comes from the `[locale]` URL segment that Next.js resolved.

Then there's a guard clause. If the locale is missing, or it's not in our valid list, we fall back to English. This prevents a 500 error if someone types a nonsense URL.

Then the dynamic import. Notice it's `import('../messages/${locale}.json')` — that backtick template literal means this is evaluated at runtime. Webpack or Turbopack bundles *all* the JSON files, but only the one you ask for gets loaded per request.

That's how we guarantee `hi.json` is never sent to English users. The server loads the right file and bundles the strings into the HTML it sends back.

[→]

---

## SLIDE 7 — `useTranslations`

[~40s]

This is the consumer side — what you write in any component.

You call `useTranslations` with a namespace — in this case `'nav'`. That maps to the top-level `nav` key in your JSON file.

Then `t('home')` returns `"Home"` for English users and `"होम"` for Hindi users. The component itself doesn't know which locale it's in. It just calls `t` and gets the right string.

The JSON structure maps directly — no configuration, no magic. Whatever key you pass to `t()` gets looked up inside that namespace object.

One thing worth knowing: missing keys *throw an error* in development. That's intentional. You find out immediately if you've used a key that doesn't exist in the JSON, rather than shipping a blank string to production.

[→]

---

## SLIDE 8 — Locale Switch Sequence

[~65s]

So — what actually happens when a user taps the language button?

The user clicks "हिन्दी" in the dev test panel.

The panel calls `router.replace()` — but this is *not* the standard Next.js router. It's the one from `@/i18n/navigation`. That's a wrapped version that understands locale options.

You pass it `{ locale: 'hi' }`, and it rewrites the current URL's locale prefix. So if you're on `/en/settings`, it navigates to `/hi/settings`. The path stays the same, only the prefix changes.

That triggers a full page navigation. Next.js makes a GET to `/hi/settings`. The server handles it — sets the locale to Hindi, imports `hi.json`, and sends back a full HTML page with all the strings already in Hindi.

The browser receives it and re-renders. Done.

That warning at the bottom is critical: if you accidentally use the plain `next/navigation` router for the locale switch, it won't understand the `{ locale }` option. It'll just navigate to the same URL with no prefix change. The strings won't change. It's a silent bug that's easy to hit.

[→]

---

## SLIDE 9 — Two Routers

[~50s]

Let me make the router distinction explicit, because there are two hooks with the same names from different packages.

`useRouter` from `next/navigation` — standard Next.js. Use this for 99% of navigation inside the app. It knows nothing about locales.

`useRouter` from `@/i18n/navigation` — the next-intl wrapper. Use this *only* when you're switching locale. It's the only place in the codebase that needs the `{ locale }` option.

Same story for `usePathname`. The plain version returns the full path including the locale prefix — `/en/home`. The next-intl version strips the prefix and returns just `/home`. Use whichever fits what you need.

In this project right now: Sidebar and TopBar use plain `next/navigation`. DevTestPanel uses the next-intl versions because it's the one component that switches locale.

[→]

---

## SLIDE 10 — Font Switching

[~55s]

Font switching is driven by locale, not by theme. They're separate concerns.

When the layout renders in Hindi mode, two things happen simultaneously.

First — `next/font/google` registers the CSS variable for Noto Sans Devanagari. That font variable only gets registered if the variable class appears somewhere in the DOM tree. If you're on the English route, the Devanagari class never gets added, so the font is never included in the page at all.

Second — the layout adds `data-locale="hi"` to the root div.

And then in `globals.css`, there's a `[data-locale="hi"]` rule that sets the font-family stack to use the Devanagari font first, falling back to Noto Sans, then Arial.

Those two things work together — the CSS variable is registered, and the CSS rule that uses it fires. Take either one away and the font doesn't apply.

This means Noto Devanagari is a zero-cost font for English users. It's never in their bundle. Next.js font optimisation handles all of that automatically.

[→]

---

## SLIDE 11 — Theme Switch

[~60s]

Theme switching is where the two systems really diverge.

When a user clicks "Sky", DevTestPanel calls `setTheme` on the theme context, passing the theme ID and the full token map.

ThemeContext does two things internally — it updates its own state so the rest of the app knows which theme is active, and it calls `applyThemeTokens`, which loops through every token in the map and calls `style.setProperty` on the document root.

So `--theme-primary` gets set to `#00A6F4` — that sky blue. Every other colour token gets updated the same way in a single loop.

And then — nothing else happens. React doesn't re-render. The browser just repaints. Because every component in the app uses Tailwind utilities like `bg-theme-primary`, which resolve to that CSS variable at paint time. When the variable changes, the colour changes, everywhere, instantly.

That's the whole trick. Components never read theme values directly. They use utility classes, which are just thin wrappers over CSS vars. The browser does the work.

[→]

---

## SLIDE 12 — Orthogonal Axes

[~50s]

Here's the mental model made visual.

Think of locale and theme as two completely independent axes. You can be in any combination: English with the default theme, English with sky, Hindi with the default theme, Hindi with sky. They don't interact.

Switching locale moves you up and down — it's a URL change, a page load, the server handles it. The theme you had before is still there when the new page loads, because theme lives in CSS variables, not in the URL.

Switching theme moves you left and right — it's a CSS var overwrite in memory. The locale you're in doesn't change at all.

The only coupling between the two is font loading — and that's locale → font, one direction only. Theme never touches fonts.

Once you see it as two orthogonal axes, the code decisions all make sense. They *should* be separate systems. They solve different problems.

[→]

---

## SLIDE 13 — `generateStaticParams` + Adding a Language

[~55s]

Last technical point before we wrap up.

`generateStaticParams` is a Next.js function that runs at build time. It returns an array of all the locale values — `[{ locale: 'en' }, { locale: 'hi' }]`. Next.js uses that to pre-render the layout shell for every locale.

The result is that `/en/*` and `/hi/*` routes are statically generated. No locale detection needed at runtime. The `withNextIntl` plugin handles the compilation automatically.

And because `generateStaticParams` imports from `routing.ts`, adding a new language is just four steps:

Add the locale code to the `locales` array in `routing.ts`. Create the JSON file with all the same keys. If it's a non-Latin script, load the font in `layout.tsx` and add a `[data-locale]` rule in `globals.css`. Add a button in `DevTestPanel`.

That's it. `generateStaticParams` picks up the new locale on the next build with no extra config.

---

## OUTRO

[~35s]

So to recap — locale switching lives in the URL and triggers a full server render. Theme switching lives in CSS custom properties and triggers a browser repaint. They're orthogonal by design, which is why the code can stay clean and each system stays testable in isolation.

If you want to dig into the actual codebase, I'll link the relevant files in the description.

Thanks for watching — if this helped, hit subscribe. See you in the next one.

---

## Quick reference card

| Slide | Topic | Time |
|---|---|---|
| 1 | Title | 0:00 |
| 2 | Two kinds of switch | 0:45 |
| 3 | Locale pipeline | 1:45 |
| 4 | Key files | 3:15 |
| 5 | routing.ts | 4:00 |
| 6 | request.ts | 4:40 |
| 7 | useTranslations | 5:30 |
| 8 | Locale switch sequence | 6:10 |
| 9 | Two routers | 7:15 |
| 10 | Font switching | 8:05 |
| 11 | Theme switch | 9:00 |
| 12 | Orthogonal axes | 10:00 |
| 13 | generateStaticParams + adding a language | 10:50 |
| Outro | Recap | 11:45 |

**Total: ~12 min 20 sec**
