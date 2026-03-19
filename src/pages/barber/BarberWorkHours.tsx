import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { BarberLayout } from '@/components/barber/BarberLayout';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

interface Schedule {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export default function BarberWorkHours() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>(
    DAYS.map((_, i) => ({ day_of_week: i, start_time: '09:00', end_time: '18:00', is_active: i >= 1 && i <= 6 }))
  );

  useEffect(() => {
    if (user) fetchSchedules();
  }, [user]);

  const fetchSchedules = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('barber_schedules')
      .select('*')
      .eq('barber_id', user.id);
    if (data && data.length > 0) {
      setSchedules(prev => prev.map(s => {
        const found = data.find(d => d.day_of_week === s.day_of_week);
        return found ? { ...found, start_time: found.start_time.slice(0, 5), end_time: found.end_time.slice(0, 5) } : s;
      }));
    }
  };

  const handleSave = async (schedule: Schedule) => {
    if (!user) return;
    try {
      if (schedule.id) {
        await supabase.from('barber_schedules').update({
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          is_active: schedule.is_active,
        }).eq('id', schedule.id);
      } else {
        const { data } = await supabase.from('barber_schedules').insert({
          barber_id: user.id,
          day_of_week: schedule.day_of_week,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          is_active: schedule.is_active,
        }).select().single();
        if (data) {
          setSchedules(prev => prev.map(s =>
            s.day_of_week === schedule.day_of_week ? { ...data, start_time: data.start_time.slice(0, 5), end_time: data.end_time.slice(0, 5) } : s
          ));
        }
      }
      toast.success(`Horário de ${DAYS[schedule.day_of_week]} salvo!`);
    } catch {
      toast.error('Erro ao salvar horário');
    }
  };

  const updateSchedule = (dayIndex: number, field: keyof Schedule, value: any) => {
    setSchedules(prev => prev.map(s =>
      s.day_of_week === dayIndex ? { ...s, [field]: value } : s
    ));
  };

  return (
    <BarberLayout>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in overflow-x-hidden">
        <h1 className="text-3xl font-bold font-display">Horários de Trabalho</h1>
        <p className="text-muted-foreground">Configure seus dias e horários de atendimento</p>

        <div className="space-y-3">
          {schedules.map((s) => (
            <div key={s.day_of_week} className="glass-card p-3 sm:p-4 animate-slide-up">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={s.is_active}
                    onCheckedChange={(checked) => {
                      updateSchedule(s.day_of_week, 'is_active', checked);
                      handleSave({ ...s, is_active: checked });
                    }}
                  />
                  <span className={`font-medium text-sm sm:text-base w-20 sm:w-24 ${!s.is_active ? 'text-muted-foreground' : ''}`}>
                    {DAYS[s.day_of_week]}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Input
                    type="time"
                    value={s.start_time}
                    onChange={(e) => updateSchedule(s.day_of_week, 'start_time', e.target.value)}
                    onBlur={() => handleSave(s)}
                    disabled={!s.is_active}
                    className="bg-secondary border-border rounded-xl h-9 sm:h-10 flex-1 min-w-0 px-2"
                  />
                  <span className="text-muted-foreground text-xs sm:text-sm shrink-0">até</span>
                  <Input
                    type="time"
                    value={s.end_time}
                    onChange={(e) => updateSchedule(s.day_of_week, 'end_time', e.target.value)}
                    onBlur={() => handleSave(s)}
                    disabled={!s.is_active}
                    className="bg-secondary border-border rounded-xl h-9 sm:h-10 flex-1 min-w-0 px-2"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </BarberLayout>
  );
}
