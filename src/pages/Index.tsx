import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Scissors } from 'lucide-react';

export default function Index() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Scissors className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!user || !role) return <Navigate to="/auth" replace />;
  if (role === 'super_admin') return <Navigate to="/admin" replace />;
  if (role === 'barber' || role === 'admin') return <Navigate to="/barber" replace />;
  return <Navigate to="/client" replace />;
}
