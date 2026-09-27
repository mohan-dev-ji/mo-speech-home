# FEAT-206 · App shell

**Layer 2 · Component** · [Back to the index](README.md)

- The frame around every page: a **sidebar** and a **top bar**
- Sidebar: Home, Search, Categories, Lists, Sentences and Settings
- Sidebar can be full or icon-only, and on the left or the right
- Top bar: the view switcher (instructor, student, admin), where you are, the
  talker switch, and Quick Settings
- Quick Settings: header on/off, grid size, sign out
- On a phone: a menu button, the page name, and a drop-down menu
- In a student's view, the shell shows only what the instructor allows

---

## What it does

The app shell is the frame every page sits in. It's what stays still while
everything inside it changes, so a student always knows where the way around
is.

### The sidebar

A rail down the side of the screen with the Mo Speech logo and the main places:
**Home**, **Search**, **Categories**, **Lists** and **Sentences**, with
**Settings** at the bottom. The current page is highlighted.

It can be set two ways, per profile (see [FEAT-106](FEAT-106-settings.md)):

- **Full** (icon and name) or **minimal** (icons only), to give the board more
  room.
- **Left** or **right**, for left- or right-handed use on a tablet held in one
  hand.

Because the setting belongs to each profile, the sidebar changes by itself when
switching from the instructor's view to a student's.

### The top bar

Across the top, from left to right:

- **The view switcher.** Which view is showing: **Instructor**, a **student's
  view**, or (for admins) **Admin**. It opens a menu to switch, and from here
  the instructor can **lock** a student's view so the student can't switch
  back. See [FEAT-301](FEAT-301-instructor-and-student-views.md).
- **Where you are.** The path to the current page, for example Lists › Life
  skills › Morning routine. Each part can be tapped to go back up.
- **The talker switch**, only on Search and Categories, the pages with the
  talker. See [FEAT-201](FEAT-201-talker.md).
- **Quick Settings**, a small menu for things changed often:
  - **Header:** turn the whole header strip at the top of the page on or off.
    Off means no talker **and** no page banner (its title and its Edit, Create
    and Modelling buttons), just the board itself. It cuts out a lot of
    noise for a student who doesn't need those controls.
  - **Grid size:** the instructor's own, or the student's when in their view.
  - **Sign out.**

### On a phone

The sidebar folds away behind a **menu** button. The top bar shows the name of
the current page in place of the full path, and the menu opens as a drop-down
with the same places.

### In a student's view

The shell follows the instructor's settings for that student (see
[FEAT-106](FEAT-106-settings.md)):

- The sidebar shows only the pages the student is allowed to see. Settings is
  hidden unless allowed.
- **Quick Settings** and the **talker switch** only appear if the student has
  been given Quick Settings.
- If the view is **locked**, the view switcher becomes a plain, locked label
  with no menu, so the student can't leave their view.

## Why it helps

- **Always the same way out.** The frame never moves, which matters for
  students who rely on consistency and motor memory.
- **Room to grow.** Pages can be switched on one at a time as a student grows,
  and the sidebar only ever shows what's allowed.
- **Fits the hand.** Left or right placement makes one-handed tablet use
  comfortable.
- **Quick changes, quickly.** The talker and grid size are one tap away from
  any page.

## Audio

The shell doesn't speak. It's for getting around.

## Edge cases

- **Modelling on a phone.** When a modelling step points at something in the
  folded-away menu, the menu opens by itself to show it, then closes when the
  step moves on. See [FEAT-303](FEAT-303-modelling-mode.md).
- **The talker dropdown** closes when any sidebar item is tapped, even the
  current page. See [FEAT-202](FEAT-202-talker-dropdown.md).
- **The logo** leads out to the public website's home page.
- **Admin** appears in the view switcher only for accounts with the admin role.
  See [FEAT-401](FEAT-401-admin-dashboard.md).

## Where it lives

- The top bar: `app/components/app/shared/sections/TopBar.tsx`
- The sidebar: `app/components/app/shared/sections/Sidebar.tsx`
- The view switcher and lock:
  `app/components/app/shared/ui/BreadcrumbViewModeDropdown.tsx`
- Quick Settings: `app/components/app/shared/ui/QuickSettings.tsx`

## Links

- **Used on:** every page in the app
- **Related:** [FEAT-106 Settings](FEAT-106-settings.md) (sidebar and student
  permissions) · [FEAT-201 The talker](FEAT-201-talker.md) ·
  [FEAT-301 Instructor & student views](FEAT-301-instructor-and-student-views.md)
  · [FEAT-303 Modelling mode](FEAT-303-modelling-mode.md) ·
  [FEAT-401 Admin dashboard](FEAT-401-admin-dashboard.md)
