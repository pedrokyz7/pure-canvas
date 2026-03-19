import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { BarberLayout } from '@/components/barber/BarberLayout';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { DollarSign, TrendingUp, Calendar, BarChart3, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';


interface AppointmentRecord {
  id: string;
  appointment_date: string;
  start_time: string;
  price: number;
  status: string;
  payment_status: string;
  client_name: string;
  service_name: string;
}

export default function BarberFinances() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ today: 0, week: 0, month: 0, total: 0 });
  const [records, setRecords] = useState<AppointmentRecord[]>([]);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all');

  useEffect(() => {
    if (user) {
      fetchStats();
      fetchRecords();
    }
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

    const [todayRes, weekRes, monthRes, totalRes] = await Promise.all([
      supabase.from('appointments').select('price').eq('barber_id', user.id).eq('appointment_date', today).eq('payment_status', 'paid'),
      supabase.from('appointments').select('price').eq('barber_id', user.id).gte('appointment_date', weekStart).lte('appointment_date', weekEnd).eq('payment_status', 'paid'),
      supabase.from('appointments').select('price').eq('barber_id', user.id).gte('appointment_date', monthStart).lte('appointment_date', monthEnd).eq('payment_status', 'paid'),
      supabase.from('appointments').select('price').eq('barber_id', user.id).eq('payment_status', 'paid'),
    ]);

    const sum = (data: any[]) => data?.reduce((s, a) => s + Number(a.price), 0) ?? 0;
    setStats({
      today: sum(todayRes.data || []),
      week: sum(weekRes.data || []),
      month: sum(monthRes.data || []),
      total: sum(totalRes.data || []),
    });
  };

  const fetchRecords = async () => {
    if (!user) return;
    const { data: appts } = await supabase
      .from('appointments')
      .select('id, appointment_date, start_time, price, status, payment_status, client_id, service_id')
      .eq('barber_id', user.id)
      .in('status', ['scheduled', 'completed'])
      .order('appointment_date', { ascending: false })
      .order('start_time', { ascending: false })
      .limit(50);

    if (!appts?.length) { setRecords([]); return; }

    const clientIds = [...new Set(appts.map(a => a.client_id))];
    const serviceIds = [...new Set(appts.map(a => a.service_id))];

    const [{ data: profiles }, { data: services }] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name').in('user_id', clientIds),
      supabase.from('services').select('id, name').in('id', serviceIds),
    ]);

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p.full_name]));
    const serviceMap = Object.fromEntries((services || []).map(s => [s.id, s.name]));

    setRecords(appts.map(a => ({
      id: a.id,
      appointment_date: a.appointment_date,
      start_time: a.start_time,
      price: a.price,
      status: a.status,
      payment_status: a.payment_status || 'pending',
      client_name: profileMap[a.client_id] || 'Cliente',
      service_name: serviceMap[a.service_id] || 'Serviço',
    })));
  };

  const togglePayment = async (id: string, current: string) => {
    const newStatus = current === 'paid' ? 'pending' : 'paid';
    const { error } = await supabase
      .from('appointments')
      .update({ payment_status: newStatus } as any)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar pagamento');
      return;
    }

    setRecords(prev => prev.map(r => r.id === id ? { ...r, payment_status: newStatus } : r));
    toast.success(newStatus === 'paid' ? 'Marcado como pago!' : 'Marcado como pendente');
    fetchStats();
  };

  const filtered = records.filter(r => {
    if (filter === 'paid') return r.payment_status === 'paid';
    if (filter === 'pending') return r.payment_status === 'pending';
    return true;
  });

  const cards = [
    { label: 'Hoje', value: stats.today, icon: DollarSign, gradient: 'from-success/20 to-success/5' },
    { label: 'Esta Semana', value: stats.week, icon: TrendingUp, gradient: 'from-primary/20 to-primary/5' },
    { label: 'Este Mês', value: stats.month, icon: Calendar, gradient: 'from-primary/20 to-primary/5' },
    { label: 'Total', value: stats.total, icon: BarChart3, gradient: 'from-primary/20 to-primary/5' },
  ];

  const filters = [
    { key: 'all' as const, label: 'Todos' },
    { key: 'pending' as const, label: '⏳ Pendentes' },
    { key: 'paid' as const, label: '✅ Pagos' },
  ];

  return (
    <BarberLayout>
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
        <h1 className="text-3xl font-bold font-display">Financeiro</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <div key={card.label} className={`glass-card p-5 bg-gradient-to-br ${card.gradient} animate-slide-up`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{card.label}</span>
                <card.icon className="w-5 h-5 text-success" />
              </div>
              <p className="text-2xl font-bold font-display">R$ {card.value.toFixed(2)}</p>
            </div>
          ))}
        </div>

        <div className="glass-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
            <h2 className="text-xl font-semibold font-display">Atendimentos</h2>
            <div className="flex gap-2">
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filter === f.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum atendimento encontrado</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 animate-slide-up">
                  <div className="space-y-0.5">
                    <p className="font-medium">{r.client_name}</p>
                    <p className="text-sm text-muted-foreground">{r.service_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(r.appointment_date + 'T00:00:00'), 'dd/MM/yyyy')} • {r.start_time.slice(0, 5)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-semibold text-success">R$ {Number(r.price).toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => togglePayment(r.id, r.payment_status)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        r.payment_status === 'paid'
                          ? 'bg-success/20 text-success'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}
                    >
                      {r.payment_status === 'paid' ? (
                        <><CheckCircle className="w-3.5 h-3.5" /> Pago</>
                      ) : (
                        <><Clock className="w-3.5 h-3.5" /> Pendente</>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </BarberLayout>
  );
}
