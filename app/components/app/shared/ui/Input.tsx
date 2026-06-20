import { cn } from "@/lib/utils";
import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

/**
 * The AAC text input — bound to theme tokens so it stays legible on every theme.
 *
 * Mirrors the Figma search field / `Dropdown` trigger treatment: solid raised
 * `surface` background, `line` hairline border, `alt-text` ink, with the
 * placeholder in the muted `secondary-alt-text`. Focus lifts the border to
 * `primary` with a soft ring. Single source of truth for input styling across
 * settings, account, and invites.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="text-theme-s font-medium text-theme-alt-text">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full rounded-theme-button border border-theme-line bg-theme-surface px-theme-btn-x py-theme-btn-y text-theme-p text-theme-alt-text",
            "placeholder:text-theme-secondary-alt-text",
            "transition-colors focus:outline-none focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/40",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-theme-warning focus:border-theme-warning focus:ring-theme-warning/40",
            className
          )}
          {...props}
        />
        {error && <p className="text-theme-s text-theme-warning">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
