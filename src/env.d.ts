/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** TMDB v4 Read Access Token (eyJ…) or v3 API key. See .env.example. */
  readonly VITE_TMDB_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
