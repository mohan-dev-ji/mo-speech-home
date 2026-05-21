"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { X, Plus } from "lucide-react";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  /**
   * The full set of tags already in use across the catalogue. Drives the
   * autocomplete dropdown. Typed values that don't match any of these
   * surface a "Create: 'foo'" option so admins can introduce new tags
   * inline without leaving the modal.
   */
  suggestions: string[];
  placeholder?: string;
};

/**
 * Create-or-pick tag input. Patterns:
 *   - Type → live-filtered list of matching existing tags
 *   - No match → "Create: 'foo'" appears at the bottom
 *   - Enter / click → adds the highlighted suggestion or the typed value
 *   - Backspace on empty input → removes the rightmost chip
 *   - Esc → closes the dropdown
 *
 * Normalisation (lowercase, trim, dash-collapse) happens server-side in
 * `updatePackLifecycle` — this component shows what the admin typed and
 * trusts the server to canonicalise. Equality checks here are
 * case-insensitive so the dropdown matches user expectations.
 */
export function TagPicker({
  value,
  onChange,
  suggestions,
  placeholder = "Add a tag…",
}: Props) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dismiss the dropdown when focus moves outside the picker.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // Lowercase-equality lookup for what's already on the pack
  const currentSet = useMemo(
    () => new Set(value.map((v) => v.toLowerCase().trim())),
    [value]
  );

  const inputNormalised = input.toLowerCase().trim();

  // Suggestions to show: catalogue tags matching the input that aren't
  // already on this pack. Always include the "Create: 'foo'" affordance
  // when the input has content and no exact match exists in either the
  // catalogue or the current chips.
  const filtered = useMemo(() => {
    const matches = suggestions
      .filter((s) => !currentSet.has(s.toLowerCase()))
      .filter((s) =>
        inputNormalised === "" ? true : s.toLowerCase().includes(inputNormalised)
      )
      .slice(0, 8); // cap the dropdown height

    return matches;
  }, [suggestions, currentSet, inputNormalised]);

  const exactMatch = filtered.some(
    (s) => s.toLowerCase() === inputNormalised
  );
  const alreadyOnPack = inputNormalised !== "" && currentSet.has(inputNormalised);
  const canCreate = inputNormalised !== "" && !exactMatch && !alreadyOnPack;

  function addTag(raw: string) {
    const normalised = raw.toLowerCase().trim().replace(/\s+/g, "-");
    if (!normalised) return;
    if (currentSet.has(normalised)) {
      setInput("");
      return;
    }
    onChange([...value, normalised]);
    setInput("");
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t.toLowerCase() !== tag.toLowerCase()));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length > 0 && inputNormalised === "") return;
      if (canCreate) {
        addTag(input);
      } else if (filtered.length === 1) {
        addTag(filtered[0]);
      } else if (filtered[0]?.toLowerCase() === inputNormalised) {
        addTag(filtered[0]);
      }
    } else if (e.key === "Backspace" && input === "" && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-background p-2 min-h-[2.5rem] focus-within:ring-2 focus-within:ring-primary/50 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-caption px-2 py-0.5"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              aria-label={`Remove ${tag}`}
              className="hover:opacity-70"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[6rem] bg-transparent text-small focus:outline-none"
        />
      </div>

      {open && (filtered.length > 0 || canCreate) && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border border-border bg-card shadow-lg max-h-60 overflow-y-auto text-small">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                addTag(s);
                inputRef.current?.focus();
              }}
              className="block w-full text-left px-3 py-2 hover:bg-muted transition-colors"
            >
              {s}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                addTag(input);
                inputRef.current?.focus();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-primary border-t border-border"
            >
              <Plus className="w-3.5 h-3.5" />
              Create:{" "}
              <span className="font-mono">
                {inputNormalised.replace(/\s+/g, "-")}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
