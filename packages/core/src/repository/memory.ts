import type { Session } from '../types.js';
import type { SessionRepository } from './index.js';

export class InMemorySessionRepository implements SessionRepository {
  private sessions: Map<string, Session> = new Map();

  async create(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async update(session: Session): Promise<void> {
    if (!this.sessions.has(session.id)) {
      throw new Error(`Session ${session.id} not found`);
    }
    this.sessions.set(session.id, session);
  }

  async get(id: string): Promise<Session | null> {
    const session = this.sessions.get(id);
    return session || null;
  }

  async list(_userId?: string): Promise<Session[]> {
    // Note: userId filtering not fully supported in simple in-memory map without index
    // Returning all for now, or could filter if schema had userId
    return Array.from(this.sessions.values()).sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async delete(id: string): Promise<void> {
    this.sessions.delete(id);
  }
}
