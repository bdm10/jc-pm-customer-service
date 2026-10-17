import { useEffect, useState } from 'react';

const current = () => window.location.hash.replace(/^#/, '') || '/bandeja';

export function navigate(path: string) {
  if (current() === path) return;
  window.location.hash = path;
  window.scrollTo({ top: 0 });
}

export function useRoute(): string[] {
  const [path, setPath] = useState(current);
  useEffect(() => {
    const on = () => setPath(current());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return path.split('?')[0].split('/').filter(Boolean);
}
