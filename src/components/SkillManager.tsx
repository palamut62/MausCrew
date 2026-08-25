import { ArrowClockwise, CaretLeft, Check, FileText, FloppyDisk, GraduationCap, MagnifyingGlass, Plus, Trash, Warning, X } from "@phosphor-icons/react";
import { Spin } from "./Spin";
import { useCallback, useEffect, useState, type CSSProperties } from "react";

import { cn } from "@/lib/cn";
import { api, type Bot } from "@/state/store";

interface ManagedSkill {
  id: string;
  name: string;
  description: string;
  whenToUse: string;
  instructions: string;
  userInvocable: boolean;
  modelInvocable: boolean;
  valid: boolean;
  diagnostic?: string;
}

interface SkillDraft {
  name: string;
  description: string;
  whenToUse: string;
  instructions: string;
  userInvocable: boolean;
  modelInvocable: boolean;
}

const EMPTY_DRAFT: SkillDraft = {
  name: "",
  description: "",
  whenToUse: "",
  instructions: "",
  userInvocable: true,
  modelInvocable: true,
};

const inputClass =
  "w-full rounded-lg border border-hairline bg-inset px-3 py-2 text-[13px] text-ink placeholder:text-ink-secondary focus:border-hairline focus:outline-none";

function draftFor(skill: ManagedSkill): SkillDraft {
  return {
    name: skill.id,
    description: skill.description,
    whenToUse: skill.whenToUse,
    instructions: skill.instructions,
    userInvocable: skill.userInvocable,
    modelInvocable: skill.modelInvocable,
  };
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-inset px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ink">{label}</div>
        <div className="mt-0.5 text-[11.5px] leading-relaxed text-ink-secondary">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn("relative h-[24px] w-[40px] shrink-0 rounded-md transition-colors", checked ? "bg-accent" : "bg-raised")}
      >
        <span
          className={cn(
            "absolute top-[3px] size-[18px] rounded-sm bg-white transition-all",
            checked ? "left-[19px]" : "left-[3px]",
          )}
        />
      </button>
    </div>
  );
}

export function SkillManager({ bot, onClose }: { bot: Bot; onClose: () => void }) {
  const [skills, setSkills] = useState<ManagedSkill[] | null>(null);
  const [workspacePath, setWorkspacePath] = useState("");
  const [rootPath, setRootPath] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<SkillDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const teachFromTask = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api(`/api/bots/${bot.id}/teach-draft`, { method: "POST" });
      setDraft(result.draft);
      setEditingId(null);
      setCreating(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setSkills(null);
    else setRefreshing(true);
    setError(null);
    try {
      const result = await api(`/api/bots/${bot.id}/skills`);
      setSkills(result.skills ?? []);
      setWorkspacePath(result.workspacePath ?? "");
      setRootPath(result.rootPath ?? "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setSkills([]);
    } finally {
      setRefreshing(false);
    }
  }, [bot.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 1_800);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const openNew = () => {
    setDraft(EMPTY_DRAFT);
    setCreating(true);
    setEditingId(null);
    setDeleteId(null);
    setError(null);
  };

  const openEdit = (skill: ManagedSkill) => {
    setDraft(draftFor(skill));
    setEditingId(skill.id);
    setCreating(false);
    setDeleteId(null);
    setError(null);
  };

  const closeEditor = () => {
    setCreating(false);
    setEditingId(null);
    setDeleteId(null);
    setError(null);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const path = editingId
        ? `/api/bots/${bot.id}/skills/${editingId}`
        : `/api/bots/${bot.id}/skills`;
      const result = await api(path, {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(draft),
      });
      const next = result.skill as ManagedSkill;
      setSkills((current) => {
        const remaining = (current ?? []).filter((skill) => skill.id !== next.id);
        return [...remaining, next].sort((a, b) => a.name.localeCompare(b.name));
      });
      setSaved(true);
      closeEditor();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (deleteId !== id) {
      setDeleteId(id);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/api/bots/${bot.id}/skills/${id}`, { method: "DELETE" });
      setSkills((current) => (current ?? []).filter((skill) => skill.id !== id));
      setSaved(true);
      closeEditor();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const editorOpen = creating || editingId !== null;
  const visible = (skills ?? []).filter((skill) => {
    const query = search.trim().toLowerCase();
    return !query || `${skill.name} ${skill.description} ${skill.whenToUse}`.toLowerCase().includes(query);
  });
  const canSave = Boolean(draft.name.trim() && draft.description.trim() && draft.instructions.trim()) && !busy;
  const isWin = window.mauscrew?.platform === "win32";
  const drag = isWin ? ({ WebkitAppRegion: "drag" } as CSSProperties) : undefined;
  const noDrag = isWin ? ({ WebkitAppRegion: "no-drag" } as CSSProperties) : undefined;

  return (
    <aside className="animate-panel-in flex h-full min-w-0 w-[312px] max-w-full shrink-0 flex-col border-l border-hairline bg-panel max-md:absolute max-md:inset-0 max-md:z-50 max-md:w-full max-md:border-l-0">
      <div
        className={cn(
          "flex min-h-[60px] shrink-0 items-center justify-between gap-2 border-b border-hairline px-4",
          isWin && "pr-[148px]",
        )}
        style={drag}
      >
        <button
          onClick={editorOpen ? closeEditor : onClose}
          aria-label={editorOpen ? "Back to skills" : "Back to bot settings"}
          className="shrink-0 rounded-md p-1 text-ink-secondary hover:bg-raised hover:text-ink"
          style={noDrag}
        >
          <CaretLeft size={18} weight="bold" />
        </button>
        <span className="min-w-0 truncate text-[15px] font-semibold text-ink">{editorOpen ? (editingId ? "Edit skill" : "New skill") : "Skill Center"}</span>
        <button onClick={onClose} aria-label="Close Skill Center" className="shrink-0 rounded-md p-1 text-ink-secondary hover:bg-raised hover:text-ink" style={noDrag}>
          <X size={18} weight="bold" />
        </button>
      </div>

      {editorOpen ? (
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <label className="block">
              <div className="mb-1.5 text-[12px] text-ink-secondary">Skill name</div>
              <input
                autoFocus
                value={draft.name}
                disabled={Boolean(editingId)}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))}
                placeholder="code-review"
                className={cn(inputClass, "font-mono disabled:opacity-60")}
              />
              <div className="mt-1 text-[11px] text-ink-secondary">Lowercase kebab-case; the folder name is permanent.</div>
            </label>

            <label className="block">
              <div className="mb-1.5 text-[12px] text-ink-secondary">Description</div>
              <textarea
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="What this skill does and when it helps"
                rows={3}
                className={cn(inputClass, "resize-y")}
              />
            </label>

            <label className="block">
              <div className="mb-1.5 text-[12px] text-ink-secondary">When to use</div>
              <textarea
                value={draft.whenToUse}
                onChange={(event) => setDraft((current) => ({ ...current, whenToUse: event.target.value }))}
                placeholder="Optional trigger guidance for the agent"
                rows={2}
                className={cn(inputClass, "resize-y")}
              />
            </label>

            <label className="block">
              <div className="mb-1.5 text-[12px] text-ink-secondary">Instructions</div>
              <textarea
                value={draft.instructions}
                onChange={(event) => setDraft((current) => ({ ...current, instructions: event.target.value }))}
                placeholder="Write the exact workflow the agent should follow…"
                rows={12}
                className={cn(inputClass, "min-h-[240px] resize-y font-mono text-[12px] leading-relaxed")}
              />
            </label>

            <Toggle
              checked={draft.modelInvocable}
              onChange={(modelInvocable) => setDraft((current) => ({ ...current, modelInvocable }))}
              label="Agent can choose it"
              description="Show this skill in the model-facing catalog."
            />
            <Toggle
              checked={draft.userInvocable}
              onChange={(userInvocable) => setDraft((current) => ({ ...current, userInvocable }))}
              label="User can invoke it"
              description={`Allow explicit use with /${draft.name || "skill-name"}.`}
            />

            {error ? <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">{error}</div> : null}

            <div className="flex items-center justify-between gap-2 border-t border-hairline pt-4">
              {editingId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(editingId)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] disabled:opacity-50",
                    deleteId === editingId ? "bg-danger text-white" : "text-danger hover:bg-danger/10",
                  )}
                >
                  <Trash size={14} weight="bold" /> {deleteId === editingId ? "Delete permanently" : "Delete"}
                </button>
              ) : <span />}
              <div className="flex gap-2">
                <button type="button" onClick={closeEditor} className="rounded-lg px-3 py-2 text-[12.5px] text-ink-secondary hover:bg-raised hover:text-ink">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!canSave}
                  onClick={() => void save()}
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[12.5px] font-medium text-app hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? <Spin size={14} weight="fill" /> : <FloppyDisk size={14} weight="bold" />} Save skill
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="px-5 pt-4">
            <div className="text-[13px] leading-relaxed text-ink-secondary">
              Reusable instructions this bot can discover from its workspace. Type <span className="font-mono text-ink">/skill-name</span> or ask the agent to use one.
            </div>
            {workspacePath ? <div className="mt-2 truncate font-mono text-[10.5px] text-ink-secondary" title={rootPath}>{rootPath}</div> : null}
            {error ? <div className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">{error}</div> : null}
            <div className="mt-4 flex gap-2">
              <label className="relative min-w-0 flex-1">
                <MagnifyingGlass size={14} weight="bold" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-secondary" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search skills" className={cn(inputClass, "pl-9")} />
              </label>
              <button
                type="button"
                onClick={() => void load(true)}
                disabled={refreshing}
                title="Refresh skills"
                className="rounded-lg border border-hairline bg-card px-2.5 text-ink-secondary hover:bg-raised hover:text-ink disabled:opacity-50"
              >
                <ArrowClockwise size={15} weight="bold" className={cn(refreshing && "maus-spin")} />
              </button>
              <button type="button" onClick={openNew} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 text-[12.5px] font-medium text-app hover:brightness-110">
                <Plus size={15} weight="bold" /> New
              </button>
            </div>
            <button
              type="button"
              onClick={() => void teachFromTask()}
              disabled={busy}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-accent/25 bg-accent/10 px-3 py-2 text-[12px] font-medium text-accent hover:bg-accent/15 disabled:opacity-50"
            >
              {busy ? <Spin size={14} weight="fill" /> : <GraduationCap size={15} weight="bold" />}
              Teach from current task
            </button>
            <div className="mt-1.5 text-[10.5px] leading-relaxed text-ink-secondary">
              Creates an editable draft from this task. Nothing is written until you review and save it.
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {skills === null ? (
              <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-ink-secondary"><Spin size={15} weight="fill" /> Loading skills…</div>
            ) : visible.length === 0 ? (
              <div className="rounded-xl border border-dashed border-hairline px-5 py-10 text-center">
                <FileText size={24} className="mx-auto text-ink-secondary" />
                <div className="mt-3 text-[14px] font-medium text-ink">{search ? "No matching skills" : "No skills yet"}</div>
                <div className="mt-1 text-[12px] leading-relaxed text-ink-secondary">{search ? "Try a different search." : "Create reusable instructions for this workspace."}</div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-hairline bg-card">
                {visible.map((skill, index) => (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => openEdit(skill)}
                    className={cn("flex w-full items-start gap-3 px-3.5 py-3 text-left hover:bg-raised/60", index > 0 && "border-t border-hairline")}
                  >
                    <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg", skill.valid ? "bg-accent/10 text-accent" : "bg-warning/10 text-warning")}>
                      {skill.valid ? <FileText size={14} weight="bold" /> : <Warning size={14} weight="bold" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-mono text-[12.5px] font-medium text-ink">{skill.name}</span>
                        {!skill.modelInvocable ? <span className="text-[10.5px] text-ink-secondary">user only</span> : null}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-relaxed text-ink-secondary">{skill.diagnostic || skill.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {saved ? <div className="flex items-center justify-center gap-1.5 border-t border-hairline px-4 py-2 text-[12px] text-success"><Check size={13} weight="fill" /> Skill changes saved</div> : null}
        </>
      )}
    </aside>
  );
}
