import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { BarberLayout } from '@/components/barber/BarberLayout';
import { UserPlus, Trash2, Phone, Mail, Eye, EyeOff, ChevronDown, ChevronUp, Scissors, DollarSign, Users, CalendarClock, Pencil, Check, X, ArrowUpRight, ArrowDownRight, TrendingUp, Calendar } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface BarberInfo {
  user_id: string;
  full_name: string;
  phone: string;
  email: string;
  is_available: boolean;
  avatar_url: string;
}

interface ClientDetail {
  client_id: string;
  name: string;
  appointments: number;
  revenue: number;
}

interface UpcomingAppointment {
  appointment_date: string;
  start_time: string;
  client_name: string;
  service_name: string;
  price: number;
}

interface BarberEarnings {
  today: number;
  prevDay: number;
  week: number;
  prevWeek: number;
  month: number;
  prevMonth: number;
}

interface BarberStats {
  totalClients: number;
  totalAppointments: number;
  totalRevenue: number;
  earnings?: BarberEarnings;
  clients: ClientDetail[];
  upcoming: UpcomingAppointment[];
}

export default function BarberManageBarbers() {
  const { user, role } = useAuth();
  const [barbers, setBarbers] = useState<BarberInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', phone: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [expandedBarber, setExpandedBarber] = useState<string | null>(null);
  const [statsCache, setStatsCache] = useState<Record<string, BarberStats>>({});
  const [loadingStats, setLoadingStats] = useState<string | null>(null);
  const [editingBarber, setEditingBarber] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', password: '' });
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  interface BarberEarningsSummary {
    barber_id: string;
    barber_name: string;
    today: number;
    week: number;
    month: number;
    prevDay: number;
    prevWeek: number;
    prevMonth: number;
  }
  const [earningsSummary, setEarningsSummary] = useState<BarberEarningsSummary[]>([]);

  useEffect(() => {
    if (user) {
      fetchBarbers();
      fetchEarningsSummary();

      // Realtime subscription for appointments and profiles changes
      const channel = supabase
        .channel('barber-manage-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
          fetchEarningsSummary();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
          fetchBarbers();
          fetchEarningsSummary();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => {
          fetchBarbers();
          fetchEarningsSummary();
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [user]);

  const fetchEarningsSummary = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke('manage-barbers', {
        body: { action: 'earnings_summary' },
      });
      if (!error && data?.earnings) {
        setEarningsSummary(data.earnings);
      }
    } catch {
      // silent fail
    }
  };

  const fetchBarbers = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-barbers', {
        body: { action: 'list' },
      });
      if (error) {
        toast.error('Erro ao carregar barbeiros');
        return;
      }
      setBarbers(data?.barbers || []);
    } catch {
      toast.error('Erro ao carregar barbeiros');
    }
  };

  const fetchStats = async (barberId: string) => {
    if (statsCache[barberId]) return;
    setLoadingStats(barberId);
    try {
      const { data, error } = await supabase.functions.invoke('manage-barbers', {
        body: { action: 'stats', barber_user_id: barberId },
      });
      if (!error && data) {
        setStatsCache((prev) => ({ ...prev, [barberId]: data }));
      }
    } catch {
      toast.error('Erro ao carregar estatísticas');
    }
    setLoadingStats(null);
  };

  const toggleExpand = (barberId: string) => {
    if (expandedBarber === barberId) {
      setExpandedBarber(null);
    } else {
      setExpandedBarber(barberId);
      fetchStats(barberId);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.password) {
      toast.error('Preencha nome, email e senha');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('manage-barbers', {
      body: { action: 'create', ...form },
    });
    setLoading(false);
    if (error || data?.error) {
      toast.error(data?.error || 'Erro ao criar barbeiro');
      return;
    }
    toast.success('Barbeiro adicionado com sucesso!');
    setForm({ full_name: '', email: '', password: '', phone: '' });
    setShowForm(false);
    fetchBarbers();
    fetchEarningsSummary();
  };
  const handleEditSave = async (barberId: string) => {
    const { full_name, email, password } = editForm;
    if (!full_name.trim() && !email.trim() && !password.trim()) {
      toast.error('Preencha ao menos um campo');
      return;
    }
    setSavingEdit(true);
    const body: any = { action: 'update_credentials', barber_user_id: barberId };
    if (full_name.trim()) body.full_name = full_name.trim();
    if (email.trim()) body.email = email.trim();
    if (password.trim()) body.password = password.trim();

    const { data, error } = await supabase.functions.invoke('manage-barbers', { body });
    setSavingEdit(false);
    if (error || data?.error) {
      toast.error(data?.error || 'Erro ao atualizar');
      return;
    }
    toast.success('Dados atualizados!');
    setEditingBarber(null);
    setEditForm({ full_name: '', email: '', password: '' });
    fetchBarbers();
  };

  const handleToggleAvailability = async (barberId: string, newValue: boolean) => {
    const { data, error } = await supabase.functions.invoke('manage-barbers', {
      body: { action: 'toggle_availability', barber_user_id: barberId, is_available: newValue },
    });
    if (error || data?.error) {
      toast.error('Erro ao alterar disponibilidade');
      return;
    }
    toast.success(newValue ? 'Barbeiro disponível' : 'Barbeiro indisponível');
    setBarbers(prev => prev.map(b => b.user_id === barberId ? { ...b, is_available: newValue } : b));
  };

  const handleDelete = async (barberUserId: string, name: string) => {
    if (!confirm(`Tem certeza que deseja remover ${name}?`)) return;
    const { data, error } = await supabase.functions.invoke('manage-barbers', {
      body: { action: 'delete', barber_user_id: barberUserId },
    });
    if (error || data?.error) {
      toast.error(data?.error || 'Erro ao remover barbeiro');
      return;
    }
    toast.success('Barbeiro removido');
    fetchBarbers();
  };

  const formatPhone = (phone: string) => {
    const d = phone.replace(/\D/g, '');
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return phone;
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const calcPercent = (current: number, previous: number): number | null => {
    if (previous === 0 && current === 0) return null;
    if (previous === 0) return 100;
    return ((current - previous) / previous) * 100;
  };

  const PercentBadge = ({ current, previous }: { current: number; previous: number }) => {
    const pct = calcPercent(current, previous);
    if (pct === null) return <span className="text-[10px] text-muted-foreground">—</span>;
    const isUp = pct >= 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${isUp ? 'text-success' : 'text-destructive'}`}>
        {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {Math.abs(pct).toFixed(0)}%
      </span>
    );
  };

  return (
    <BarberLayout>
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in overflow-x-hidden">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-display">Barbeiros</h1>
            <p className="text-muted-foreground mt-1">{barbers.length} barbeiro{barbers.length !== 1 ? 's' : ''}</p>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="gap-2"
            variant={showForm ? 'secondary' : 'default'}
          >
            <UserPlus className="w-4 h-4" />
            {showForm ? 'Cancelar' : 'Adicionar'}
          </Button>
        </div>
        {showForm && (
          <form onSubmit={handleCreate} className="glass-card p-6 space-y-4 animate-slide-up">
            <h2 className="text-lg font-semibold font-display">Novo Barbeiro</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Nome completo *</label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Nome do barbeiro" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Telefone</label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Email *</label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="barbeiro@email.com" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Senha *</label>
                <div className="relative">
                  <Input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Senha de acesso" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? 'Criando...' : 'Criar Barbeiro'}
            </Button>
          </form>
        )}

        {barbers.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 glass-card">Nenhum barbeiro cadastrado</p>
        ) : (
          <div className="space-y-3">
            {barbers.map((b) => {
              const isExpanded = expandedBarber === b.user_id;
              const stats = statsCache[b.user_id];
              const isLoading = loadingStats === b.user_id;

              return (
                <div key={b.user_id} className="glass-card animate-slide-up overflow-hidden">
                  <div
                    className="p-3 sm:p-4 cursor-pointer hover:bg-accent/10 transition-colors"
                    onClick={() => toggleExpand(b.user_id)}
                  >
                    <div className="space-y-2">
                      <div className="min-w-0">
                        {editingBarber === b.user_id ? (
                          <div className="space-y-2 w-full" onClick={(e) => e.stopPropagation()}>
                            <Input
                              value={editForm.full_name}
                              onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                              placeholder="Novo nome"
                              className="h-8 text-sm"
                            />
                            <Input
                              type="email"
                              value={editForm.email}
                              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                              placeholder="Novo email"
                              className="h-8 text-sm"
                            />
                            <div className="relative">
                              <Input
                                type={showEditPassword ? 'text' : 'password'}
                                value={editForm.password}
                                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                                placeholder="Nova senha (deixe vazio para manter)"
                                className="h-8 text-sm pr-9"
                              />
                              <button type="button" onClick={() => setShowEditPassword(!showEditPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                {showEditPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleEditSave(b.user_id)} disabled={savingEdit} className="h-7 text-xs">
                                {savingEdit ? 'Salvando...' : 'Salvar'}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { setEditingBarber(null); setEditForm({ full_name: '', email: '', password: '' }); }} className="h-7 text-xs">
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="font-medium flex items-center gap-2 text-sm sm:text-base">
                              <span className="truncate">{b.full_name || 'Barbeiro'}</span>
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                            </p>
                            <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                              <Mail className="w-3 h-3 shrink-0" /> <span className="truncate">{b.email}</span>
                            </p>
                            {b.phone && (
                              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                                <Phone className="w-3 h-3 shrink-0" /> {formatPhone(b.phone)}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      {editingBarber !== b.user_id && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <div onClick={(e) => e.stopPropagation()}>
                            <Switch
                              checked={b.is_available}
                              onCheckedChange={(checked) => handleToggleAvailability(b.user_id, checked)}
                            />
                          </div>
                          {role === 'admin' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingBarber(b.user_id); setEditForm({ full_name: b.full_name, email: b.email, password: '' }); }}
                              className="p-1.5 rounded-lg hover:bg-accent/20 text-muted-foreground hover:text-foreground transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {role === 'admin' && b.user_id !== user?.id && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(b.user_id, b.full_name); }}
                              className="p-1.5 rounded-lg hover:bg-destructive/20 text-destructive transition-colors"
                              title="Remover barbeiro"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Inline earnings */}
                    {(() => {
                      const earning = earningsSummary.find(e => e.barber_id === b.user_id);
                      if (!earning) return null;
                      return (
                        <div className="border-t border-border/30 px-3 sm:px-4 py-3">
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <p className="text-[10px] text-muted-foreground">Hoje</p>
                              <p className="text-xs font-bold text-success">R$ {earning.today.toFixed(2)}</p>
                              <PercentBadge current={earning.today} previous={earning.prevDay} />
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Semana</p>
                              <p className="text-xs font-bold">R$ {earning.week.toFixed(2)}</p>
                              <PercentBadge current={earning.week} previous={earning.prevWeek} />
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Mês</p>
                              <p className="text-xs font-bold">R$ {earning.month.toFixed(2)}</p>
                              <PercentBadge current={earning.month} previous={earning.prevMonth} />
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border/50 p-4 space-y-4 animate-fade-in">
                      {isLoading ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Carregando estatísticas...</p>
                      ) : stats ? (
                        <>
                          {/* Earnings by period */}
                          {stats.earnings && (
                            <div>
                              <h3 className="text-sm font-semibold mb-2 text-muted-foreground flex items-center gap-1">
                                <TrendingUp className="w-4 h-4" /> Ganhos por Período
                              </h3>
                              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                <div className="bg-success/10 rounded-xl p-2 sm:p-3 text-center">
                                  <DollarSign className="w-4 h-4 mx-auto mb-1 text-success" />
                                  <p className="text-sm sm:text-lg font-bold text-success">{formatCurrency(stats.earnings.today)}</p>
                                  <p className="text-[10px] sm:text-xs text-muted-foreground">Hoje</p>
                                  <PercentBadge current={stats.earnings.today} previous={stats.earnings.prevDay} />
                                </div>
                                <div className="bg-primary/10 rounded-xl p-2 sm:p-3 text-center">
                                  <TrendingUp className="w-4 h-4 mx-auto mb-1 text-primary" />
                                  <p className="text-sm sm:text-lg font-bold">{formatCurrency(stats.earnings.week)}</p>
                                  <p className="text-[10px] sm:text-xs text-muted-foreground">Semana</p>
                                  <PercentBadge current={stats.earnings.week} previous={stats.earnings.prevWeek} />
                                </div>
                                <div className="bg-primary/10 rounded-xl p-2 sm:p-3 text-center">
                                  <Calendar className="w-4 h-4 mx-auto mb-1 text-primary" />
                                  <p className="text-sm sm:text-lg font-bold">{formatCurrency(stats.earnings.month)}</p>
                                  <p className="text-[10px] sm:text-xs text-muted-foreground">Mês</p>
                                  <PercentBadge current={stats.earnings.month} previous={stats.earnings.prevMonth} />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* General stats */}
                          <div className="grid grid-cols-3 gap-2 sm:gap-3">
                            <div className="bg-accent/10 rounded-xl p-2 sm:p-3 text-center">
                              <Users className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1 text-primary" />
                              <p className="text-lg sm:text-2xl font-bold">{stats.totalClients}</p>
                              <p className="text-[10px] sm:text-xs text-muted-foreground">Clientes</p>
                            </div>
                            <div className="bg-accent/10 rounded-xl p-2 sm:p-3 text-center">
                              <Scissors className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1 text-primary" />
                              <p className="text-lg sm:text-2xl font-bold">{stats.totalAppointments}</p>
                              <p className="text-[10px] sm:text-xs text-muted-foreground">Atendimentos</p>
                            </div>
                            <div className="bg-accent/10 rounded-xl p-2 sm:p-3 text-center">
                              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1 text-primary" />
                              <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(stats.totalRevenue)}</p>
                              <p className="text-[10px] sm:text-xs text-muted-foreground">Faturamento Total</p>
                            </div>
                          </div>

                          {stats.clients.length > 0 ? (
                            <div>
                              <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Detalhes por cliente</h3>
                              <div className="space-y-2">
                                {stats.clients.map((c) => (
                                  <div key={c.client_id} className="flex items-center justify-between bg-accent/5 rounded-lg px-3 py-2">
                                    <div>
                                      <p className="text-sm font-medium">{c.name}</p>
                                      <p className="text-xs text-muted-foreground">{c.appointments} atendimento{c.appointments !== 1 ? 's' : ''}</p>
                                    </div>
                                    <p className="text-sm font-semibold text-primary">{formatCurrency(c.revenue)}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center">Nenhum atendimento registrado</p>
                          )}

                          {stats.upcoming && stats.upcoming.length > 0 && (
                            <div>
                              <h3 className="text-sm font-semibold mb-2 text-muted-foreground flex items-center gap-1">
                                <CalendarClock className="w-4 h-4" /> Próximos agendamentos
                              </h3>
                              <div className="space-y-2">
                                {stats.upcoming.map((u, i) => (
                                  <div key={i} className="flex items-center justify-between bg-primary/5 rounded-lg px-3 py-2">
                                    <div>
                                      <p className="text-sm font-medium">{u.client_name}</p>
                                      <p className="text-xs text-muted-foreground">{u.service_name}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-semibold">{new Date(u.appointment_date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                                      <p className="text-xs text-muted-foreground">{u.start_time.slice(0, 5)} • {formatCurrency(u.price)}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BarberLayout>
  );
}
