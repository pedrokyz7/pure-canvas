import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import logo from '@/assets/logo.jpg';
import categoryMasculino from '@/assets/category-masculino.jpg';
import categoryFeminino from '@/assets/category-feminino.jpg';
import { supabase } from '@/integrations/supabase/client';
import { ClientLayout } from '@/components/client/ClientLayout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Scissors, ArrowLeft, ArrowRight, Clock, DollarSign, Calendar, CheckCircle, User, Circle, Banknote, CreditCard, Sparkles } from 'lucide-react';
import { ServiceMediaCarousel } from '@/components/client/ServiceMediaCarousel';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Barber {
  user_id: string;
  full_name: string;
  is_available: boolean;
  avatar_url: string | null;
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  image_url: string | null;
  video_url: string | null;
  category: string;
}

type Step = 'barber' | 'category' | 'service' | 'datetime' | 'confirm' | 'success';

const STEPS: Step[] = ['barber', 'category', 'service', 'datetime', 'confirm'];

export default function ClientBooking() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('barber');
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'masculino' | 'feminino' | null>(null);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'local' | 'online' | null>(null);

  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + Number(s.price), 0);

  const toggleService = (service: Service) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.id === service.id);
      if (exists) return prev.filter(s => s.id !== service.id);
      return [...prev, service];
    });
  };

  useEffect(() => {
    fetchBarbers();
  }, []);

  useEffect(() => {
    if (selectedBarber) fetchServices();
  }, [selectedBarber]);

  useEffect(() => {
    if (selectedBarber && selectedServices.length > 0 && selectedDate) fetchSlots();
    else setSlots([]);
  }, [selectedBarber, selectedServices, selectedDate]);

  const fetchBarbers = async () => {
    const { data: roles } = await supabase.from('user_roles').select('user_id').in('role', ['barber', 'admin']);
    if (!roles?.length) return;
    const ids = roles.map(r => r.user_id);
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, is_available, avatar_url, is_frozen').in('user_id', ids);
    if (profiles) setBarbers(profiles.filter(p => !p.is_frozen).map(p => ({ ...p, is_available: (p as any).is_available ?? true })));
  };

  const fetchServices = async () => {
    if (!selectedBarber) return;
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('barber_id', selectedBarber.user_id)
      .eq('is_active', true)
      .order('name');
    if (data) setServices(data);
  };

  const fetchSlots = async () => {
    if (!selectedBarber || selectedServices.length === 0) return;
    const dayOfWeek = selectedDate.getDay();
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    const { data: schedule } = await supabase
      .from('barber_schedules')
      .select('*')
      .eq('barber_id', selectedBarber.user_id)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .single();

    if (!schedule) {
      setSlots([]);
      return;
    }

    const { data: existingApts } = await supabase
      .from('appointments')
      .select('start_time, end_time')
      .eq('barber_id', selectedBarber.user_id)
      .eq('appointment_date', dateStr)
      .neq('status', 'cancelled');

    const available: string[] = [];
    const startMinutes = timeToMinutes(schedule.start_time);
    const endMinutes = timeToMinutes(schedule.end_time);
    const duration = totalDuration;

    for (let m = startMinutes; m + duration <= endMinutes; m += 30) {
      const hasConflict = existingApts?.some(apt => {
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

  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const minutesToTime = (minutes: number) => {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const handleBook = async () => {
    if (!user || !selectedBarber || selectedServices.length === 0 || !selectedTime) return;
    setIsBooking(true);
    try {
      const endMinutes = timeToMinutes(selectedTime) + totalDuration;
      const endTime = minutesToTime(endMinutes);

      // Insert one appointment per selected service, chained in time
      let currentStart = selectedTime;
      for (const svc of selectedServices) {
        const svcEnd = minutesToTime(timeToMinutes(currentStart) + svc.duration_minutes);
        const { error } = await supabase.from('appointments').insert({
          client_id: user.id,
          barber_id: selectedBarber.user_id,
          service_id: svc.id,
          appointment_date: format(selectedDate, 'yyyy-MM-dd'),
          start_time: currentStart,
          end_time: svcEnd,
          price: svc.price,
          payment_method: paymentMethod || 'local',
        } as any);
        if (error) throw error;
        currentStart = svcEnd;
      }

      setStep('success');
    } catch (error: any) {
      toast.error('Erro ao agendar: ' + error.message);
    } finally {
      setIsBooking(false);
    }
  };

  const nextDays = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));

  return (
    <ClientLayout>
      <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
        {/* Progress - hide on success */}
        {step !== 'success' && (
        <div className="flex items-center gap-2 justify-center">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step === s ? 'bg-primary text-primary-foreground' :
                STEPS.indexOf(step) > i ? 'bg-success text-success-foreground' :
                'bg-secondary text-muted-foreground'
              }`}>
                {STEPS.indexOf(step) > i ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`w-6 h-0.5 ${STEPS.indexOf(step) > i ? 'bg-success' : 'bg-border'}`} />}
            </div>
          ))}
        </div>
        )}

        {/* Step: Select Barber */}
        {step === 'barber' && (
          <div className="space-y-4 animate-slide-up">
            <h2 className="text-2xl font-bold font-display text-center">Escolha o Barbeiro</h2>
            <p className="text-center text-sm text-muted-foreground">
              {barbers.length === 0 ? '0 barbeiros disponíveis' : `${barbers.length} barbeiro${barbers.length > 1 ? 's' : ''} disponíve${barbers.length > 1 ? 'is' : 'l'}`}
            </p>
            {barbers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum barbeiro cadastrado no momento</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {barbers.map((b) => (
                  <button
                    key={b.user_id}
                    onClick={() => { if (b.is_available) { setSelectedBarber(b); setStep('category'); } }}
                    disabled={!b.is_available}
                    className={`glass-card p-6 text-center transition-all animate-press relative ${
                      b.is_available ? 'hover:border-primary' : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="absolute top-2 right-2">
                      <Circle className={`w-3 h-3 ${b.is_available ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'}`} />
                    </div>
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 overflow-hidden">
                      {b.avatar_url ? (
                        <img src={b.avatar_url} alt={b.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <Scissors className="w-7 h-7 text-primary" />
                      )}
                    </div>
                    <p className="font-medium">{b.full_name || 'Barbeiro'}</p>
                    <p className={`text-xs mt-1 ${b.is_available ? 'text-green-500' : 'text-red-500'}`}>
                      {b.is_available ? 'Disponível' : 'Indisponível'}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step: Select Category */}
        {step === 'category' && (
          <div className="space-y-4 animate-slide-up">
            <button onClick={() => { setStep('barber'); setSelectedCategory(null); }} className="flex items-center text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </button>
            <h2 className="text-2xl font-bold font-display text-center">Tipo de Serviço</h2>
            <p className="text-center text-sm text-muted-foreground">Selecione a categoria</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => { setSelectedCategory('masculino'); setSelectedServices([]); setStep('service'); }}
                className="glass-card p-8 flex flex-col items-center gap-4 transition-all animate-press hover:border-primary group"
              >
                <div className="w-20 h-20 rounded-2xl overflow-hidden animate-float group-hover:animate-icon-glow transition-all">
                  <img src={categoryMasculino} alt="Masculino" className="w-full h-full object-cover" />
                </div>
                <p className="font-bold font-display text-lg">Masculino</p>
              </button>
              <button
                onClick={() => { setSelectedCategory('feminino'); setSelectedServices([]); setStep('service'); }}
                className="glass-card p-8 flex flex-col items-center gap-4 transition-all animate-press hover:border-primary group"
              >
                <div className="w-20 h-20 rounded-2xl overflow-hidden animate-float group-hover:animate-icon-glow transition-all" style={{ animationDelay: '0.4s' }}>
                  <img src={categoryFeminino} alt="Feminino" className="w-full h-full object-cover" />
                </div>
                <p className="font-bold font-display text-lg">Feminino</p>
              </button>
            </div>
          </div>
        )}

        {/* Step: Select Services (multi) */}
        {step === 'service' && (
          <div className="space-y-4 animate-slide-up">
            <button onClick={() => { setStep('category'); setSelectedServices([]); }} className="flex items-center text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </button>
            <h2 className="text-2xl font-bold font-display text-center flex items-center justify-center gap-2">
              <img src={selectedCategory === 'masculino' ? categoryMasculino : categoryFeminino} alt="" className="w-6 h-6 rounded-full object-cover" />
              Serviços {selectedCategory === 'masculino' ? 'Masculinos' : 'Femininos'}
            </h2>
            <p className="text-center text-sm text-muted-foreground">Selecione um ou mais serviços</p>
            <div className="grid grid-cols-2 gap-3">
              {services.filter(s => s.category === selectedCategory).map((s) => {
                const isSelected = selectedServices.some(ss => ss.id === s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleService(s)}
                    className={`glass-card overflow-hidden transition-all text-left flex flex-col ${
                      isSelected ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/50'
                    }`}
                  >
                    <ServiceMediaCarousel
                      imageUrl={s.image_url}
                      videoUrl={s.video_url}
                      serviceName={s.name}
                    />
                    {!s.image_url && !s.video_url && (
                      <div className="w-full aspect-[4/3] bg-muted/30 flex items-center justify-center">
                        <Scissors className="w-8 h-8 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="p-3 flex flex-col gap-1.5 flex-1">
                      <div className="flex items-start gap-2">
                        <Checkbox checked={isSelected} className="pointer-events-none mt-0.5 shrink-0" />
                        <p className="font-medium text-sm leading-tight">{s.name}</p>
                      </div>
                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {s.duration_minutes} min
                        </span>
                        <span className="font-bold text-xs text-success">R$ {Number(s.price).toFixed(2)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {services.filter(s => s.category === selectedCategory).length === 0 && (
              <p className="text-center text-muted-foreground py-8">Nenhum serviço disponível nesta categoria</p>
            )}

            {selectedServices.length > 0 && (
              <div className="space-y-3">
                <div className="glass-card p-3 flex justify-between text-sm">
                  <span className="text-muted-foreground">{selectedServices.length} serviço{selectedServices.length > 1 ? 's' : ''} • {totalDuration} min</span>
                  <span className="font-bold text-success">R$ {totalPrice.toFixed(2)}</span>
                </div>
                <Button
                  onClick={() => setStep('datetime')}
                  className="w-full h-12 rounded-xl text-base font-semibold animate-press"
                >
                  Continuar <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step: Select Date & Time */}
        {step === 'datetime' && (
          <div className="space-y-4 animate-slide-up">
            <button onClick={() => setStep('service')} className="flex items-center text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </button>
            <h2 className="text-2xl font-bold font-display text-center">Escolha a Data e Hora</h2>

            <div className="grid grid-cols-7 gap-1">
              {nextDays.map((day) => {
                const isSelected = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => { setSelectedDate(day); setSelectedTime(null); }}
                    className={`flex flex-col items-center py-1.5 rounded-xl transition-all animate-press ${
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-card border border-border hover:border-primary/50'
                    }`}
                  >
                    <span className="text-[10px] uppercase opacity-70">{format(day, 'EEE', { locale: ptBR }).slice(0, 3)}</span>
                    <span className="text-sm font-bold font-display">{format(day, 'd')}</span>
                  </button>
                );
              })}
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-3">Horários disponíveis</p>
              {slots.length === 0 ? (
                <p className="text-center text-muted-foreground py-6 glass-card">Nenhum horário disponível neste dia</p>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {slots.map((time) => (
                    <button
                      key={time}
                      onClick={() => setSelectedTime(time)}
                      className={`py-2 rounded-xl text-xs font-medium transition-all animate-press ${
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
            </div>

            {selectedTime && (
              <Button
                onClick={() => setStep('confirm')}
                className="w-full h-12 rounded-xl text-base font-semibold animate-press"
              >
                Continuar <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && selectedBarber && selectedServices.length > 0 && selectedTime && (
          <div className="space-y-6 animate-slide-up">
            <button onClick={() => setStep('datetime')} className="flex items-center text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </button>
            <h2 className="text-2xl font-bold font-display text-center">Confirmar Agendamento</h2>

            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Scissors className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Barbeiro</p>
                  <p className="font-medium">{selectedBarber.full_name}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Serviços</p>
                  {selectedServices.map(s => (
                    <p key={s.id} className="font-medium">
                      {s.name} <span className="text-muted-foreground text-sm">({s.duration_minutes} min - R$ {Number(s.price).toFixed(2)})</span>
                    </p>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Data e Hora</p>
                  <p className="font-medium">
                    {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })} às {selectedTime}
                  </p>
                  <p className="text-sm text-muted-foreground">Duração total: {totalDuration} min</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-success" />
                <div>
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="font-bold font-display text-lg text-success">R$ {totalPrice.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-center">Forma de Pagamento</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPaymentMethod('local')}
                  className={`glass-card p-4 flex flex-col items-center gap-2 transition-all animate-press ${
                    paymentMethod === 'local' ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/50'
                  }`}
                >
                  <Banknote className={`w-6 h-6 ${paymentMethod === 'local' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium">Pagar no local</span>
                  <span className="text-[10px] text-muted-foreground">Na hora do corte</span>
                </button>
                <button
                  disabled
                  className="glass-card p-4 flex flex-col items-center gap-2 opacity-50 cursor-not-allowed relative"
                >
                  <CreditCard className="w-6 h-6 text-muted-foreground" />
                  <span className="text-sm font-medium">Pagar online</span>
                  <span className="text-[10px] text-primary font-semibold animate-pulse">Em breve</span>
                </button>
              </div>
            </div>

            <Button
              onClick={handleBook}
              disabled={isBooking || !paymentMethod}
              className="w-full h-12 rounded-xl text-base font-semibold animate-press"
            >
              {isBooking ? 'Agendando...' : 'Confirmar Agendamento'}
              <CheckCircle className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && selectedBarber && (
          <div className="flex flex-col items-center justify-center py-8 animate-fade-in">
            {/* Logo with glow animation */}
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse scale-150" />
              <div className="relative w-24 h-24 rounded-full overflow-hidden ring-4 ring-primary/30 shadow-2xl animate-logo-pulse">
                <img src={logo} alt="BLACKOUT" className="w-full h-full object-cover" />
              </div>
            </div>

            {/* Success icon */}
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-success" />
            </div>

            {/* Text */}
            <h2 className="text-2xl font-bold font-display text-center mb-2">
              Agendamento Confirmado!
            </h2>
            <p className="text-muted-foreground text-center text-sm mb-1">
              Tudo pronto, estamos esperando por você.
            </p>
            <p className="text-center text-sm font-medium mb-6">
              {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })} às {selectedTime} com <span className="text-primary">{selectedBarber.full_name}</span>
            </p>

            {/* Services summary */}
            <div className="glass-card p-4 w-full max-w-xs mb-6 space-y-2">
              {selectedServices.map(s => (
                <div key={s.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{s.name}</span>
                  <span className="font-medium text-success">R$ {Number(s.price).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-border pt-2 flex justify-between font-bold text-sm">
                <span>Total</span>
                <span className="text-success">R$ {totalPrice.toFixed(2)}</span>
              </div>
            </div>

            {/* Brand */}
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground/50 font-display mb-6">
              BLACKOUT BARBER SHOP
            </p>

            <Button
              onClick={() => {
                setStep('barber');
                setSelectedBarber(null);
                setSelectedCategory(null);
                setSelectedServices([]);
                setSelectedTime(null);
                setPaymentMethod(null);
              }}
              className="w-full max-w-xs h-12 rounded-xl text-base font-semibold animate-press"
            >
              Novo Agendamento
            </Button>
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
