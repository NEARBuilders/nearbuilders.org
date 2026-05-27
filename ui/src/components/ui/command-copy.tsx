import { Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function CommandCopy({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    toast.success("Copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="w-full group flex items-center justify-between gap-3 rounded-[8px] border border-border bg-foreground px-4 py-3 cursor-pointer transition-opacity duration-150 hover:opacity-90 text-left"
    >
      <code className="font-mono text-sm font-semibold text-background break-all leading-snug">
        {command}
      </code>
      <span
        className={`shrink-0 transition-colors duration-150 ${copied ? "text-brand-accent" : "text-background/50 group-hover:text-background/80"}`}
      >
        <Copy size={14} />
      </span>
    </button>
  );
}

export { CommandCopy };
