import { UIProvider } from "@/lib/ui-context";
import { PortalSidebar } from "@/components/portal-sidebar";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <UIProvider>
      <div className="min-h-screen overflow-x-hidden bg-canvas">
        <PortalSidebar />
        <div className="min-w-0 lg:pl-64">{children}</div>
      </div>
    </UIProvider>
  );
}
