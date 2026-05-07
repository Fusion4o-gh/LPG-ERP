import { Sidebar } from "./Sidebar";

export function AppShell({ children, permissions }: { children: React.ReactNode; permissions: string[] }) {
  return (
    <div className="min-h-screen md:flex">
      <Sidebar permissions={permissions} />
      <main className="flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
