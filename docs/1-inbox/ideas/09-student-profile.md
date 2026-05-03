# Student Profile and Home Profile Storage

## What the Student Profile Is

The student is a profile in Mo Speech Home — not a Clerk user. They do not log in. The instructor (and any collaborators) manage the student's profile on their behalf.

The `studentProfile` record is the root of everything the student sees and interacts with in the app.

---

## studentProfile Schema

```typescript
studentProfile: {
  _id: Id<"studentProfiles">
  accountId: Id<"users">           // the owner account
  name: string
  dateOfBirth?: number
  profilePhoto?: string            // R2 path
  language: string                 // "eng" | "hin" — active language for this profile
  createdAt: number
  updatedAt: number

  // State flags — control what the student can see and do
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

  // Recent symbol usage — populated from Phase 7 onwards.
  // Capped at 20, FIFO. Powers home dashboard "Recent symbols" strip and admin velocity views.
  recentSymbols?: Array<{
    profileSymbolId: Id<"profileSymbols">
    usedAt: number
  }>
}
```

---

## What Is Stored in the Home Profile

Everything the student uses is stored in `convex-home`, hanging off the `studentProfile._id`:

```
studentProfile
  ├── profileCategories[]          (all the student's categories)
  │     ├── profileSymbols[]       (symbols in each category with all overrides)
  │     ├── profileLists[]         (pre-compiled lists)
  │     └── profileSentences[]     (pre-built sentences)
  └── modellingSession[]           (session history)
```

All of this is the student's home profile. It is private to this profile. It is fully owned and fully editable by the instructor.

---

## Everything Is JSON-Driven

Every piece of the student's AAC world is a Convex document. This has powerful implications:

- **Context switching** — switching between home and school is loading a different set of JSON documents
- **Language switching** — changing language is updating a field on `studentProfile` and re-querying symbol labels in the new language
- **Offline support** — the service worker can cache the active profile's documents for offline use; the assets (images, audio) are already cached in R2
- **Backup and restore** — the profile can be exported as JSON and restored from that file
- **Sharing** — content is shared as a serialised JSON snapshot in a `shareRequest` document

---

## Language on the Profile

`studentProfile.language` determines:
- Which symbol labels are shown (`words.eng` vs `words.hin`)
- Which audio files are played (`audio.eng.default` vs `audio.hin.default`)
- Which locale next-intl uses for the UI (if full UI i18n is enabled)

One language per student profile at launch. The architecture supports multiple profiles per account, so a bilingual family could create two profiles for the same student — one in each language — as a workaround if needed.

---

## Profile Context Provider

A `ProfileContext` React context wraps the app and holds:
- The active `studentProfile` document
- All `profileCategories` with their symbols, lists, sentences, first-thens
- The active state flags
- The active language

This context is populated on login and kept in sync via Convex subscriptions. Components read from it rather than querying Convex directly. The resource library metadata (for home page promotion) is held in a separate lightweight `ResourceLibraryContext`.

---

## Multiple Student Profiles

A single account can have multiple student profiles — for families with more than one student using AAC, or for a bilingual family wanting separate language setups. Each profile is entirely independent. The instructor switches between profiles from the Home screen or Settings.

---

## Future Consideration — Student's Own Account

As the student grows and gains independence, they may eventually want their own Clerk account to log in and use the app independently. This is not in scope for V1 — the student is always a profile, not a user. The architecture supports adding this later by linking a Clerk account to the `studentProfile` record without restructuring the account model.
