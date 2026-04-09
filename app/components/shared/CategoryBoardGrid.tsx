// Pure layout container for SymbolCard instances.
// Columns default to 4 — settable per studentProfile grid preference.

type CategoryBoardGridProps = {
  children: React.ReactNode;
  columns?: number;
};

export function CategoryBoardGrid({ children, columns = 4 }: CategoryBoardGridProps) {
  return (
    <div
      className="grid gap-3 p-4 content-start"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}
