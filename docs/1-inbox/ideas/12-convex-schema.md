# Convex Schema

## Three Projects

```
convex-home        ← Mo Speech Home backend
convex-school      ← Mo Speech School backend (future)
convex-identity    ← Shared child identity layer
```

Cross-project reads use HTTP Actions. `convex-school` and `convex-home` each expose read-only HTTP endpoints. The other app calls them via Convex HTTP actions. Prototype this seam early — it is the most novel part of the architecture.

---

## convex-home Tables

### symbols (existing — extend)

```typescript
symbols: {
  _id: Id<"symbols">
  words: { eng: string, hin: string }      // extend per language
  synonyms?: { eng: string[], hin: string[] }
  imagePath: string                         // R2 path — SymbolStix licensed, read-only
  audio: {
    eng: { default: string }               // R2 path to pre-generated Google TTS
    hin: { default: string }               // add per language
  }
  tags: string[]
  categories: string[]                      // SymbolStix default categories
  priority?: number                         // 1–500 for core vocabulary free tier
}
```

### users (existing — extend)

```typescript
users: {
  _id: Id<"users">
  clerkUserId: string
  subscription: {
    status: "trial" | "active" | "expired" | "cancelled"
    customAccess?: { isActive: boolean, reason: string, grantedBy: string, grantedAt: number, expiresAt?: number }
    trialEndsAt?: number
    subscriptionEndsAt?: number
    plan?: "monthly" | "yearly"
    stripeCustomerId?: string
    stripeSubscriptionId?: string
  }
  createdAt: number
  updatedAt: number
}
```

### accountMembers (new)

```typescript
accountMembers: {
  _id: Id<"accountMembers">
  accountId: Id<"users">
  email: string
  clerkUserId?: string
  role: "owner" | "collaborator"
  status: "pending" | "active"
  invitedAt: number
  joinedAt?: number
}
```

### childProfiles (new)

```typescript
childProfiles: {
  _id: Id<"childProfiles">
  accountId: Id<"users">
  name: string
  dateOfBirth?: number
  profilePhoto?: string
  language: string                          // "eng" | "hin"
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
    core_dropdown_visible: boolean   // default: true — hides the core words/numbers/letters dropdown
  }
  createdAt: number
  updatedAt: number
}
```

### profileCategories (new)

```typescript
profileCategories: {
  _id: Id<"profileCategories">
  profileId: Id<"childProfiles">
  name: { eng: string, hin: string }
  icon: string
  colour: string
  order: number
  librarySourceId?: string                  // loose ref to resourcePacks._id — reload defaults only
  createdAt: number
  updatedAt: number
}
```

### profileSymbols (new — most important table)

```typescript
profileSymbols: {
  _id: Id<"profileSymbols">
  profileId: Id<"childProfiles">
  profileCategoryId: Id<"profileCategories">
  order: number

  imageSource: {
    type: "symbolstix" | "googleImages" | "aiGenerated" | "userUpload"
    symbolId?: Id<"symbols">               // symbolstix only
    imagePath?: string                     // R2 path for other three types
    imageSourceUrl?: string                // original URL (Google Images audit trail)
    aiPrompt?: string                      // stored for regeneration
  }

  label: { eng: string, hin: string }

  audio?: {
    eng?: AudioSource
    hin?: AudioSource
  }

  display?: {
    bgColour?: string
    textColour?: string
    textSize?: "sm" | "md" | "lg" | "xl"
    borderColour?: string
    borderWidth?: number
    showLabel?: boolean
    showImage?: boolean
    shape?: "square" | "rounded" | "circle"
  }

  createdAt: number
  updatedAt: number
}

type AudioSource = {
  type: "r2" | "tts" | "recorded"
  path: string
  ttsText?: string
  language?: string
}
```

### profileLists (new)

```typescript
profileLists: {
  _id: Id<"profileLists">
  profileId: Id<"childProfiles">
  profileCategoryId: Id<"profileCategories">
  name: { eng: string, hin: string }
  order: number
  librarySourceId?: string
  items: Array<{ profileSymbolId: Id<"profileSymbols">, order: number }>
  createdAt: number
  updatedAt: number
}
```

### profileSentences (new)

```typescript
profileSentences: {
  _id: Id<"profileSentences">
  profileId: Id<"childProfiles">
  profileCategoryId: Id<"profileCategories">
  name: { eng: string, hin: string }
  order: number
  librarySourceId?: string
  items: Array<{ profileSymbolId: Id<"profileSymbols">, order: number }>
  ttsAudioPath?: { eng?: string, hin?: string }
  ttsText?: { eng?: string, hin?: string }
  createdAt: number
  updatedAt: number
}
```

### profileFirstThens (new)

```typescript
profileFirstThens: {
  _id: Id<"profileFirstThens">
  profileId: Id<"childProfiles">
  profileCategoryId: Id<"profileCategories">
  name: { eng: string, hin: string }
  order: number
  librarySourceId?: string
  first: { profileSymbolId: Id<"profileSymbols">, labelOverride?: string }
  then: { profileSymbolId: Id<"profileSymbols">, labelOverride?: string }
  createdAt: number
  updatedAt: number
}
```

### modellingSession (new)

```typescript
modellingSession: {
  _id: Id<"modellingSessions">
  profileId: Id<"childProfiles">
  initiatedBy: string
  symbolId: Id<"symbols">
  symbolPreview: { word: string, imagePath: string }
  steps: Array<{ screen: string, highlight: string }>
  currentStep: number
  status: "active" | "completed" | "cancelled"
  createdAt: number
  completedAt?: number
}
```

### resourcePacks (new — admin managed)

```typescript
resourcePacks: {
  _id: Id<"resourcePacks">
  name: { eng: string, hin: string }
  description: { eng: string, hin: string }
  coverImagePath: string
  season?: string
  tags: string[]
  featured: boolean
  publishedAt?: number
  expiresAt?: number
  createdBy: string
  updatedAt: number
  category: {
    name: { eng: string, hin: string }
    icon: string
    colour: string
    symbols: Array<{ symbolId: string, labelOverride?: object, display?: object, order: number }>
  }
  lists: Array<object>
  sentences: Array<object>
  firstThens: Array<object>
}
```

---

## convex-identity Tables

### childIdentity

```typescript
childIdentity: {
  _id: Id<"childIdentities">
  name: string
  dateOfBirth?: number
  profilePhoto?: string
  language: string
  activeContext: "home" | "school"
  homeProfileId?: string
  schoolProfileId?: string
  inviteCode: string
  createdAt: number
  updatedAt: number
}
```

### profileVisibility

```typescript
profileVisibility: {
  _id: Id<"profileVisibilities">
  childIdentityId: Id<"childIdentities">
  viewerRole: "parent" | "teacher"
  canViewHome: boolean
  canViewSchool: boolean
  grantedAt: number
  grantedBy: string
}
```

### shareRequest

```typescript
shareRequest: {
  _id: Id<"shareRequests">
  childIdentityId: Id<"childIdentities">
  fromApp: "home" | "school"
  toApp: "home" | "school"
  senderClerkId: string
  itemType: "category" | "list" | "sentence" | "firstThen"
  itemId: string
  itemSnapshot: object
  status: "pending" | "accepted" | "declined"
  sentAt: number
  resolvedAt?: number
  resolvedBy?: string
}
```

---

## Key Design Decisions

**Lists always reference profileSymbolId, never raw symbolId.** Every symbol in the user's profile — whether from SymbolStix or custom — exists as a `profileSymbol` record. Lists, sentences, and first-thens reference `profileSymbol` records. This means overrides apply consistently everywhere a symbol appears, and custom symbols work identically to SymbolStix symbols throughout the app.

**librarySourceId is a loose reference only.** It is never used for rendering — only for the "Reload Defaults" warning flow. There is no enforced foreign key relationship. If a resource pack is deleted, profiles that loaded from it are completely unaffected.

**language fields are open-ended.** Adding a new language is adding a new field to the `words` and `audio` objects — no schema migration required for existing records.
