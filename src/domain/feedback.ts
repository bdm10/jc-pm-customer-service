// Comentarios de la reunión: modelo y exportación (CSV para Excel en español, y JSON).

import type { ScenarioId } from './types';

export type FeedbackPriority = 'Alta' | 'Media' | 'Baja';

export interface FeedbackEntry {
  id: string;
  scenarioId: ScenarioId | 'general';
  createdAt: string;
  author: string;
  whatToChange: string;
  missingStep: string;
  whoDecides: string;
  priority: FeedbackPriority;
}

export const FEEDBACK_COLUMNS = ['Escenario', 'Fecha', 'Quién comenta', 'Qué cambiar', 'Paso que falta', 'Quién decide', 'Prioridad'] as const;

function csvCell(v: string): string {
  const s = v.replace(/\r?\n/g, ' ').trim();
  return /[";\n]/.test(s) || s !== v.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV separado por «;» con BOM UTF-8 para que Excel en español lo abra correctamente. */
export function feedbackToCsv(entries: FeedbackEntry[], scenarioTitle: (id: FeedbackEntry['scenarioId']) => string): string {
  const rows = [FEEDBACK_COLUMNS.join(';')];
  for (const e of entries) {
    rows.push(
      [scenarioTitle(e.scenarioId), new Date(e.createdAt).toLocaleString('es-ES'), e.author, e.whatToChange, e.missingStep, e.whoDecides, e.priority]
        .map((c) => csvCell(c ?? ''))
        .join(';'),
    );
  }
  return '﻿' + rows.join('\r\n') + '\r\n';
}

export function feedbackToJson(entries: FeedbackEntry[], scenarioTitle: (id: FeedbackEntry['scenarioId']) => string): string {
  return JSON.stringify(
    {
      exportadoEl: new Date().toISOString(),
      origen: 'Prototipo Espacio de Atención al Cliente JC / PM — datos y acciones simulados',
      comentarios: entries.map((e) => ({ ...e, escenario: scenarioTitle(e.scenarioId) })),
    },
    null,
    2,
  );
}

export function isFeedbackEmpty(e: Pick<FeedbackEntry, 'whatToChange' | 'missingStep' | 'whoDecides'>): boolean {
  return !e.whatToChange.trim() && !e.missingStep.trim() && !e.whoDecides.trim();
}
