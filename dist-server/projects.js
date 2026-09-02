import { readFileSync } from "node:fs";
import { join } from "node:path";
import { writeFileAtomic } from "./atomic.js";
import { DATA_DIR } from "./config.js";
import { newId } from "./contracts.js";
const PROJECTS_FILE = join(DATA_DIR, "projects.json");
function cleanText(value, max) {
    return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function cleanResources(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .slice(0, 40)
        .map((entry) => {
        const row = entry && typeof entry === "object" ? entry : {};
        const label = cleanText(row.label, 80);
        const itemValue = cleanText(row.value, 2_000);
        return label && itemValue ? { id: cleanText(row.id, 100) || newId(), label, value: itemValue } : null;
    })
        .filter((entry) => Boolean(entry));
}
function publicProject(value) {
    const id = cleanText(value.id, 100);
    const name = cleanText(value.name, 80);
    if (!id || !name)
        return null;
    const createdAt = Number(value.createdAt) || Date.now();
    return {
        id,
        name,
        description: cleanText(value.description, 500),
        workspacePath: cleanText(value.workspacePath, 4_096) || undefined,
        instructions: cleanText(value.instructions, 8_000),
        resources: cleanResources(value.resources),
        roomIds: Array.isArray(value.roomIds)
            ? [...new Set(value.roomIds.filter((roomId) => typeof roomId === "string"))]
            : [],
        createdAt,
        updatedAt: Number(value.updatedAt) || createdAt,
    };
}
export class ProjectManager {
    projects = [];
    file;
    constructor(file = PROJECTS_FILE) {
        this.file = file;
        try {
            const rows = JSON.parse(readFileSync(file, "utf8"));
            this.projects = Array.isArray(rows)
                ? rows.map((row) => publicProject(row)).filter((row) => Boolean(row))
                : [];
        }
        catch {
            this.projects = [];
        }
    }
    list() {
        return this.projects.map((project) => structuredClone(project));
    }
    get(id) {
        const project = this.projects.find((candidate) => candidate.id === id);
        return project ? structuredClone(project) : undefined;
    }
    create(input) {
        const name = cleanText(input.name, 80);
        if (!name)
            throw Object.assign(new Error("Give the project a name"), { status: 400 });
        const now = Date.now();
        const project = {
            id: newId(),
            name,
            description: cleanText(input.description, 500),
            workspacePath: cleanText(input.workspacePath, 4_096) || undefined,
            instructions: cleanText(input.instructions, 8_000),
            resources: cleanResources(input.resources),
            roomIds: [...new Set(input.roomIds ?? [])],
            createdAt: now,
            updatedAt: now,
        };
        this.projects.unshift(project);
        this.save();
        return structuredClone(project);
    }
    update(id, patch) {
        const project = this.projects.find((candidate) => candidate.id === id);
        if (!project)
            return null;
        if (patch.name !== undefined) {
            const name = cleanText(patch.name, 80);
            if (!name)
                throw Object.assign(new Error("Give the project a name"), { status: 400 });
            project.name = name;
        }
        if (patch.description !== undefined)
            project.description = cleanText(patch.description, 500);
        if (patch.workspacePath !== undefined)
            project.workspacePath = cleanText(patch.workspacePath, 4_096) || undefined;
        if (patch.instructions !== undefined)
            project.instructions = cleanText(patch.instructions, 8_000);
        if (patch.resources !== undefined)
            project.resources = cleanResources(patch.resources);
        if (patch.roomIds !== undefined)
            project.roomIds = [...new Set(patch.roomIds)];
        project.updatedAt = Date.now();
        this.save();
        return structuredClone(project);
    }
    attachRoom(projectId, roomId) {
        const project = this.projects.find((candidate) => candidate.id === projectId);
        if (!project)
            return null;
        if (!project.roomIds.includes(roomId))
            project.roomIds.push(roomId);
        project.updatedAt = Date.now();
        this.save();
        return structuredClone(project);
    }
    detachRoom(roomId) {
        const changed = [];
        for (const project of this.projects) {
            if (!project.roomIds.includes(roomId))
                continue;
            project.roomIds = project.roomIds.filter((id) => id !== roomId);
            project.updatedAt = Date.now();
            changed.push(structuredClone(project));
        }
        if (changed.length)
            this.save();
        return changed;
    }
    remove(id) {
        const at = this.projects.findIndex((candidate) => candidate.id === id);
        if (at < 0)
            return null;
        const [removed] = this.projects.splice(at, 1);
        this.save();
        return structuredClone(removed);
    }
    systemBlock(id) {
        if (!id)
            return "";
        const project = this.projects.find((candidate) => candidate.id === id);
        if (!project)
            return "";
        const resources = project.resources.length
            ? `\nProject resources:\n${project.resources.map((resource) => `- ${resource.label}: ${resource.value}`).join("\n")}`
            : "";
        return `Project: ${project.name} [id: ${project.id}].${project.description ? ` ${project.description}` : ""}${project.instructions ? `\nProject instructions:\n${project.instructions}` : ""}${resources}`;
    }
    save() {
        writeFileAtomic(this.file, JSON.stringify(this.projects, null, 2));
    }
}
