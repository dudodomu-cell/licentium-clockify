import { fetchEntries, fetchProjects } from "@/lib/db";
import { ProjectsList } from "@/components/projects-list";
import { durationMinutes } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [projects, entries] = await Promise.all([
    fetchProjects({ includeArchived: true }),
    fetchEntries({}),
  ]);

  // Aggregate hours / amount per project across all time and all users.
  const stats = new Map<string, { minutes: number; earned: number; users: number }>();
  const userSets = new Map<string, Set<string>>();
  for (const e of entries) {
    if (!e.project_id) continue;
    const m = durationMinutes(e.starts_at, e.ends_at);
    const earned = (m / 60) * Number(e.rate);
    const prev = stats.get(e.project_id) ?? { minutes: 0, earned: 0, users: 0 };
    stats.set(e.project_id, {
      minutes: prev.minutes + m,
      earned: prev.earned + earned,
      users: prev.users,
    });
    const set = userSets.get(e.project_id) ?? new Set<string>();
    set.add(e.user_id);
    userSets.set(e.project_id, set);
  }
  for (const [pid, set] of userSets) {
    const prev = stats.get(pid)!;
    stats.set(pid, { ...prev, users: set.size });
  }

  return (
    <main>
      <div className="hero">
        <h1>Projects</h1>
        <p>
          Tags you can assign to time entries. Anyone on the team can create,
          edit, archive, or delete &mdash; the team is small and fully
          collaborative here.
        </p>
      </div>

      <section>
        <div className="section-head">
          <div className="section-num">
            <b>01 /</b> All projects
          </div>
        </div>
        <ProjectsList projects={projects} stats={stats} />
      </section>
    </main>
  );
}
