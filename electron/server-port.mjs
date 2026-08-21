import fs from "node:fs";
import path from "node:path";

export const SERVER_PORTS = Object.freeze([8799, 18799, 28799]);

export function orderedServerPorts(savedPort) {
  return SERVER_PORTS.includes(savedPort)
    ? [savedPort, ...SERVER_PORTS.filter((port) => port !== savedPort)]
    : [...SERVER_PORTS];
}

export function readSavedServerPort(userDataDir) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(userDataDir, "server-port.json"), "utf8"));
    return SERVER_PORTS.includes(parsed?.port) ? parsed.port : null;
  } catch {
    return null;
  }
}

export function saveServerPort(userDataDir, port) {
  if (!SERVER_PORTS.includes(port)) return;
  fs.mkdirSync(userDataDir, { recursive: true });
  const destination = path.join(userDataDir, "server-port.json");
  const temporary = `${destination}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify({ port }), { mode: 0o600 });
  fs.renameSync(temporary, destination);
}
