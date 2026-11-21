# NexaTech

La [implementación local de NexaTech](docs/implementacion-local.md) documenta el esquema, los conectores y las pruebas con el emulador de Firebase SQL Connect.

El [estado actual de NexaTech](docs/ESTADO_ACTUAL_NEXATECH.md) reúne los resultados hasta G1. Con PostgreSQL 18 y Firebase CLI configurados, `npm.cmd run dev:local` inicia la tienda, la autenticación y el catálogo de demostración en `127.0.0.1`. [Preparación y pruebas](docs/implementacion-local.md#tienda-integrada-de-la-fase-e1)

El build para Hosting toma los identificadores públicos de la aplicación web de `nexatech-58ce3` desde `.env.production.local`. La [guía de publicación](docs/preparacion-publicacion-g1.md) documenta la configuración, las pruebas y las autorizaciones pendientes.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
