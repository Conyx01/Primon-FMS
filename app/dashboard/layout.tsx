import { Sidebar } from "@/components/sidebar";
import { UIProvider } from "@/lib/ui-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UIProvider>
      <div className="min-h-screen bg-canvas overflow-x-hidden">
        <Sidebar />
        <div className="lg:pl-64 min-w-0">{children}</div>
      </div>
    </UIProvider>
  );
}

