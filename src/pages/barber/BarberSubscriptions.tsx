import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { BarberLayout } from '@/components/barber/BarberLayout';
import { Navigate } from 'react-router-dom';
import { CreditCard, CheckCircle, XCircle, Clock, CalendarDays, QrCode, Globe, Copy, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface PaymentRecord {
  id: string;
  amount: number;
  billing_period: string;
  payment_method: string;
  notes: string | null;
  created_at: string;
  subscription_activated: boolean;
}

interface BillingSettings {
  amount: number;
  billing_period: string;
}

export default function BarberSubscriptions() {
  const { role, loading, user } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [showPix, setShowPix] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [pixPaymentSent, setPixPaymentSent] = useState(false);
  const [sendingPixNotification, setSendingPixNotification] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    setLoadingData(true);
    const [paymentsRes, settingsRes] = await Promise.all([
      supabase
        .from('billing_payments')
        .select('*')
        .eq('admin_user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('billing_settings')
        .select('amount, billing_period')
        .limit(1)
        .maybeSingle(),
    ]);

    if (!paymentsRes.error && paymentsRes.data) {
      setPayments(paymentsRes.data as PaymentRecord[]);
    }
    if (!settingsRes.error && settingsRes.data) {
      setSettings(settingsRes.data as BillingSettings);
    }
    setLoadingData(false);
  };

  const lastPayment = payments.length > 0 ? payments[0] : null;
  const lastActivated = payments.find(p => p.subscription_activated);

  const getNextDueDate = () => {
    if (!lastActivated) return null;
    const date = new Date(lastActivated.created_at);
    if (settings?.billing_period === 'quarterly') {
      date.setMonth(date.getMonth() + 3);
    } else {
      date.setMonth(date.getMonth() + 1);
    }
    return date;
  };

  const nextDue = getNextDueDate();
  const isOverdue = nextDue ? nextDue < new Date() : true;

  const getDaysRemaining = () => {
    if (!nextDue) return null;
    const now = new Date();
    const diff = nextDue.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const daysRemaining = getDaysRemaining();

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  // Send notification when ≤3 days remaining
  useEffect(() => {
    if (daysRemaining === null || daysRemaining > 3 || daysRemaining < 0 || !user) return;

    const notifyKey = `sub_notified_${user.id}_${nextDue?.toISOString().slice(0, 10)}`;
    if (localStorage.getItem(notifyKey)) return;

    const sendExpiryNotifications = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user.id)
          .maybeSingle();

        const name = profile?.full_name || user.email;
        const msg = `A assinatura de ${name} vence em ${daysRemaining} dia(s). Realize o pagamento para evitar o congelamento da conta.`;

        await supabase.from('notifications').insert({
          user_id: user.id,
          title: 'Assinatura próxima do vencimento',
          message: msg,
          type: 'billing',
        });

        const { data: barberProfiles } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('admin_id', user.id);

        if (barberProfiles && barberProfiles.length > 0) {
          const inserts = barberProfiles.map((b) => ({
            user_id: b.user_id,
            title: 'Assinatura próxima do vencimento',
            message: `A assinatura da barbearia vence em ${daysRemaining} dia(s). Lembre o administrador de realizar o pagamento.`,
            type: 'billing' as const,
          }));
          await supabase.from('notifications').insert(inserts);
        }

        localStorage.setItem(notifyKey, 'true');
      } catch (e) {
        console.error('Error sending expiry notifications', e);
      }
    };

    sendExpiryNotifications();
  }, [daysRemaining, user]);

  if (loading) return null;
  if (role !== 'admin' && role !== 'barber') return <Navigate to="/" replace />;

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const periodLabel = settings?.billing_period === 'quarterly' ? 'trimestre' : 'mês';
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const isActive = !!lastActivated;

  const methodLabels: Record<string, string> = {
    pix: 'PIX',
    dinheiro: 'Dinheiro',
    transferencia: 'Transferência',
    cartao: 'Cartão',
    boleto: 'Boleto',
  };

  const PIX_KEY = '16484750602';

  const handlePixPaymentDone = async () => {
    setSendingPixNotification(true);
    try {
      // Notify super_admin about the payment
      const { data: superAdmins } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'super_admin');

      if (superAdmins && superAdmins.length > 0) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user!.id)
          .maybeSingle();

        const name = profile?.full_name || user!.email;
        const amount = settings ? formatCurrency(settings.amount) : '';

        for (const admin of superAdmins) {
          await supabase.from('notifications').insert({
            user_id: admin.user_id,
            title: 'Pagamento PIX informado',
            message: `${name} informou que realizou o pagamento PIX${amount ? ` de ${amount}` : ''}. Verifique e aprove.`,
            type: 'billing',
          });
        }
      }
      setPixPaymentSent(true);
      toast.success('Notificação enviada ao cobrador!');
    } catch {
      toast.error('Erro ao enviar notificação');
    } finally {
      setSendingPixNotification(false);
    }
  };

  const handlePayOnline = async () => {
    setLoadingCheckout(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { email: user!.email, return_url: window.location.origin },
      });
      if (error || data?.error) {
        toast.error(data?.error || 'Erro ao criar sessão de pagamento');
        return;
      }
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch {
      toast.error('Erro ao iniciar pagamento online');
    } finally {
      setLoadingCheckout(false);
    }
  };

  const handleCopyPix = () => {
    navigator.clipboard.writeText(PIX_KEY);
    toast.success('Chave PIX copiada!');
  };

  return (
    <BarberLayout>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in w-full min-w-0">
        <div>
          <h1 className="text-3xl font-bold font-display">Assinaturas</h1>
          <p className="text-muted-foreground mt-1">Acompanhe sua assinatura e histórico de pagamentos</p>
        </div>

        {loadingData ? (
          <p className="text-muted-foreground text-center py-12">Carregando...</p>
        ) : (
          <>
            {/* Current subscription status */}
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Assinatura Atual
                </h2>
                {isActive && !isOverdue ? (
                  <Badge variant="default" className="bg-green-500/20 text-green-500 border-green-500/30">
                    <CheckCircle className="w-3 h-3 mr-1" /> Ativa
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <XCircle className="w-3 h-3 mr-1" /> {isOverdue ? 'Vencida' : 'Inativa'}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Plano</p>
                  <p className="text-sm font-medium truncate">
                    {settings ? `${formatCurrency(settings.amount)}/${periodLabel}` : '—'}
                  </p>
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Total Pago</p>
                  <p className="text-sm font-medium truncate">{formatCurrency(totalPaid)}</p>
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Último Pagamento</p>
                  <p className="text-xs font-medium truncate">
                    {lastPayment ? `${formatDate(lastPayment.created_at)} — ${formatCurrency(Number(lastPayment.amount))}` : '—'}
                  </p>
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Próximo Vencimento</p>
                  <p className={`text-sm font-medium truncate ${isOverdue ? 'text-destructive' : ''}`}>
                    {nextDue ? formatDate(nextDue.toISOString()) : '—'}
                  </p>
                </div>
              </div>

              {/* Days remaining indicator */}
              {daysRemaining !== null && (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  daysRemaining <= 0
                    ? 'bg-destructive/10 text-destructive'
                    : daysRemaining <= 3
                      ? 'bg-yellow-500/10 text-yellow-500'
                      : 'bg-primary/10 text-primary'
                }`}>
                  <Clock className="w-4 h-4" />
                  {daysRemaining <= 0
                    ? `Assinatura vencida há ${Math.abs(daysRemaining)} dia(s)`
                    : `${daysRemaining} dia(s) restante(s) para o vencimento`}
                </div>
              )}
              {daysRemaining === null && !isActive && (
                <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium bg-destructive/10 text-destructive">
                  <XCircle className="w-4 h-4" />
                  Nenhuma assinatura ativa
                </div>
              )}
            </div>

            {/* Payment actions - show only when ≤3 days or overdue */}
            {(daysRemaining === null || daysRemaining <= 3) && (
            <div className="glass-card p-5 space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Pagar Assinatura
              </h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => setShowPix(!showPix)}
                >
                  <QrCode className="w-4 h-4" />
                  Pagar com PIX
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={handlePayOnline}
                  disabled={loadingCheckout}
                >
                  {loadingCheckout ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                  Pagar Online
                </Button>
              </div>

              {showPix && (
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 animate-fade-in">
                  {pixPaymentSent ? (
                    <div className="text-center space-y-3 py-2">
                      <Clock className="w-8 h-8 text-primary mx-auto" />
                      <p className="text-sm font-medium">Aguarde a aprovação do cobrador</p>
                      <p className="text-xs text-muted-foreground">Você será notificado quando o pagamento for confirmado.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => setPixPaymentSent(false)}
                      >
                        Efetuar Novo Pagamento
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium">Chave PIX (CPF) para pagamento:</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm bg-background rounded px-3 py-2 border border-border truncate">
                          {PIX_KEY}
                        </code>
                        <Button size="sm" variant="outline" onClick={handleCopyPix}>
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Destinatário: <span className="font-medium text-foreground">Pedro Henrique</span> · CPF: <span className="font-medium text-foreground">164.847.506-02</span> · Banco: <span className="font-medium text-foreground">Neon</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {settings
                          ? `Valor: ${formatCurrency(settings.amount)}`
                          : ''}
                      </p>
                      <Button
                        className="w-full gap-2"
                        variant="outline"
                        onClick={handlePixPaymentDone}
                        disabled={sendingPixNotification}
                      >
                        {sendingPixNotification ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Pagamento efetuado
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
            )}

            {/* Payment history */}
            <div className="space-y-3">
              <h2 className="font-semibold flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-primary" />
                Histórico de Pagamentos
              </h2>

              {payments.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <p className="text-muted-foreground">Nenhum pagamento registrado</p>
                </div>
              ) : (
                payments.map((payment) => (
                  <div key={payment.id} className="glass-card p-4 animate-slide-up overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{formatCurrency(Number(payment.amount))}</p>
                          <Badge variant="outline" className="text-[10px]">
                            {methodLabels[payment.payment_method] || payment.payment_method}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {payment.billing_period === 'quarterly' ? 'Trimestral' : 'Mensal'}
                          </Badge>
                        </div>
                        {payment.subscription_activated && (
                          <Badge variant="default" className="text-[10px] bg-primary/20 text-primary border-primary/30">
                            <CheckCircle className="w-3 h-3 mr-1" /> Ativou assinatura
                          </Badge>
                        )}
                        {payment.notes && (
                          <p className="text-xs text-muted-foreground truncate">{payment.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Clock className="w-3 h-3" />
                        {formatDate(payment.created_at)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </BarberLayout>
  );
}
