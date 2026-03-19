import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ClientLayout } from '@/components/client/ClientLayout';
import { Calendar, Clock, XCircle, Pencil, MapPin, Banknote, CreditCard } from 'lucide-react';
import { ServiceMediaCarousel } from '@/components/client/ServiceMediaCarousel';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { EditAppointmentModal } from '@/components/client/EditAppointmentModal';

interface AppointmentRecord {
  id: string;
  barber_id: string;
  service_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  price: number;
  created_at: string;
}

interface EnrichedAppointment extends AppointmentRecord {
  barber_name: string;
  service_name: string;
  service_image_url: string | null;
  service_video_url: string | null;
}

interface AppointmentGroup {
  ids: string[];
  barber_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  price: number;
  barber_name: string;
  service_names: string[];
  service_media: { image_url: string | null; video_url: string | null; name: string }[];
  payment_method: string;
}

const getAppointmentTimestamp = (appointment: { appointment_date: string; start_time: string }) =>
  new Date(`${appointment.appointment_date}T${appointment.start_time}`).getTime();

const compareAppointmentsAsc = (
  a: { appointment_date: string; start_time: string },
  b: { appointment_date: string; start_time: string }
) => getAppointmentTimestamp(a) - getAppointmentTimestamp(b);

const compareAppointmentsDesc = (
  a: { appointment_date: string; start_time: string },
  b: { appointment_date: string; start_time: string }
) => getAppointmentTimestamp(b) - getAppointmentTimestamp(a);

const isUpcomingAppointment = (appointment: { appointment_date: string; end_time: string; status: string }, now: Date) => {
  const appointmentEnd = new Date(`${appointment.appointment_date}T${appointment.end_time}`);
  return appointment.status !== 'cancelled' && appointment.status !== 'completed' && appointmentEnd >= now;
};

const isSameBookingGroup = (group: AppointmentGroup, appointment: EnrichedAppointment) =>
  group.appointment_date === appointment.appointment_date &&
  group.barber_id === appointment.barber_id &&
  group.status === appointment.status &&
  group.end_time === appointment.start_time;

export default function ClientAppointments() {
  const { user, loading } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentGroup[]>([]);
  const [filter, setFilter] = useState<'upcoming' | 'cancelled' | 'completed'>('upcoming');
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentGroup | null>(null);

  useEffect(() => {
    if (!loading) {
      void fetchAppointments();
    }
  }, [user, filter, loading]);

  const fetchAppointments = async () => {
    if (!user) {
      setAppointments([]);
      setIsLoadingAppointments(false);
      return;
    }

    setIsLoadingAppointments(true);

    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('client_id', user.id)
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(100);

    if (error) {
      toast.error('Erro ao carregar agendamentos');
      setAppointments([]);
      setIsLoadingAppointments(false);
      return;
    }

    const appointmentsData = (data || []) as AppointmentRecord[];

    if (appointmentsData.length === 0) {
      setAppointments([]);
      setIsLoadingAppointments(false);
      return;
    }

    const barberIds = [...new Set(appointmentsData.map((appointment) => appointment.barber_id))];
    const serviceIds = [...new Set(appointmentsData.map((appointment) => appointment.service_id))];

    const [profilesRes, servicesRes] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name').in('user_id', barberIds),
      supabase.from('services').select('id, name, image_url, video_url').in('id', serviceIds),
    ]);

    const profileMap = new Map((profilesRes.data || []).map((profile) => [profile.user_id, profile.full_name]));
    const serviceMap = new Map((servicesRes.data || []).map((service) => [service.id, { name: service.name, image_url: service.image_url, video_url: service.video_url }]));

    const enrichedAppointments: EnrichedAppointment[] = appointmentsData
      .map((appointment) => {
        const svc = serviceMap.get(appointment.service_id);
        return {
          ...appointment,
          barber_name: profileMap.get(appointment.barber_id) || 'Barbeiro',
          service_name: svc?.name || 'Serviço',
          service_image_url: svc?.image_url || null,
          service_video_url: svc?.video_url || null,
        };
      })
      .sort(compareAppointmentsAsc);

    const now = new Date();
    const appointmentsForSelectedTab = enrichedAppointments
      .filter((appointment) => {
        if (filter === 'upcoming') return isUpcomingAppointment(appointment, now);
        if (filter === 'cancelled') return appointment.status === 'cancelled';
        return appointment.status === 'completed';
      })
      .sort(filter === 'upcoming' ? compareAppointmentsAsc : compareAppointmentsDesc);

    const groupedAppointments = appointmentsForSelectedTab.reduce<AppointmentGroup[]>((groups, appointment) => {
      const lastGroup = groups[groups.length - 1];

      if (lastGroup && isSameBookingGroup(lastGroup, appointment)) {
        lastGroup.ids.push(appointment.id);
        lastGroup.service_names.push(appointment.service_name);
        lastGroup.service_media.push({ image_url: appointment.service_image_url, video_url: appointment.service_video_url, name: appointment.service_name });
        lastGroup.end_time = appointment.end_time;
        lastGroup.price += Number(appointment.price);
        return groups;
      }

      groups.push({
        ids: [appointment.id],
        barber_id: appointment.barber_id,
        appointment_date: appointment.appointment_date,
        start_time: appointment.start_time,
        end_time: appointment.end_time,
        status: appointment.status,
        price: Number(appointment.price),
        barber_name: appointment.barber_name,
        service_names: [appointment.service_name],
        service_media: [{ image_url: appointment.service_image_url, video_url: appointment.service_video_url, name: appointment.service_name }],
        payment_method: (appointment as any).payment_method || 'local',
      });

      return groups;
    }, []);

    setAppointments(groupedAppointments);
    setIsLoadingAppointments(false);
  };

  const cancelAppointment = async (ids: string[]) => {
    const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).in('id', ids);

    if (error) {
      toast.error('Erro ao cancelar');
      return;
    }

    toast.success(ids.length > 1 ? 'Agendamentos cancelados' : 'Agendamento cancelado');
    void fetchAppointments();
  };

  const markArrived = async (ids: string[]) => {
    const { error } = await supabase.from('appointments').update({ status: 'arrived' }).in('id', ids);
    if (error) {
      toast.error('Erro ao confirmar chegada');
      return;
    }
    toast.success('Chegada confirmada! O barbeiro foi notificado.');
    void fetchAppointments();
  };

  const undoArrival = async (ids: string[]) => {
    const { error } = await supabase.from('appointments').update({ status: 'scheduled' }).in('id', ids);
    if (error) {
      toast.error('Erro ao desfazer chegada');
      return;
    }
    toast.success('Status atualizado: a caminho');
    void fetchAppointments();
  };

  const statusLabel: Record<string, string> = {
    scheduled: 'Agendado',
    arrived: 'Chegou',
    completed: 'Concluído',
    cancelled: 'Cancelado',
  };

  const statusColor: Record<string, string> = {
    scheduled: 'text-primary',
    arrived: 'text-yellow-400',
    completed: 'text-success',
    cancelled: 'text-destructive',
  };

  return (
    <ClientLayout>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in px-4 sm:px-0">
        <h1 className="text-3xl font-bold font-display">Meus Agendamentos</h1>

        <div className="flex gap-2 justify-center sm:justify-start flex-wrap">
          <Button
            variant={filter === 'upcoming' ? 'default' : 'outline'}
            size="sm"
            className="rounded-xl text-xs px-3"
            onClick={() => setFilter('upcoming')}
          >
            Agendamentos
          </Button>
          <Button
            variant={filter === 'cancelled' ? 'default' : 'outline'}
            size="sm"
            className="rounded-xl text-xs px-3"
            onClick={() => setFilter('cancelled')}
          >
            Cancelados
          </Button>
          <Button
            variant={filter === 'completed' ? 'default' : 'outline'}
            size="sm"
            className="rounded-xl text-xs px-3"
            onClick={() => setFilter('completed')}
          >
            Concluídos
          </Button>
        </div>

        {isLoadingAppointments ? (
          <p className="text-center text-muted-foreground py-12 glass-card">Carregando agendamentos...</p>
        ) : appointments.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 glass-card">
            Nenhum agendamento {filter === 'upcoming' ? 'encontrado' : filter === 'cancelled' ? 'cancelado' : 'concluído'}
          </p>
        ) : (
          <div className="space-y-3">
            {appointments.map((appointment) => (
              <div key={appointment.ids.join('-')} className="glass-card p-4 animate-slide-up space-y-3">
                {appointment.service_media.some(m => m.image_url || m.video_url) && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {appointment.service_media.map((media, idx) => (
                      (media.image_url || media.video_url) && (
                        <div key={idx} className="rounded-xl overflow-hidden">
                          <ServiceMediaCarousel
                            imageUrl={media.image_url}
                            videoUrl={media.video_url}
                            serviceName={media.name}
                          />
                        </div>
                      )
                    ))}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <p className="font-medium break-words">{appointment.service_names.join(' • ')}</p>
                  <p className="text-sm text-muted-foreground">com {appointment.barber_name}</p>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(`${appointment.appointment_date}T00:00:00`), 'dd/MM/yyyy')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {appointment.start_time.slice(0, 5)} - {appointment.end_time.slice(0, 5)}
                    </span>
                  </div>
                </div>
                <div className="sm:text-right space-y-1 shrink-0">
                  <p className="font-bold text-success">R$ {Number(appointment.price).toFixed(2)}</p>
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium w-fit sm:ml-auto ${
                    appointment.payment_method === 'local'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-primary/20 text-primary'
                  }`}>
                    {appointment.payment_method === 'local' ? <Banknote className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                    {appointment.payment_method === 'local' ? 'Pagar no local' : 'Online'}
                  </span>
                  <p className={`text-xs font-medium ${statusColor[appointment.status] || ''}`}>
                    {statusLabel[appointment.status] || appointment.status}
                  </p>
                  {appointment.status === 'scheduled' && filter === 'upcoming' && (
                    <div className="flex flex-col sm:items-end gap-1 mt-1">
                      <Button
                        variant="default"
                        size="sm"
                        className="rounded-xl text-xs h-8 gap-1"
                        onClick={() => markArrived(appointment.ids)}
                      >
                        <MapPin className="w-3.5 h-3.5" /> Cheguei!
                      </Button>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-foreground text-xs h-7"
                          onClick={() => setEditingAppointment(appointment)}
                        >
                          <Pencil className="w-3 h-3 mr-1" /> Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive text-xs h-7"
                          onClick={() => cancelAppointment(appointment.ids)}
                        >
                          <XCircle className="w-3 h-3 mr-1" /> Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                  {appointment.status === 'arrived' && filter === 'upcoming' && (
                    <div className="flex flex-col sm:items-end gap-1 mt-1">
                      <p className="text-xs text-yellow-400 font-medium">✓ Aguardando atendimento</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 rounded-xl"
                        onClick={() => undoArrival(appointment.ids)}
                      >
                        Ainda estou a caminho
                      </Button>
                    </div>
                  )}
                </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {editingAppointment && user && (
          <EditAppointmentModal
            open={!!editingAppointment}
            onClose={() => setEditingAppointment(null)}
            appointmentIds={editingAppointment.ids}
            barberId={editingAppointment.barber_id}
            barberName={editingAppointment.barber_name}
            currentDate={editingAppointment.appointment_date}
            currentStartTime={editingAppointment.start_time}
            clientId={user.id}
            onSaved={() => fetchAppointments()}
          />
        )}
      </div>
    </ClientLayout>
  );
}
