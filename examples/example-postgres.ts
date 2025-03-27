import express from 'express';
import session from 'express-session';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

import { ConnectSessionKyselyStore } from '../dist/index.js';
import { type Database } from '../dist/kyselyTypes.js';
import { createTable } from '../dist/utils.js';

declare module 'express-session' {
  interface SessionData {
    views: number;
  }
}

const app = express();

const dialect = new PostgresDialect({
  pool: new Pool({
    database: 'sessions',
    host: 'localhost',
    user: 'postgres',
    password: '',
  }),
});

const kysely = new Kysely<Database>({ dialect });

await createTable(kysely, 'postgresql', 'sessions');

const store = new ConnectSessionKyselyStore(kysely, {
  tableName: 'sessions', // optional. Defaults to 'sessions'
});

app.use(
  session({
    secret: 'keyboard cat',
    cookie: {
      maxAge: 10000, // ten seconds, for testing
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
