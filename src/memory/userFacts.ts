import { db } from "../db/database.js";

export function setUserFact(userId: number, key: string, value: string): void {
  const stmt = db.prepare(`
    INSERT INTO user_facts (user_id, key, value, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, key)
    DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(userId, key, value);
}

export function getUserFact(userId: number, key: string): string | null {
  const stmt = db.prepare(`
    SELECT value
    FROM user_facts
    WHERE user_id = ? AND key = ?
    LIMIT 1
  `);

  const row = stmt.get(userId, key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function getAllUserFacts(userId: number): Array<{ key: string; value: string }> {
  const stmt = db.prepare(`
    SELECT key, value
    FROM user_facts
    WHERE user_id = ?
    ORDER BY key ASC
  `);

  return stmt.all(userId) as Array<{ key: string; value: string }>;
}
