import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { BarberLayout } from '@/components/barber/BarberLayout';
import { Calendar, DollarSign, Users, TrendingUp, ArrowUpRight, ArrowDownRight, ChevronDown, Clock } from 'lucide-react';

import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Stats {
  today: number;
  week: number;
  month: number;
  todayCount: number;
  prevDay: number;
  prevWeek: number;
  prevMonth: number;
}

interface UpcomingAppointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  price: number;
  client_name: string;
  service_name: string;
}

function calcPercent(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return 100;
  return ((current - previous) / previous) * 100;
}

function PercentBadge({ current, previous }: { current: number; previous: number }) {
  const pct = calcPercent(current, previous);
  if (pct === null) return <span className="text-xs text-muted-foreground">—</span>;
  const isUp = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isUp ? 'text-success' : 'text-destructive'}`}>
      {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

export default function BarberDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ today: 0, week: 0, month: 0, todayCount: 0, prevDay: 0, prevWeek: 0, prevMonth: 0 });
  const [upcoming, setUpcoming] = useState<UpcomingAppointment[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<UpcomingAppointment[]>([]);
  const [showTodayList, setShowTodayList] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchStats();
    fetchUpcoming();
    fetchTodayAppointments();

    // Realtime: refresh when appointments change
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        fetchStats();
        fetchUpcoming();
        fetchTodayAppointments();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const getDateRanges = () => {
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const yesterday = format(subDays(now, 1), 'yyyy-MM-dd');
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const prevWeekStart = format(startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const prevWeekEnd = format(endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
    const prevMonthStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
    const prevMonthEnd = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
    return { today, yesterday, weekStart, weekEnd, prevWeekStart, prevWeekEnd, monthStart, monthEnd, prevMonthStart, prevMonthEnd };
  };

  const sumPrices = (data: any[] | null) => data?.reduce((s, a) => s + Number(a.price), 0) ?? 0;

  const fetchStats = async () => {
    if (!user) return;
    const d = getDateRanges();

    const [todayRes, weekRes, monthRes, prevDayRes, prevWeekRes, prevMonthRes] = await Promise.all([
      supabase.from('appointments').select('price').eq('barber_id', user.id).eq('appointment_date', d.today).eq('payment_status', 'paid'),
      supabase.from('appointments').select('price').eq('barber_id', user.id).gte('appointment_date', d.weekStart).lte('appointment_date', d.weekEnd).eq('payment_status', 'paid'),
      supabase.from('appointments').select('price').eq('barber_id', user.id).gte('appointment_date', d.monthStart).lte('appointment_date', d.monthEnd).eq('payment_status', 'paid'),
      supabase.from('appointments').select('price').eq('barber_id', user.id).eq('appointment_date', d.yesterday).eq('payment_status', 'paid'),
      supabase.from('appointments').select('price').eq('barber_id', user.id).gte('appointment_date', d.prevWeekStart).lte('appointment_date', d.prevWeekEnd).eq('payment_status', 'paid'),
      supabase.from('appointments').select('price').eq('barber_id', user.id).gte('appointment_date', d.prevMonthStart).lte('appointment_date', d.prevMonthEnd).eq('payment_status', 'paid'),
    ]);

    const todayCount = await supabase.from('appointments').select('id', { count: 'exact', head: true })
      .eq('barber_id', user.id).eq('appointment_date', d.today).eq('status', 'scheduled');

    setStats({
      today: sumPrices(todayRes.data),
      week: sumPrices(weekRes.data),
      month: sumPrices(monthRes.data),
      todayCount: todayCount.count ?? 0,
      prevDay: sumPrices(prevDayRes.data),
      prevWeek: sumPrices(prevWeekRes.data),
      prevMonth: sumPrices(prevMonthRes.data),
    });
  };

  const fetchTodayAppointments = async () => {
    if (!user) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data } = await supabase
      .from('appointments')
      .select('id, appointment_date, start_time, end_time, status, price, client_id, service_id')
      .eq('barber_id', user.id)
      .eq('appointment_date', today)
      .eq('status', 'scheduled')
      .order('start_time');

    if (data && data.length > 0) {
      const clientIds = [...new Set(data.map(a => a.client_id))];
      const serviceIds = [...new Set(data.map(a => a.service_id))];

      const [profilesRes, servicesRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').in('user_id', clientIds),
        supabase.from('services').select('id, name').in('id', serviceIds),
      ]);

      const profileMap: Record<string, string> = {};
      (profilesRes.data || []).forEach(p => { profileMap[p.user_id] = p.full_name; });
      const serviceMap: Record<string, string> = {};
      (servicesRes.data || []).forEach(s => { serviceMap[s.id] = s.name; });

      setTodayAppointments(data.map(a => ({
        id: a.id,
        appointment_date: a.appointment_date,
        start_time: a.start_time,
        end_time: a.end_time,
        status: a.status,
        price: a.price,
        client_name: profileMap[a.client_id] || 'Cliente',
        service_name: serviceMap[a.service_id] || 'Serviço',
      })));
    } else {
      setTodayAppointments([]);
    }
  };

  const fetchUpcoming = async () => {
    if (!user) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data } = await supabase
      .from('appointments')
      .select('id, appointment_date, start_time, end_time, status, price, client_id, service_id')
      .eq('barber_id', user.id)
      .gte('appointment_date', today)
      .eq('status', 'scheduled')
      .order('appointment_date')
      .order('start_time')
      .limit(10);

    if (data && data.length > 0) {
      const clientIds = [...new Set(data.map(a => a.client_id))];
      const serviceIds = [...new Set(data.map(a => a.service_id))];

      const [profilesRes, servicesRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').in('user_id', clientIds),
        supabase.from('services').select('id, name').in('id', serviceIds),
      ]);

      const profileMap: Record<string, string> = {};
      (profilesRes.data || []).forEach(p => { profileMap[p.user_id] = p.full_name; });
      const serviceMap: Record<string, string> = {};
      (servicesRes.data || []).forEach(s => { serviceMap[s.id] = s.name; });

      setUpcoming(data.map(a => ({
        id: a.id,
        appointment_date: a.appointment_date,
        start_time: a.start_time,
        end_time: a.end_time,
        status: a.status,
        price: a.price,
        client_name: profileMap[a.client_id] || 'Cliente',
        service_name: serviceMap[a.service_id] || 'Serviço',
      })));
    } else {
      setUpcoming([]);
    }
  };

  const statCards = [
    { label: 'Hoje', value: stats.today, prev: stats.prevDay, icon: DollarSign, color: 'text-success' },
    { label: 'Semana', value: stats.week, prev: stats.prevWeek, icon: TrendingUp, color: 'text-primary' },
    { label: 'Mês', value: stats.month, prev: stats.prevMonth, icon: Calendar, color: 'text-primary' },
  ];

  return (
    <BarberLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-in min-w-0">
        <div>
          <h1 className="text-3xl font-bold font-display animate-[pulse_3s_ease-in-out_infinite] bg-gradient-to-r from-primary via-destructive to-primary bg-clip-text text-transparent">Painel Financeiro</h1>
          <p className="text-muted-foreground mt-1">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((card) => (
            <div key={card.label} className="glass-card p-5 animate-slide-up">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{card.label}</span>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <p className="text-2xl font-bold font-display">
                R$ {Number(card.value).toFixed(2)}
              </p>
              {'prev' in card && card.prev !== undefined && (
                <div className="mt-1">
                  <PercentBadge current={Number(card.value)} previous={card.prev} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Agendamentos Hoje - Clickable */}
        <div className="glass-card overflow-hidden animate-slide-up">
          <button
            onClick={() => setShowTodayList(!showTodayList)}
            className="w-full p-5 flex items-center justify-between hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-primary" />
              <div className="text-left">
                <p className="text-sm text-muted-foreground">Agendamentos Hoje</p>
                <p className="text-2xl font-bold font-display">{stats.todayCount}</p>
              </div>
            </div>
            <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${showTodayList ? 'rotate-180' : ''}`} />
          </button>

          {showTodayList && (
            <div className="border-t border-border">
              {todayAppointments.length === 0 ? (
                <p className="text-muted-foreground text-center py-6 text-sm">Nenhum agendamento para hoje</p>
              ) : (
                <div className="divide-y divide-border/50">
                  {todayAppointments.map((apt) => (
                    <div key={apt.id} className="flex items-center justify-between px-5 py-4 hover:bg-secondary/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">{apt.client_name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{apt.client_name}</p>
                          <p className="text-xs text-muted-foreground">{apt.service_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{apt.start_time.slice(0, 5)} - {apt.end_time.slice(0, 5)}</span>
                        </div>
                        <p className="text-sm font-semibold text-success">R$ {Number(apt.price).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Upcoming */}
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold font-display mb-4">Próximos Agendamentos</h2>
          {upcoming.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum agendamento próximo</p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((apt) => (
                <div key={apt.id} className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 animate-slide-up">
                  <div>
                    <p className="font-medium">{apt.client_name}</p>
                    <p className="text-sm text-muted-foreground">{apt.service_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {format(new Date(apt.appointment_date + 'T00:00:00'), 'dd/MM')} • {apt.start_time.slice(0, 5)}
                    </p>
                    <p className="text-sm text-success font-semibold">R$ {Number(apt.price).toFixed(2)}</p>
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
