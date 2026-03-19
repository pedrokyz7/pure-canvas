import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { format, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DailyData {
  date: string;
  label: string;
  value: number;
}

interface EarningsChartsProps {
  barberId: string;
}

export function EarningsCharts({ barberId }: EarningsChartsProps) {
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [monthlyAccum, setMonthlyAccum] = useState<DailyData[]>([]);

  useEffect(() => {
    if (barberId) fetchChartData();
  }, [barberId]);

  const fetchChartData = async () => {
    const now = new Date();
    const mStart = startOfMonth(now);
    const mEnd = endOfMonth(now);
    const mStartStr = format(mStart, 'yyyy-MM-dd');
    const mEndStr = format(mEnd, 'yyyy-MM-dd');

    const { data } = await supabase
      .from('appointments')
      .select('price, appointment_date')
      .eq('barber_id', barberId)
      .gte('appointment_date', mStartStr)
      .lte('appointment_date', mEndStr)
      .eq('payment_status', 'paid');

    const days = eachDayOfInterval({ start: mStart, end: now });
    const dayMap: Record<string, number> = {};
    (data || []).forEach(a => {
      dayMap[a.appointment_date] = (dayMap[a.appointment_date] || 0) + Number(a.price);
    });

    const daily: DailyData[] = days.map(d => {
      const dateStr = format(d, 'yyyy-MM-dd');
      return {
        date: dateStr,
        label: format(d, 'dd', { locale: ptBR }),
        value: dayMap[dateStr] || 0,
      };
    });

    let accum = 0;
    const accumulated: DailyData[] = daily.map(d => {
      accum += d.value;
      return { ...d, value: accum };
    });

    setDailyData(daily);
    setMonthlyAccum(accumulated);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
          <p className="text-xs text-muted-foreground">Dia {label}</p>
          <p className="text-sm font-bold text-success">R$ {Number(payload[0].value).toFixed(2)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Daily earnings bar chart */}
      <div className="glass-card p-4 sm:p-6">
        <h3 className="text-base font-semibold font-display mb-4">Ganhos Diários</h3>
        {dailyData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={45} tickFormatter={(v) => `R$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Monthly accumulated area chart */}
      <div className="glass-card p-4 sm:p-6">
        <h3 className="text-base font-semibold font-display mb-4">Acumulado do Mês</h3>
        {monthlyAccum.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyAccum}>
              <defs>
                <linearGradient id="colorAccum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `R$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorAccum)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
