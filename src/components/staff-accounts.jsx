import { useCallback, useState } from 'react';
import * as staff from '../dataconnect-generated/staff/esm/index.esm.js';
import { useResource } from '../hooks/useResource.js';
import { canonicalUuid, orderDate } from '../lib/commerce.js';
import { labelFor, optionalText, textValue } from '../lib/operations.js';
import { readStaff, staffDb } from '../lib/staff.js';
import { CommandForm, Pager, RecordList } from './operations.jsx';
import { Resource } from './ui.jsx';

function CategoryForm({ uid, category, onSaved }) {
  return <CommandForm uid={uid} connector={staffDb} command={staff.saveCategoryRef} onSaved={onSaved}
    submitLabel={category ? 'Guardar categoría' : 'Crear categoría'} values={form => ({
      id: canonicalUuid(category?.id) ?? undefined, slug: textValue(form, 'slug'), name: textValue(form, 'name'),
      description: optionalText(form, 'description'), archived: form.has('archived'),
    })}>
    <label>Nombre<input name="name" required maxLength={120} defaultValue={category?.name} /></label>
    <label>Identificador de URL<input name="slug" required maxLength={120} pattern="[a-z0-9]+(-[a-z0-9]+)*"
      readOnly={Boolean(category)} defaultValue={category?.slug} /></label>
    <label>Descripción<textarea name="description" maxLength={1000} defaultValue={category?.description ?? ''} /></label>
    {category && <label><input type="checkbox" name="archived" defaultChecked={Boolean(category.archivedAt)} /> Archivar categoría</label>}
  </CommandForm>;
}

export function StaffCategories({ uid }) {
  const [offset, setOffset] = useState(0);
  const [saved, setSaved] = useState(false);
  const load = useCallback(async () => (await readStaff(uid, staff.listStaffCategories, { offset }))
    .staffCategories.map(({ category }) => category), [uid, offset]);
  const categories = useResource(load);
  const refresh = () => { setSaved(true); categories.retry(); };
  return <section className="surface form-stack">
    <h2>Categorías del catálogo</h2>
    <details><summary>Nueva categoría</summary><CategoryForm uid={uid} onSaved={refresh} /></details>
    {saved && <p role="status" className="feedback">Categoría guardada.</p>}
    <Resource value={categories} label="Consultando categorías…">{items => <>
      <RecordList items={items} render={category => <li key={category.id}>
        <details><summary>{category.name}{category.archivedAt && ' (archivada)'}</summary>
          <CategoryForm uid={uid} category={category} onSaved={refresh} />
        </details>
      </li>} />
      <Pager offset={offset} count={items.length} onChange={setOffset} label="Páginas de categorías" />
    </>}</Resource>
  </section>;
}

export function StaffCustomers({ uid }) {
  const [offset, setOffset] = useState(0);
  const load = useCallback(async () => (await readStaff(uid, staff.listCustomers, { offset }))
    .staffCustomers.map(({ customer }) => customer), [uid, offset]);
  const customers = useResource(load);
  return <section className="surface form-stack">
    <h2>Cuentas de clientes</h2>
    <Resource value={customers} label="Consultando cuentas…">{items => <>
      <RecordList items={items} render={customer => <li key={customer.uid}>
        <div><strong>{customer.displayName}</strong><p className="muted">{customer.uid}</p>
          <p>{customer.userRoles_on_user.map(role => labelFor(role.roleCode)).join(' · ')}</p></div>
        <div><span>{labelFor(customer.status)}</span><p className="muted">Alta {orderDate(customer.createdAt)}</p></div>
      </li>} />
      <Pager offset={offset} count={items.length} onChange={setOffset} label="Páginas de clientes" />
    </>}</Resource>
  </section>;
}
