import { useEffect, useRef, useState } from 'react'
import { cloud, errText, isLocalMode } from '../cloud'
import { localSignIn } from '../backend/local'
import { claimDevice } from '../data'
import { set, useStore } from '../store'
import { BrandMark, Icon } from '../components/ui'

const CODE_LEN = 6

export function Login() {
  return isLocalMode ? <LocalLogin /> : <PhoneLogin />
}

/**
 * 本地模式入口：没有云配置时不假装发短信，直接说明数据存在本机。
 * 这样 fork 这个仓库的人第一次打开就能用，而不是卡在一个发不出验证码的界面。
 */
function LocalLogin() {
  const [busy, setBusy] = useState(false)

  async function enter() {
    setBusy(true)
    try {
      const session = localSignIn()
      set({ session, loginNotice: null })
      await claimDevice()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-inner">
        <div className="auth-brand">
          <BrandMark size={30} />
          <div>
            <h1>second mind</h1>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>你的身份树</div>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-title">本地模式</div>
          <p className="auth-desc">
            这个版本把内容存在你这台设备的浏览器里，不需要手机号，也不需要任何后端。可以完整试用 Network、工作台与大纲。
          </p>
          <ul className="local-points">
            <li>换浏览器或清除站点数据，内容会丢失</li>
            <li>没有跨设备同步，也没有账号隔离</li>
            <li>想要手机号登录与多设备同步，见 README 的「接入你自己的后端」</li>
          </ul>
          <button className="btn btn-primary btn-block btn-lg" onClick={enter} disabled={busy}>
            {busy ? '正在进入…' : '开始使用'}
          </button>
        </div>

        <p className="auth-foot">
          配置 <code>VITE_CLOUD_ENDPOINT</code> 与 <code>VITE_CLOUD_KEY</code> 后重新构建，
          <br />
          即可切换为手机号登录 + 跨设备同步的云模式。
        </p>
      </div>
    </div>
  )
}

function PhoneLogin() {
  const [phase, setPhase] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [digits, setDigits] = useState<string[]>(Array(CODE_LEN).fill(''))
  const [pending, setPending] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [bad, setBad] = useState(false)
  const [challenge, setChallenge] = useState<{ verificationId: string; isExistingUser: boolean } | null>(null)
  const boxes = useRef<(HTMLInputElement | null)[]>([])
  const notice = useStore((s) => s.loginNotice)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(t)
  }, [cooldown])

  useEffect(() => {
    if (phase === 'code') boxes.current[0]?.focus()
  }, [phase])

  const phoneValid = /^1\d{10}$/.test(phone)

  async function sendCode() {
    if (!phoneValid) {
      setError('请输入正确的 11 位手机号')
      return
    }
    setError('')
    setSending(true)
    try {
      const { data, error: e } = await cloud.auth.sendOtp({ phone })
      if (e) {
        setError(errText(e))
        return
      }
      setChallenge({ verificationId: data!.verificationId, isExistingUser: !!data!.isExistingUser })
      setPhase('code')
      setCooldown(60)
      setDigits(Array(CODE_LEN).fill(''))
    } catch (e) {
      setError(errText(e))
    } finally {
      setSending(false)
    }
  }

  async function submit(code: string) {
    if (!challenge || code.length !== CODE_LEN) return
    setPending(true)
    setError('')
    try {
      const { data, error: e } = await cloud.auth.verifyOtp({
        phone,
        verificationId: challenge.verificationId,
        isExistingUser: challenge.isExistingUser,
        token: code,
      })
      if (e || !data) {
        setBad(true)
        window.setTimeout(() => setBad(false), 400)
        setError(errText(e) || '验证码不正确，请重新输入')
        setDigits(Array(CODE_LEN).fill(''))
        boxes.current[0]?.focus()
        return
      }
      set({ session: data, loginNotice: null })
      await claimDevice()
    } catch (e) {
      setError(errText(e))
    } finally {
      setPending(false)
    }
  }

  function onDigit(i: number, v: string) {
    const clean = v.replace(/\D/g, '')
    if (clean.length > 1) {
      const arr = [...digits]
      for (let k = 0; k < clean.length && i + k < CODE_LEN; k++) arr[i + k] = clean[k]
      setDigits(arr)
      const nextIdx = Math.min(CODE_LEN - 1, i + clean.length)
      boxes.current[nextIdx]?.focus()
      const joined = arr.join('')
      if (joined.length === CODE_LEN) void submit(joined)
      return
    }
    const arr = [...digits]
    arr[i] = clean
    setDigits(arr)
    if (clean && i < CODE_LEN - 1) boxes.current[i + 1]?.focus()
    const joined = arr.join('')
    if (joined.length === CODE_LEN) void submit(joined)
  }

  function onKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      e.preventDefault()
      const arr = [...digits]
      arr[i - 1] = ''
      setDigits(arr)
      boxes.current[i - 1]?.focus()
    }
    if (e.key === 'ArrowLeft' && i > 0) boxes.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < CODE_LEN - 1) boxes.current[i + 1]?.focus()
  }

  return (
    <div className="auth">
      <svg className="auth-deco" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g stroke="var(--border-strong)" strokeWidth="0.6" fill="none" opacity="0.7">
          <path d="M120 120L260 200L210 330L90 300Z" />
          <path d="M260 200L420 150L500 260L420 380L210 330" />
          <path d="M500 260L640 220L690 350L560 420L420 380" />
          <path d="M420 150L560 90L640 220" />
        </g>
        <g fill="var(--primary)" opacity="0.22">
          <circle cx="120" cy="120" r="6" />
          <circle cx="260" cy="200" r="4" />
          <circle cx="420" cy="150" r="5" />
          <circle cx="500" cy="260" r="7" />
          <circle cx="640" cy="220" r="4" />
          <circle cx="210" cy="330" r="4" />
          <circle cx="420" cy="380" r="3" />
          <circle cx="690" cy="350" r="4" />
        </g>
      </svg>

      <div className="auth-inner">
        <div className="auth-brand">
          <BrandMark size={30} />
          <div>
            <h1>second mind</h1>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>你的身份树</div>
          </div>
        </div>

        <div className="auth-card">
          {phase === 'phone' ? (
            <>
              <div className="auth-title">用手机号进入</div>
              <p className="auth-desc">内容只属于这个手机号。第一次进入会创建你的身份树，之后 15 天内在这台设备上自动登录。</p>
              <label className="field">
                <span className="label">手机号</span>
                <input
                  className="input"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="11 位手机号"
                  value={phone}
                  aria-invalid={!!error && !phoneValid}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))
                    setError('')
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && void sendCode()}
                />
              </label>
              {error && <div className="err" role="alert">{error}</div>}
              {notice && !error && <div className="hint" style={{ color: 'var(--warning)' }}>{notice}</div>}
              <button className="btn btn-primary btn-block btn-lg" onClick={sendCode} disabled={sending || !phoneValid}>
                {sending ? '正在发送…' : '获取验证码'}
              </button>
            </>
          ) : (
            <>
              <div className="auth-title">输入验证码</div>
              <p className="auth-desc">
                已发送到 {phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}
                <button
                  className="btn-ghost btn btn-sm"
                  style={{ display: 'inline-flex', marginLeft: 4, height: 22, padding: '0 6px' }}
                  onClick={() => {
                    setPhase('phone')
                    setError('')
                  }}
                >
                  修改
                </button>
              </p>
              <div className={`otp ${bad ? 'bad' : ''}`}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      boxes.current[i] = el
                    }}
                    value={d}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={CODE_LEN}
                    aria-label={`第 ${i + 1} 位验证码`}
                    onChange={(e) => onDigit(i, e.target.value)}
                    onKeyDown={(e) => onKey(i, e)}
                    disabled={pending}
                  />
                ))}
              </div>
              {error && <div className="err" role="alert">{error}</div>}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                <button
                  className="send-btn"
                  onClick={sendCode}
                  disabled={cooldown > 0 || sending}
                  style={{ border: 'none', background: 'transparent', padding: 0, color: cooldown > 0 ? 'var(--text-3)' : 'var(--primary)' }}
                >
                  {cooldown > 0 ? `${cooldown}s 后可重发` : '重新发送'}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => void submit(digits.join(''))}
                  disabled={pending || digits.join('').length !== CODE_LEN}
                >
                  {pending ? '验证中…' : '进入'}
                </button>
              </div>
            </>
          )}
        </div>

        <p className="auth-foot">
          未验证手机号时，服务器不会返回任何内容。
          <br />
          同一手机号最多在 3 台设备登录，所有改动实时同步。
        </p>
      </div>
    </div>
  )
}
