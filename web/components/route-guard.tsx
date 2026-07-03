"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/roles";
import { canAccess } from "@/lib/access";
import { ROLE_LABEL } from "@/lib/data/types";

/** Enforces role-based access at the route level — deep-linking a page you can't
 *  see (e.g. an agent opening /analytics) bounces you back to Home. */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useCurrentUser();
  const router = useRouter();
  const allowed = canAccess(pathname, user.role);

  useEffect(() => {
    if (!allowed) {
      toast.error(`No access — ${ROLE_LABEL[user.role]} can't open this page.`);
      router.replace("/home");
    }
  }, [allowed, pathname, user.role, router]);

  if (!allowed) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="flex items-center gap-2 text-text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          <span className="font-mono text-[11px] uppercase tracking-[0.18em]">Redirecting…</span>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
