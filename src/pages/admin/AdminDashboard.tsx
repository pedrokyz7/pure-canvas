import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Navigate } from 'react-router-dom';
import { Users, Scissors, DollarSign, CalendarClock, Shield } from 'lucide-react';
import { Scissors as ScissorsIcon } from 'lucide-react';

interface Stats {
  totalBarbers: number;
  totalAdmins: number;
  totalClients: number;
  totalAppointments: number;
  totalRevenue: number;
}

export default function AdminDashboard() {
  const { role, loading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const { data, error } = await supabase.functions.invoke('admin-management', {
      body: { action: 'get_stats' },
    });
    if (!error && data) setStats(data);
    setLoadingStats(false);
  };

  if (loading) return null;
  if (role !== 'super_admin') return <Navigate to="/" replace />;

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold font-display">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visão geral do sistema</p>
        </div>

        {loadingStats ? (
          <p className="text-muted-foreground text-center py-12">Carregando...</p>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="glass-card p-4 text-center">
              <Shield className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{stats.totalAdmins}</p>
              <p className="text-xs text-muted-foreground">Admins Barbeiro</p>
            </div>
            <div className="glass-card p-4 text-center">
              <Scissors className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{stats.totalBarbers}</p>
              <p className="text-xs text-muted-foreground">Barbeiros</p>
            </div>
            <div className="glass-card p-4 text-center">
              <Users className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{stats.totalClients}</p>
              <p className="text-xs text-muted-foreground">Clientes</p>
            </div>
            <div className="glass-card p-4 text-center">
              <CalendarClock className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{stats.totalAppointments}</p>
              <p className="text-xs text-muted-foreground">Agendamentos</p>
            </div>
            <div className="glass-card p-4 text-center col-span-2 md:col-span-1">
              <DollarSign className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">Faturamento Total</p>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-center">Erro ao carregar estatísticas</p>
        )}
      </div>
    </AdminLayout>
  );
}
