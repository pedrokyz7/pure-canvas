import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { BarberSidebar } from './BarberSidebar';
import { NotificationBell } from './NotificationBell';
import { useAuth } from '@/hooks/useAuth';
import { Lock } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo.jpg';

export function BarberLayout({ children }: { children: ReactNode }) {
  const { user, isFrozen, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const fullName = user?.user_metadata?.full_name || '';
  const shortName = fullName.trim().split(/\s+/).slice(0, 2).join(' ');

  const isSubscriptionsPage = location.pathname === '/barber/subscriptions';
  const showFrozenBlock = isFrozen && !isSubscriptionsPage;

  if (showFrozenBlock) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
        {/* Ice particles animation */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full opacity-0"
              style={{
                width: `${Math.random() * 8 + 2}px`,
                height: `${Math.random() * 8 + 2}px`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                background: `radial-gradient(circle, hsl(200 80% 80% / 0.8), hsl(210 90% 70% / 0.3))`,
                boxShadow: `0 0 ${Math.random() * 10 + 4}px hsl(200 80% 70% / 0.5)`,
                animation: `ice-float ${3 + Math.random() * 4}s ease-in-out ${Math.random() * 3}s infinite`,
              }}
            />
          ))}
        </div>

        {/* Frost border ring */}
        <div className="relative mb-8 animate-fade-in">
          <div
            className="absolute -inset-4 rounded-3xl"
            style={{
              background: 'linear-gradient(135deg, hsl(200 80% 70% / 0.2), hsl(210 90% 80% / 0.1), hsl(190 70% 60% / 0.2))',
              border: '1px solid hsl(200 60% 70% / 0.3)',
              boxShadow: '0 0 30px hsl(200 80% 70% / 0.15), inset 0 0 20px hsl(200 80% 80% / 0.05)',
              animation: 'frost-pulse 3s ease-in-out infinite',
            }}
          />
          <img src={logo} alt="Logo" className="relative w-24 h-24 rounded-2xl object-cover" />
        </div>

        {/* Lock icon with ice glow */}
        <div className="relative mb-4 animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <Lock
            className="w-20 h-20"
            style={{ color: 'hsl(200 80% 70%)' }}
          />
          <div
            className="absolute inset-0 blur-xl rounded-full"
            style={{
              background: 'radial-gradient(circle, hsl(200 80% 70% / 0.4), transparent)',
            }}
          />
        </div>

        <h2
          className="text-3xl font-bold mb-2 animate-fade-in"
          style={{ color: 'hsl(200 80% 75%)', animationDelay: '0.3s' }}
        >
          Conta Congelada
        </h2>
        <p className="text-muted-foreground text-center max-w-md mb-6 animate-fade-in" style={{ animationDelay: '0.45s' }}>
          Sua conta foi congelada pelo administrador. Entre em contato com o suporte ou regularize sua situação.
        </p>
        <div className="flex gap-3 animate-fade-in" style={{ animationDelay: '0.6s' }}>
          <Button variant="default" onClick={() => navigate('/barber/subscriptions')}>
            Ir para Assinaturas
          </Button>
          <Button variant="outline" onClick={async () => { await signOut(); window.location.href = '/auth'; }}>
            Sair
          </Button>
        </div>

        <style>{`
          @keyframes ice-float {
            0%, 100% { opacity: 0; transform: translateY(0) scale(1); }
            20% { opacity: 0.7; }
            50% { opacity: 0.4; transform: translateY(-30px) scale(1.2); }
            80% { opacity: 0.6; }
          }
          @keyframes frost-pulse {
            0%, 100% { box-shadow: 0 0 30px hsl(200 80% 70% / 0.15), inset 0 0 20px hsl(200 80% 80% / 0.05); }
            50% { box-shadow: 0 0 50px hsl(200 80% 70% / 0.25), inset 0 0 30px hsl(200 80% 80% / 0.1); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <BarberSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-30 h-14 flex items-center border-b border-border px-4 gap-3 bg-background/95 backdrop-blur-sm">
            <SidebarTrigger />
            <img src={logo} alt="Logo" className="w-8 h-8 rounded-lg object-cover animate-logo-pulse" />
            {shortName && (
              <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
                {shortName}
              </span>
            )}
            <div className="ml-auto">
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 overflow-y-auto overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
