// En es-ES los números de 4 cifras no se agrupan por defecto (4120 €); forzamos el separador para que se lean mejor.
const always = { useGrouping: 'always' } as unknown as Intl.NumberFormatOptions;
const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2, ...always });
const eur0 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, ...always });
const num = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1, ...always });
const pct = new Intl.NumberFormat('es-ES', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const fmtEUR = (v: number) => eur.format(v);
export const fmtEUR0 = (v: number) => eur0.format(v);
export const fmtNum = (v: number) => num.format(v);
export const fmtPct = (ratio: number) => pct.format(ratio);
export const fmtPctPoints = (v: number) => `${num.format(v)} %`;

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtLongDay(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

export function fmtAge(iso: string, now = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime();
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'hace 1 día' : `hace ${d} días`;
}

export function hoursSince(iso: string, now = new Date()): number {
  return (now.getTime() - new Date(iso).getTime()) / 3600000;
}

/** Días naturales entre hoy y la fecha (redondeado al día). */
export function daysUntil(iso: string, now = new Date()): number {
  const a = new Date(now);
  a.setHours(0, 0, 0, 0);
  const b = new Date(iso);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function relativeDay(iso: string, now = new Date()): string {
  const d = daysUntil(iso, now);
  if (d === 0) return 'hoy';
  if (d === 1) return 'mañana';
  if (d === -1) return 'ayer';
  if (d > 1) return `en ${d} días`;
  return `hace ${-d} días`;
}

// --- Utilidades de tiempo para generar datos relativos al momento del reinicio ---

export function addHours(base: Date, h: number): string {
  return new Date(base.getTime() + h * 3600000).toISOString();
}

export function addMinutes(base: Date, m: number): string {
  return new Date(base.getTime() + m * 60000).toISOString();
}

/** Suma días laborables (lunes a viernes) y fija la hora a las 09:00. */
export function addBusinessDays(base: Date, n: number): string {
  const d = new Date(base);
  d.setHours(9, 0, 0, 0);
  let left = Math.abs(n);
  const step = n >= 0 ? 1 : -1;
  while (left > 0) {
    d.setDate(d.getDate() + step);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d.toISOString();
}

export function isoDateInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromDateInput(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 9, 0, 0).toISOString();
}
