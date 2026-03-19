import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

type Theme = 'dark' | 'light' | 'system';

function getSystemTheme(): 'dark' | 'light' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemTheme() : theme;
  document.documentElement.classList.remove('dark', 'light');
  document.documentElement.classList.add(resolved);
}

function getStorageKey(userId: string | undefined) {
  return userId ? `app-theme-${userId}` : 'app-theme';
}

export function useTheme() {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>(() => {
    const key = getStorageKey(user?.id);
    return (localStorage.getItem(key) as Theme) || 'dark';
  });

  // Re-read theme when user changes
  useEffect(() => {
    const key = getStorageKey(user?.id);
    const saved = (localStorage.getItem(key) as Theme) || 'dark';
    setThemeState(saved);
  }, [user?.id]);

  useEffect(() => {
    applyTheme(theme);
    const key = getStorageKey(user?.id);
    localStorage.setItem(key, theme);
  }, [theme, user?.id]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return { theme, setTheme: setThemeState };
}
