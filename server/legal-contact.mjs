const defaults = {
  provider: 'Gustavo Alonso SA de CV',
  responsible: 'Gustavo Alonso Gutierrez',
  address: 'Sierra de California 209, Colinas del Sur, C. P. 88296, Nuevo Laredo, Tamaulipas, México.',
  email: 'galonso004@outlook.com',
  phone: '8677520375',
};

export function getLegalContact(env = process.env) {
  const value = (name, fallback) => env[name]?.trim() || fallback;
  const responsible = value('LEGAL_RESPONSIBLE', defaults.responsible);
  const supportEmail = value('LEGAL_SUPPORT_EMAIL', defaults.email);
  const supportPhone = value('LEGAL_SUPPORT_PHONE', defaults.phone);
  return {
    provider: value('LEGAL_PROVIDER', defaults.provider),
    responsible,
    address: value('LEGAL_ADDRESS', defaults.address),
    privacyContact: value('LEGAL_PRIVACY_CONTACT', responsible),
    privacyEmail: value('LEGAL_PRIVACY_EMAIL', supportEmail),
    privacyPhone: value('LEGAL_PRIVACY_PHONE', supportPhone),
    supportEmail,
    supportPhone,
  };
}
