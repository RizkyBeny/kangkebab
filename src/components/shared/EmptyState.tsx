import React from "react";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-1 px-6 py-12 text-center">
        {Icon && (
          <span className="mb-1 flex size-10 items-center justify-center rounded-lg bg-muted">
            <Icon className="size-5 text-muted-foreground" />
          </span>
        )}
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}