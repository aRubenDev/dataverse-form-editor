import { useRef } from 'react';
import { PackageOpen } from 'lucide-react';

interface Props {
  onText: (text: string, fileName: string) => void;
  label?: string;
  primary?: boolean;
}

export function BundleButton({ onText, label = 'Cargar paquete', primary = false }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = ''; // permite volver a cargar el mismo fichero
          if (f) onText(await f.text(), f.name);
        }}
      />
      <button className={primary ? 'btn btn-primary' : 'btn'} onClick={() => ref.current?.click()}>
        <PackageOpen size={16} /> {label}
      </button>
    </>
  );
}
