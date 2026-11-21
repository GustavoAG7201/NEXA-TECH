import { commands } from './commands.mjs';
import { HttpError } from './errors.mjs';
import { queries } from './queries.mjs';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const date = /^\d{4}-\d{2}-\d{2}$/;
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const validators = {
  String: value => typeof value === 'string' && !value.includes('\0'),
  UUID: value => typeof value === 'string' && uuid.test(value),
  Int: value => Number.isInteger(value) && value >= -2147483648 && value <= 2147483647,
  Int64: value => {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) return false;
    if (!['number', 'string'].includes(typeof value) || !/^-?\d{1,19}$/.test(value)) return false;
    const n = BigInt(value);
    return n >= -9223372036854775808n && n <= 9223372036854775807n;
  },
  Date: value => typeof value === 'string' && date.test(value) &&
    value.slice(0, 4) !== '0000' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().startsWith(value),
  Timestamp: value => typeof value === 'string' && timestamp.test(value) && Number.isFinite(Date.parse(value)),
  Boolean: value => typeof value === 'boolean',
  Any: () => true,
};

function bindVariables(specification, supplied) {
  return Object.fromEntries(Object.entries(specification).map(([name, type]) => {
    const value = Object.hasOwn(supplied, name) ? supplied[name] : null;
    const required = type.endsWith('!');
    const scalar = type.replace('!', '');
    if (value == null) {
      if (required) throw new HttpError(400, 'INVALID_DATA');
      return [name, null];
    }
    if (!validators[scalar](value) || (name.toLowerCase().endsWith('offset') && value < 0)) {
      throw new HttpError(400, 'INVALID_DATA');
    }
    return [name, scalar === 'Int64' ? BigInt(value).toString() : value];
  }));
}

export function findOperation(name) {
  if (Object.hasOwn(queries, name)) return queries[name];
  if (Object.hasOwn(commands, name)) return commands[name];
  throw new HttpError(404, 'NOT_FOUND');
}

export async function executeOperation(pool, operation, supplied, identity) {
  const values = bindVariables(operation.variables, supplied);
  if (operation.sql) {
    const { rows: [row] } = await pool.query(operation.sql, operation.params.map(name => name === 'uid' ? identity.uid : values[name]));
    return { [operation.root]: row.result };
  }

  const input = Object.fromEntries(Object.entries(operation.input).map(([name, source]) => [
    name, source === '@email' ? identity.email : typeof source === 'string' ? values[source.slice(1)] : source,
  ]));
  const parameters = [identity.uid, values.key, operation.kind, JSON.stringify(input)];
  await pool.query(`
    INSERT INTO public.commerce_command (actor_uid, idempotency_key, kind, input)
    VALUES ($1, $2, $3, $4) ON CONFLICT (actor_uid, idempotency_key) DO NOTHING`, parameters);
  const { rows: [result] } = await pool.query(`
    SELECT kind, input_version AS "inputVersion", input_digest AS "inputDigest", status,
      result_code AS "resultCode", result_id AS "resultId",
      input_digest = encode(sha256(convert_to(jsonb_build_array(input_version, $3::text, $4::jsonb)::text, 'UTF8')), 'hex') AS "sameInput"
    FROM public.commerce_command WHERE actor_uid = $1 AND idempotency_key = $2`, parameters);
  if (!result) throw new HttpError(503, 'COMMAND_UNAVAILABLE');
  const { sameInput, ...response } = result;
  if (!sameInput) throw new HttpError(409, 'IDEMPOTENCY_CONFLICT');
  return response;
}
