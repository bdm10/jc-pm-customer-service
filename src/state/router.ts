import { useEffect, useState, type MouseEvent } from 'react';

// Enrutado por hash con respaldo en memoria: si el marco que aloja la página (p. ej. la vista
// previa online) no deja cambiar `location.hash`, la navegación sigue funcionando dentro de la app.
let memoryPath: string | null = null;
const listeners = new Set<() => void>();

const fromHash = () => window.location.hash.replace(/^#/, '');
const current = () => memoryPath ?? (fromHash() || '/bandeja');

export function navigate(path: string) {
  if (current() === path) return;
  memoryPath = path;
  try {
    window.location.hash = path;
  } catch {
    /* el marco no permite cambiar el hash: basta con el estado en memoria */
  }
  listeners.forEach((l) => l());
  window.scrollTo({ top: 0 });
}

/** Para enlaces `<a href="#/ruta">`: navega sin depender de que el navegador cambie el hash. */
export function linkTo(path: string) {
  return {
    href: `#${path}`,
    onClick: (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      navigate(path);
    },
  };
}

export function useRoute(): string[] {
  const [path, setPath] = useState(current);
  useEffect(() => {
    const onHash = () => {
      const h = fromHash();
      if (h) memoryPath = h;
      setPath(current());
    };
    const onMemory = () => setPath(current());
    window.addEventListener('hashchange', onHash);
    listeners.add(onMemory);
    return () => {
      window.removeEventListener('hashchange', onHash);
      listeners.delete(onMemory);
    };
  }, []);
  return path.split('?')[0].split('/').filter(Boolean);
}
