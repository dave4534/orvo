import { ClaimsView } from "@/features/claims/claims-view";
import { AppShell } from "@/features/shell/app-shell";
import { ClaimsProvider } from "@/store/claims-store";
import { WorkspaceProvider } from "@/store/workspace-store";

export default function Page() {
  return (
    <ClaimsProvider>
      <WorkspaceProvider>
        <AppShell>
          <ClaimsView />
        </AppShell>
      </WorkspaceProvider>
    </ClaimsProvider>
  );
}
