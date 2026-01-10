import type { Session } from '../types.js';

export interface SessionRepository {
  create(session: Session): Promise<void>;
  update(session: Session): Promise<void>;
  get(id: string): Promise<Session | null>;
  list(userId?: string): Promise<Session[]>;
  delete(id: string): Promise<void>;
}
export * from './memory.js';
