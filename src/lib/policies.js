export const policyRoutes = {
  TERMS: ['terminos', 'Términos y condiciones'],
  PRIVACY: ['privacidad', 'Aviso de privacidad'],
  SHIPPING: ['envios', 'Envíos'],
  CANCELLATION: ['cancelaciones', 'Cancelaciones'],
  RETURN: ['devoluciones', 'Devoluciones'],
  WARRANTY: ['garantias', 'Garantías'],
  SUPPORT: ['soporte', 'Atención a clientes'],
};

export const policyPath = kind => '/politicas/' + policyRoutes[kind][0];
