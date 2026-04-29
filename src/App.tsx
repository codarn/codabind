import { useMemo, useState } from "react";
import { DomainTree } from "./components/DomainTree";
import { IssuesPanel } from "./components/IssuesPanel";
import { Preview } from "./components/Preview";
import { RecordRow } from "./components/RecordRow";
import { StatusBar } from "./components/StatusBar";
import { Topbar } from "./components/Topbar";
import { ZoneMeta } from "./components/ZoneMeta";
import { useDnsCheck } from "./hooks/useDnsCheck";
import { useZoneFile } from "./hooks/useZoneFile";
import { emptyZone, newRecord } from "./zone/parser";
import { serializeZone } from "./zone/serializer";
import {
  countByType,
  filterByType,
  groupByFqdn,
  pathToFqdn,
  recordsInScope,
  relativeNameForPath,
  type TypeFilter,
} from "./zone/selectors";
import { buildTree } from "./zone/tree";
import type { RecordType, Zone, ZoneRecord } from "./zone/types";
import { validateZone } from "./zone/validator";

export function App() {
  const [zone, setZone] = useState<Zone>(emptyZone);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const { parseErrors, importedName, importFile, exportZone, reset } = useZoneFile();
  const dns = useDnsCheck();

  const issues = useMemo(() => validateZone(zone), [zone]);
  const tree = useMemo(() => buildTree(zone.records, zone.origin), [zone.records, zone.origin]);
  const scopeRecords = useMemo(
    () => recordsInScope(zone, tree, selectedPath),
    [zone, tree, selectedPath],
  );
  const visibleRecords = useMemo(
    () => filterByType(scopeRecords, typeFilter),
    [scopeRecords, typeFilter],
  );
  const groupedRecords = useMemo(
    () => groupByFqdn(visibleRecords, zone.origin),
    [visibleRecords, zone.origin],
  );
  const typeCounts = useMemo(() => countByType(scopeRecords), [scopeRecords]);

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

  const globalIssues = useMemo(() => issues.filter((i) => !i.recordId), [issues]);
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warnCount = issues.filter((i) => i.severity === "warning").length;
  const previewText = useMemo(() => serializeZone(zone), [zone]);

  const handleImport = async (file: File) => {
    const next = await importFile(file);
    if (next) {
      setZone(next);
      setSelectedPath([]);
    }
  };

  const handleNew = () => {
    setZone(emptyZone());
    reset();
    dns.reset();
    setSelectedPath([]);
  };

  const handleAddRecord = () => {
    const seedType: RecordType = typeFilter === "ALL" ? "A" : typeFilter;
    const rec = newRecord(seedType);
    if (selectedPath.length > 0) {
      rec.name = relativeNameForPath(zone.origin, selectedPath);
    }
    setZone((z) => ({ ...z, records: [...z.records, rec] }));
  };

  const updateRecord = (rec: ZoneRecord) =>
    setZone((z) => ({ ...z, records: z.records.map((r) => (r.id === rec.id ? rec : r)) }));

  const deleteRecord = (id: string) =>
    setZone((z) => ({ ...z, records: z.records.filter((r) => r.id !== id) }));

  return (
    <div className="app">
      <Topbar
        canExport={errorCount === 0}
        isChecking={dns.isChecking}
        onImport={handleImport}
        onExport={() => exportZone(zone)}
        onNew={handleNew}
        onAddRecord={handleAddRecord}
        onCheck={() => dns.checkAll(zone)}
        onCancelCheck={dns.cancel}
      />

      <ZoneMeta zone={zone} importedName={importedName} onChange={setZone} />

      <StatusBar
        errorCount={errorCount}
        warnCount={warnCount}
        totalRecords={zone.records.length}
        scopeRecordCount={scopeRecords.length}
        visibleCount={visibleRecords.length}
        scopeFqdn={pathToFqdn(selectedPath)}
        typeFilter={typeFilter}
        typeCounts={typeCounts}
        onTypeFilterChange={setTypeFilter}
      />

      <IssuesPanel parseErrors={parseErrors} globalIssues={globalIssues} />

      <div className="main">
        <aside className="sidebar">
          <DomainTree root={tree} selectedPath={selectedPath} onSelect={setSelectedPath} />
        </aside>

        <section className="records">
          {groupedRecords.length === 0 && (
            <div className="empty">
              {typeFilter === "ALL"
                ? "No records in this scope."
                : `No ${typeFilter} records in this scope.`}
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
                  checkResult={dns.results.get(r.id)}
                  showChecks={dns.results.size > 0 || dns.isChecking}
                  onChange={updateRecord}
                  onDelete={() => deleteRecord(r.id)}
                />
              ))}
            </div>
          ))}
        </section>
      </div>

      <Preview text={previewText} />

      <footer className="footer">Codabind by Codarn AB</footer>
    </div>
  );
}
