"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

/** Gates the workspace: restores a saved demo session, else bounces to /login. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const authed = useStore((s) => s.authed);
  const restoreSession = useStore((s) => s.restoreSession);
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    restoreSession();
    setChecked(true);
  }, [restoreSession]);

  useEffect(() => {
    if (checked && !authed) router.replace("/login");
  }, [checked, authed, router]);

  if (!authed) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="flex items-center gap-2 text-text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          <span className="font-mono text-[11px] uppercase tracking-[0.18em]">Loading…</span>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
