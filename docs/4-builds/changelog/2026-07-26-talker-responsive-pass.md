# 2026-07-26 — Talker responsive pass

**Milestone:** Responsive pass (Talker dropdown project) · **Issues:** MOS-5, MOS-6, MOS-7
**Spec:** [FEAT-006](../features/FEAT-006-talker-dropdown-responsive.md) · **Plan:** [phase-15.8-talker-responsive](../plans/_done/phase-15.8-talker-responsive.md) · **PR:** [#3](https://github.com/mohan-dev-ji/mo-speech-home/pull/3)

Made the persistent talker responsive on small screens.

- **MOS-5** — the talker dropdown core-words grid now steps its column count by viewport × grid-size setting (mirrors `CategoryBoardGrid`: large 2/2/4, medium 3/4/8, small 4/8/12), via a new reactive `useGridColumns` hook. On narrow screens a board uses fewer columns so symbols are bigger. Desktop (`lg`) unchanged.
- **MOS-6** — phrase tiles (tray `PhraseBox`, dropdown `PhraseDropdownCard`) shrink below the `md` breakpoint; `md`+ restores desktop size.
- **MOS-7** — the talker chip tray now scrolls horizontally at **all** widths (`flex-nowrap overflow-x-auto`) instead of wrapping to new rows and hiding the controls. Word chips also shrink on mobile. *(The issue's original "small screens only" wording for the scroll was an owner-confirmed error — corrected to all widths.)*

**Files:** `app/hooks/useGridColumns.ts` (new), `app/components/app/shared/ui/TalkerDropdown.tsx`, `app/components/app/shared/ui/TalkerBar.tsx`.

**Code review:** no Critical issues. One Important finding fixed in the PR — dnd-kit's `touch-none` + 8px pointer activation would have let a touch-swipe reorder chips instead of scrolling the tray; resolved by splitting into `MouseSensor` (8px) + `TouchSensor` (250ms hold) and dropping `touch-none`, so a swipe scrolls and a press-hold reorders. Confirmed on a real phone (2026-07-26): swipe scrolls, hold reorders, tap plays.
