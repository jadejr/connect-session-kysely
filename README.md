# Connect Session Kysely

This is based on [connect-session-knex](https://github.com/gx0r/connect-session-knex) and thus the original code comes from them under the ISC license.

connect-session-kysely is an [express-session](https://github.com/expressjs/session) or fastify store backed by PostgreSQL, MySQL, MariaDB, MSSQL, QLite3, via the [kysely](https://www.kysely.dev/) library.

## Installation

```sh
$ npm install connect-session-kysely
```

## Usage

[Example application using the defaults](https://github.com/jadejr/connect-session-kysely/blob/master/examples/example.ts)

[Example application with PostgreSQL](https://github.com/gx0r/connect-session-knex/blob/master/examples/example-postgres.ts)

## Options
- `dbType` type of database to use (`'mysql' | 'postgresql' | 'sqlite'`). Kysely doesn't tell us what db we use, so we hae to hint which optimized query set we want to use
- `cleanupInterval` milliseconds between clearing expired sessions. Defaults to 60000. 0 disables the automatic clearing of expired sessions.
- `tableName='sessions'` Tablename to use. Defaults to 'sessions'.
- `sidFieldName='sid'` Field name in table to use for storing session ids. Defaults to 'sid'.

If the table does not exist in the schema, this module will attempt to create it unless the `createTable` option is false.

If a knex instance is not provided, this module will attempt to create a sqlite3 database, with a file named `connect-session-knex.sqlite`, in the working directory of the process.

## Schema

### PostgreSQL or SQLite

#### Table Name "sessions"

| Column  |           Type           | Modifiers | Storage  |
| ------- | :----------------------: | :-------: | :------: |
| sid     |  character varying(255)  | not null  | extended |
| sess    |           json           | not null  | extended |
| expired | timestamp with time zone | not null  |  plain   |

### Indexes:

```
    "sessions_pkey" PRIMARY KEY, btree (sid)
    "sessions_expired_index" btree (expired)
```

### MySQL

Table Name `sessions`.

| Column  |     Type     |  Modifiers   |
| ------- | :----------: | :----------: |
| sid     | VARCHAR(255) | NOT NULL, PK |
| sess    |     JSON     |   NOT NULL   |
| expired |   DATETIME   |   NOT NULL   |

Command to manually create table:

```sql
CREATE TABLE `sessions` (
  `sid` VARCHAR(255) NOT NULL,
  `sess` JSON NOT NULL,
  `expired` DATETIME NOT NULL,
  PRIMARY KEY (`sid`));
```
