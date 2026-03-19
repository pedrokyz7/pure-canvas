import { useEffect, useState } from 'react';
import { Calendar, DollarSign, Scissors, LogOut, User, CalendarPlus } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
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
  { title: 'Agendar', url: '/client', icon: CalendarPlus },
  { title: 'Meus Agendamentos', url: '/client/appointments', icon: Calendar },
];

export function ClientSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { signOut, user } = useAuth();
  const [firstName, setFirstName] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.full_name) {
          setFirstName(data.full_name.split(' ')[0]);
        }
      });
  }, [user]);

  const profileTitle = firstName ? `Meu Perfil ${firstName}` : 'Meu Perfil';
  const items = [...baseItems, { title: profileTitle, url: '/client/profile', icon: User }];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="font-display text-sm tracking-tight px-4 py-6">
            {!collapsed && (
              <span className="flex flex-col gap-0.5">
                <span className="flex items-center gap-2">
                  <Scissors className="w-5 h-5 text-primary" />
                  BLACKOUT BARBER SHOP
                </span>
                {firstName && (
                  <span className="text-xs text-muted-foreground font-normal pl-7">
                    {firstName}
                  </span>
                )}
              </span>
            )}
            {collapsed && <Scissors className="w-5 h-5 text-primary" />}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/client'}
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
