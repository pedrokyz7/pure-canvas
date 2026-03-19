import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ClientLayout } from '@/components/client/ClientLayout';
import { DollarSign, TrendingUp, Calendar } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ClientSpending() {
  const { user } = useAuth();
  const [total, setTotal] = useState(0);
  const [weekTotal, setWeekTotal] = useState(0);
  const [monthTotal, setMonthTotal] = useState(0);
  const [byBarber, setByBarber] = useState<{ name: string; total: number; count: number }[]>([]);

  useEffect(() => {
    if (user) fetchSpending();
  }, [user]);

  const fetchSpending = async () => {
    if (!user) return;
    const today = new Date();
    const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');

    const [allRes, weekRes, monthRes] = await Promise.all([
      supabase.from('appointments').select('price, barber_id').eq('client_id', user.id).in('status', ['completed', 'scheduled']),
      supabase.from('appointments').select('price').eq('client_id', user.id).in('status', ['completed', 'scheduled']).gte('appointment_date', weekStart).lte('appointment_date', weekEnd),
      supabase.from('appointments').select('price').eq('client_id', user.id).in('status', ['completed', 'scheduled']).gte('appointment_date', monthStart).lte('appointment_date', monthEnd),
    ]);

    setTotal(allRes.data?.reduce((s, a) => s + Number(a.price), 0) ?? 0);
    setWeekTotal(weekRes.data?.reduce((s, a) => s + Number(a.price), 0) ?? 0);
    setMonthTotal(monthRes.data?.reduce((s, a) => s + Number(a.price), 0) ?? 0);

    // Group by barber
    if (allRes.data) {
      const barberMap: Record<string, { total: number; count: number }> = {};
      allRes.data.forEach(a => {
        if (!barberMap[a.barber_id]) barberMap[a.barber_id] = { total: 0, count: 0 };
        barberMap[a.barber_id].total += Number(a.price);
        barberMap[a.barber_id].count += 1;
      });

      const barberIds = Object.keys(barberMap);
      if (barberIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', barberIds);
        const result = barberIds.map(id => ({
          name: profiles?.find(p => p.user_id === id)?.full_name || 'Barbeiro',
          total: barberMap[id].total,
          count: barberMap[id].count,
        }));
        result.sort((a, b) => b.total - a.total);
        setByBarber(result);
      }
    }
  };

  const cards = [
    { label: 'Total Gasto', value: total, icon: DollarSign },
    { label: 'Esta Semana', value: weekTotal, icon: TrendingUp },
    { label: 'Este Mês', value: monthTotal, icon: Calendar },
  ];

  return (
    <ClientLayout>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        <h1 className="text-3xl font-bold font-display">Meus Gastos</h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {cards.map((c) => (
            <div key={c.label} className="glass-card p-5 animate-slide-up">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{c.label}</span>
                <c.icon className="w-5 h-5 text-primary" />
              </div>
              <p className="text-2xl font-bold font-display text-success">R$ {c.value.toFixed(2)}</p>
            </div>
          ))}
        </div>

        {byBarber.length > 0 && (
          <div className="glass-card p-6">
            <h2 className="text-xl font-semibold font-display mb-4">Gastos por Barbeiro</h2>
            <div className="space-y-3">
              {byBarber.map((b) => (
                <div key={b.name} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                  <div>
                    <p className="font-medium">{b.name}</p>
                    <p className="text-sm text-muted-foreground">{b.count} atendimento{b.count > 1 ? 's' : ''}</p>
                  </div>
                  <p className="font-bold text-success">R$ {b.total.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
