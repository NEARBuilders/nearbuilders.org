import { CircleAlert, Rows3 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export type RecordsStateProps = {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  onRetry: () => void;
  loadingFallback?: ReactNode;
  errorTitle?: ReactNode;
  errorBody?: ReactNode;
  emptyTitle?: ReactNode;
  emptyBody?: ReactNode;
  children: ReactNode;
};

export function RecordsState({
  isLoading,
  isError,
  isEmpty,
  onRetry,
  loadingFallback,
  errorTitle,
  errorBody,
  emptyTitle,
  emptyBody,
  children,
}: RecordsStateProps) {
  if (isLoading) return <>{loadingFallback}</>;
  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-6 py-12 text-center">
        <CircleAlert className="mx-auto size-6 text-destructive" />
        <h3 className="mt-3 font-semibold text-foreground">
          {errorTitle ?? "Records could not be loaded"}
        </h3>
        {errorBody ? <p className="mt-1 text-sm text-muted-foreground">{errorBody}</p> : null}
        <Button className="mt-4" size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className="rounded-xl border border-border bg-card px-6 py-16 text-center">
        <Rows3 className="mx-auto size-6 text-muted-foreground" />
        <h3 className="mt-3 font-semibold text-foreground">{emptyTitle ?? "No records"}</h3>
        {emptyBody ? <p className="mt-1 text-sm text-muted-foreground">{emptyBody}</p> : null}
      </div>
    );
  }
  return <>{children}</>;
}
