import { useRef } from "react";

interface TopbarProps {
  canExport: boolean;
  onImport: (file: File) => void;
  onExport: () => void;
  onNew: () => void;
  onAddRecord: () => void;
}

export function Topbar({ canExport, onImport, onExport, onNew, onAddRecord }: TopbarProps) {
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <header className="topbar">
      <h1>Codabind</h1>
      <div className="actions">
        <button onClick={() => fileInput.current?.click()}>Import…</button>
        <input
          ref={fileInput}
          type="file"
          accept=".zone,.db,.txt,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={onExport}
          disabled={!canExport}
          title={canExport ? "Download zone file" : "Fix errors before exporting"}
        >
          Export
        </button>
        <button onClick={onNew}>New file</button>
        <button onClick={onAddRecord} className="primary">+ New record</button>
      </div>
    </header>
  );
}
