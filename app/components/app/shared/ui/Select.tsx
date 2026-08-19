"use client";

import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Themed <select>. The native control draws its own arrow hard against the
 * right edge and in the browser's colour — so we turn it off
 * (`appearance-none`) and draw our own chevron with real breathing room.
 *
 * Everything is a plain select underneath: the native dropdown list, keyboard
 * behaviour and mobile picker all still apply.
 *
 * Two skins, because the app has two palettes. `theme` follows the profile's
 * AAC tokens (they change at runtime, so they stay inline styles); `admin`
 * follows the admin surface's border/background classes. Only the chevron
 * mechanics are shared — that's the part that was missing everywhere.
 */
type Variant = 'theme' | 'admin';

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  variant?: Variant;
  /** Sizes the positioning context. Default `w-full`; pass `w-fit` for a
   *  shrink-to-content select such as an admin table filter. */
  wrapperClassName?: string;
};

const VARIANT_CLASS: Record<Variant, string> = {
  theme: 'rounded-theme-sm py-2.5 text-theme-s outline-none',
  admin:
    'rounded-md border border-border bg-background py-2 text-small focus:outline-none focus:ring-2 focus:ring-primary/50',
};

export function Select({
  variant = 'theme',
  className,
  wrapperClassName,
  style,
  children,
  ...rest
}: Props) {
  return (
    <div className={cn('relative w-full', wrapperClassName)}>
      <select
        {...rest}
        className={cn(
          'w-full appearance-none pl-3 pr-10',
          VARIANT_CLASS[variant],
          className,
        )}
        style={
          variant === 'theme'
            ? {
                background: 'var(--theme-symbol-bg)',
                color: 'var(--theme-text)',
                border: '1px solid var(--theme-line)',
                ...style,
              }
            : style
        }
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className={cn(
          'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4',
          variant === 'admin' && 'text-muted-foreground',
        )}
        style={variant === 'theme' ? { color: 'var(--theme-secondary-text)' } : undefined}
      />
    </div>
  );
}
