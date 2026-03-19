import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Navigate, useSearchParams } from 'react-router-dom';
import {
  CreditCard, CheckCircle, XCircle, ExternalLink, RefreshCw,
  Shield, Settings, Save, DollarSign, Plus, Lock, Unlock, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface BarberAdmin {
  user_id: string;
  full_name: string;
  email: string;
  roles: string[];
  is_frozen: boolean;
}

interface SubscriptionInfo {
  subscribed: boolean;
  subscription_id?: string;
  subscription_end?: string;
}

interface BillingSettings {
  id: string;
  billing_period: string;
  amount: number;
  updated_at: string;
}

export default function AdminBilling() {
  const { role, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const [barberAdmins, setBarberAdmins] = useState<BarberAdmin[]>([]);
  const [subscriptions, setSubscriptions] = useState<Record<string, SubscriptionInfo>>({});
  const [loadingData, setLoadingData] = useState(true);
  const [checkingEmail, setCheckingEmail] = useState<string | null>(null);
  const [creatingCheckout, setCreatingCheckout] = useState<string | null>(null);

  const [billingSettings, setBillingSettings] = useState<BillingSettings | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editPeriod, setEditPeriod] = useState('monthly');
  const [savingSettings, setSavingSettings] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);

  // Payment tracking
  const [paymentTotals, setPaymentTotals] = useState<Record<string, number>>({});
  const [totalReceived, setTotalReceived] = useState(0);
  const [lastActivatedPayments, setLastActivatedPayments] = useState<Record<string, string>>({});
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAdmin, setPaymentAdmin] = useState<BarberAdmin | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [savingPayment, setSavingPayment] = useState(false);
  const [freezingUser, setFreezingUser] = useState<string | null>(null);
  const [activatingUser, setActivatingUser] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Assinatura criada com sucesso!');
    }
    if (searchParams.get('canceled') === 'true') {
      toast.info('Checkout cancelado');
    }
  }, [searchParams]);

  useEffect(() => {
    fetchBarberAdmins();
    fetchBillingSettings();
    fetchPayments();
  }, []);

  const fetchBillingSettings = async () => {
    const { data, error } = await supabase
      .from('billing_settings')
      .select('*')
      .limit(1)
      .single();
    if (!error && data) {
      setBillingSettings(data as BillingSettings);
      setEditAmount(String(data.amount));
      setEditPeriod(data.billing_period);
    }
  };

  const fetchPayments = async () => {
    const [allRes, activatedRes] = await Promise.all([
      supabase.from('billing_payments').select('admin_user_id, amount'),
      supabase.from('billing_payments').select('admin_user_id, created_at, billing_period')
        .eq('subscription_activated', true)
        .order('created_at', { ascending: false }),
    ]);
    if (!allRes.error && allRes.data) {
      const totals: Record<string, number> = {};
      let total = 0;
      for (const p of allRes.data) {
        totals[p.admin_user_id] = (totals[p.admin_user_id] || 0) + Number(p.amount);
        total += Number(p.amount);
      }
      setPaymentTotals(totals);
      setTotalReceived(total);
    }
    if (!activatedRes.error && activatedRes.data) {
      const lastDates: Record<string, string> = {};
      for (const p of activatedRes.data) {
        if (!lastDates[p.admin_user_id]) {
          lastDates[p.admin_user_id] = p.created_at;
        }
      }
      setLastActivatedPayments(lastDates);
    }
  };

  const isSubscriptionActiveByDate = (userId: string): boolean => {
    const lastPaymentDate = lastActivatedPayments[userId];
    if (!lastPaymentDate) return false;
    const date = new Date(lastPaymentDate);
    const period = billingSettings?.billing_period || 'monthly';
    if (period === 'quarterly') {
      date.setMonth(date.getMonth() + 3);
    } else {
      date.setMonth(date.getMonth() + 1);
    }
    return date > new Date();
  };

  const saveBillingSettings = async () => {
    if (!billingSettings) return;
    const amount = parseFloat(editAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      toast.error('Insira um valor válido');
      return;
    }
    setSavingSettings(true);
    const { error } = await supabase
      .from('billing_settings')
      .update({
        amount,
        billing_period: editPeriod,
        updated_at: new Date().toISOString(),
      })
      .eq('id', billingSettings.id);
    if (error) {
      toast.error('Erro ao salvar configurações');
    } else {
      toast.success('Valor da cobrança atualizado!');
      setBillingSettings({ ...billingSettings, amount, billing_period: editPeriod });
      setEditingSettings(false);
    }
    setSavingSettings(false);
  };

  const fetchBarberAdmins = async () => {
    const { data, error } = await supabase.functions.invoke('admin-management', {
      body: { action: 'list_all_users' },
    });
    if (!error && data?.users) {
      const admins = data.users.filter((u: any) =>
        u.roles.some((r: string) => r === 'admin')
      );
      setBarberAdmins(admins);
      for (const admin of admins) {
        checkSubscription(admin.email, admin.user_id);
      }
    }
    setLoadingData(false);
  };

  const checkSubscription = async (email: string, userId: string) => {
    setCheckingEmail(userId);
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        body: { email },
      });
      if (!error && data) {
        setSubscriptions(prev => ({ ...prev, [userId]: data }));
      }
    } catch {
      // ignore
    }
    setCheckingEmail(null);
  };

  const handleCharge = async (email: string, userId: string, fullName: string) => {
    setCreatingCheckout(userId);
    const amount = billingSettings?.amount ?? 99.90;
    const period = billingSettings?.billing_period === 'quarterly' ? 'trimestral' : 'mensal';
    const formattedAmount = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    try {
      const { error } = await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Assinatura Pendente',
        message: `Sua assinatura ${period} de R$ ${formattedAmount} precisa ser paga. Entre em contato com o administrador ou acesse sua área para regularizar.`,
        type: 'billing',
      });
      if (error) {
        toast.error('Erro ao enviar cobrança');
      } else {
        toast.success(`Cobrança enviada para ${fullName || email}`);
      }
    } catch {
      toast.error('Erro ao enviar cobrança');
    }
    setCreatingCheckout(null);
  };

  const handleManageSubscription = async (email: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        body: { email, return_url: window.location.origin },
      });
      if (error) {
        // When function returns non-2xx, error.message or error.context may contain details
        const errorBody = typeof error === 'object' && error !== null && 'context' in error
          ? await (error as any).context?.json?.().catch(() => null)
          : null;
        const msg = errorBody?.error || data?.error || 'Este admin não possui conta Stripe. Use o sistema de pagamento interno.';
        toast.error(msg);
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch {
      toast.error('Este admin não possui conta Stripe. Use o sistema de pagamento interno.');
    }
  };

  const openPaymentDialog = (admin: BarberAdmin) => {
    setPaymentAdmin(admin);
    setPaymentAmount(billingSettings ? String(billingSettings.amount) : '99.90');
    setPaymentNotes('');
    setPaymentMethod('pix');
    setPaymentDialogOpen(true);
  };

  const handleFreezeToggle = async (admin: BarberAdmin) => {
    const action = admin.is_frozen ? 'unfreeze_account' : 'freeze_account';
    const label = admin.is_frozen ? 'descongelada' : 'congelada';
    setFreezingUser(admin.user_id);
    try {
      const { data, error } = await supabase.functions.invoke('admin-management', {
        body: { action, target_user_id: admin.user_id },
      });
      if (error || data?.error) {
        toast.error(data?.error || 'Erro ao alterar status da conta');
      } else {
        toast.success(`Conta ${label} com sucesso! ${data.affected_count} conta(s) afetada(s).`);
        setBarberAdmins(prev => prev.map(a =>
          a.user_id === admin.user_id ? { ...a, is_frozen: !admin.is_frozen } : a
        ));
      }
    } catch {
      toast.error('Erro ao alterar status da conta');
    }
    setFreezingUser(null);
  };

  const handleRecordPayment = async () => {
    if (!paymentAdmin) return;
    const amount = parseFloat(paymentAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      toast.error('Insira um valor válido');
      return;
    }
    setSavingPayment(true);
    const { error } = await supabase.from('billing_payments').insert({
      admin_user_id: paymentAdmin.user_id,
      amount,
      billing_period: billingSettings?.billing_period || 'monthly',
      notes: paymentNotes,
      payment_method: paymentMethod,
      subscription_activated: true,
    } as any);
    if (error) {
      toast.error('Erro ao registrar pagamento');
    } else {
      const now = new Date().toISOString();
      setLastActivatedPayments(prev => ({ ...prev, [paymentAdmin.user_id]: now }));
      setSubscriptions(prev => ({
        ...prev,
        [paymentAdmin.user_id]: { subscribed: true },
      }));
      toast.success(`Pagamento de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} registrado para ${paymentAdmin.full_name || paymentAdmin.email}. Assinatura ativada!`);
      setPaymentDialogOpen(false);
      fetchPayments();
    }
    setSavingPayment(false);
  };

  const handleActivateSubscription = async (admin: BarberAdmin) => {
    setActivatingUser(admin.user_id);
    try {
      const amount = billingSettings?.amount ?? 99.90;
      const { error } = await supabase.from('billing_payments').insert({
        admin_user_id: admin.user_id,
        amount,
        billing_period: billingSettings?.billing_period || 'monthly',
        notes: 'Assinatura ativada manualmente pelo Super Admin',
        payment_method: 'manual',
        subscription_activated: true,
      } as any);
      if (error) {
        toast.error('Erro ao ativar assinatura');
      } else {
        const now = new Date().toISOString();
        setLastActivatedPayments(prev => ({ ...prev, [admin.user_id]: now }));
        setSubscriptions(prev => ({
          ...prev,
          [admin.user_id]: { subscribed: true },
        }));
        toast.success(`Assinatura de ${admin.full_name || admin.email} ativada com sucesso!`);
        fetchPayments();
      }
    } catch {
      toast.error('Erro ao ativar assinatura');
    }
    setActivatingUser(null);
  };

  if (loading) return null;
  if (role !== 'super_admin') return <Navigate to="/" replace />;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const activeCount = barberAdmins.filter(a => isSubscriptionActiveByDate(a.user_id) || subscriptions[a.user_id]?.subscribed).length;
  const periodLabel = billingSettings?.billing_period === 'quarterly' ? 'trimestre' : 'mês';
  const formattedPlanAmount = billingSettings
    ? billingSettings.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '99,90';

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold font-display">Cobranças</h1>
          <p className="text-muted-foreground mt-1">Gerencie as assinaturas dos administradores barbeiros</p>
        </div>

        {/* Billing Settings Config */}
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm">Configuração de Cobrança</h2>
            </div>
            {!editingSettings && (
              <Button size="sm" variant="outline" onClick={() => setEditingSettings(true)}>
                Editar
              </Button>
            )}
          </div>

          {editingSettings ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
              <div className="space-y-1 flex-1 w-full">
                <label className="text-xs text-muted-foreground">Valor (R$)</label>
                <Input
                  type="text"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  placeholder="99.90"
                  className="max-w-[160px]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Período</label>
                <Select value={editPeriod} onValueChange={setEditPeriod}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveBillingSettings} disabled={savingSettings}>
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {savingSettings ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => {
                  setEditingSettings(false);
                  if (billingSettings) {
                    setEditAmount(String(billingSettings.amount));
                    setEditPeriod(billingSettings.billing_period);
                  }
                }}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Plano atual: <span className="font-medium text-foreground">R$ {formattedPlanAmount}/{periodLabel} por barbearia</span>
            </p>
          )}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass-card p-4 text-center">
            <CreditCard className="w-6 h-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{barberAdmins.length}</p>
            <p className="text-xs text-muted-foreground">Total Admins</p>
          </div>
          <div className="glass-card p-4 text-center">
            <CheckCircle className="w-6 h-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Assinaturas Ativas</p>
          </div>
          <div className="glass-card p-4 text-center">
            <XCircle className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{barberAdmins.length - activeCount}</p>
            <p className="text-xs text-muted-foreground">Sem Assinatura</p>
          </div>
          <div className="glass-card p-4 text-center">
            <DollarSign className="w-6 h-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{formatCurrency(totalReceived)}</p>
            <p className="text-xs text-muted-foreground">Total Recebido</p>
          </div>
        </div>

        {/* Refresh all */}
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => { fetchBarberAdmins(); fetchPayments(); }} disabled={loadingData}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Atualizar Status
          </Button>
        </div>

        {/* Barber Admins List */}
        {loadingData ? (
          <p className="text-muted-foreground text-center py-12">Carregando...</p>
        ) : barberAdmins.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <p className="text-muted-foreground">Nenhum admin barbeiro cadastrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {barberAdmins.map((admin) => {
              const sub = subscriptions[admin.user_id];
              const isActiveByDate = isSubscriptionActiveByDate(admin.user_id);
              const isActive = isActiveByDate || sub?.subscribed;
              const isChecking = checkingEmail === admin.user_id;
              const isCreating = creatingCheckout === admin.user_id;
              const adminPaid = paymentTotals[admin.user_id] || 0;
              const isFreezing = freezingUser === admin.user_id;

              return (
                <div key={admin.user_id} className="glass-card p-4 animate-slide-up">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-primary shrink-0" />
                        <p className="font-medium text-sm sm:text-base truncate">{admin.full_name || 'Sem nome'}</p>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{admin.email}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-[10px]">Admin Barbeiro</Badge>
                        <Badge variant="outline" className="text-[10px]">
                          R$ {formattedPlanAmount}/{periodLabel}
                        </Badge>
                        {isChecking ? (
                          <Badge variant="outline" className="text-[10px]">Verificando...</Badge>
                        ) : isActive ? (
                          <Badge variant="default" className="text-[10px] bg-green-500/20 text-green-500 border-green-500/30">
                            <CheckCircle className="w-3 h-3 mr-1" /> Ativo
                          </Badge>
                        ) : sub ? (
                          <Badge variant="destructive" className="text-[10px]">
                            <XCircle className="w-3 h-3 mr-1" /> Inativo
                          </Badge>
                        ) : null}
                        {admin.is_frozen && (
                          <Badge variant="destructive" className="text-[10px]">
                            <Lock className="w-3 h-3 mr-1" /> Congelada
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Total pago: <span className="font-semibold text-foreground">{formatCurrency(adminPaid)}</span>
                      </p>
                      {isActive && sub?.subscription_end && (
                        <p className="text-[11px] text-muted-foreground">
                          Próxima cobrança: {formatDate(sub.subscription_end)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openPaymentDialog(admin)}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        Registrar Pgto
                      </Button>
                      {isActive ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleManageSubscription(admin.email)}
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                          Gerenciar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleCharge(admin.email, admin.user_id, admin.full_name)}
                          disabled={isCreating}
                        >
                          <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                          {isCreating ? 'Enviando...' : 'Cobrar'}
                        </Button>
                      )}
                      {admin.is_frozen ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleFreezeToggle(admin)}
                          disabled={isFreezing}
                          className="border-primary/30 text-primary hover:bg-primary/10"
                        >
                          <Unlock className="w-3.5 h-3.5 mr-1.5" />
                          {isFreezing ? 'Processando...' : 'Descongelar'}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleFreezeToggle(admin)}
                          disabled={isFreezing}
                        >
                          <Lock className="w-3.5 h-3.5 mr-1.5" />
                          {isFreezing ? 'Processando...' : 'Congelar'}
                        </Button>
                      )}
                      {!isActive && !admin.is_frozen && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleActivateSubscription(admin)}
                          disabled={activatingUser === admin.user_id}
                          className="border-green-500/30 text-green-500 hover:bg-green-500/10"
                        >
                          <Zap className="w-3.5 h-3.5 mr-1.5" />
                          {activatingUser === admin.user_id ? 'Ativando...' : 'Ativar Assinatura'}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => checkSubscription(admin.email, admin.user_id)}
                        disabled={isChecking}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="glass-card p-4 text-center">
          <p className="text-xs text-muted-foreground">
            Plano: <span className="font-medium text-foreground">R$ {formattedPlanAmount}/{periodLabel} por barbearia</span> • Pagamentos processados via Stripe
          </p>
        </div>
      </div>

      {/* Record Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Registrar pagamento recebido de <span className="font-medium text-foreground">{paymentAdmin?.full_name || paymentAdmin?.email}</span>
            </p>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Valor (R$)</label>
              <Input
                type="text"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="99.90"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Método de Pagamento</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Observação (opcional)</label>
              <Input
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Pagamento referente a março..."
              />
            </div>
            <p className="text-xs text-primary font-medium">
              ✓ Ao confirmar, a assinatura será ativada automaticamente.
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleRecordPayment} disabled={savingPayment}>
              <DollarSign className="w-3.5 h-3.5 mr-1.5" />
              {savingPayment ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
