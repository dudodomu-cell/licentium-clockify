import Link from "next/link";
import type { Profile, Project } from "@/lib/types";
import { DatePicker } from "./date-picker";

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "thisWeek", label: "This week" },
  { key: "thisMonth", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "all", label: "All" },
] as const;

export function FilterBar({
  profiles,
  projects,
  current,
  basePath,
  showUserFilter = true,
}: {
  profiles: Profile[];
  projects: Project[];
  current: {
    user?: string;
    project?: string;
    from?: string;
    to?: string;
    preset?: string;
  };
  basePath: string;
  showUserFilter?: boolean;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="filters">
        {PRESETS.map((p) => (
          <Link
            key={p.key}
            href={`${basePath}?preset=${p.key}`}
            className={`btn ${current.preset === p.key ? "primary" : ""}`}
          >
            {p.label}
          </Link>
        ))}
      </div>
      <form method="get" action={basePath} className="filters">
        {showUserFilter && (
          <label className="field">
            User
            <select
              className="select sm"
              name="user"
              defaultValue={current.user ?? ""}
            >
              <option value="">Everyone</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          Project
          <select
            className="select sm"
            name="project"
            defaultValue={current.project ?? ""}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.archived ? `(archived) ${p.name}` : p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          From
          <DatePicker name="from" defaultValue={current.from} />
        </label>
        <label className="field">
          To
          <DatePicker name="to" defaultValue={current.to} />
        </label>
        <button type="submit" className="btn primary">
          Apply
        </button>
        <Link href={basePath} className="btn">
          Reset
        </Link>
      </form>
    </div>
  );
}
