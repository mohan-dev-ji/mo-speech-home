# Component Patterns

Design-token-based UI patterns used across the app. These are living specs — update here first when the style changes.

---

## Navigational Tab Button

Used in scrollable tab bars (e.g. TalkerDropdown little-words tabs). Two visual states:

| State    | Background                  | Text colour          | Text size    |
|----------|-----------------------------|----------------------|--------------|
| Active   | `bg-theme-button-highlight` | `text-theme-text`    | `text-theme-s` |
| Inactive | `bg-theme-primary`          | `text-theme-alt-text`| `text-theme-p` |

- Border radius: `rounded-theme-sm`
- Padding: `py-theme-buttons-y-padding px-3` (small button padding on y-axis)
- Font weight: `font-medium`
- Transition: `transition-colors`
- Container: horizontal scroll row, `gap-2 px-4 py-3`, `scrollbar-width: none`

### Usage note
Large buttons (e.g. primary CTAs) use `py-theme-large-buttons-padding` instead.

---

## Reusable component

A shared `<NavTabButton>` component should be created at:

```
app/components/app/shared/ui/NavTabButton.tsx
```

Props:
```ts
type NavTabButtonProps = {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
};
```
