import { describe, expect, it } from '@jest/globals';
import { EVIDENCE_MIME_TYPES, PUSH_PLATFORMS, ROLES, TASK_STATUSES } from '@fieldmate/shared';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { devicePushTokens, taskEvidence, taskStatus, userRole } from './schema.js';

/**
 * The CHECK constraints for file_type and platform hardcode their values in SQL.
 * These tests fail if they ever drift from the shared constants (docs/05 §3).
 */
function checkSql(table: Parameters<typeof getTableConfig>[0], name: string): string {
  const constraint = getTableConfig(table).checks.find((c) => c.name === name);
  if (!constraint) throw new Error(`Missing CHECK constraint ${name}`);
  return constraint.value.queryChunks
    .map((chunk) => (typeof chunk === 'object' && 'value' in chunk ? chunk.value : ''))
    .join('');
}

describe('schema constants stay in sync with @fieldmate/shared', () => {
  it('evidence file_type CHECK lists exactly the shared mime types', () => {
    const sql = checkSql(taskEvidence, 'task_evidence_file_type');
    for (const mime of EVIDENCE_MIME_TYPES) expect(sql).toContain(`'${mime}'`);
    expect(sql.match(/'[^']+'/g)).toHaveLength(EVIDENCE_MIME_TYPES.length);
  });

  it('push token platform CHECK lists exactly the shared platforms', () => {
    const sql = checkSql(devicePushTokens, 'device_push_tokens_platform');
    for (const platform of PUSH_PLATFORMS) expect(sql).toContain(`'${platform}'`);
    expect(sql.match(/'[^']+'/g)).toHaveLength(PUSH_PLATFORMS.length);
  });

  it('enums match the shared role and status values', () => {
    expect(userRole.enumValues).toEqual([...ROLES]);
    expect(taskStatus.enumValues).toEqual([...TASK_STATUSES]);
  });
});
