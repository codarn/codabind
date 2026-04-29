import { RECORD_TYPES, type RecordType } from "../zone/types";
import type { TypeFilter } from "../zone/selectors";

interface StatusBarProps {
  errorCount: number;
  warnCount: number;
  totalRecords: number;
  scopeRecordCount: number;
  visibleCount: number;
  scopeFqdn: string;
  typeFilter: TypeFilter;
  typeCounts: Map<RecordType, number>;
  onTypeFilterChange: (filter: TypeFilter) => void;
}

export function StatusBar({
  errorCount,
  warnCount,
  totalRecords,
  scopeRecordCount,
  visibleCount,
  scopeFqdn,
  typeFilter,
  typeCounts,
  onTypeFilterChange,
}: StatusBarProps) {
  const showFiltered = visibleCount !== totalRecords || scopeRecordCount !== totalRecords;

  return (
    <section className="status">
      <span className={`pill ${errorCount ? "err" : "ok"}`}>{errorCount} errors</span>
      <span className={`pill ${warnCount ? "warn" : "ok"}`}>{warnCount} warnings</span>
      <span className="pill">
        {showFiltered ? `${visibleCount} of ${totalRecords} records` : `${totalRecords} records`}
      </span>
      <span className="pill scope">scope: {scopeFqdn}</span>
      <label className="filter">
        <span>Type</span>
        <select
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value as TypeFilter)}
        >
          <option value="ALL">All ({scopeRecordCount})</option>
          {RECORD_TYPES.filter((t) => typeCounts.get(t)).map((t) => (
            <option key={t} value={t}>{t} ({typeCounts.get(t)})</option>
          ))}
        </select>
      </label>
    </section>
  );
}
