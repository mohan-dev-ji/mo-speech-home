# Navigation and Permissions

## Four Nav Items

```
Home  |  Search  |  Categories  |  Settings
```

The app shell always renders these four items. What the child can access within them is controlled by state flags set by the parent.

---

## State Flags

State flags are boolean values stored on `childProfile` in Convex. They propagate instantly to all connected devices via Convex subscriptions — no page reload required.

| Flag | Default | Controls |
|---|---|---|
| `home_visible` | ON | Whether child sees the Home dashboard |
| `search_visible` | ON | Whether Search nav item is accessible |
| `categories_visible` | ON | Whether Categories nav item is accessible |
| `settings_visible` | OFF | Whether child can access Settings |
| `talker_visible` | ON | Whether the talker header renders (search + board) |
| `talker_banner_toggle` | ON | Whether child can switch between talker and banner in board mode |
| `play_modal_visible` | ON | Whether the play button is available |
| `voice_input_enabled` | ON | Whether the microphone button is active |
| `audio_autoplay` | ON | Whether audio fires automatically on symbol tap |
| `modelling_push` | OFF | Whether parent can push a modelling session to this child |
| `core_dropdown_visible` | ON | Whether the core words/numbers/letters dropdown is visible on the talker |

---

## Permission System — One App, Permission-Layered

There are no separate routing trees for parent and child. The same app renders for both. A `PermissionContext` wraps the entire app and holds:

- The current user's role (`owner` | `collaborator` | `child-view`)
- All state flags from `childProfile`

Components read from this context to show or hide UI elements. No conditional routing — just conditional rendering based on role and flags.

**Parent sees:** All four nav items, edit controls on categories and symbols, create shortcuts on Home, all settings, modelling trigger button.

**Child sees:** Only what the state flags permit. Nav items that are disabled are hidden entirely — not greyed out.

---

## Child View vs Parent View

The app detects which mode to render based on how it is opened:

- **Parent opens the app on their own device** → full parent view
- **Parent hands device to child** → parent taps "Child View" to switch; state flags take effect; edit controls disappear
- **Child has their own device** → app opens in child view by default

The active view is stored locally on the device, not in Convex. It is a device-level preference, not a profile setting.

---

## Modelling Mode and Permissions

Modelling mode requires `modelling_push = ON` on the child's profile. When the parent triggers a modelling session, Convex creates a `modellingSession` document. The child's app subscribes to active sessions for their profile and enters the guided walkthrough automatically.

Full detail: `04-modelling-mode.md`
