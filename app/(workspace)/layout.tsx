import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";
import { RouteGuard } from "@/components/route-guard";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <AppShell>
        <RouteGuard>{children}</RouteGuard>
      </AppShell>
    </AuthGate>
  );
}
