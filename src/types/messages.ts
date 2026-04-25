export type Role = "system" | "user" | "assistant";

export interface MemoryMessage {
  id?: number;
  userId: number;
  role: Role;
  content: string;
  createdAt?: string;
}
