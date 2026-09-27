# Constraints

The rules Mo Speech works within. Anything built must fit these.

## Markets and languages

- **India first.** The first launch market is India, with **Hindi** as a
  first-class language. The first professional pilot is an SLT in India.
- **Then the UK and EU.** English (British voices) and Spanish are live.
- **Every language is complete, or it isn't shown.** A language is only offered
  to families once its app words, symbols and voices are ready. While it's
  being checked, it's shown as *preview*.
- **Languages are structural.** Sentences and phrases get a real version per
  language, never a word-for-word translation.
- **Mixed-language families** must be supported: different students can have
  different languages, and a symbol can be pinned to one language.

## Children's data and privacy

- **UK Children's Code** (the ICO's Age Appropriate Design Code), **UK and EU
  GDPR**, and **India's DPDP Act** all apply. Privacy is on by default, data is
  kept to a minimum, and there are no dark patterns.
- **Nothing a child says is collected.** Analytics are anonymous events about
  features used, never words, symbols, sentences, names or recordings. No
  session recording. No IP addresses. They can be switched off.
- **Data stays in the UK/EU where possible.** (Analytics moves to the EU region
  before launch: MOS-75.)
- **Families can delete their account,** and everything in it goes, including
  their pictures and recordings.
- **Photos of children** are personal data, and are never shared or published.

## Plans

Three plans (decided 2026-09-26, MOS-49):

| Plan | Price | The line |
|---|---|---|
| **Free** | £0, never expires, no trial | Use Mo Speech: SymbolStix symbols, tap and play |
| **Pro** | £13.99 / month | Shape it: save, edit, create and model with SymbolStix |
| **Max** | £18.99 / month | Go beyond SymbolStix: your own photos, Image Search, AI pictures, plus tones, premium themes and family invites |

- **Free must stay genuinely useful**, not a teaser.
- **Free library content is SymbolStix-only.**
- **Payments** go through Stripe Managed Payments, as merchant of record, so tax
  and payments work in India and the EU (ADR-025).

Full detail: [FEAT-108](../4-builds/features/FEAT-108-pricing-and-tiers.md).

## Licensing

- **SymbolStix** symbols are licensed for everyone on Mo Speech. They're the
  core of every plan.
- **Creative Commons images** (Image Search) must be credited. Mo Speech keeps
  the credit with every picture and lists them on the Credits screen.
- **AI-generated images** belong to the account that made them.

## Devices

- **Tablets first,** then phones and computers. It's a web app, used in a
  browser or added to the home screen.
- **One hand, either hand.** The sidebar can sit on the left or the right.
- **Touch targets are large,** and grid sizes suit different motor skills.

## Accessibility and wellbeing

- **Motor memory:** nothing moves on a board unless an adult moves it.
- **Reduced motion:** the device's reduce-motion setting is respected, and an
  in-app switch arrives with animated themes (M4).
- **Calm by default:** the header, and anything a student doesn't need, can be
  switched off.
- **Every tap is heard:** no silent symbols.

## Integrity of the instructor's setup

- A **student view can be locked**, and the lock must survive restarts, new
  tabs and any other way out (MOS-82, before launch).
- Students only change what their instructor allows.
