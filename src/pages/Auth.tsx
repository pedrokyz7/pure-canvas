import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Scissors, User, Mail, Lock, ArrowRight, Phone, Eye, EyeOff } from 'lucide-react';
import logo from '@/assets/logo.jpg';
import { toast } from 'sonner';

const EMAIL_DOMAINS = ['@gmail.com', '@hotmail.com', '@outlook.com', '@yahoo.com', '@icloud.com'];

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState<'barber' | 'client'>('client');
  const [loginRole, setLoginRole] = useState<'barber' | 'client'>('client');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const emailPrefix = email.split('@')[0];
  const emailSuggestions = emailPrefix && !email.includes('@')
    ? EMAIL_DOMAINS.map(d => emailPrefix + d)
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isLogin) {
        const { user: loggedUser } = await signIn(email, password);
        // Check role from user_roles table
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', loggedUser?.id ?? '')
          .maybeSingle();

        const actualRole = roleData?.role ?? (loggedUser?.user_metadata?.role as string | undefined) ?? null;

        const isBarberLike = actualRole === 'barber' || actualRole === 'admin';
        const isSuperAdmin = actualRole === 'super_admin';

        if (isSuperAdmin) {
          toast.success('Login realizado com sucesso!');
          window.location.href = '/admin';
          return;
        }

        if (loginRole === 'barber' && !isBarberLike) {
          await supabase.auth.signOut();
          toast.error('Esta conta não é de barbeiro');
          setIsLoading(false);
          return;
        }
        if (loginRole === 'client' && actualRole !== 'client') {
          await supabase.auth.signOut();
          toast.error('Esta conta não é de cliente');
          setIsLoading(false);
          return;
        }

        toast.success('Login realizado com sucesso!');
        if (isBarberLike) {
          window.location.href = '/barber';
        } else {
          window.location.href = '/client';
        }
        return;
      } else {
        const phoneDigits = phone.replace(/\D/g, '');
        if (phoneDigits.length < 10) {
          toast.error('Informe um telefone válido');
          setIsLoading(false);
          return;
        }
        await signUp(email, password, fullName, selectedRole, phone);
        // Sign out so user must login with their credentials
        await supabase.auth.signOut();
        toast.success('Conta criada com sucesso! Faça login para continuar.');
        setIsLogin(true);
        setPassword('');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao autenticar');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logo} alt="Logo" className="w-24 h-24 rounded-2xl mx-auto mb-4 object-cover animate-logo-pulse" />
          <h1 className="text-2xl font-bold font-display tracking-wide mb-2">BLACKOUT BARBER SHOP</h1>
          <p className="text-muted-foreground">
            {isLogin ? 'Faça login na sua conta' : 'Crie sua conta'}
          </p>
        </div>

        {/* Role Selection (login only) */}
        {isLogin && (
          <div className="flex gap-3 mb-6">
            <button
              type="button"
              onClick={() => setLoginRole('client')}
              className={`flex-1 p-4 rounded-2xl border transition-all animate-press ${
                loginRole === 'client'
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-muted-foreground/30'
              }`}
            >
              <User className={`w-6 h-6 mx-auto mb-2 ${loginRole === 'client' ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className={`text-sm font-medium ${loginRole === 'client' ? 'text-primary' : 'text-muted-foreground'}`}>
                Cliente
              </p>
            </button>
            <button
              type="button"
              onClick={() => setLoginRole('barber')}
              className={`flex-1 p-4 rounded-2xl border transition-all animate-press ${
                loginRole === 'barber'
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-muted-foreground/30'
              }`}
            >
              <Scissors className={`w-6 h-6 mx-auto mb-2 ${loginRole === 'barber' ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className={`text-sm font-medium ${loginRole === 'barber' ? 'text-primary' : 'text-muted-foreground'}`}>
                Barbeiro
              </p>
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Nome completo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="pl-10 h-12 bg-card border-border rounded-xl"
                required
              />
            </div>
          )}
          {!isLogin && (
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="(00) 00000-0000"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                className="pl-10 h-12 bg-card border-border rounded-xl"
                required
              />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={emailRef}
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setShowEmailSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowEmailSuggestions(false), 150)}
              onFocus={() => setShowEmailSuggestions(true)}
              className="pl-10 h-12 bg-card border-border rounded-xl"
              required
            />
            {showEmailSuggestions && emailSuggestions.length > 0 && (
              <div className="absolute z-10 top-full mt-1 w-full bg-card border border-border rounded-xl overflow-hidden shadow-lg">
                {emailSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors text-foreground"
                    onMouseDown={() => { setEmail(suggestion); setShowEmailSuggestions(false); }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10 h-12 bg-card border-border rounded-xl"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 rounded-xl text-base font-semibold animate-press"
          >
            {isLoading ? 'Carregando...' : isLogin ? 'Entrar' : 'Criar conta'}
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}{' '}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary font-medium hover:underline"
          >
            {isLogin ? 'Criar conta Cliente' : 'Fazer login'}
          </button>
        </p>
      </div>
    </div>
  );
}
