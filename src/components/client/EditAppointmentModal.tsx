import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Clock } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  image_url: string | null;
  video_url: string | null;
}

interface EditAppointmentModalProps {
  open: boolean;
  onClose: () => void;
  appointmentIds: string[];
  barberId: string;
  barberName: string;
  currentDate: string;
  currentStartTime: string;
  clientId: string;
  onSaved: () => void;
}

export function EditAppointmentModal({
  open,
  onClose,
  appointmentIds,
  barberId,
  barberName,
  currentDate,
  currentStartTime,
  clientId,
  onSaved,
}: EditAppointmentModalProps) {
  const [step, setStep] = useState<'services' | 'datetime'>('services');
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(currentDate + 'T00:00:00'));
  const [selectedTime, setSelectedTime] = useState<string | null>(currentStartTime.slice(0, 5));
  const [slots, setSlots] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [currentServiceIds, setCurrentServiceIds] = useState<string[]>([]);

  const totalDuration = selectedServices.reduce((s, svc) => s + svc.duration_minutes, 0);
  const totalPrice = selectedServices.reduce((s, svc) => s + Number(svc.price), 0);

  useEffect(() => {
    if (open) {
      setStep('services');
      setSelectedDate(new Date(currentDate + 'T00:00:00'));
      setSelectedTime(currentStartTime.slice(0, 5));
      fetchServices();
      fetchCurrentServices();
    }
  }, [open]);

  useEffect(() => {
    if (selectedServices.length > 0 && selectedDate) {
      fetchSlots();
    } else {
      setSlots([]);
    }
  }, [selectedServices, selectedDate]);

  const fetchServices = async () => {
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('barber_id', barberId)
      .eq('is_active', true)
      .order('name');
    if (data) setAllServices(data);
  };

  const fetchCurrentServices = async () => {
    const { data } = await supabase
      .from('appointments')
      .select('service_id')
      .in('id', appointmentIds);
    if (data) {
      const ids = data.map((d) => d.service_id);
      setCurrentServiceIds(ids);
    }
  };

  useEffect(() => {
    if (allServices.length > 0 && currentServiceIds.length > 0) {
      const selected = allServices.filter((s) => currentServiceIds.includes(s.id));
      setSelectedServices(selected);
    }
  }, [allServices, currentServiceIds]);

  const toggleService = (service: Service) => {
    setSelectedServices((prev) => {
      const exists = prev.find((s) => s.id === service.id);
      if (exists) return prev.filter((s) => s.id !== service.id);
      return [...prev, service];
    });
    setSelectedTime(null);
  };

  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const minutesToTime = (minutes: number) => {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const fetchSlots = async () => {
    const dayOfWeek = selectedDate.getDay();
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    const { data: schedule } = await supabase
      .from('barber_schedules')
      .select('*')
      .eq('barber_id', barberId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .single();

    if (!schedule) {
      setSlots([]);
      return;
    }

    const { data: existingApts } = await supabase
      .from('appointments')
      .select('id, start_time, end_time')
      .eq('barber_id', barberId)
      .eq('appointment_date', dateStr)
      .neq('status', 'cancelled');

    const otherApts = (existingApts || []).filter((a) => !appointmentIds.includes(a.id));

    const available: string[] = [];
    const startMinutes = timeToMinutes(schedule.start_time);
    const endMinutes = timeToMinutes(schedule.end_time);
    const duration = totalDuration;

    for (let m = startMinutes; m + duration <= endMinutes; m += 30) {
      const hasConflict = otherApts.some((apt) => {
        const aptStart = timeToMinutes(apt.start_time);
        const aptEnd = timeToMinutes(apt.end_time);
        return m < aptEnd && m + duration > aptStart;
      });

      if (!hasConflict) {
        if (dateStr === format(new Date(), 'yyyy-MM-dd')) {
          const now = new Date();
          const nowMinutes = now.getHours() * 60 + now.getMinutes();
          if (m <= nowMinutes) continue;
        }
        available.push(minutesToTime(m));
      }
    }

    setSlots(available);
  };

  const handleSave = async () => {
    if (selectedServices.length === 0 || !selectedTime) return;
    setIsSaving(true);

    try {
      // Cancel old appointments
      const { error: cancelError } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .in('id', appointmentIds);
      if (cancelError) throw cancelError;

      // Insert new appointments
      let currentStart = selectedTime;
      for (const svc of selectedServices) {
        const svcEnd = minutesToTime(timeToMinutes(currentStart) + svc.duration_minutes);
        const { error } = await supabase.from('appointments').insert({
          client_id: clientId,
          barber_id: barberId,
          service_id: svc.id,
          appointment_date: format(selectedDate, 'yyyy-MM-dd'),
          start_time: currentStart,
          end_time: svcEnd,
          price: svc.price,
        });
        if (error) throw error;
        currentStart = svcEnd;
      }

      toast.success('Agendamento atualizado!');
      onSaved();
      onClose();
    } catch (error: any) {
      toast.error('Erro ao atualizar: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const nextDays = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Editar Agendamento</DialogTitle>
          <p className="text-sm text-muted-foreground">com {barberName}</p>
        </DialogHeader>

        {step === 'services' && (
          <div className="space-y-4">
            <p className="text-sm font-medium">Selecione os serviços</p>
            <div className="space-y-2">
              {allServices.map((s) => {
                const isSelected = selectedServices.some((ss) => ss.id === s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleService(s)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox checked={isSelected} className="pointer-events-none" />
                      <div>
                        <p className="font-medium text-sm">{s.name}</p>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {s.duration_minutes} min
                        </span>
                      </div>
                    </div>
                    <span className="font-bold text-sm text-success">R$ {Number(s.price).toFixed(2)}</span>
                  </button>
                );
              })}
            </div>

            {selectedServices.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm p-2 rounded-lg bg-muted/50">
                  <span className="text-muted-foreground">
                    {selectedServices.length} serviço{selectedServices.length > 1 ? 's' : ''} • {totalDuration} min
                  </span>
                  <span className="font-bold text-success">R$ {totalPrice.toFixed(2)}</span>
                </div>
                <Button onClick={() => setStep('datetime')} className="w-full rounded-xl">
                  Escolher data e hora
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 'datetime' && (
          <div className="space-y-4">
            <button
              onClick={() => setStep('services')}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Voltar aos serviços
            </button>

            <p className="text-sm font-medium">Escolha a data</p>
            <div className="grid grid-cols-7 gap-1">
              {nextDays.slice(0, 14).map((day) => {
                const isSelected = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => {
                      setSelectedDate(day);
                      setSelectedTime(null);
                    }}
                    className={`flex flex-col items-center py-1.5 rounded-lg transition-all text-[10px] ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card border border-border hover:border-primary/50'
                    }`}
                  >
                    <span className="uppercase opacity-70">{format(day, 'EEE', { locale: ptBR }).slice(0, 3)}</span>
                    <span className="text-sm font-bold font-display">{format(day, 'd')}</span>
                  </button>
                );
              })}
            </div>

            <p className="text-sm font-medium">Horários disponíveis</p>
            {slots.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-4">Nenhum horário disponível</p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {slots.map((time) => (
                  <button
                    key={time}
                    onClick={() => setSelectedTime(time)}
                    className={`py-2 rounded-lg text-xs font-medium transition-all ${
                      selectedTime === time
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card border border-border hover:border-primary/50'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            )}

            {selectedTime && (
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full rounded-xl"
              >
                {isSaving ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
