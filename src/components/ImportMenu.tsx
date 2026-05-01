import { useEffect, useRef, useState, type FormEvent } from "react";
import { DEFAULT_RESOLVERS } from "../dns/resolvers";

interface ImportMenuProps {
  onImportFile: (file: File) => void;
  onImportFromDns: (resolverId: string, domain: string) => void;
  isResolving: boolean;
}

export function ImportMenu({ onImportFile, onImportFromDns, isResolving }: ImportMenuProps) {
  const [open, setOpen] = useState(false);
  const [resolverId, setResolverId] = useState<string | null>(null);
  const [domain, setDomain] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open && resolverId === null) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setResolverId(null);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setResolverId(null);
      }
    };
    window.addEventListener("mousedown", handler);
    window.addEventListener("keydown", keyHandler);
    return () => {
      window.removeEventListener("mousedown", handler);
      window.removeEventListener("keydown", keyHandler);
    };
  }, [open, resolverId]);

  const handlePickResolver = (id: string) => {
    setOpen(false);
    setResolverId(id);
    setDomain("");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = domain.trim();
    if (!trimmed || !resolverId) return;
    onImportFromDns(resolverId, trimmed);
    setResolverId(null);
    setDomain("");
  };

  const activeResolver = resolverId
    ? DEFAULT_RESOLVERS.find((r) => r.id === resolverId)
    : null;

  return (
    <div className="import-menu" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={isResolving}
      >
        {isResolving ? "Resolving…" : "Import…"}
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".zone,.db,.txt,text/plain"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImportFile(f);
          e.target.value = "";
          setOpen(false);
        }}
      />

      {open && (
        <div className="import-dropdown" role="menu">
          <button type="button" role="menuitem" onClick={() => fileInput.current?.click()}>
            From file…
          </button>
          <div className="dropdown-divider" />
          <div className="dropdown-label">From public DNS</div>
          {DEFAULT_RESOLVERS.map((r) => (
            <button
              key={r.id}
              type="button"
              role="menuitem"
              onClick={() => handlePickResolver(r.id)}
            >
              <span>{r.name}</span>
              <span className="region">{r.region}</span>
            </button>
          ))}
        </div>
      )}

      {activeResolver && (
        <form className="dns-import-form" onSubmit={handleSubmit}>
          <span className="hint">Resolve from {activeResolver.name}:</span>
          <input
            autoFocus
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
          />
          <button type="submit" className="primary" disabled={!domain.trim()}>
            Resolve
          </button>
          <button
            type="button"
            onClick={() => {
              setResolverId(null);
              setDomain("");
            }}
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
