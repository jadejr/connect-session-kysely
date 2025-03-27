import { Kysely, sql } from 'kysely';
import { SessionData, Store } from 'express-session';

import { Database } from './kyselyTypes.js';
import { DbType, getFastQueryIfExists, timestampTypeName, expiredCondition } from './utils.js';

export interface Options {
  cleanupInterval: number; // 0 disables
  dbType: DbType;
  onDbCleanupError: (err: unknown) => void;
  tableName: string;
  sidFieldName: string;
}

export class ConnectSessionKyselyStore extends Store {
  #kysely: Kysely<Database>;
  #ready: Promise<unknown>; // Schema created
  nextDbCleanup: NodeJS.Timeout | undefined;
  options: Options;

  constructor(kysely: Kysely<Database>, options: Partial<Options>) {
    super();

    if (!kysely) {
      throw new Error('kysely instance is required');
    }
    this.#kysely = kysely;

    this.options = {
      cleanupInterval: 60000,
      sidFieldName: 'sid',
      tableName: 'sessions',
      dbType: 'sqlite',
      onDbCleanupError: (err: unknown) => {
        console.error(err);
      },
      ...options,
    } as Options;

    const { cleanupInterval } = this.options;

    this.#ready = (async () => {
      if (cleanupInterval > 0) {
        await this.dbCleanup();
      }
    })();
  }

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async get(sid: string, callback?: (err: Error | null, session?: SessionData | null) => void) {
    try {
      await this.#ready;
      const { dbType, tableName, sidFieldName } = this.options;

      const response = await this.#kysely
        .selectFrom(tableName as 'sessions')
        .select('sess')
        .where(sidFieldName as 'sid', '=', sid)
        .where(expiredCondition(dbType, new Date().toISOString()))
        .executeTakeFirst();

      let session: SessionData | null = null;
      if (response) {
        session = response.sess as SessionData;
        if (typeof session === 'string') {
          session = JSON.parse(session) as SessionData;
        }
      }
      callback?.(null, session);
      return session;
    } catch (err) {
      callback?.(err as Error);
      throw err;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async set(sid: string, session: SessionData, callback?: (err?: Error | null) => void) {
    try {
      await this.#ready;
      const { dbType, tableName, sidFieldName } = this.options;
      const { maxAge } = session.cookie;
      const now = new Date().getTime();
      const expired = maxAge ? now + maxAge : now + 86400000; // 86400000 = add one day
      const sess = JSON.stringify(session);

      const dbDate = new Date(expired).toISOString();

      const fastQuery = getFastQueryIfExists(dbType, tableName, sidFieldName, sid, dbDate, sess);
      if (fastQuery) {
        await this.#kysely.executeQuery(fastQuery.compile(this.#kysely));
      } else {
        await this.#kysely.transaction().execute(async (trx) => {
          const foundKeys = await trx
            .selectFrom(tableName as 'sessions')
            .selectAll()
            .forUpdate()
            .where(sidFieldName as 'sid', '=', sid)
            .execute();

          if (foundKeys.length === 0) {
            await trx
              .insertInto(tableName as 'sessions')
              .values({
                [sidFieldName as 'sid']: sid,
                expired: dbDate,
                sess,
              })
              .execute();
          } else {
            await trx
              .updateTable(tableName as 'sessions')
              .set({
                expired: dbDate,
                sess,
              })
              .where(sidFieldName as 'sid', '=', sid)
              .execute();
          }
        });
      }

      callback?.();
    } catch (err) {
      callback?.(err as Error);
      throw err;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async touch(sid: string, session: SessionData, callback?: () => void) {
    await this.#ready;
    const { dbType, tableName, sidFieldName } = this.options;

    if (session.cookie && session.cookie.expires) {
      await this.#kysely
        .updateTable(tableName as 'sessions')
        .where(sidFieldName as 'sid', '=', sid)
        .where(expiredCondition(dbType, new Date().toISOString()))
        .set({
          expired: new Date(session.cookie.expires).toISOString(),
        })
        .execute();
    }
    callback?.();
  }

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async destroy(sid: string, callback?: (err?: Error) => void) {
    try {
      await this.#ready;
      const { tableName, sidFieldName } = this.options;

      const retVal = await this.#kysely
        .deleteFrom(tableName as 'sessions')
        .where(sidFieldName as 'sid', '=', sid)
        .execute();
      callback?.();
      return retVal;
    } catch (err) {
      callback?.(err as Error);
      throw err;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async length(callback?: (err: Error | null, length?: number) => void) {
    try {
      await this.#ready;
      const { tableName, sidFieldName } = this.options;

      const response = await this.#kysely
        .selectFrom(tableName as 'sessions')
        .select((eb) => [eb.fn.count(sidFieldName as 'sid').as('count')])
        .executeTakeFirst();

      const length = Number(response?.count ?? 0);

      callback?.(null, length);
      return length;
    } catch (err) {
      callback?.(err as Error);
      throw err;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async clear(callback?: (err?: Error | null) => void) {
    try {
      await this.#ready;
      const { tableName } = this.options;

      const res = await this.#kysely.deleteFrom(tableName as 'sessions').executeTakeFirst();

      callback?.();
      return Number(res.numDeletedRows);
    } catch (err) {
      callback?.(err as Error);
      throw err;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async all(callback?: (err?: Error | null, obj?: SessionData[] | { [sid: string]: SessionData } | null) => void) {
    try {
      await this.#ready;
      const { dbType, tableName } = this.options;

      const rows = await this.#kysely
        .selectFrom(tableName as 'sessions')
        .select('sess')
        .where(expiredCondition(dbType, new Date().toISOString()))
        .execute();

      const sessions = rows.map((row) => {
        if (typeof row.sess === 'string') {
          return JSON.parse(row.sess) as SessionData;
        }
        return row.sess as SessionData;
      });

      callback?.(undefined, sessions);
      return sessions;
    } catch (err) {
      callback?.(err as Error);
      throw err;
    }
  }

  private async dbCleanup() {
    const { cleanupInterval, dbType, tableName, onDbCleanupError } = this.options;

    try {
      const condition =
        dbType === 'sqlite'
          ? sql<boolean>`datetime(${new Date().toISOString()}) < datetime(expired)`
          : sql<boolean>`CAST(${new Date().toISOString()} as ${sql.raw(timestampTypeName(dbType))}) < expired`;

      await this.#kysely
        .deleteFrom(tableName as 'sessions')
        .where(condition)
        .execute();
    } catch (err: unknown) {
      onDbCleanupError?.(err);
    } finally {
      if (cleanupInterval > 0) {
        this.nextDbCleanup = setTimeout(() => {
          this.dbCleanup().catch(console.error);
        }, cleanupInterval).unref();
      }
    }
  }
}
