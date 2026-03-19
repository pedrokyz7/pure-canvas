import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { BarberLayout } from '@/components/barber/BarberLayout';
import { Users, DollarSign, Phone, Mail } from 'lucide-react';

interface ClientInfo {
  user_id: string;
  full_name: string;
  phone: string | null;
  email: string;
  avatar_url: string | null;
  totalSpent: number;
  appointmentCount: number;
}

export default function BarberClients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientInfo[]>([]);

  useEffect(() => {
    if (user) fetchClients();
  }, [user]);

  const fetchClients = async () => {
    if (!user) return;

    // Get all users with 'client' role
    const { data: clientRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'client');

    console.log('clientRoles:', clientRoles, 'error:', rolesError);

    if (!clientRoles?.length) {
      // Fallback: get all profiles and exclude barbers
      const { data: barberRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'barber');
      
      const barberIds = new Set(barberRoles?.map(r => r.user_id) || []);
      
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone, avatar_url');

      if (!allProfiles?.length) return;

      const clientProfiles = allProfiles.filter(p => !barberIds.has(p.user_id));
      if (!clientProfiles.length) return;

      const clientIds = clientProfiles.map(p => p.user_id);

      const { data: appointments } = await supabase
        .from('appointments')
        .select('client_id, price, status')
        .eq('barber_id', user.id)
        .in('status', ['completed', 'scheduled']);

      const clientMap: Record<string, { total: number; count: number }> = {};
      appointments?.forEach(a => {
        if (!clientMap[a.client_id]) clientMap[a.client_id] = { total: 0, count: 0 };
        clientMap[a.client_id].total += Number(a.price);
        clientMap[a.client_id].count += 1;
      });

      const result: ClientInfo[] = clientIds.map(id => {
        const profile = clientProfiles.find(p => p.user_id === id);
        return {
          user_id: id,
          full_name: profile?.full_name || 'Cliente',
          phone: profile?.phone || null,
          email: '',
          avatar_url: profile?.avatar_url || null,
          totalSpent: clientMap[id]?.total ?? 0,
          appointmentCount: clientMap[id]?.count ?? 0,
        };
      });

      result.sort((a, b) => b.totalSpent - a.totalSpent);
      setClients(result);
      return;
    }

    const clientIds = clientRoles.map(r => r.user_id);

    // Get profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, phone, avatar_url')
      .in('user_id', clientIds);

    // Get appointments for this barber to calculate spending
    const { data: appointments } = await supabase
      .from('appointments')
      .select('client_id, price, status')
      .eq('barber_id', user.id)
      .in('status', ['completed', 'scheduled']);

    const clientMap: Record<string, { total: number; count: number }> = {};
    appointments?.forEach(a => {
      if (!clientMap[a.client_id]) clientMap[a.client_id] = { total: 0, count: 0 };
      clientMap[a.client_id].total += Number(a.price);
      clientMap[a.client_id].count += 1;
    });

    const result: ClientInfo[] = clientIds.map(id => ({
      user_id: id,
      full_name: profiles?.find(p => p.user_id === id)?.full_name || 'Cliente',
      phone: profiles?.find(p => p.user_id === id)?.phone || null,
      email: '',
      avatar_url: profiles?.find(p => p.user_id === id)?.avatar_url || null,
      totalSpent: clientMap[id]?.total ?? 0,
      appointmentCount: clientMap[id]?.count ?? 0,
    }));

    result.sort((a, b) => b.totalSpent - a.totalSpent);
    setClients(result);
  };

  const formatPhoneDisplay = (phone: string) => {
    const d = phone.replace(/\D/g, '');
    if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return phone;
  };

  return (
    <BarberLayout>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold font-display">Clientes Cadastrados</h1>
          <p className="text-muted-foreground mt-1">{clients.length} cliente{clients.length !== 1 ? 's' : ''}</p>
        </div>

        {clients.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 glass-card">Nenhum cliente atendido ainda</p>
        ) : (
          <div className="space-y-3">
            {clients.map((c) => (
              <div key={c.user_id} className="glass-card p-4 flex items-center justify-between animate-slide-up">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt={c.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">{c.full_name}</p>
                    {c.phone && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {formatPhoneDisplay(c.phone)}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {c.appointmentCount} atendimento{c.appointmentCount > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-success text-lg">R$ {c.totalSpent.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">total gasto</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </BarberLayout>
  );
}
