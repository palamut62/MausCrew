import { api } from "@/state/store";

interface ExportedTeam {
  team: {
    name: string;
    members: unknown[];
  };
}

function downloadManifest(manifest: ExportedTeam): { name: string; members: number } {
  const slug =
    manifest.team.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "mauscrew-team";
  const blob = new Blob([`${JSON.stringify(manifest, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slug}.mausteam.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // There is no browser event for "download has consumed this URL". Keep it
  // alive long enough for slower engines to start reading, then clean it up.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { name: manifest.team.name, members: manifest.team.members.length };
}

/** Export an ad-hoc selection of bots without creating a room first.
 *
 * `include` decides how much of each bot travels. Skills are procedures the
 * user wrote on purpose and make a shared bot able to do the job rather than
 * only describe it, so they default to on. Memory is the one field likely to
 * hold something about the user's own life; it travels only when this screen
 * says so. */
export async function downloadSelectedTeam(
  name: string,
  memberIds: string[],
  include: { skills: boolean; memory: boolean } = { skills: true, memory: false },
): Promise<{ name: string; members: number }> {
  const manifest = (await api("/api/teams/export", {
    method: "POST",
    body: JSON.stringify({ name, memberIds, include }),
  })) as ExportedTeam;
  return downloadManifest(manifest);
}
