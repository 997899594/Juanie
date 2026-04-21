import { describe, expect, it, mock } from 'bun:test';

const mysqlQueryMock = mock(async () => [[{ affectedRows: 2 }, { affectedRows: 3 }]]);
const mysqlEndMock = mock(async () => undefined);
const mysqlCreateConnectionMock = mock(async () => ({
  query: mysqlQueryMock,
  end: mysqlEndMock,
}));

const mongoUpdateManyMock = mock(async () => ({ modifiedCount: 3 }));
const mongoCollectionMock = mock(() => ({
  updateMany: mongoUpdateManyMock,
}));
const mongoDbHandle = {
  collection: mongoCollectionMock,
};
const mongoDbMock = mock(() => mongoDbHandle);
const mongoConnectMock = mock(async () => undefined);
const mongoCloseMock = mock(async () => undefined);
const MongoClientMock = mock(function (this: Record<string, unknown>) {
  return {
    connect: mongoConnectMock,
    db: mongoDbMock,
    close: mongoCloseMock,
  };
});

mock.module('mysql2/promise', () => ({
  default: {
    createConnection: mysqlCreateConnectionMock,
  },
}));

mock.module('mongodb', () => ({
  BSON: {},
  MongoClient: MongoClientMock,
  ObjectId: class ObjectIdMock {},
}));

describe('migration executor database drivers', () => {
  it('executes MySQL migrations with multi-statement support', async () => {
    const { executeMySQLMigration } = await import('@/lib/migrations/executor');

    const output = await executeMySQLMigration(
      {
        id: 'db_mysql',
        name: 'primary',
        type: 'mysql',
        connectionString: 'mysql://root:secret@127.0.0.1:3306/app',
      },
      'ALTER TABLE users ADD COLUMN enabled TINYINT(1); UPDATE users SET enabled = 1;'
    );

    expect(mysqlCreateConnectionMock).toHaveBeenCalledWith({
      uri: 'mysql://root:secret@127.0.0.1:3306/app',
      multipleStatements: true,
    });
    expect(output).toBe('Rows affected: 5');
  });

  it('executes MongoDB migration scripts with top-level await', async () => {
    const { executeMongoDBMigration } = await import('@/lib/migrations/executor');

    const output = await executeMongoDBMigration(
      {
        id: 'db_mongo',
        name: 'analytics',
        type: 'mongodb',
        connectionString: 'mongodb://127.0.0.1:27017/app',
      },
      `
const result = await db.collection('users').updateMany({}, { $set: { enabled: true } });
return { modifiedCount: result.modifiedCount };
`
    );

    expect(mongoCollectionMock).toHaveBeenCalledWith('users');
    expect(output).toBe('MongoDB migration result: {"modifiedCount":3}');
  });

  it('supports CommonJS-style MongoDB migration exports', async () => {
    const { executeMongoDBMigration } = await import('@/lib/migrations/executor');

    const output = await executeMongoDBMigration(
      {
        id: 'db_mongo_cjs',
        name: 'analytics',
        type: 'mongodb',
        connectionString: 'mongodb://127.0.0.1:27017/app',
      },
      `
module.exports = async ({ db }) => {
  const result = await db.collection('audit').updateMany({}, { $set: { migrated: true } });
  return 'updated:' + result.modifiedCount;
};
`
    );

    expect(mongoCollectionMock).toHaveBeenCalledWith('audit');
    expect(output).toBe('updated:3');
  });
});
