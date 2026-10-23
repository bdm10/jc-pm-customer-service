import { describe, expect, it } from 'vitest';
import { feedbackToCsv, feedbackToJson, type FeedbackEntry } from './feedback';

const entry: FeedbackEntry = {
  id: 'FB-1',
  scenarioId: 's3',
  createdAt: '2026-10-19T09:30:00.000Z',
  author: 'Equipo PM',
  whatToChange: 'Mostrar el "riesgo" del seguro; también el saldo',
  missingStep: 'Avisar al comercial\nantes de Finanzas',
  whoDecides: 'Finanzas',
  priority: 'Alta',
};

describe('Exportación de comentarios', () => {
  it('genera CSV con BOM, separador «;» y escapado correcto', () => {
    const csv = feedbackToCsv([entry], () => 'Bloqueo por crédito');
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).trim().split('\r\n');
    expect(lines[0]).toBe('Escenario;Fecha;Quién comenta;Qué cambiar;Paso que falta;Quién decide;Prioridad');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"Mostrar el ""riesgo"" del seguro; también el saldo"');
    expect(lines[1]).toContain('Avisar al comercial antes de Finanzas');
    expect(lines[1].endsWith(';Finanzas;Alta')).toBe(true);
  });

  it('genera JSON con el título del escenario', () => {
    const json = JSON.parse(feedbackToJson([entry], () => 'Bloqueo por crédito'));
    expect(json.comentarios[0].escenario).toBe('Bloqueo por crédito');
    expect(json.comentarios[0].prioridad ?? json.comentarios[0].priority).toBe('Alta');
  });
});
