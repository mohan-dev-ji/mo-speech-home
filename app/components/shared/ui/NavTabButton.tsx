import Link from 'next/link';

type NavTabButtonProps = {
  active: boolean;
  onClick?: () => void;
  href?: string;
  size?: 'sm' | 'lg';
  children: React.ReactNode;
};

export function NavTabButton({
  active,
  onClick,
  href,
  size = 'sm',
  children,
}: NavTabButtonProps) {
  const colorClass = active
    ? 'bg-theme-button-highlight text-theme-text'
    : 'bg-theme-primary text-theme-alt-text';

  const sizeClass = size === 'lg'
    ? 'w-full flex items-center gap-2.5 px-theme-btn-x py-theme-btn-y'
    : 'px-3 py-theme-btn-y';

  const className = `shrink-0 rounded-theme-sm text-theme-s font-medium transition-colors ${sizeClass} ${colorClass}`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}
