import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { BarberLayout } from '@/components/barber/BarberLayout';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, XCircle, Clock, CalendarDays, MessageCircle, User, Banknote, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

interface Appointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  price: number;
  payment_status: string;
  payment_method: string;
  client_name: string;
  client_phone: string | null;
  client_avatar: string | null;
  service_name: string;
}

export default function BarberSchedule() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchAppointments();
      // Realtime subscription
      const channel = supabase
        .channel('barber-appointments')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `barber_id=eq.${user.id}` }, () => {
          fetchAppointments();
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [user]);

  const fetchAppointments = async () => {
    if (!user) return;
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');

    const { data: appts } = await supabase
      .from('appointments')
      .select('id, appointment_date, start_time, end_time, status, price, payment_status, payment_method, client_id, service_id')
      .eq('barber_id', user.id)
      .gte('appointment_date', today)
      .neq('status', 'cancelled')
      .order('appointment_date')
      .order('start_time');

    if (!appts || appts.length === 0) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    const clientIds = [...new Set(appts.map(a => a.client_id))];
    const serviceIds = [...new Set(appts.map(a => a.service_id))];

    const [{ data: profiles }, { data: services }] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, phone, avatar_url').in('user_id', clientIds),
      supabase.from('services').select('id, name').in('id', serviceIds),
    ]);

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, { name: p.full_name, phone: p.phone, avatar: p.avatar_url }]));
    const serviceMap = Object.fromEntries((services || []).map(s => [s.id, s.name]));

    setAppointments(appts.map(a => ({
      id: a.id,
      appointment_date: a.appointment_date,
      start_time: a.start_time,
      end_time: a.end_time,
      status: a.status,
      price: a.price,
      payment_status: a.payment_status,
      payment_method: (a as any).payment_method || 'local',
      client_name: profileMap[a.client_id]?.name || 'Cliente',
      client_phone: profileMap[a.client_id]?.phone || null,
      client_avatar: profileMap[a.client_id]?.avatar || null,
      service_name: serviceMap[a.service_id] || 'Serviço',
    })));
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('appointments').update({ status }).eq('id', id);
    toast.success(status === 'completed' ? 'Concluído!' : 'Cancelado!');
    fetchAppointments();
  };

  const statusColors: Record<string, string> = {
    scheduled: 'bg-primary/20 text-primary',
    arrived: 'bg-yellow-500/20 text-yellow-400',
    completed: 'bg-success/20 text-success',
    cancelled: 'bg-destructive/20 text-destructive',
  };

  const grouped = appointments.reduce<Record<string, Appointment[]>>((acc, apt) => {
    if (!acc[apt.appointment_date]) acc[apt.appointment_date] = [];
    acc[apt.appointment_date].push(apt);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort();

  return (
    <BarberLayout>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in overflow-x-hidden">
        <h1 className="text-3xl font-bold font-display">Clientes Agendados</h1>
        <p className="text-muted-foreground text-sm">Todos os agendamentos feitos pelos clientes aparecem aqui automaticamente.</p>

        {loading ? (
          <div className="glass-card p-8 text-center">
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">Nenhum agendamento próximo</p>
          </div>
        ) : (
          sortedDates.map((date) => (
            <div key={date} className="space-y-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                <h2 className="font-semibold font-display text-lg capitalize">
                  {format(new Date(date + 'T12:00:00'), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </h2>
                <span className="text-xs text-muted-foreground">({grouped[date].length})</span>
              </div>
              {grouped[date].map((apt) => (
                <div key={apt.id} className="glass-card p-3 sm:p-4 animate-slide-up space-y-3">
                  {/* Top row: time + avatar + client info */}
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className="text-center min-w-[44px] shrink-0">
                      <p className="font-bold font-display text-sm">{apt.start_time.slice(0, 5)}</p>
                      <p className="text-[10px] text-muted-foreground">{apt.end_time.slice(0, 5)}</p>
                    </div>
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-card border border-border shrink-0">
                      {apt.client_avatar ? (
                        <img src={apt.client_avatar} alt={apt.client_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{apt.client_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{apt.service_name}</p>
                      {apt.client_phone && (
                        <a
                          href={`https://wa.me/55${apt.client_phone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] sm:text-xs text-green-500 hover:text-green-400 transition-colors mt-0.5"
                        >
                          <MessageCircle className="w-3 h-3 shrink-0" />
                          <span className="truncate">(+55) {apt.client_phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}</span>
                        </a>
                      )}
                    </div>
                  </div>
                  {/* Bottom row: status + actions + price + payment */}
                  <div className="flex items-center gap-2 flex-wrap pl-[44px] sm:pl-0 sm:justify-end">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap ${statusColors[apt.status]}`}>
                      {apt.status === 'scheduled' ? 'Agendado' : apt.status === 'arrived' ? 'Chegou' : apt.status === 'completed' ? 'Concluído' : 'Cancelado'}
                    </span>
                    {(apt.status === 'scheduled' || apt.status === 'arrived') && (
                      <div className="flex gap-1">
                        <button onClick={() => updateStatus(apt.id, 'completed')} className="p-1 hover:bg-success/10 rounded-lg">
                          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
                        </button>
                        <button onClick={() => updateStatus(apt.id, 'cancelled')} className="p-1 hover:bg-destructive/10 rounded-lg">
                          <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
                        </button>
                      </div>
                    )}
                    <span className="font-semibold font-display text-sm whitespace-nowrap">R$ {Number(apt.price).toFixed(2)}</span>
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${
                      apt.payment_method === 'local' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-primary/20 text-primary'
                    }`}>
                      {apt.payment_method === 'local' ? <Banknote className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                      {apt.payment_method === 'local' ? 'No local' : 'Online'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </BarberLayout>
  );
}