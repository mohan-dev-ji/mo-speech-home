"use client";

// The symbol/phrase chip area of the Talker rectangle (ADR-015).
//
// Holds a mix of single-word chips (white SymbolCard) and multi-symbol PHRASES
// (a zinc box wrapping the phrase's word chips + a name pill — the visual marker
// that "this is a reusable chunk", offset from the colourful semantic
// categories). Units can be dragged to reorder and removed via a corner X
// (shuffle editing, ADR-015 §8) — reuses the project's dnd-kit pattern
// (PointerSensor, 8px activation so a tap still plays). Tapping a chip calls
// onChipTap; the parent decides play-vs-other.

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X } from "lucide-react";
import { SymbolCard } from "./SymbolCard";
import { getCategoryColour } from "@/app/lib/categoryColours";

export type TalkerPhraseWord = {
  imagePath?: string;
  audioPath?: string;
  label: string;
  labelRecord?: Record<string, string>; // Phase 15 (Task 6) — full localised record
};

export type TalkerSymbolItem = {
  instanceId: string;   // unique per tap (uuid), not the symbol ID
  symbolId: string;
  imagePath?: string;
  audioPath?: string;   // R2 key — served via /api/assets proxy
  label: string;
  labelRecord?: Record<string, string>; // Phase 15 (Task 6)
  // Phrase fields (present only when kind === 'phrase').
  kind?: "word" | "phrase";
  phraseName?: string;
  phraseNameRecord?: Record<string, string>; // Phase 15 (Task 6)
  words?: TalkerPhraseWord[];
};

// Payload emitted by TalkerDropdown when a quick-access symbol OR phrase is
// tapped. Omits instanceId — the receiving handler assigns that on insert.
export type QuickSymbolItem = {
  symbolId: string;
  label: string;
  labelRecord?: Record<string, string>; // Phase 15 (Task 6)
  imagePath?: string;
  audioPath?: string;
  kind?: "word" | "phrase";
  phraseName?: string;
  phraseNameRecord?: Record<string, string>; // Phase 15 (Task 6)
  words?: TalkerPhraseWord[];
};

const ZINC = getCategoryColour("zinc");

type TalkerBarProps = {
  symbols: TalkerSymbolItem[];
  placeholder?: string;
  onChipTap: (item: TalkerSymbolItem) => void;
  onRemove?: (instanceId: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
};

export function TalkerBar({
  symbols,
  placeholder = "Tap symbols to build a sentence…",
  onChipTap,
  onRemove,
  onReorder,
}: TalkerBarProps) {
  // 8px activation: a tap (no movement) fires onChipTap; a drag reorders. Same
  // convention as the sentence editor's SlotStrip, so tap-to-play stays reliable
  // on touch devices.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;
    const oldIdx = symbols.findIndex((s) => s.instanceId === active.id);
    const newIdx = symbols.findIndex((s) => s.instanceId === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    onReorder(oldIdx, newIdx);
  }

  if (symbols.length === 0) {
    return (
      <div className="flex flex-1 min-w-0 self-stretch items-center flex-wrap content-start gap-theme-elements py-theme-elements overflow-y-auto">
        <span
          className="text-caption opacity-50 select-none"
          style={{ color: "var(--theme-alt-text)" }}
        >
          {placeholder}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-w-0 self-stretch items-start flex-wrap content-start gap-theme-elements py-theme-elements overflow-y-auto">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={symbols.map((s) => s.instanceId)}
          strategy={horizontalListSortingStrategy}
        >
          {symbols.map((item) => (
            <SortableUnit
              key={item.instanceId}
              item={item}
              onTap={() => onChipTap(item)}
              onRemove={onRemove ? () => onRemove(item.instanceId) : undefined}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

// ─── Sortable unit (word chip or zinc phrase box) ───────────────────────────────

function SortableUnit({
  item,
  onTap,
  onRemove,
}: {
  item: TalkerSymbolItem;
  onTap: () => void;
  onRemove?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.instanceId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: "relative",
  };

  const isPhrase = item.kind === "phrase";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group shrink-0 touch-none ${isPhrase ? "" : "w-40"}`}
      {...listeners}
      {...attributes}
    >
      {isPhrase ? (
        <PhraseBox item={item} onTap={onTap} />
      ) : (
        <SymbolCard
          symbolId={item.symbolId}
          imagePath={item.imagePath}
          label={item.label}
          language="en"
          onTap={onTap}
        />
      )}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          // Block pointer-down from reaching the drag listeners so tapping the X
          // never starts a drag, even on a touch device crossing the 8px jitter.
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Remove ${item.phraseName ?? item.label}`}
          className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center shadow z-10"
          style={{ background: "var(--theme-warning)", color: "#fff" }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Zinc phrase box (Figma Symbol/variant=Phrase) ──────────────────────────────

function PhraseBox({ item, onTap }: { item: TalkerSymbolItem; onTap: () => void }) {
  const words = item.words ?? [];
  // Mirror SymbolCard's press feedback: a hover primary outline + active
  // scale-down, so a phrase chip behaves like a word chip when pressed. The
  // border is always 4px (transparent at rest) so hover never shifts layout.
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onTap}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={item.phraseName ?? item.label}
      className="flex flex-col items-center gap-2 rounded-theme p-3 transition-transform active:scale-95"
      style={{
        background: ZINC.c500,
        borderWidth: 4,
        borderStyle: "solid",
        borderColor: hovered ? "var(--theme-brand-primary)" : "transparent",
        transition: "border-color 150ms ease, transform 150ms ease",
      }}
    >
      <div className="flex items-end gap-2">
        {words.length === 0 ? (
          <div className="w-24 h-24 rounded-theme-sm" style={{ background: ZINC.c100 }} />
        ) : (
          words.map((w, i) => (
            <div
              key={i}
              className="w-24 h-24 rounded-theme-sm overflow-hidden flex items-center justify-center"
              style={{ background: ZINC.c100 }}
            >
              {w.imagePath ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`/api/assets?key=${w.imagePath}`}
                  alt={w.label}
                  className="w-full h-full object-contain p-1.5"
                  draggable={false}
                />
              ) : (
                <span className="text-caption px-1 text-center" style={{ color: ZINC.c700 }}>
                  {w.label}
                </span>
              )}
            </div>
          ))
        )}
      </div>
      {/* Name pill — the "this is a phrase" label. */}
      <span
        className="text-caption font-medium rounded-full px-3 py-0.5"
        style={{ background: ZINC.c700, color: "#fff" }}
      >
        {item.phraseName ?? item.label}
      </span>
    </button>
  );
}
