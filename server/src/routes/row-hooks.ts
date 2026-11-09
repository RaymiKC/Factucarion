import { hashPassword, isBcryptHash } from '../security/password';
import type { Row } from '../db/types';

/**
 * Table specific normalisation applied before insert/update.
 * Keeps clear text secrets out of the database: users_config handed a
 * `password` (or `temp_password`) gets it hashed with bcrypt.
 */
export async function prepareRow(table: string, row: Row): Promise<Row> {
  if (table !== 'users_config') return row;

  const prepared: Row = { ...row };

  if (typeof prepared.email === 'string') {
    prepared.email = prepared.email.toLowerCase().trim();
  }

  if (typeof prepared['password'] === 'string' && prepared['password']) {
    prepared.password_hash = await hashPassword(prepared['password'] as string);
    delete prepared['password'];
  }

  if (
    typeof prepared.temp_password === 'string' &&
    prepared.temp_password &&
    !isBcryptHash(prepared.temp_password)
  ) {
    prepared.temp_password = await hashPassword(prepared.temp_password);
  }

  return prepared;
}
