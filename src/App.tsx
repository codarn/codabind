import { useMemo, useRef, useState } from "react";
import { RecordRow } from "./components/RecordRow";
import { DomainTree } from "./components/DomainTree";
import { emptyZone, newRecord, parseZone } from "./zone/parser";
import { serializeZone } from "./zone/serializer";
import { validateZone } from "./zone/validator";
import { buildTree, fqdn, findNode, recordsInSubtree } from "./zone/tree";
import { RECORD_TYPES, type RecordType, type Zone, type ZoneRecord } from "./zone/types";

type TypeFilter = "ALL" | RecordType;

export function App() {
  const [zone, setZone] = useState<Zone>(emptyZone);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importedName, setImportedName] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const issues = useMemo(() => validateZone(zone), [zone]);
  const issuesByRecord = useMemo(() => {
    const map = new Map<string, typeof issues>();
    for (const i of issues) {
      if (!i.recordId) continue;
      const arr = map.get(i.recordId) ?? [];
      arr.push(i);
      map.set(i.recordId, arr);
    }
    return map;
  }, [issues]);

  const globalIssues = issues.filter((i) => !i.recordId);
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warnCount = issues.filter((i) => i.severity === "warning").length;

  const tree = useMemo(() => buildTree(zone.records, zone.origin), [zone.records, zone.origin]);

  const subtreeRecords = useMemo(() => {
    if (selectedPath.length === 0) return zone.records;
    const node = findNode(tree, selectedPath);
    return node ? recordsInSubtree(node) : [];
  }, [tree, selectedPath, zone.records]);

  const typeCounts = useMemo(() => {
    const counts = new Map<RecordType, number>();
    for (const r of subtreeRecords) counts.set(r.record.type, (counts.get(r.record.type) ?? 0) + 1);
    return counts;
  }, [subtreeRecords]);

  const visibleRecords = useMemo(
    () => (typeFilter === "ALL" ? subtreeRecords : subtreeRecords.filter((r) => r.record.type === typeFilter)),
    [subtreeRecords, typeFilter],
  );

  const groupedRecords = useMemo(() => {
    const groups = new Map<string, ZoneRecord[]>();
    for (const r of visibleRecords) {
      const key = fqdn(r, zone.origin);
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
      const ar = a.replace(/\.$/, "").split(".").reverse().join(".");
      const br = b.replace(/\.$/, "").split(".").reverse().join(".");
      return ar.localeCompare(br);
    });
  }, [visibleRecords, zone.origin]);

  const updateRecord = (rec: ZoneRecord) =>
    setZone((z) => ({ ...z, records: z.records.map((r) => (r.id === rec.id ? rec : r)) }));

  const deleteRecord = (id: string) =>
    setZone((z) => ({ ...z, records: z.records.filter((r) => r.id !== id) }));

  const addRecord = () => {
    const seedType: RecordType = typeFilter === "ALL" ? "A" : typeFilter;
    const rec = newRecord(seedType);
    if (selectedPath.length > 0) {
      const originLabels = (zone.origin || "").replace(/\.$/, "").split(".").filter(Boolean).reverse();
      if (
        originLabels.length <= selectedPath.length &&
        originLabels.every((l, i) => l === selectedPath[i])
      ) {
        const sub = selectedPath.slice(originLabels.length).slice().reverse().join(".");
        rec.name = sub || "@";
      } else {
        rec.name = selectedPath.slice().reverse().join(".") + ".";
      }
    }
    setZone((z) => ({ ...z, records: [...z.records, rec] }));
  };

  const handleImportClick = () => fileInput.current?.click();

  const handleFile = async (file: File) => {
    const MAX_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      setParseErrors([`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Limit is 5 MB.`]);
      setImportedName(file.name);
      return;
    }
    const text = await file.text();
    const result = parseZone(text);
    setZone(result.zone);
    setParseErrors(result.errors);
    setImportedName(file.name);
    setSelectedPath([]);
  };

  const handleExport = () => {
    const text = serializeZone(zone);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const base = (zone.origin || "zone").replace(/\.$/, "") || "zone";
    a.download = `${base}.zone`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const handleNew = () => {
    setZone(emptyZone());
    setParseErrors([]);
    setImportedName("");
    setSelectedPath([]);
  };

  const previewText = useMemo(() => serializeZone(zone), [zone]);

  const selectedFqdn = selectedPath.length === 0 ? "all domains" : selectedPath.slice().reverse().join(".") + ".";

  return (
    <div className="app">
      <header className="topbar">
        <h1>Codabind</h1>
        <div className="actions">
          <button onClick={handleImportClick}>Import…</button>
          <input
            ref={fileInput}
            type="file"
            accept=".zone,.db,.txt,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <button onClick={handleExport} disabled={errorCount > 0} title={errorCount > 0 ? "Fix errors before exporting" : "Download zone file"}>
            Export
          </button>
          <button onClick={handleNew}>New file</button>
          <button onClick={addRecord} className="primary">+ New record</button>
        </div>
      </header>

      <section className="zone-meta">
        <label className="field">
          <span>$ORIGIN</span>
          <input value={zone.origin} onChange={(e) => setZone({ ...zone, origin: e.target.value })} placeholder="example.com." />
        </label>
        <label className="field">
          <span>$TTL</span>
          <input value={zone.ttl} onChange={(e) => setZone({ ...zone, ttl: e.target.value })} placeholder="3600" />
        </label>
        {importedName && <span className="imported">Imported: {importedName}</span>}
      </section>

      <section className="status">
        <span className={`pill ${errorCount ? "err" : "ok"}`}>{errorCount} errors</span>
        <span className={`pill ${warnCount ? "warn" : "ok"}`}>{warnCount} warnings</span>
        <span className="pill">
          {visibleRecords.length === subtreeRecords.length && subtreeRecords.length === zone.records.length
            ? `${zone.records.length} records`
            : `${visibleRecords.length} of ${zone.records.length} records`}
        </span>
        <span className="pill scope">scope: {selectedFqdn}</span>
        <label className="filter">
          <span>Type</span>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}>
            <option value="ALL">All ({subtreeRecords.length})</option>
            {RECORD_TYPES.filter((t) => typeCounts.get(t)).map((t) => (
              <option key={t} value={t}>
                {t} ({typeCounts.get(t)})
              </option>
            ))}
          </select>
        </label>
      </section>

      {parseErrors.length > 0 && (
        <section className="parse-errors">
          <strong>Parse errors:</strong>
          <ul>
            {parseErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </section>
      )}

      {globalIssues.length > 0 && (
        <section className="parse-errors">
          <strong>Zone issues:</strong>
          <ul>
            {globalIssues.map((i, idx) => (
              <li key={idx} className={i.severity}>
                {i.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="main">
        <aside className="sidebar">
          <DomainTree root={tree} selectedPath={selectedPath} onSelect={setSelectedPath} />
        </aside>

        <section className="records">
          {groupedRecords.length === 0 && (
            <div className="empty">
              {typeFilter === "ALL" ? "No records in this scope." : `No ${typeFilter} records in this scope.`}
            </div>
          )}
          {groupedRecords.map(([fq, recs]) => (
            <div key={fq} className="record-group">
              <h3 className="group-header">{fq}</h3>
              {recs.map((r) => (
                <RecordRow
                  key={r.id}
                  record={r}
                  issues={issuesByRecord.get(r.id) ?? []}
                  onChange={updateRecord}
                  onDelete={() => deleteRecord(r.id)}
                />
              ))}
            </div>
          ))}
        </section>
      </div>

      <details className="preview">
        <summary>Preview output</summary>
        <pre>{previewText}</pre>
      </details>

      <footer className="footer">Codabind by Codarn AB</footer>
    </div>
  );
}
