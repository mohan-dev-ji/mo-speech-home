# Mo Speech — Locale Switching
## YouTube Video Script

**Estimated runtime:** ~9–10 minutes  
**Format:** Screen recording of slides + voiceover  
**Audience:** Developers learning Next.js App Router + next-intl

---

> **Production notes**
> - Slides are in `locale-slides.html` — run fullscreen in browser
> - Advance slides with arrow keys or spacebar
> - `[→]` = advance slide · `[PAUSE]` = natural breath beat
> - Each section shows `[~Xs]` estimated speaking time
> - The URL anatomy and pipeline slides have staggered animations — let them fully render before speaking the next point

---

## INTRO (before title slide)

[~20s]

Hey — this video is about how locale switching works in a Next.js app using the App Router and next-intl.

It sounds complicated, but once you see the pattern, it's surprisingly clean. Everything flows from one thing: the URL.

Let's walk through it.

[→ advance to title slide]

---

## SLIDE 1 — Title

[~20s]

The app is Mo Speech — an AAC platform built on Next.js 16, React 19, and next-intl v4.

We support English and Hindi, and the whole system is deliberately simple: the locale is always in the URL, messages are always loaded server-side, and the client never makes an extra request just to get translated strings.

[→]

---

## SLIDE 2 — The URL Is the Source of Truth

[~55s]

Every locale decision in this system flows from a single place — the prefix in the URL.

When you look at `/en/home`, there are two parts doing distinct jobs. The `en` segment — shown in blue here — is what Next.js extracts and calls `[locale]`. That's the dynamic URL segment that drives the entire i18n system.

The `home` part — in green — is the path. It stays identical when you switch locale. If you're on `/en/home` and switch to Hindi, you land on `/hi/home`. Same path, different prefix.

[PAUSE]

Now, the reason the locale is always in the URL — and never just implied by a cookie or a browser header — is the setting `localePrefix: 'always'`. That means bare `/home` doesn't exist in this app. Every route requires the prefix. This is important because it means the server always knows the locale before it renders a single component. There's no detection step, no guessing, no flash.

[→]

---

## SLIDE 3 — The Server-Side Pipeline

[~90s]

Here's the full picture of what happens on every page load. Watch the diagram animate through the steps as I talk.

**Step one.** The browser makes a GET request — say, `/en/home`. This is a completely normal HTTP request.

**Step two.** It hits `next.config.ts`, which wraps the Next.js config with `withNextIntl`. That plugin intercepts the request and activates the whole localisation system. No middleware file needed — the plugin handles it.

**Step three.** We land in `app/[locale]/layout.tsx`. That `[locale]` folder in the directory name is a dynamic segment. Next.js extracts `en` from the URL and passes it as a param. The layout calls `setRequestLocale('en')` — that tells next-intl which locale this server render is for.

**Step four.** Then it calls `getMessages()`. That function goes to `i18n/request.ts`, which validates the locale and dynamically imports the right JSON file.

**Step five.** The JSON — all the English strings — gets passed into `NextIntlClientProvider`, which wraps the entire page tree.

And from that point, flowing left across the bottom of the diagram, any component in the tree can call `useTranslations()` and get the right string.

[PAUSE]

The green callout at the bottom is the key point. Nothing is fetched on the client. The messages travel as part of the server-rendered HTML. That's why there's no loading spinner, no flash of untranslated text.

[→]

---

## SLIDE 4 — `routing.ts`

[~40s]

`routing.ts` is the shortest file in the system but the most important.

It defines three things. `locales` — the array of all valid locale codes. `defaultLocale` — what to fall back to if the URL prefix is missing or invalid. And `localePrefix: 'always'` — which enforces the rule we just talked about.

The reason this file matters is at the bottom of the slide: `request.ts`, `layout.tsx`, and `navigation.ts` all import from here. There is one place to add a new locale and every other part of the system picks it up automatically. No duplication, no config drift.

[→]

---

## SLIDE 5 — `request.ts`

[~55s]

This is the function that actually loads your translation strings, server-side, per request.

`requestLocale` comes from the URL segment that Next.js resolved. It's a promise, so you await it first.

Then there's a guard clause. If the locale is missing or it's not in our valid list — maybe someone typed a nonsense URL — we silently fall back to English. No crash, no 500.

Then the dynamic import. That template literal — `../messages/${locale}.json` — is evaluated at runtime. Webpack bundles all the JSON files, but only the one you ask for gets loaded for this particular request.

This is the mechanism that guarantees `hi.json` is never sent to English users. The strings for each language only travel to people who need them.

[→]

---

## SLIDE 6 — `useTranslations`

[~40s]

On the component side, this is all you write.

You call `useTranslations` with a namespace — here it's `'nav'`. That maps to the top-level `nav` key in your JSON file. Then `t('home')` returns `"Home"` for English or `"होम"` for Hindi. The component has no idea which locale it's in — it just calls `t` and gets the right thing back.

The JSON structure maps directly to the hook call. No configuration layer, no magic string resolution. If you call `t('home')`, it looks up `messages.nav.home`. That's the whole mechanism.

One thing to know: missing keys throw at runtime in development. That's intentional. You find out immediately if you used a key that doesn't exist in the JSON, rather than shipping a blank string to production.

[→]

---

## SLIDE 7 — Switching Locale — The Full Sequence

[~70s]

So what actually happens when a user taps the language button?

Watch the sequence diagram. Each horizontal arrow is a message being sent from one actor to the next.

The user clicks "हिन्दी" in the dev test panel.

The panel calls `router.replace()` — but critically, this is not the standard Next.js router. It's the one from `@/i18n/navigation`. That's a wrapped version that understands locale options.

You pass `{ locale: 'hi' }`, and it rewrites the current URL's locale prefix. So `/en/settings` becomes `/hi/settings`. The path is preserved, only the prefix changes.

That triggers a full page navigation — a real GET request to `/hi/settings`. The server handles it: sets the locale to Hindi, imports `hi.json`, and sends back a full HTML page with all the strings already translated.

The browser receives it and re-renders. That's the whole flow.

[PAUSE]

The warning at the bottom is critical. If you accidentally use the plain `next/navigation` router to switch locale, it won't understand the `{ locale }` option. It'll navigate to the same URL with no prefix change. The strings won't update. It's a silent bug, easy to hit.

[→]

---

## SLIDE 8 — Two Routers

[~45s]

Let me make that distinction explicit, because there are two hooks with identical names from different packages.

`useRouter` from `next/navigation` — standard Next.js. Use this for 99% of navigation inside the app. Moving between pages within the same locale.

`useRouter` from `@/i18n/navigation` — the next-intl wrapper. Use this only when you're switching locale. It's the one place in the codebase that needs the `{ locale }` option.

Same story for `usePathname`. The plain version includes the locale prefix in the returned string — `/en/home`. The next-intl version strips it and gives you just `/home`.

In this project right now, shown in the three cards: Sidebar and TopBar use plain `next/navigation`. DevTestPanel uses the next-intl versions, because it's the one component that ever needs to switch locale.

[→]

---

## SLIDE 9 — `generateStaticParams` + Adding a Language

[~50s]

Last one. `generateStaticParams` is a Next.js function that runs at build time. It returns the locale array — `[{ locale: 'en' }, { locale: 'hi' }]` — and Next.js uses that to pre-render the layout shell for every locale.

The result is that all `/en/*` and `/hi/*` routes are statically generated. No locale detection at runtime, no overhead. And because it imports from `routing.ts`, any new locale you add gets picked up automatically on the next build.

Adding a new language is four steps:

One — add the locale code to `routing.ts`.

Two — create the JSON file with the same key structure.

Three — if it's a non-Latin script, load the font in `layout.tsx` and add a `[data-locale]` rule in `globals.css` for the font-family.

And four — add a button in `DevTestPanel`. That's it. `generateStaticParams` handles the rest.

---

## OUTRO

[~30s]

To wrap up — locale switching in this stack is entirely server-driven. The URL is the locale. The server loads the right JSON on every request. The client never fetches messages separately. And the only client-side behaviour is the locale switch itself, which is just a page navigation with a different URL prefix.

Once you see it as a URL problem, the rest follows naturally.

Thanks for watching — subscribe if this was useful. See you in the next one.

---

## Quick reference card

| Slide | Topic | Approx time |
|---|---|---|
| 1 | Title | 0:00 |
| 2 | The URL is the source of truth | 0:40 |
| 3 | Server-side pipeline | 1:35 |
| 4 | routing.ts | 3:05 |
| 5 | request.ts | 3:45 |
| 6 | useTranslations | 4:40 |
| 7 | Locale switch sequence | 5:20 |
| 8 | Two routers | 6:30 |
| 9 | generateStaticParams + adding a language | 7:15 |
| Outro | Recap | 8:05 |

**Total: ~8 min 35 sec**
