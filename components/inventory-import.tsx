"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Download, Loader2 } from "lucide-react";
import { useStore, type ImportUnitRow } from "@/lib/store";
import { useClientUnits, useClientProjects } from "@/lib/roles";

const HEADERS = ["Project", "Tower", "Unit No", "Config", "Carpet Area (sq.ft)", "Price (INR)", "Floor", "Facing", "Availability", "Locality", "Builder"];

/** Manager-only bulk import of properties from Excel/CSV → parsed into the live inventory. */
export function InventoryImport() {
  const addUnits = useStore((s) => s.addUnits);
  const units = useClientUnits();
  const projects = useClientProjects();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  // tolerant header → field mapping (handles "Unit No", "unit_no", "Price (INR)", "BHK", etc.)
  const mapRow = (raw: Record<string, unknown>): ImportUnitRow => {
    const pick = (...needles: string[]) => {
      for (const key of Object.keys(raw)) {
        const k = key.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (needles.some((n) => k.includes(n))) return raw[key];
      }
      return undefined;
    };
    return {
      project: pick("project") as string,
      tower: pick("tower", "block") as string,
      unitNo: pick("unitno", "unitnumber", "flatno") as string,
      config: pick("config", "bhk", "type", "unittype") as string,
      carpetAreaSqft: pick("carpet", "area", "sqft", "size") as string,
      priceInr: pick("price", "inr", "cost", "amount", "value") as string,
      floor: pick("floor") as string,
      facing: pick("facing", "direction") as string,
      availability: pick("avail", "status") as string,
      locality: pick("locality", "location", "area") as string,
      builder: pick("builder", "developer") as string,
    };
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-uploading the same file
    if (!file) return;
    setBusy(true);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (!rows.length) { toast.error("That sheet looks empty."); return; }
      const { added, projectsCreated } = addUnits(rows.map(mapRow));
      if (!added) {
        toast.error("No valid units found — check the Config column (e.g. 2BHK, 3BHK, Villa).");
      } else {
        toast.success(`Imported ${added} unit${added === 1 ? "" : "s"}${projectsCreated ? ` · ${projectsCreated} new project${projectsCreated === 1 ? "" : "s"}` : ""}`, { description: "They're now live in the inventory." });
      }
    } catch {
      toast.error("Couldn't read that file. Use .xlsx or .csv with the template columns.");
    } finally {
      setBusy(false);
    }
  };

  // Template seeded from the inventory we already have, so the format matches exactly.
  const downloadTemplate = () => {
    const byId = Object.fromEntries(projects.map((p) => [p.id, p]));
    const rows = units.slice(0, 8).map((u) => {
      const p = byId[u.projectId];
      return {
        Project: p?.name ?? "", Tower: u.tower, "Unit No": u.unitNo, Config: u.config,
        "Carpet Area (sq.ft)": u.carpetAreaSqft, "Price (INR)": u.priceInr, Floor: u.floor,
        Facing: u.facing, Availability: u.availability, Locality: p?.locality ?? "", Builder: p?.builder ?? "",
      };
    });
    const data = rows.length ? rows : [Object.fromEntries(HEADERS.map((h) => [h, ""]))];
    const ws = XLSX.utils.json_to_sheet(data, { header: HEADERS });
    ws["!cols"] = HEADERS.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Properties");
    XLSX.writeFile(wb, "inventory-template.xlsx");
  };

  return (
    <div className="mb-5 flex flex-col gap-3 rounded-[6px] border border-border bg-surface p-4 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] bg-accent-soft text-accent"><FileSpreadsheet size={18} /></span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text">Bulk-import properties</div>
          <div className="text-xs text-text-muted">Upload an Excel/CSV of units — they're parsed and added straight to the inventory.</div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button onClick={downloadTemplate} className="inline-flex h-9 items-center gap-1.5 rounded-[5px] border border-border px-3 text-sm font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text">
          <Download size={15} /> Template
        </button>
        <button onClick={() => inputRef.current?.click()} disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-[5px] bg-accent px-3.5 text-sm font-semibold text-accent-contrast transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Upload Excel
        </button>
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="hidden" />
      </div>
    </div>
  );
}
