import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Navigate } from 'react-router-dom';
import { Trash2, Mail, Phone, Pencil, Eye, EyeOff, Shield, Scissors, User, Lock, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface UserInfo {
  user_id: string;
  full_name: string;
  phone: string;
  email: string;
  is_available: boolean;
  avatar_url: string;
  roles: string[];
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin Barbeiro',
  barber: 'Barbeiro',
  client: 'Cliente',
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'A senha deve ter pelo menos 8 caracteres';
  if (!/[A-Z]/.test(pw)) return 'A senha deve conter ao menos uma letra maiúscula';
  if (!/[a-z]/.test(pw)) return 'A senha deve conter ao menos uma letra minúscula';
  if (!/[0-9]/.test(pw)) return 'A senha deve conter ao menos um número';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'A senha deve conter ao menos um caractere especial';
  return null;
}

export default function AdminUsers() {
  const { role, loading, user } = useAuth();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', password: '' });
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editErrors, setEditErrors] = useState<{ email?: string; password?: string }>({});

  // Super Admin self-edit
  const [selfEdit, setSelfEdit] = useState(false);
  const [selfForm, setSelfForm] = useState({ email: '', password: '', confirmPassword: '' });
  const [showSelfPassword, setShowSelfPassword] = useState(false);
  const [savingSelf, setSavingSelf] = useState(false);
  const [selfErrors, setSelfErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase.functions.invoke('admin-management', {
      body: { action: 'list_all_users' },
    });
    if (!error && data) setUsers(data.users || []);
    setLoadingUsers(false);
  };

  const handleDelete = async (targetId: string, name: string) => {
    if (!confirm(`Tem certeza que deseja remover ${name}? Todos os dados serão excluídos.`)) return;
    const { data, error } = await supabase.functions.invoke('admin-management', {
      body: { action: 'delete_user', target_user_id: targetId },
    });
    if (error || data?.error) {
      toast.error(data?.error || 'Erro ao remover usuário');
      return;
    }
    toast.success('Usuário removido');
    fetchUsers();
  };

  const validateEditForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    if (editForm.email.trim() && !emailRegex.test(editForm.email.trim())) {
      errors.email = 'Email inválido';
    }
    if (editForm.password.trim()) {
      const pwErr = validatePassword(editForm.password.trim());
      if (pwErr) errors.password = pwErr;
    }
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEditSave = async (targetId: string) => {
    const { full_name, email, password } = editForm;
    if (!full_name.trim() && !email.trim() && !password.trim()) {
      toast.error('Preencha ao menos um campo');
      return;
    }
    if (!validateEditForm()) return;

    setSavingEdit(true);
    const body: any = { action: 'update_user', target_user_id: targetId };
    if (full_name.trim()) body.full_name = full_name.trim();
    if (email.trim()) body.email = email.trim();
    if (password.trim()) body.password = password.trim();

    const { data, error } = await supabase.functions.invoke('admin-management', { body });
    setSavingEdit(false);
    if (error || data?.error) {
      toast.error(data?.error || 'Erro ao atualizar');
      return;
    }
    toast.success('Usuário atualizado com sucesso!');
    setEditingUser(null);
    setEditForm({ full_name: '', email: '', password: '' });
    setEditErrors({});
    fetchUsers();
  };

  const validateSelfForm = (): boolean => {
    const errors: { email?: string; password?: string; confirmPassword?: string } = {};
    if (selfForm.email.trim() && !emailRegex.test(selfForm.email.trim())) {
      errors.email = 'Email inválido';
    }
    if (selfForm.password.trim()) {
      const pwErr = validatePassword(selfForm.password.trim());
      if (pwErr) errors.password = pwErr;
      if (selfForm.password !== selfForm.confirmPassword) {
        errors.confirmPassword = 'As senhas não coincidem';
      }
    }
    if (!selfForm.email.trim() && !selfForm.password.trim()) {
      errors.email = 'Preencha ao menos um campo';
    }
    setSelfErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSelfSave = async () => {
    if (!validateSelfForm()) return;
    if (!confirm('Tem certeza que deseja alterar suas credenciais de Super Admin?')) return;

    setSavingSelf(true);
    const body: any = { action: 'update_user', target_user_id: user?.id };
    if (selfForm.email.trim()) body.email = selfForm.email.trim();
    if (selfForm.password.trim()) body.password = selfForm.password.trim();

    const { data, error } = await supabase.functions.invoke('admin-management', { body });
    setSavingSelf(false);
    if (error || data?.error) {
      toast.error(data?.error || 'Erro ao atualizar credenciais');
      return;
    }
    toast.success('Credenciais do Super Admin atualizadas com sucesso!');
    setSelfEdit(false);
    setSelfForm({ email: '', password: '', confirmPassword: '' });
    setSelfErrors({});
    fetchUsers();
  };

  if (loading) return null;
  if (role !== 'super_admin') return <Navigate to="/" replace />;

  const filteredUsers = filter === 'all'
    ? users
    : users.filter(u => u.roles.includes(filter));

  const formatPhone = (phone: string) => {
    const d = phone.replace(/\D/g, '');
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return phone;
  };

  const superAdminUser = users.find(u => u.roles.includes('super_admin'));

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold font-display">Usuários</h1>
          <p className="text-muted-foreground mt-1">{users.length} usuário{users.length !== 1 ? 's' : ''} cadastrados</p>
        </div>

        {/* Super Admin Self-Edit Card */}
        {superAdminUser && (
          <div className="glass-card p-5 border border-primary/20 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold font-display">Conta Super Admin</h2>
              </div>
              {!selfEdit && (
                <Button size="sm" variant="outline" onClick={() => { setSelfEdit(true); setSelfForm({ email: superAdminUser.email, password: '', confirmPassword: '' }); }}>
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Editar Credenciais
                </Button>
              )}
            </div>

            {!selfEdit ? (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> {superAdminUser.email}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> ••••••••
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs text-destructive/80">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Alterações nas credenciais exigem novo login</span>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Novo Email</Label>
                  <Input
                    type="email"
                    value={selfForm.email}
                    onChange={(e) => { setSelfForm({ ...selfForm, email: e.target.value }); setSelfErrors(prev => ({ ...prev, email: undefined })); }}
                    placeholder="novo@email.com"
                    className="h-9 text-sm"
                  />
                  {selfErrors.email && <p className="text-xs text-destructive">{selfErrors.email}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Nova Senha</Label>
                  <div className="relative">
                    <Input
                      type={showSelfPassword ? 'text' : 'password'}
                      value={selfForm.password}
                      onChange={(e) => { setSelfForm({ ...selfForm, password: e.target.value }); setSelfErrors(prev => ({ ...prev, password: undefined })); }}
                      placeholder="Mínimo 8 caracteres"
                      className="h-9 text-sm pr-9"
                    />
                    <button type="button" onClick={() => setShowSelfPassword(!showSelfPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showSelfPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {selfErrors.password && <p className="text-xs text-destructive">{selfErrors.password}</p>}
                  {selfForm.password && !selfErrors.password && (
                    <p className="text-xs text-primary">Senha válida ✓</p>
                  )}
                </div>

                {selfForm.password && (
                  <div className="space-y-1.5">
                    <Label className="text-sm">Confirmar Senha</Label>
                    <Input
                      type="password"
                      value={selfForm.confirmPassword}
                      onChange={(e) => { setSelfForm({ ...selfForm, confirmPassword: e.target.value }); setSelfErrors(prev => ({ ...prev, confirmPassword: undefined })); }}
                      placeholder="Repita a nova senha"
                      className="h-9 text-sm"
                    />
                    {selfErrors.confirmPassword && <p className="text-xs text-destructive">{selfErrors.confirmPassword}</p>}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={handleSelfSave} disabled={savingSelf}>
                    {savingSelf ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setSelfEdit(false); setSelfForm({ email: '', password: '', confirmPassword: '' }); setSelfErrors({}); }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {['all', 'admin', 'barber', 'client'].map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'Todos' : ROLE_LABELS[f] || f}
            </Button>
          ))}
        </div>

        {loadingUsers ? (
          <p className="text-muted-foreground text-center py-12">Carregando...</p>
        ) : filteredUsers.length === 0 ? (
          <p className="text-muted-foreground text-center py-12 glass-card">Nenhum usuário encontrado</p>
        ) : (
          <div className="space-y-3">
            {filteredUsers.filter(u => !u.roles.includes('super_admin')).map((u) => (
              <div key={u.user_id} className="glass-card p-4 animate-slide-up">
                {editingUser === u.user_id ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Nome</Label>
                      <Input
                        value={editForm.full_name}
                        onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                        placeholder="Novo nome"
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Email</Label>
                      <Input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => { setEditForm({ ...editForm, email: e.target.value }); setEditErrors(prev => ({ ...prev, email: undefined })); }}
                        placeholder="Novo email"
                        className="h-9 text-sm"
                      />
                      {editErrors.email && <p className="text-xs text-destructive">{editErrors.email}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Senha</Label>
                      <div className="relative">
                        <Input
                          type={showEditPassword ? 'text' : 'password'}
                          value={editForm.password}
                          onChange={(e) => { setEditForm({ ...editForm, password: e.target.value }); setEditErrors(prev => ({ ...prev, password: undefined })); }}
                          placeholder="Nova senha (deixe vazio para manter)"
                          className="h-9 text-sm pr-9"
                        />
                        <button type="button" onClick={() => setShowEditPassword(!showEditPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showEditPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      {editErrors.password && <p className="text-xs text-destructive">{editErrors.password}</p>}
                      {editForm.password && !editErrors.password && (
                        <p className="text-xs text-primary">Senha válida ✓</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleEditSave(u.user_id)} disabled={savingEdit}>
                        {savingEdit ? 'Salvando...' : 'Salvar'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingUser(null); setEditForm({ full_name: '', email: '', password: '' }); setEditErrors({}); }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${u.is_available ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}
                          title={u.is_available ? 'Ativo' : 'Inativo'}
                        />
                        <p className="font-medium text-sm sm:text-base truncate">{u.full_name || 'Sem nome'}</p>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3 shrink-0" /> <span className="truncate">{u.email}</span>
                      </p>
                      {u.phone && (
                        <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3 shrink-0" /> {formatPhone(u.phone)}
                        </p>
                      )}
                      <div className="flex gap-1 flex-wrap mt-1">
                        {u.roles.map((r) => (
                          <Badge key={r} variant="secondary" className="text-[10px]">
                            {ROLE_LABELS[r] || r}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setEditingUser(u.user_id); setEditForm({ full_name: u.full_name, email: u.email, password: '' }); setEditErrors({}); }}
                        className="p-1.5 rounded-lg hover:bg-accent/20 text-muted-foreground hover:text-foreground transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(u.user_id, u.full_name)}
                        className="p-1.5 rounded-lg hover:bg-destructive/20 text-destructive transition-colors"
                        title="Remover"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
