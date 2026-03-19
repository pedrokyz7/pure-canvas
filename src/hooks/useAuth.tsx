import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type UserRole = 'barber' | 'client' | 'admin' | 'super_admin' | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole;
  loading: boolean;
  isFrozen: boolean;
  signUp: (email: string, password: string, fullName: string, role: 'barber' | 'client', phone?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ user: User | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [isFrozen, setIsFrozen] = useState(false);

  const clearAuthState = () => {
    setUser(null);
    setSession(null);
    setRole(null);
    setIsFrozen(false);
  };

  const fetchRole = async (userId: string, fallbackRole?: UserRole): Promise<UserRole> => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar papel do usuário:', error);
      const resolvedFallback = fallbackRole ?? null;
      setRole(resolvedFallback);
      return resolvedFallback;
    }

    const resolvedRole = (data?.role as UserRole) ?? fallbackRole ?? null;

    if (!data?.role && fallbackRole) {
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: fallbackRole });

      if (insertError) {
        console.error('Erro ao recuperar papel do usuário:', insertError);
      }
    }

    setRole(resolvedRole);
    return resolvedRole;
  };

  const hydrateAuthState = async (currentSession: Session | null) => {
    setSession(currentSession);

    if (!currentSession?.user) {
      clearAuthState();
      setLoading(false);
      return;
    }

    setUser(currentSession.user);

    await fetchRole(
      currentSession.user.id,
      (currentSession.user.user_metadata?.role as UserRole) ?? null,
    );

    // Check frozen status - own profile OR admin's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_frozen, admin_id')
      .eq('user_id', currentSession.user.id)
      .maybeSingle();

    let frozen = profile?.is_frozen ?? false;

    // If not directly frozen but has an admin, check if admin is frozen
    if (!frozen && profile?.admin_id) {
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('is_frozen')
        .eq('user_id', profile.admin_id)
        .maybeSingle();
      frozen = adminProfile?.is_frozen ?? false;
    }

    setIsFrozen(frozen);

    setLoading(false);
  };

  useEffect(() => {
    let isMounted = true;

    const safelyHydrateAuthState = async (currentSession: Session | null) => {
      if (!isMounted) return;
      await hydrateAuthState(currentSession);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      window.setTimeout(() => {
        void safelyHydrateAuthState(currentSession);
      }, 0);
    });

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      void safelyHydrateAuthState(currentSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string, userRole: 'barber' | 'client', phone?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: userRole,
          phone: phone?.replace(/\D/g, '') || null,
        },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
    if (data.user) {
      await supabase.from('user_roles').insert({ user_id: data.user.id, role: userRole });
      if (phone) {
        await supabase.from('profiles').update({ phone: phone.replace(/\D/g, '') }).eq('user_id', data.user.id);
      }
      setRole(userRole);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { user: data.user };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Erro ao sair:', err);
    }
    clearAuthState();
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, isFrozen, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
