import { useRef } from "react";
import { GitHubLink } from "./GitHubLink";
import { Logo } from "./Logo";

interface TopbarProps {
  canExport: boolean;
  isChecking: boolean;
  onImport: (file: File) => void;
  onExport: () => void;
  onNew: () => void;
  onAddRecord: () => void;
  onCheck: () => void;
  onCancelCheck: () => void;
}

export function Topbar({
  canExport,
  isChecking,
  onImport,
  onExport,
  onNew,
  onAddRecord,
  onCheck,
  onCancelCheck,
}: TopbarProps) {
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        <h1>Codabind</h1>
      </div>
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
        {isChecking ? (
          <button onClick={onCancelCheck} title="Cancel propagation check">Cancel</button>
        ) : (
          <button onClick={onCheck} title="Resolve every record across public DNS resolvers">
            Check propagation
          </button>
        )}
        <button onClick={onAddRecord} className="primary">+ New record</button>
        <GitHubLink />
      </div>
    </header>
  );
}
