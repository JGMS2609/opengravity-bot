import { db } from "../db/database.js";

export type InternalSkill = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
};

const defaultSkills: InternalSkill[] = [
  {
    id: "memory_profile",
    name: "Memory Profile",
    description: "Guarda y recupera datos importantes del usuario.",
    enabled: true,
  },
  {
    id: "time_helper",
    name: "Time Helper",
    description: "Ayuda con hora y fecha actual.",
    enabled: true,
  },
  {
    id: "self_improvement",
    name: "Self Improvement",
    description: "Permite listar y activar habilidades internas seguras.",
    enabled: true,
  },
];

function seedSkills(): void {
  const stmt = db.prepare(`
    INSERT INTO skills (id, name, description, enabled, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO NOTHING
  `);

  for (const skill of defaultSkills) {
    stmt.run(skill.id, skill.name, skill.description, skill.enabled ? 1 : 0);
  }
}

seedSkills();

export function listSkills(): InternalSkill[] {
  const stmt = db.prepare(`
    SELECT id, name, description, enabled
    FROM skills
    ORDER BY id ASC
  `);

  const rows = stmt.all() as Array<{
    id: string;
    name: string;
    description: string;
    enabled: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    enabled: row.enabled === 1,
  }));
}

export function getSkillById(id: string): InternalSkill | undefined {
  return listSkills().find((skill) => skill.id === id);
}

export function enableSkill(id: string): boolean {
  const stmt = db.prepare(`
    UPDATE skills
    SET enabled = 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const result = stmt.run(id);
  return result.changes > 0;
}

export function disableSkill(id: string): boolean {
  const stmt = db.prepare(`
    UPDATE skills
    SET enabled = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const result = stmt.run(id);
  return result.changes > 0;
}
