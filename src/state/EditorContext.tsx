import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react';
import type { FormModel } from '../domain/types';
import { initialState, reducer, type Action, type EditorState, type FormSource } from './reducer';

const DRAFT_KEY = 'dfd.draft';

interface Draft {
  form: FormModel;
  source: FormSource | null;
  lcid: number;
  savedAt: string;
}

export function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* no crítico */
  }
}

const Ctx = createContext<{ state: EditorState; dispatch: Dispatch<Action> } | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Autoguardado de borrador: protege frente a recargas, cierres de pestaña o sesiones caducadas.
  useEffect(() => {
    if (!state.present || !state.dirty) return;
    const t = setTimeout(() => {
      try {
        const draft: Draft = { form: state.present!, source: state.source, lcid: state.lcid, savedAt: new Date().toISOString() };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        /* cuota excedida: se ignora, el editor sigue funcionando */
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [state.present, state.dirty, state.source, state.lcid]);

  useEffect(() => {
    if (!state.dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state.dirty]);

  // Atajos: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z / Ctrl+Y
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        dispatch({ type: 'redo' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useEditor() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useEditor debe usarse dentro de <EditorProvider>');
  return v;
}
