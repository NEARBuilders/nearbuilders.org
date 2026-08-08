import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useRef } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const transitionTimeoutRef = useRef<number | null>(null);

  const toggleTheme = () => {
    const root = document.documentElement;

    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current);
    }

    root.classList.add("theme-transition");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark");

        transitionTimeoutRef.current = window.setTimeout(() => {
          root.classList.remove("theme-transition");
          transitionTimeoutRef.current = null;
        }, 180);
      });
    });
  };

  return (
    <Button
      type="button"
      onClick={toggleTheme}
      variant="ghost"
      size="icon-sm"
      className="size-9 rounded-md"
      aria-label="Toggle theme"
    >
      {resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </Button>
  );
}
