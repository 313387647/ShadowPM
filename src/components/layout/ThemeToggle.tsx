"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Theme = "dark" | "light";

export function ThemeToggle({ variant = "icon" }: { variant?: "icon" | "row" }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  const nextTheme: Theme = theme === "dark" ? "light" : "dark";
  const toggleTheme = () => {
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("shadowpm-theme", nextTheme);
    setTheme(nextTheme);
  };

  if (variant === "row") {
    const Icon = theme === "dark" ? Sun : Moon;
    return <button type="button" onClick={toggleTheme} className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm text-foreground transition-colors hover:bg-surface-2">
      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      切换至{nextTheme === "light" ? "轻色" : "深色"}模式
    </button>;
  }

  const Icon = theme === "dark" ? Sun : Moon;
  return <button type="button" onClick={toggleTheme} className={cn("grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground")} aria-label={`切换至${nextTheme === "light" ? "轻色" : "深色"}模式`} title={`切换至${nextTheme === "light" ? "轻色" : "深色"}模式`}>
    <Icon className="size-4" aria-hidden="true" />
  </button>;
}
