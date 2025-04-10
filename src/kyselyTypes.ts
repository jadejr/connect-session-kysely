import type { ColumnType, Insertable, JSONColumnType, Selectable, Updateable } from 'kysely';

export interface Database {
  sessions: SessionTable;
}

export interface SessionTable {
  sid: ColumnType<string, string, never>;
  sess: JSONColumnType<object>;
  expired: ColumnType<string, Date | string, Date | string>;
}

export type Session = Selectable<SessionTable>;
export type NewSession = Insertable<SessionTable>;
export type SessionUpdate = Updateable<SessionTable>;
