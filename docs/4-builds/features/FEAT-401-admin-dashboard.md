# FEAT-401 · Admin dashboard

**Layer 4 · Admin** · [Back to the index](README.md)

- Not customer facing: only Mo Speech staff with the **admin** role
- The back office at `/admin`, separate from the app
- An **Overview** of the numbers, plus **Users**, **Themes** and **Languages**
  pages
- English only, by design
- Checked on the server, so the address alone gets nobody in

---

## What it does

Mo Speech's own team needs a back office for running the product: seeing how
it's used, looking after accounts, and managing languages and themes. That's
the admin dashboard, reserved for accounts with the **admin** role.

Publishing content happens in the app itself, in the **admin view**. See
[FEAT-301](FEAT-301-instructor-and-student-views.md) and
[FEAT-402](FEAT-402-admin-authoring.md).

### Who can get in

The admin role is set on an account by Mo Speech (in the sign-in service's
account settings), never from inside the app. Every admin page checks the role
on the server before showing anything. Anyone else who opens an admin address
is sent to Home.

### The admin dashboard (`/admin`)

A separate, plain back office with its own sidebar:

- **Overview:** the numbers at a glance. Total users, how many are on Free, Pro
  and Max, how many were active in the last 7 days, and how many signed up in
  the last 7 days.
- **Users:** find any account, see its plan and profiles, and give special
  access. See [FEAT-405](FEAT-405-users-admin.md).
- **Themes:** which themes exist and which plan each belongs to. See
  [FEAT-407](FEAT-407-themes-admin.md).
- **Languages:** add languages and control when each goes live. See
  [FEAT-406](FEAT-406-languages-admin.md).

**← Back to app** returns to Home. The dashboard is **English only**. It's for
the team, not families, so its words aren't translated.

## Why it helps

- **A clear picture.** The overview shows at a glance how the product is being
  used.
- **Support without a developer.** Any account can be looked up, and special
  access given, from the Users page.
- **Safety.** Server-side role checks keep the back office out of the wrong
  hands.

## Audio

The dashboard doesn't play audio.

## Edge cases

- **Not an admin:** admin addresses redirect to Home.
- **Getting there.** Admins go to the dashboard by typing `/admin`. There's
  deliberately no link to it inside the app.
- **Planned sections:** affiliates (M3,
  [MOS-62](https://linear.app/mo-intelligence/issue/MOS-62)) and the admin
  symbol editor (M3, [MOS-60](https://linear.app/mo-intelligence/issue/MOS-60) /
  [MOS-61](https://linear.app/mo-intelligence/issue/MOS-61)) will be added to
  the dashboard.


## Where it lives

- The dashboard pages: `app/(admin)/admin/`, with the shared layout, sidebar
  and role check in `app/(admin)/layout.tsx`
- Dashboard sections: `app/components/admin/`
- The overview numbers: `convex/admin/overviewStats.ts`

## Links

- **Down to:** [FEAT-405 Users admin](FEAT-405-users-admin.md) ·
  [FEAT-406 Languages admin](FEAT-406-languages-admin.md) ·
  [FEAT-407 Themes admin](FEAT-407-themes-admin.md) ·
  [FEAT-408 Product analytics](FEAT-408-product-analytics.md)
- **Related:** [FEAT-301 Instructor & student views](FEAT-301-instructor-and-student-views.md)
  (the in-app admin view) · [FEAT-402 Admin authoring](FEAT-402-admin-authoring.md)
  · [FEAT-403 Backup & restore](FEAT-403-backup-and-restore.md) ·
  [FEAT-404 Translation pipeline](FEAT-404-translation-pipeline.md)
