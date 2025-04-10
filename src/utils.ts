import { Kysely, RawBuilder, sql } from 'kysely';

import { Database } from './kyselyTypes.js';

export type DbType = 'mysql' | 'sqlite' | 'postgresql';

export function getFastQueryIfExists(
  dbType: DbType,
  tableName: string,
  sidFieldName: string,
  sid: string,
  dbDate: string,
  sess: string
): RawBuilder<boolean> | null {
  if (dbType === 'sqlite') {
    return sql`insert or replace into ${sql.table(tableName)} (${sql.ref(sidFieldName)}, expired, sess) values (${sid}, ${dbDate}, ${sess})`;
  } else if (dbType === 'postgresql') {
    return sql`
    with new_values (${sql.ref(sidFieldName)}, expired, sess) as (
      values (${sid}, ${dbDate}::timestamp with time zone, ${sess}::json)
    ),
    upsert as (
      update ${sql.table(tableName)} cs set
        ${sql.ref(sidFieldName)} = nv.${sql.ref(sidFieldName)},
        expired = nv.expired,
        sess = nv.sess
      from new_values nv
      where cs.${sql.ref(sidFieldName)} = nv.${sql.ref(sidFieldName)}
      returning cs.*
    )
    insert into ${sql.table(tableName)} (${sql.ref(sidFieldName)}, expired, sess)
    select ${sql.ref(sidFieldName)}, expired, sess
    from new_values
    where not exists (
      select 1 from upsert up 
      where up.${sql.ref(sidFieldName)} = new_values.${sql.ref(sidFieldName)}
    )
  `;
  } else if (dbType === 'mysql') {
    return sql`insert into ${sql.table(tableName)} (${sql.ref(sidFieldName)}, expired, sess) 
    values (${sid}, ${dbDate}, ${sess}) 
    on duplicate key update expired=values(expired), sess=values(sess)`;
  } else {
    return null;
  }
}

// this is a workaround until kysely supporrts CREATE TABLE IF NOT EXISTS
async function checkForTable(kysely: Kysely<Database>, dbType: DbType, tableName: string) {
  const result = await kysely.introspection
    .getTables()
    .then((tables) => tables.some((table) => table.name === tableName));
  return result;
}

export async function createTable(kysely: Kysely<Database>, dbType: DbType, tableName: string) {
  const hasTable = await checkForTable(kysely, dbType, tableName);
  if (hasTable) {
    return;
  }
  const jsonType = dbType === 'postgresql' ? 'jsonb' : 'json';
  const dateTimeType = dbType === 'mysql' ? 'datetime' : 'timestamp';

  await kysely.schema
    .createTable(tableName)
    .addColumn('sid', 'varchar(255)', (col) => col.primaryKey())
    .addColumn('sess', jsonType)
    .addColumn('expired', dateTimeType, (col) => col.notNull())
    .execute();

  await kysely.schema.createIndex('expired_index').columns(['expired']).on(tableName).execute();

  return;
}
