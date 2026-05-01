import { GitHubLink } from "./GitHubLink";
import { ImportMenu } from "./ImportMenu";
import { Logo } from "./Logo";

interface TopbarProps {
  canExport: boolean;
  isChecking: boolean;
  isResolving: boolean;
  onImport: (file: File) => void;
  onImportFromDns: (resolverId: string, domain: string) => void;
  onExport: () => void;
  onNew: () => void;
  onAddRecord: () => void;
  onCheck: () => void;
  onCancelCheck: () => void;
}

export function Topbar({
  canExport,
  isChecking,
  isResolving,
  onImport,
  onImportFromDns,
  onExport,
  onNew,
  onAddRecord,
  onCheck,
  onCancelCheck,
}: TopbarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        <h1>Codabind</h1>
      </div>
      <div className="actions">
        <ImportMenu
          onImportFile={onImport}
          onImportFromDns={onImportFromDns}
          isResolving={isResolving}
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
