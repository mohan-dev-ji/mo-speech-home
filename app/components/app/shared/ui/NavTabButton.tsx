import Link from 'next/link';

type NavTabButtonProps = {
  active: boolean;
  onClick?: () => void;
  href?: string;
  size?: 'sm' | 'lg';
  /** Minimal navbar (Figma `variant=Minimal`): centre the glyph, drop the label. */
  iconOnly?: boolean;
  /** Accessible name — required when `iconOnly` (no visible label). */
  ariaLabel?: string;
  children: React.ReactNode;
};

export function NavTabButton({
  active,
  onClick,
  href,
  size = 'sm',
  iconOnly = false,
  ariaLabel,
  children,
}: NavTabButtonProps) {
  // Figma Navbar-button (1433:21520): inactive = no fill + secondary-alt-text;
  // active = surface pill + line stroke + alt-text + elevation-subtle. Border is
  // always present (transparent when inactive) so the active stroke adds no width shift.
  const colorClass = active
    ? 'bg-theme-surface border-theme-line text-theme-alt-text font-semibold elevation-subtle'
    : 'border-transparent text-theme-secondary-alt-text font-normal';

  // lg = sidebar nav rail (Figma py = Large-buttons-padding-y 20, no flex gap
  // between items — the padding carries the rhythm); iconOnly centres the glyph
  // (Minimal rail); sm = TalkerDropdown tab pills.
  const sizeClass = size === 'lg'
    ? iconOnly
      ? 'w-full flex items-center justify-center px-theme-btn-x py-theme-nav-y'
      : 'w-full flex items-center gap-theme-elements px-theme-btn-x py-theme-nav-y'
    : 'px-theme-btn-x py-theme-btn-y';

  const className = `shrink-0 rounded-theme-button border text-theme-s transition-colors ${sizeClass} ${colorClass}`;

  if (href) {
    return (
      <Link href={href} className={className} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} aria-label={ariaLabel}>
      {children}
    </button>
  );
}
