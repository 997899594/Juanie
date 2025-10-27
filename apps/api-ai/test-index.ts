import { pgTable, text, index, uuid } from 'drizzle-orm/pg-core';

const testTable = pgTable('test', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
});

const testIdx = index('test_name_idx').on(testTable.name);

console.log('Index created successfully:', testIdx);
