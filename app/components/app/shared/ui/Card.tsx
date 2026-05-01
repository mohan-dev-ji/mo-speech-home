import { cn } from "@/lib/utils";

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className, children }: CardProps) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground border border-border rounded-lg p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: CardProps) {
  return <div className={cn("mb-4", className)}>{children}</div>;
}

export function CardTitle({ className, children }: CardProps) {
  return (
    <h3 className={cn("font-semibold text-subheading", className)}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children }: CardProps) {
  return (
    <p className={cn("text-small text-muted-foreground mt-1", className)}>
      {children}
    </p>
  );
}

export function CardContent({ className, children }: CardProps) {
  return <div className={cn("", className)}>{children}</div>;
}

export function CardFooter({ className, children }: CardProps) {
  return (
    <div className={cn("mt-4 pt-4 border-t border-border", className)}>
      {children}
    </div>
  );
}
