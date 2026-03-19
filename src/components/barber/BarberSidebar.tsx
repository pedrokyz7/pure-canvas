import { Calendar, DollarSign, Scissors, Clock, LogOut, LayoutDashboard, Users, UserPlus, User, CreditCard } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import { useMemo } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

const baseItems = [
  { title: 'Painel Financeiro', url: '/barber', icon: LayoutDashboard },
  { title: 'Clientes Agendados', url: '/barber/schedule', icon: Calendar },
  { title: 'Serviços/Barbeiro', url: '/barber/services', icon: Scissors },
  { title: 'Horários', url: '/barber/work-hours', icon: Clock },
];

const adminOnlyItems = [
  { title: 'Clientes Cadastrados', url: '/barber/clients', icon: Users },
  { title: 'Barbeiros', url: '/barber/barbers', icon: UserPlus },
];

const subscriptionItem = { title: 'Assinaturas', url: '/barber/subscriptions', icon: CreditCard };

export function BarberSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { signOut, role, user } = useAuth();
  const isAdmin = role === 'admin';
  const fullName = user?.user_metadata?.full_name || '';
  const shortName = fullName.trim().split(/\s+/).slice(0, 2).join(' ');
  const profileTitle = shortName ? `Meu Perfil ${shortName}` : 'Meu Perfil';

  const items = useMemo(
    () => isAdmin
      ? [...baseItems, ...adminOnlyItems, subscriptionItem, { title: profileTitle, url: '/barber/profile', icon: User }]
      : [...baseItems, { title: profileTitle, url: '/barber/profile', icon: User }],
    [isAdmin, profileTitle]
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="font-display text-sm tracking-tight px-4 py-6">
            {!collapsed && (
              <span className="flex items-center gap-2">
                <Scissors className="w-5 h-5 text-primary" />
                BLACKOUT BARBER SHOP
              </span>
            )}
            {collapsed && <Scissors className="w-5 h-5 text-primary" />}
          </SidebarGroupLabel>
          {!collapsed && shortName && (
            <div className="px-4 pb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground truncate">{shortName}</span>
            </div>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/barber'}
                      className="hover:bg-accent/50 rounded-xl px-3 py-2.5"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="w-4 h-4 mr-3" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
              <SidebarMenuButton asChild>
                  <button
                    onClick={async () => {
                      try { await signOut(); } catch (_) {}
                      window.location.href = '/auth';
                    }}
                    className="flex items-center w-full hover:bg-destructive/10 text-destructive rounded-xl px-3 py-2.5"
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    {!collapsed && <span>Sair</span>}
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
