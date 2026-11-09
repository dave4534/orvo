import { ClaimsView } from "@/features/claims/claims-view";
import { AppShell } from "@/features/shell/app-shell";

export default function Page() {
  return (
    <AppShell>
      <ClaimsView />
    </AppShell>
  );
}
