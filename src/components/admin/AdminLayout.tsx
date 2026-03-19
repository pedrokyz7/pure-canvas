import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from './AdminSidebar';
import { Shield } from 'lucide-react';

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-30 h-14 flex items-center border-b border-border px-4 gap-3 bg-background/95 backdrop-blur-sm">
            <SidebarTrigger />
            <Shield className="w-6 h-6 text-primary animate-logo-pulse" />
            <span className="text-sm font-semibold text-foreground">Painel Super Admin</span>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
