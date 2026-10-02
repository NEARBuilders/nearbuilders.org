import { Check, Circle, XCircle } from "lucide-react";
import { useCallback, useState } from "react";
import { Spinner } from "@/components/ui/spinner";

export type StepState = "pending" | "running" | "success" | "failed";

export interface Step {
  label: string;
  state: StepState;
  error?: string;
  blocking?: boolean;
}

export function StepIcon({ state }: { state: StepState }) {
  switch (state) {
    case "running":
      return <Spinner className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-px" />;
    case "success":
      return <Check className="h-3.5 w-3.5 text-brand-cyan shrink-0 mt-px" />;
    case "failed":
      return <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-px" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-border shrink-0 mt-px" />;
  }
}

export function StepList({ steps }: { steps: Step[] }) {
  return (
    <>
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-3">
          <StepIcon state={step.state} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs ${step.state === "failed" ? "text-destructive" : "text-foreground"}`}
              >
                {step.label}
              </span>
              {step.blocking === false && (
                <span className="text-3xs text-muted-foreground uppercase tracking-wide">
                  non-blocking
                </span>
              )}
            </div>
            {step.error && (
              <p className="text-xs text-destructive mt-0.5 break-all">{step.error}</p>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

export function useStepper(stepLabels: readonly { label: string; blocking?: boolean }[]) {
  const [steps, setSteps] = useState<Step[]>(
    stepLabels.map((s) => ({ ...s, state: "pending" as StepState })),
  );

  const updateStep = useCallback((index: number, state: StepState, error?: string) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, state, error } : s)));
  }, []);

  const resetSteps = useCallback(() => {
    setSteps(stepLabels.map((s) => ({ ...s, state: "pending" as StepState })));
  }, [stepLabels]);

  const runStep = useCallback(
    async <T,>(index: number, fn: () => Promise<T>): Promise<T | undefined> => {
      updateStep(index, "running");
      try {
        const value = await fn();
        updateStep(index, "success");
        return value;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        updateStep(index, "failed", msg);
        return undefined;
      }
    },
    [updateStep],
  );

  return { steps, updateStep, resetSteps, runStep };
}
