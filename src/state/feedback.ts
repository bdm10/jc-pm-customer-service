import { useCallback, useEffect, useState } from 'react';
import type { FeedbackEntry } from '../domain/feedback';

// Los comentarios se guardan aparte del estado de la demo: «Reset demo» NO los borra.
const KEY = 'cs-proto/feedback/v1';

function load(): FeedbackEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FeedbackEntry[]) : [];
  } catch {
    return [];
  }
}

function persist(entries: FeedbackEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* sin persistencia */
  }
}

const listeners = new Set<(e: FeedbackEntry[]) => void>();
let cache: FeedbackEntry[] | null = null;

export function useFeedback() {
  const [entries, setEntries] = useState<FeedbackEntry[]>(() => (cache ??= load()));
  useEffect(() => {
    listeners.add(setEntries);
    return () => {
      listeners.delete(setEntries);
    };
  }, []);
  const update = useCallback((next: FeedbackEntry[]) => {
    cache = next;
    persist(next);
    listeners.forEach((l) => l(next));
  }, []);
  const add = useCallback((e: Omit<FeedbackEntry, 'id' | 'createdAt'>) => {
    const entry: FeedbackEntry = { ...e, id: `FB-${Date.now().toString(36)}`, createdAt: new Date().toISOString() };
    update([...(cache ?? []), entry]);
    return entry;
  }, [update]);
  const remove = useCallback((id: string) => update((cache ?? []).filter((x) => x.id !== id)), [update]);
  const clear = useCallback(() => update([]), [update]);
  return { entries, add, remove, clear };
}

interface DownloadsApi {
  save(req: { filename: string; data: string }): Promise<{ status: string }>;
}
type ClaudeHost = { use?: (name: 'downloads') => Promise<DownloadsApi | null> };

/**
 * Descarga un archivo generado en el navegador. En la vista previa online (claude.ai) las descargas
 * directas están bloqueadas y se usa la capacidad «downloads», que pide confirmación al usuario.
 */
export async function download(filename: string, content: string, type: string): Promise<void> {
  const host = (window as unknown as { claude?: ClaudeHost }).claude;
  if (host?.use) {
    const dl = await host.use('downloads');
    if (!dl) throw new Error('La descarga no está disponible en esta vista. Usa «Copiar CSV».');
    try {
      await dl.save({ filename, data: content });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'declined') throw new Error('Descarga cancelada.');
      throw new Error('No se ha podido descargar el archivo. Usa «Copiar CSV».');
    }
    return;
  }
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
