# Privacy Policy — Mo Speech

> **Status:** Seed document, not yet legally reviewed. The product-analytics
> disclosure below is the technical truth of what Mo Speech captures via
> PostHog. A full privacy policy covering Clerk, Stripe, Convex, Cloudflare R2,
> and Google Cloud TTS / Imagen processing must be drafted with legal review
> before the product reaches production traffic at scale.
>
> Owner: Mo (sole founder). Last updated when this file is committed.

---

## What we collect

Mo Speech is an AAC (Augmentative and Alternative Communication) application
for children. We treat the data flowing through it as sensitive by default
and minimise what we collect about the child's communication.

### Data you give us directly

- **Account details:** email, name (optional), password — handled by our
  authentication provider, Clerk.
- **Subscription details:** billing information — handled by our payment
  processor, Stripe. We never store card numbers ourselves.
- **Student profile data:** the student's name, language, voice preference,
  custom symbols, categories, lists, and sentences. This is the content of
  the app and is stored in our backend (Convex) and asset storage
  (Cloudflare R2).
- **Voice recordings (optional):** if you choose to record a custom voice
  for a symbol, the audio file is stored in Cloudflare R2 and linked to your
  account only.

### Data we collect about how the app is used

Mo Speech uses **PostHog**, a privacy-first product analytics service, to
understand how the app is used and to improve it.

**What we send to PostHog:**

- Anonymous interaction events — which screens are visited, which buttons
  are tapped, which features are used.
- Your Clerk user ID (the adult instructor's account identifier).
- Aggregate properties — your subscription tier, language preference,
  active theme.

**What we never send to PostHog:**

- The words, symbols, or sentences your child speaks through the app.
- The labels of specific symbols tapped (we know a symbol *was* tapped, not
  which one).
- Names of student profiles.
- Custom audio recordings.
- Pack content, list content, sentence content.
- Your IP address (IP anonymisation is enabled at the project level).

**Session replay is disabled.** We do not record screen content, mouse
movements, or input contents.

**You can opt out at any time.** Go to **Settings → Data & Privacy** and turn
off the analytics toggle. The choice is saved to your account and follows
you across devices. PostHog will stop receiving any events from you.

### Data we collect about errors

When something breaks in the app, we may log the error so we can fix it.
Error logs are kept short-term and do not contain the content your child has
been speaking.

---

## Where data lives

| Service | What's there | Region |
|---|---|---|
| Clerk | Authentication, email, name | US |
| Convex | Account, subscription, student profiles, content | US |
| Cloudflare R2 | Symbol images, voice recordings | Cloudflare global edge |
| Stripe | Billing information | US/EU |
| PostHog | Anonymous interaction events | US Cloud (V1) — migrate to EU Cloud if enterprise / NHS / school-district customers require strict UK/EU data residency |
| Google Cloud (TTS, Imagen, Translation) | Generated audio + AI images cached in R2; original text sent at generation time only | US/EU per Google's region selection |

---

## Children's privacy

Mo Speech is designed for use by children with the support of an adult
instructor (parent, carer, SLP, teacher). The **adult creates the account
and is the data subject** for the purposes of UK GDPR and CCPA — the child
is a profile under the adult's account, not an authenticated user.

We do not collect personal data directly from children. We do not run
behavioural advertising. We do not sell data to third parties.

---

## Your rights

You can:

- View and edit your account data in Settings.
- Delete your account at any time (Settings → Account & Billing → Danger
  zone). This deletes all student profiles, content, custom audio, and
  associated data.
- Opt out of product analytics (Settings → Data & Privacy).
- Request a copy of your data — contact mo@mospeech.com.
- Request deletion of historical analytics events — contact us; PostHog
  supports per-user deletion via the API.

---

## Contact

For privacy questions: mo@mospeech.com

---

## Changes to this policy

We will update this document and note material changes in the app when
they occur. Material changes affecting how data is collected will be
disclosed before they take effect.

---

## TODO before production

- [ ] Formal legal review (UK GDPR, CCPA, COPPA where applicable).
- [ ] Add cookie banner / consent flow if/when behavioural cookies are
      introduced (none in V1 — PostHog uses cookieless mode for
      unauthenticated visitors).
- [ ] Decide on Data Processing Agreement signage with PostHog, Convex,
      Clerk, Cloudflare, Stripe, Google Cloud.
- [ ] Surface this policy from the marketing site and during signup.
- [ ] Confirm UK ICO registration is needed at scale.
