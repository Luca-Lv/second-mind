import { createWorkBuddyCloud } from '@tencent-ai/workbuddy-cloud-sdk'
import { localAuth, localDb } from './backend/local'

/**
 * 两种运行模式，靠环境变量切换：
 *
 * 1) 本地模式（默认）—— 没有配置 VITE_CLOUD_* 时启用。
 *    数据存在浏览器 localStorage，零依赖、零配置，`npm run dev` 直接可用。
 *
 * 2) 云模式 —— 配置了 VITE_CLOUD_ENDPOINT 与 VITE_CLOUD_KEY 时启用。
 *    走云数据库，支持手机号验证码登录、跨设备同步、行级账号隔离。
 *
 * 配置写在 `.env.local`（已被 .gitignore 排除），格式见 `.env.example`。
 */
const env = import.meta.env as Record<string, string | undefined>

export const cloudConfig = {
  endpoint: (env.VITE_CLOUD_ENDPOINT ?? '').trim(),
  oauthRelayBaseUrl: (
    env.VITE_CLOUD_OAUTH_RELAY ?? 'https://www.workbuddy.cn/v2/as/genie-baas/oauth'
  ).trim(),
  // publishableKey 只标识"哪个应用"，本身不带权限；服务端按 Origin 精确校验，可公开。
  publishableKey: (env.VITE_CLOUD_KEY ?? '').trim(),
}

export const isLocalMode = !cloudConfig.endpoint || !cloudConfig.publishableKey

export const cloud: any = isLocalMode
  ? { auth: localAuth }
  : createWorkBuddyCloud({
      endpoint: cloudConfig.endpoint,
      oauthRelayBaseUrl: cloudConfig.oauthRelayBaseUrl,
      publishableKey: cloudConfig.publishableKey,
    })

/** 云数据库是 PostgREST 风格，行类型需在调用处断言。 */
export const db: any = isLocalMode ? localDb : (cloud.database as any)

export function unwrap<T>(res: { data: T; error: any }): T {
  if (res.error) throw res.error
  return res.data
}

export function errText(e: any): string {
  if (!e) return '未知错误'
  if (typeof e === 'string') return e
  const msg = e.message || e.error_description || ''
  if (e.kind === 'network' || e.name === 'TypeError') return '网络连接不上，请检查网络后重试'
  if (e.kind === 'unauthenticated' || e.kind === 'invalid_grant') return '登录已失效，请重新验证手机号'
  if (e.code === '23505') return '这条内容已经存在'
  if (e.code === '42501') return '没有权限执行该操作'
  if (e.code === '42P01') return '数据表不存在，请联系维护者'
  return msg || '操作失败，请重试'
}
