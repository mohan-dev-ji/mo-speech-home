# Child Profile and Home Profile Storage

## What the Child Profile Is

The child is a profile in Mo Speech Home — not a Clerk user. They do not log in. The parent (and any collaborators) manage the child's profile on their behalf.

The `childProfile` record is the root of everything the child sees and interacts with in the app.

---

## childProfile Schema

```typescript
childProfile: {
  _id: Id<"childProfiles">
  accountId: Id<"users">           // the owner account
  name: string
  dateOfBirth?: number
  profilePhoto?: string            // R2 path
  language: string                 // "eng" | "hin" — active language for this profile
  createdAt: number
  updatedAt: number

  // State flags — control what the child can see and do
  stateFlags: {
    home_visible: boolean
    search_visible: boolean
    categories_visible: boolean
    settings_visible: boolean
    talker_visible: boolean
    talker_banner_toggle: boolean
    play_modal_visible: boolean
    voice_input_enabled: boolean
    audio_autoplay: boolean
    modelling_push: boolean
  }
}
```

---

## What Is Stored in the Home Profile

Everything the child uses is stored in `convex-home`, hanging off the `childProfile._id`:

```
childProfile
  ├── profileCategories[]          (all the child's categories)
  │     ├── profileSymbols[]       (symbols in each category with all overrides)
  │     ├── profileLists[]         (pre-compiled lists)
  │     ├── profileSentences[]     (pre-built sentences)
  │     └── profileFirstThens[]    (first/then schedules)
  └── modellingSession[]           (session history)
```

All of this is the child's home profile. It is private to this profile. It is fully owned and fully editable by the parent.

---

## Everything Is JSON-Driven

Every piece of the child's AAC world is a Convex document. This has powerful implications:

- **Context switching** — switching between home and school is loading a different set of JSON documents
- **Language switching** — changing language is updating a field on `childProfile` and re-querying symbol labels in the new language
- **Offline support** — the service worker can cache the active profile's documents for offline use; the assets (images, audio) are already cached in R2
- **Backup and restore** — the profile can be exported as JSON and restored from that file
- **Sharing** — content is shared as a serialised JSON snapshot in a `shareRequest` document

---

## Language on the Profile

`childProfile.language` determines:
- Which symbol labels are shown (`words.eng` vs `words.hin`)
- Which audio files are played (`audio.eng.default` vs `audio.hin.default`)
- Which locale next-intl uses for the UI (if full UI i18n is enabled)

One language per child profile at launch. The architecture supports multiple profiles per account, so a bilingual family could create two profiles for the same child — one in each language — as a workaround if needed.

---

## Profile Context Provider

A `ProfileContext` React context wraps the app and holds:
- The active `childProfile` document
- All `profileCategories` with their symbols, lists, sentences, first-thens
- The active state flags
- The active language

This context is populated on login and kept in sync via Convex subscriptions. Components read from it rather than querying Convex directly. The resource library metadata (for home page promotion) is held in a separate lightweight `ResourceLibraryContext`.

---

## Multiple Child Profiles

A single account can have multiple child profiles — for families with more than one non-verbal child, or for a bilingual family wanting separate language setups. Each profile is entirely independent. The parent switches between profiles from the Home screen or Settings.
