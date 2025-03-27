import SQLite from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';

import { type Database } from '../src/kyselyTypes.js';
import { ConnectSessionKyselyStore } from '../src/index.js';
import { type DbType, createTable } from '../src/utils.js';

declare module 'express-session' {
  interface SessionData {
    name: string;
  }
}

interface TestStore {
  name: string;
  dbType: DbType;
  kysely: () => Kysely<Database>;
  store: (kysely: Kysely<Database>) => ConnectSessionKyselyStore;
}

const stores: TestStore[] = [
  {
    name: 'Sqlite (memory)',
    dbType: 'sqlite',
    kysely: () => {
      const dialect = new SqliteDialect({
        database: new SQLite(':memory:'),
      });
      return new Kysely<Database>({ dialect });
    },
    store: (kysely: Kysely<Database>) => {
      return new ConnectSessionKyselyStore(kysely, {
        cleanupInterval: 0,
      });
    },
  },
];

describe.for(stores)('Session Store Tests ($name)', ({ store: thisStore, kysely, dbType }) => {
  let store: ConnectSessionKyselyStore;
  let db: Kysely<Database>;
  beforeAll(async () => {
    db = kysely();
    await createTable(db, dbType, 'sessions');
    store = thisStore(db);
  });
  afterAll(async () => {
    await db.destroy();
  });

  test('initial clear', async () => {
    await store.clear();
    const len = await store.length();
    assert.strictEqual(len, 0);
  });

  test('set then clear', async () => {
    await store.set('1092348234', {
      cookie: {
        originalMaxAge: 1000,
        maxAge: 1000,
      },
      name: 'InsertThenClear',
    });

    const cleared = await store.clear();

    assert.strictEqual(cleared, 1);

    const len = await store.length();
    assert.strictEqual(len, 0);
  });

  test('double clear', async () => {
    await store.clear();
    await store.clear();
    const cleared = await store.clear();
    assert.strictEqual(cleared, 0);

    const len = await store.length();
    assert.strictEqual(len, 0);
  });

  test('destroy', async () => {
    await store.set('555666777', {
      cookie: {
        originalMaxAge: 1000,
        maxAge: 1000,
      },
      name: 'Rob Dobilina',
    });

    await store.destroy('555666777');

    const len = await store.length();
    assert.strictEqual(len, 0);
  });

  test('set', async () => {
    await store.set('1111222233334444', {
      cookie: {
        originalMaxAge: 20000,
        maxAge: 20000,
      },
      name: 'sample name',
    });

    const len = await store.length();
    assert.strictEqual(len, 1);

    const session = await store.get('1111222233334444');

    assert.deepEqual(session, {
      cookie: {
        originalMaxAge: 20000,
        maxAge: 20000,
      },
      name: 'sample name',
    });
  });

  test('retrieve', async () => {
    const session = await store.get('1111222233334444');

    assert.deepEqual(session, {
      cookie: {
        originalMaxAge: 20000,
        maxAge: 20000,
      },
      name: 'sample name',
    });
  });

  test('unknown session', async () => {
    const item = await store.get('hope-and-change');
    assert.equal(item, undefined);
  });

  test('only one session should exist', async () => {
    const len = await store.length();
    assert.strictEqual(len, 1);
  });

  test('touch', async () => {
    await store.clear();

    await store.set('11112222333344445555', {
      cookie: {
        originalMaxAge: 20000,
        maxAge: 20000,
      },
      name: 'sample name',
    });
    await store.touch('11112222333344445555', {
      cookie: {
        originalMaxAge: 20000,
        maxAge: 20000,
        expires: new Date(),
      },
      name: 'sample name',
    });
    const len = await store.length();
    assert.strictEqual(len, 1);
  });

  test('retrieve all', async () => {
    const session1 = {
      cookie: {
        originalMaxAge: 20000,
        maxAge: 20000,
        expires: new Date(),
      },
      name: 'retrieve-all session 1',
    };

    const session2 = {
      cookie: {
        originalMaxAge: 20000,
        maxAge: 20000,
        expires: new Date(),
      },
      name: 'retrieve-all session 2',
    };

    await store.clear();
    await store.set('123412341234', session1);
    await store.set('432143214321', session2);
    const sessions = await store.all();
    assert.equal(sessions.length, 2);

    sessions.forEach((session) => {
      if (session.cookie.expires) {
        session.cookie.expires = new Date(session.cookie.expires);
      }
    });

    assert.deepEqual(
      sessions.find((s) => s.name === session1.name),
      session1
    );

    assert.deepEqual(
      sessions.find((s) => s.name === session2.name),
      session2
    );
  });

  test('no cleanup timeout when cleanupInterval is 0', () => {
    assert.equal(store.nextDbCleanup, null);
  });
});
