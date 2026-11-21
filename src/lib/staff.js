import { connectorConfig } from '../dataconnect-generated/staff/esm/index.esm.js';
import { checkSession } from './commerce.js';
import { connectStore, serverOnly } from './firebase.js';

export const staffDb = connectStore(connectorConfig);

export async function readStaff(uid, query, variables) {
  checkSession(uid);
  const { data } = variables === undefined ? await query(staffDb, serverOnly) : await query(staffDb, variables, serverOnly);
  checkSession(uid);
  return data;
}
