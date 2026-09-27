# Scope: in, before launch, planned, not planned

This is what Mo Speech does, what it will do, and what it deliberately won't.
**Agents: don't build anything under "Not planned" without the owner's say-so.**

The living plan is [`01-final-straight.md`](../01-final-straight.md), tracked in
Linear (project *Final straight*, milestones M0–M7).

---

## Shipped

Everything in the feature index,
[`4-builds/features/README.md`](../4-builds/features/README.md): FEAT-101 to
FEAT-408.

## Must land before launch

| What | Why | Where |
|---|---|---|
| The three-tier pricing (Free / Pro £13.99 / Max £18.99), including Upload and My Images moving to Max | The pricing is decided but not built | M2 · MOS-49 |
| Payments through Stripe Managed Payments | Tax and payments that work in India and the EU | M2 · MOS-59, ADR-025 |
| No fake "trial" on new accounts | Free is free | M2 · MOS-28 |
| A student view lock that can't be escaped | Protects the instructor's setup | M5 · MOS-82 |
| Modelling working end to end | It's broken at step 2 | M5 · MOS-83 |
| A backup of pictures and recordings | Losing them would be unrecoverable | M7 · MOS-85 |
| Analytics in the EU region, plus data protection (ICO, privacy policy, Children's Code) | Children's data law | M7 · MOS-75 |
| The Hindi launch checklist | India is the first market | M5 · MOS-67 |

## Planned

| What | For whom | Where |
|---|---|---|
| **Affiliates** (FEAT-409): SLTs refer families and earn commission, managed on the user's page | SLTs | M3 · MOS-62 |
| **Admin symbol editor** (FEAT-410): correct any symbol's words in every language | The team, with SLT feedback | M3 · MOS-60/61 |
| **Animated Pro & Max themes** based on special interests, plus a Reduce motion switch | Students | M4 · MOS-63/64 |
| **Marketing site**, including a features page | Visitors | M6 · MOS-70/71 |
| **Sign up from a library module adds it** after sign-up | Visitors | M6 · MOS-80 |
| **Clearer audio buttons** on sentences and phrases | Instructors | M5 · MOS-81 |

### After launch

- **Deeper gestalt language processing support.** Phrase-first learning is
  already in (phrases, block sentences, tones). Further GLP features depend on
  data about how words relate across languages, gathered from professionals
  using Mo Speech. See `2-research/gestalt-language-processing/`.
- **A school product** that connects to the family's (see
  [`01-users.md`](01-users.md)).

## Not planned

Considered, and deliberately not being built:

| Not building | Why |
|---|---|
| **A free trial** of the paid plans | Free is a real plan instead |
| **A fourth "Starter" tier** | Three tiers are clearer (MOS-49) |
| **A theme editor in the admin dashboard** | Themes are designed in Figma and built in code (MOS-65) |
| **One sound per symbol on list steps, fluent sentences and phrases** | They speak as one piece of language, so their audio is set as a whole |
| **Machine-translating sentences and phrases word for word** | Word order differs between languages. Each gets its own version |
| **Collecting anything a child says** (words, symbols, sentences, recordings, session replays) | Children's privacy |
| **Voice cloning** | Not scheduled. The old pricing copy that says "coming soon" is being removed (MOS-49) |
| **Native iOS or Android apps** | The web app runs on tablets and phones, and can be added to the home screen |
| **An "unpublish" button for library modules** | Publishing is deliberately one-way in the app. Removal is a rare, careful, manual job |

## Open questions

Ideas not yet decided either way:

- Should opening a group speak its name, as an on/off setting?
  (`1-inbox/ideas/speak-module-name-on-enter.md`)
- A read-only "view as student" preview inside the instructor view.
  (`1-inbox/ideas/20-profile-lock-and-pin.md`)
