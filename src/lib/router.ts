import { useState, useEffect, useCallback } from 'react';

function getFullPath(): string {
  if (typeof window === 'undefined') return '/';
  return (window.location.pathname || '/') + (window.location.search || '') + (window.location.hash || '');
}

export interface NavigateOptions {
  replace?: boolean;
  scrollToTop?: boolean;
}

export function useRouter() {
  const [currentPath, setCurrentPath] = useState<string>(() => getFullPath());

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(getFullPath());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((to: string, options?: NavigateOptions) => {
    const current = getFullPath();
    if (to !== current) {
      if (options?.replace) {
        window.history.replaceState({}, '', to);
      } else {
        window.history.pushState({}, '', to);
      }
      setCurrentPath(to);
      if (options?.scrollToTop !== false) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, []);

  return { currentPath, navigate };
}

