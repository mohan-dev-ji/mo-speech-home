"use client";

type Props = {
  title: string;
  children?: React.ReactNode;
};

export function PageBanner({ title, children }: Props) {
  return (
    <div className="flex items-center gap-4 min-h-[136px] p-theme-general bg-theme-card rounded-theme">
      <div className="flex-1 flex flex-col justify-center min-w-0">
        <h1
          className="text-theme-h3 font-bold leading-tight truncate"
          style={{ color: 'var(--theme-text-primary)' }}
        >
          {title}
        </h1>
        {children && (
          <div className="flex items-center flex-wrap gap-2 mt-3">
            {children}
          </div>
        )}
      </div>
     
    </div>
  );
}
