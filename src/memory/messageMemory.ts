import { db } from "../db/database.js";
import type { MemoryMessage, Role } from "../types/messages.js";

export function saveMessage(userId: number, role: Role, content: string): void {
  const stmt = db.prepare(`
    INSERT INTO messages (user_id, role, content)
    VALUES (?, ?, ?)
  `);
  stmt.run(userId, role, content);
}

export function getRecentMessages(userId: number, limit = 12): MemoryMessage[] {
  const stmt = db.prepare(`
    SELECT id, user_id as userId, role, content, created_at as createdAt
    FROM messages
    WHERE user_id = ?
    ORDER BY id DESC
    LIMIT ?
  `);

  const rows = stmt.all(userId, limit) as MemoryMessage[];
  return rows.reverse();
}
