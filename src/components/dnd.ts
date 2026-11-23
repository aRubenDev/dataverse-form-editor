import type { DragEvent } from 'react';
import type { AttributeMeta } from '../domain/types';

/**
 * El navegador no permite leer dataTransfer durante dragover, así que el payload activo
 * se guarda a nivel de módulo (solo hay un arrastre a la vez).
 */
export type DragPayload =
  | { kind: 'attr'; attr: AttributeMeta }
  | { kind: 'spacer' }
  | { kind: 'cell'; id: string }
  | { kind: 'section'; id: string };

let current: DragPayload | null = null;

export function startDrag(e: DragEvent, payload: DragPayload): void {
  current = payload;
  e.dataTransfer.setData('text/plain', 'dfd');
  e.dataTransfer.effectAllowed = 'move';
  e.stopPropagation();
}

export const endDrag = (): void => {
  current = null;
};

export const activeDrag = (): DragPayload | null => current;
