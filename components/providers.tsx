"use client";

import { Toaster } from "sonner";
import { ThemeProvider } from "@/lib/theme";
import { ConfirmProvider } from "./ui/confirm";
import { CommandPalette } from "./command-palette";
import { ConductorDock } from "./conductor-dock";
import { AgentCopilot } from "./agent-copilot";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ConfirmProvider>
        {children}
        <CommandPalette />
        <AgentCopilot />
        <ConductorDock />
      <Toaster
        position="bottom-right"
        theme="system"
        offset={16}
        toastOptions={{
          classNames: {
            toast:
              "!bg-surface !text-text !border !border-border !rounded-[14px] !shadow-[var(--shadow-lift)] !font-sans",
            description: "!text-text-muted",
            title: "!font-semibold !text-text",
          },
        }}
      />
      </ConfirmProvider>
    </ThemeProvider>
  );
}
