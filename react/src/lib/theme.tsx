import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

export type AppTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_KEY = 'facturapro_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    return (localStorage.getItem(THEME_KEY) as AppTheme) || 'light';
  });

  // Apply class to <html> element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((t: AppTheme) => {
    setThemeState(t);
  }, []);

  const toggle = useCallback(() => {
    setThemeState(prev => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

// Save user's theme preference to Supabase
export async function saveUserTheme(userId: string, theme: AppTheme) {
  await supabase
    .from('users_config')
    .update({ preferred_theme: theme })
    .eq('id', userId);
}

// Save user's language preference to Supabase
export async function saveUserLanguage(userId: string, language: string, region: string) {
  await supabase
    .from('users_config')
    .update({ preferred_language: language, preferred_region: region })
    .eq('id', userId);
}
