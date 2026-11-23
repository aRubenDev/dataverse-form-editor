/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_AZURE_CLIENT_ID?: string;
  readonly VITE_AZURE_TENANT?: string;
  readonly VITE_DEFAULT_ORG_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
