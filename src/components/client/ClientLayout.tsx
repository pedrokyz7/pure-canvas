import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { ClientSidebar } from './ClientSidebar';
import { NotificationBell } from '@/components/barber/NotificationBell';
import logo from '@/assets/logo.jpg';

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <ClientSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-30 h-14 flex items-center border-b border-border px-4 gap-3 bg-background/95 backdrop-blur-sm">
            <SidebarTrigger />
            <img src={logo} alt="Logo" className="w-8 h-8 rounded-lg object-cover animate-logo-pulse" />
            <div className="ml-auto">
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 p-6 md:p-8 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
