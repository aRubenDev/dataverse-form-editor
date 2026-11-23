import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { Issue } from '../domain/types';
import { useEditor } from '../state/EditorContext';

export function IssuesPanel({ issues }: { issues: Issue[] }) {
  const { dispatch } = useEditor();
  const errors = issues.filter((i) => i.level === 'error').length;

  return (
    <details className="border-t border-slate-300 bg-white" open={errors > 0}>
      <summary className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm font-medium">
        {issues.length === 0 ? (
          <span className="flex items-center gap-1.5 text-emerald-600"><CheckCircle2 size={16} /> Sin incidencias</span>
        ) : (
          <>
            {errors > 0 && <span className="flex items-center gap-1 text-red-600"><XCircle size={16} /> {errors} error(es)</span>}
            {issues.length - errors > 0 && <span className="flex items-center gap-1 text-amber-600"><AlertTriangle size={16} /> {issues.length - errors} aviso(s)</span>}
          </>
        )}
      </summary>
      {issues.length > 0 && (
        <ul className="max-h-40 divide-y divide-slate-100 overflow-y-auto border-t border-slate-100 text-sm">
          {issues.map((i, n) => (
            <li key={n}>
              <button
                className="flex w-full items-start gap-2 px-4 py-1.5 text-left hover:bg-slate-50"
                onClick={() => i.target && dispatch({ type: 'select', selection: i.target })}
              >
                {i.level === 'error' ? <XCircle size={14} className="mt-0.5 shrink-0 text-red-500" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />}
                <span>{i.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
