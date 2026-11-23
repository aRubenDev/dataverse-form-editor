import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DataverseClient } from '../api/dataverse';
import { useAuth } from '../auth/AuthContext';
import { parseFormXml } from '../domain/formxml/parse';
import type { AttributeMeta, EntityMeta, FormSummary } from '../domain/types';
import { useEditor } from './EditorContext';

/**
 * Carga entidades, formularios y atributos del entorno conectado.
 * Un contador por tipo de petición descarta respuestas obsoletas si el usuario cambia de entidad rápidamente.
 */
export function useMetadata() {
  const { status, orgUrl, getToken } = useAuth();
  const { state, dispatch } = useEditor();
  const [entities, setEntities] = useState<EntityMeta[]>([]);
  const [entity, setEntityState] = useState<string>('');
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [attributes, setAttributes] = useState<AttributeMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef({ entity: 0, form: 0 });

  const client = useMemo(
    () => (status === 'signed-in' && orgUrl ? new DataverseClient(orgUrl, getToken) : null),
    [status, orgUrl, getToken],
  );

  useEffect(() => {
    if (!client) {
      setEntities([]);
      setForms([]);
      setAttributes([]);
      return;
    }
    let cancelled = false;
    setBusy(true);
    setError(null);
    Promise.all([client.listEntities(), client.getBaseLanguage()])
      .then(([ents, lcid]) => {
        if (cancelled) return;
        setEntities(ents);
        if (!state.present) dispatch({ type: 'setLcid', lcid });
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const setEntity = useCallback(
    async (logicalName: string) => {
      setEntityState(logicalName);
      setForms([]);
      setAttributes([]);
      if (!client || !logicalName) return;
      const id = ++seq.current.entity;
      setBusy(true);
      setError(null);
      try {
        const [f, a] = await Promise.all([client.listForms(logicalName), client.listAttributes(logicalName)]);
        if (id !== seq.current.entity) return;
        setForms(f);
        setAttributes(a);
      } catch (e) {
        if (id === seq.current.entity) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (id === seq.current.entity) setBusy(false);
      }
    },
    [client],
  );

  const loadForm = useCallback(
    async (formId: string) => {
      if (!client || !formId) return;
      if (state.dirty && !window.confirm('Hay cambios sin exportar. ¿Cargar otro formulario y descartarlos?')) return;
      const id = ++seq.current.form;
      setBusy(true);
      setError(null);
      try {
        const xml = await client.getFormXml(formId);
        if (id !== seq.current.form) return;
        const form = parseFormXml(xml);
        const summary = forms.find((x) => x.formId === formId);
        dispatch({ type: 'load', form, source: { entity, formId, name: summary?.name } });
      } catch (e) {
        if (id === seq.current.form) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (id === seq.current.form) setBusy(false);
      }
    },
    [client, dispatch, entity, forms, state.dirty],
  );

  return { client, entities, entity, setEntity, forms, attributes, loadForm, busy, error };
}

export type Metadata = ReturnType<typeof useMetadata>;
