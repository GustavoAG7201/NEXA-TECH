export async function request(path, payload, uid) {
  const headers = {};
  if (payload !== undefined) headers['Content-Type'] = 'application/json';
  if (uid) headers['X-Nexa-User'] = uid;
  const response = await fetch('/api/' + path, {
    method: payload === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error), { code: data.error });
  return data;
}

export const operation = name => (values = {}, uid) => request('operations/' + name, values, uid);

export function command(name) {
  return Object.assign(operation(name), { operationName: name });
}

export const storeId = 'nexatech-native';
