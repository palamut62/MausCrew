import { describe, expect, it } from "vitest";

import { CrewDatabase } from "./crew-database.ts";

describe("CrewDatabase", () => {
  it("applies schema migrations once and enables integrity constraints", () => {
    const database = new CrewDatabase(":memory:");
    try {
      expect(database.db.prepare("SELECT version FROM schema_migrations").all()).toEqual([{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }, { version: 5 }, { version: 6 }]);
      expect(database.db.prepare("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });
    } finally {
      database.close();
    }
  });

  it("rolls back failed transactions", () => {
    const database = new CrewDatabase(":memory:");
    try {
      expect(() => database.transaction(() => {
        database.db.prepare("INSERT INTO agents(id, name, role, status, created_at, updated_at) VALUES ('a', 'A', 'R', 'offline', 'now', 'now')").run();
        throw new Error("stop");
      })).toThrow("stop");
      expect(database.db.prepare("SELECT count(*) AS count FROM agents").get()).toEqual({ count: 0 });
    } finally {
      database.close();
    }
  });
});
