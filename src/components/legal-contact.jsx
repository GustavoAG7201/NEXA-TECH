import { useOutletContext } from 'react-router-dom';
import { Resource } from './ui.jsx';

const supportFields = [['supportEmail', 'Correo de atención'], ['supportPhone', 'Teléfono de atención']];
const contactFields = {
  PRIVACY: [
    ['responsible', 'Responsable'], ['address', 'Domicilio'], ['privacyContact', 'Contacto de privacidad'],
    ['privacyPhone', 'Teléfono de privacidad'], ['privacyEmail', 'Correo de contacto para privacidad'],
  ],
  TERMS: [['provider', 'Proveedor'], ['address', 'Domicilio'], ...supportFields],
  SUPPORT: supportFields,
};

function ContactValue({ field, value }) {
  if (!value) return null;
  if (field.endsWith('Email')) return <a className="text-link" href={'mailto:' + value}>{value}</a>;
  if (field.endsWith('Phone')) return <a className="text-link" href={'tel:' + value.replace(/[^\d+]/g, '')}>{value}</a>;
  return value;
}

export function PolicyContact({ kind }) {
  const { contact } = useOutletContext();
  const fields = contactFields[kind];
  if (!fields) return null;
  return <Resource value={contact} label="Consultando datos de contacto…">{value =>
    <dl className="policy-contact">{fields.filter(([field]) => value[field]).map(([field, label]) => <div key={field}>
      <dt>{label}</dt><dd><ContactValue field={field} value={value[field]} /></dd>
    </div>)}</dl>}
  </Resource>;
}

export function SupportLinks({ contact }) {
  if (!contact) return null;
  return <>
    <ContactValue field="supportEmail" value={contact.supportEmail} />
    <ContactValue field="supportPhone" value={contact.supportPhone} />
  </>;
}
