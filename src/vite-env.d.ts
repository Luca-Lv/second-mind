/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 云模式：云环境 endpoint。留空则启用本地模式。 */
  readonly VITE_CLOUD_ENDPOINT?: string
  /** 云模式：可公开的前端 publishableKey（只标识应用，不带权限）。 */
  readonly VITE_CLOUD_KEY?: string
  /** 云模式：OAuth 中继地址，一般不需要改。 */
  readonly VITE_CLOUD_OAUTH_RELAY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
