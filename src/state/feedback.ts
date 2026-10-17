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

export function download(filename: string, content: string, type: string) {
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
