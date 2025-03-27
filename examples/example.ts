import SQLite from 'better-sqlite3';
import express from 'express';
import session from 'express-session';
import { Kysely, SqliteDialect } from 'kysely';

import { ConnectSessionKyselyStore } from '../dist/index.js';
import { type Database } from '../dist/kyselyTypes.js';
import { createTable } from '../dist/utils.js';

declare module 'express-session' {
  interface SessionData {
    views: number;
  }
}

async function main() {
  const app = express();

  const dialect = new SqliteDialect({
    database: new SQLite('./sessions.sqlite'),
  });
  const kysely = new Kysely<Database>({ dialect });

  await createTable(kysely, 'sqlite', 'sessions');

  const store = new ConnectSessionKyselyStore(kysely, {
    cleanupInterval: 0, // disable session cleanup
  });

  app.use(
    session({
      secret: 'keyboard cat',
      cookie: {
        maxAge: 30000, // 30 seconds for testing
      },
      store,
      resave: false,
      saveUninitialized: false,
    })
  );

  app.use('/', (req, res) => {
    const n = req.session.views || 0;
    req.session.views = n + 1;
    res.end(`${n} views`);
  });

  app.listen(3000);

  setInterval(() => {
    store.length().then((length) => {
      console.log(`There are ${JSON.stringify(length)} sessions`);
    });
  }, 2000);

  setInterval(() => {
    store.clear().then((length) => {
      console.log(`Cleared ${JSON.stringify(length)} sessions`);
    });
  }, 30000);
}
void main();
