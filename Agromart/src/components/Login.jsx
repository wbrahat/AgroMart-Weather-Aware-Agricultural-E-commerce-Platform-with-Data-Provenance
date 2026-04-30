import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://qhkckodhjvnuoablpfwq.supabase.co'
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoa2Nrb2RoanZudW9hYmxwZndxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMjAwNzcsImV4cCI6MjA5MjU5NjA3N30.ifETbDHuaqlSUOl20SFLCAFzzuBbaqhc_bglCCa1LrU'
const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

const supabase = hasSupabaseConfig
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
  : null

const normalizeAuthError = (message = '') => {
  const lower = message.toLowerCase()

  if (lower.includes('invalid login credentials')) {
    return 'Incorrect email or password.'
  }
  if (lower.includes('email not confirmed')) {
    return 'Please verify your email first, then try again.'
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Network error. Please check your connection and try again.'
  }

  return message || 'Login failed. Please try again.'
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [authMode, setAuthMode] = useState('signin')
  const [slideIndex, setSlideIndex] = useState(0)
  const [rememberedEmail, setRememberedEmail] = useState(localStorage.getItem('agromart_remember_email') || '')
  const [rememberMe, setRememberMe] = useState(Boolean(localStorage.getItem('agromart_remember_email')))
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const heroSlides = [
    {
      image: '/images/login.png',
      kicker: 'Farm to City',
      title: 'Smart routes through green fields and golden sunsets.',
      subtitle: 'Track movement from source farms to city markets with full clarity.'
    },
    {
      image: '/images/delivery.png',
      kicker: 'Cold Chain Flow',
      title: 'Delivery trucks, tea gardens, and live drone visibility.',
      subtitle: 'Monitor shipment health and transit decisions in one dashboard.'
    },
    {
      image: '/images/market.png',
      kicker: 'Fresh Market',
      title: 'Colorful produce, better decisions, stronger margins.',
      subtitle: 'Connect product quality, stock levels, and pricing performance.'
    }
  ]
  const isSignUpMode = authMode === 'signup'

  useEffect(() => {
    const remembered = localStorage.getItem('agromart_remember_email') || ''

    if (remembered) {
      setEmail(remembered)
      setRememberedEmail(remembered)
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSlideIndex((current) => (current + 1) % heroSlides.length)
    }, 4600)

    return () => window.clearInterval(timer)
  }, [heroSlides.length])

  const showNotice = (message) => {
    setErrorMessage('')
    setSuccessMessage(message)
  }

  const signInOrSignUp = async () => {
    if (!supabase) {
      setErrorMessage('Supabase configuration is missing.')
      return
    }

    setIsLoading(true)

    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password
        })

        if (error) {
          setErrorMessage(normalizeAuthError(error.message))
          return
        }

        if (data?.user) {
          setSuccessMessage('Account created. Check your email to confirm your account.')
          setAuthMode('signin')
        } else {
          showNotice('Account creation request sent.')
        }

        return
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      })

      if (error) {
        setErrorMessage(normalizeAuthError(error.message))
        return
      }

      if (!data.session || !data.user) {
        setErrorMessage('Login failed. No active session returned.')
        return
      }

      sessionStorage.setItem('agromart_user', JSON.stringify(data.user))
      sessionStorage.setItem('agromart_token', data.session.access_token)

      if (rememberMe) {
        localStorage.setItem('agromart_remember_email', email.trim())
        setRememberedEmail(email.trim())
      } else {
        localStorage.removeItem('agromart_remember_email')
        setRememberedEmail('')
      }

      setSuccessMessage('Login successful. You are now signed in.')
      window.location.href = '/dashboard.html'
    } catch (error) {
      setErrorMessage(normalizeAuthError(error?.message))
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim()

    setErrorMessage('')
    setSuccessMessage('')

    if (!trimmedEmail) {
      setErrorMessage('Enter your email first, then click Forgot Password.')
      return
    }

    if (!supabase) {
      setErrorMessage('Supabase configuration is missing.')
      return
    }

    setIsLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/login`
      })

      if (error) {
        setErrorMessage(normalizeAuthError(error.message))
        return
      }

      setSuccessMessage('Password reset link sent. Check your email.')
    } catch (error) {
      setErrorMessage(normalizeAuthError(error?.message))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSocialLogin = async (provider) => {
    setErrorMessage('')
    setSuccessMessage('')

    if (!supabase) {
      setErrorMessage('Supabase configuration is missing.')
      return
    }

    setIsLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/dashboard.html`
        }
      })

      // Supabase v2 returns a URL to redirect the user for OAuth flows.
      if (error) {
        const msg = (error.message || '').toLowerCase()
        // handle unsupported provider and mark it disabled so we hide the button
        if (msg.includes('unsupported provider') || msg.includes('provider is not enabled')) {
          setDisabledProviders(prev => ({ ...prev, [provider]: true }))
          setErrorMessage('This social provider is not enabled in Supabase. I hid the button for you — enable it in Supabase to re-enable.')
          return
        }

        setErrorMessage(normalizeAuthError(error.message))
        return
      }

      if (data && data.url) {
        window.location.href = data.url
        return
      }

      setErrorMessage('OAuth login failed. Please check provider configuration in Supabase.')
    } catch (error) {
      setErrorMessage(normalizeAuthError(error?.message))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    signInOrSignUp()
  }

  const currentSlide = heroSlides[slideIndex]

  const goToSlide = (index) => {
    setSlideIndex(index)
  }

  return (
    <div className="min-h-dvh w-full bg-[#06110b] text-white">
      <div className="grid min-h-dvh lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative flex min-h-[42vh] items-end overflow-hidden lg:min-h-dvh">
          <div className="absolute inset-0">
            {heroSlides.map((slide, index) => (
              <div
                key={slide.image}
                className={`absolute inset-0 transition-all duration-700 ease-out ${
                  index === slideIndex ? 'opacity-100 scale-100' : 'pointer-events-none opacity-0 scale-[1.03]'
                }`}
                aria-hidden={index !== slideIndex}
              >
                <img
                  src={slide.image}
                  alt={slide.title}
                  className="h-full w-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.13),transparent_28%),linear-gradient(to_b,rgba(3,8,5,0.12),rgba(3,8,5,0.58)_42%,rgba(3,8,5,0.94)_100%)]" />
              </div>
            ))}
          </div>

          <div className="relative z-10 flex h-full w-full flex-col justify-between px-5 py-5 sm:px-8 sm:py-8">
            <div className="flex items-center justify-between gap-4">
              <div className="rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-[11px] font-semibold tracking-[0.24em] text-lime-100/85 backdrop-blur-md">
                AGROMART
              </div>
              <div className="rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-[11px] font-medium text-white/75 backdrop-blur-md">
                Premium login flow
              </div>
            </div>

            <div className="mx-auto w-full max-w-2xl pb-2 text-center lg:pb-6">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.34em] text-lime-100/80">
                {currentSlide.kicker}
              </p>
              <h1
                className="mx-auto max-w-xl text-[2.15rem] font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl"
                style={{ fontFamily: 'Fraunces, serif' }}
              >
                {currentSlide.title}
              </h1>
              <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-white/76 sm:text-base">
                {currentSlide.subtitle}
              </p>

              <div className="mt-8 flex items-center justify-center gap-2">
                {heroSlides.map((slide, index) => (
                  <button
                    key={slide.image}
                    type="button"
                    onClick={() => goToSlide(index)}
                    aria-label={`Show slide ${index + 1}`}
                    className="rounded-full p-1"
                  >
                    <span
                      className={`block rounded-full transition-all duration-300 ${
                        index === slideIndex ? 'h-2 w-8 bg-lime-300' : 'h-2 w-2 bg-white/35'
                      }`}
                    />
                  </button>
                ))}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4 backdrop-blur-md">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Signal</p>
                  <p className="mt-1 text-sm font-semibold text-white">Smarter decisions</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4 backdrop-blur-md">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Flow</p>
                  <p className="mt-1 text-sm font-semibold text-white">Smooth login handoff</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4 backdrop-blur-md">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Result</p>
                  <p className="mt-1 text-sm font-semibold text-white">Faster action</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-[linear-gradient(180deg,#f7f3eb_0%,#efe8da_100%)] px-5 py-8 text-slate-900 sm:px-8 lg:px-10">
          <div className="w-full max-w-xl rounded-[2rem] border border-black/5 bg-white/80 p-6 shadow-[0_32px_90px_-28px_rgba(13,46,27,0.45)] backdrop-blur-xl sm:p-8">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-lime-300/35 bg-[#efe4c5] shadow-[0_16px_32px_rgba(0,0,0,0.12)]">
                <img
                  src="/logo1.png"
                  alt="AgroMart logo"
                  className="h-full w-full scale-[1.4] object-cover object-center"
                  onError={(event) => {
                    event.currentTarget.src = '/logo.png'
                  }}
                />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-700/75">
                AgroMart Bangladesh
              </p>
              <h2
                className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2.35rem]"
                style={{ fontFamily: 'Fraunces, serif' }}
              >
                {isSignUpMode ? 'Create Account' : 'Welcome Back'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {isSignUpMode
                  ? 'Join AgroMart to manage your supply chain in one place.'
                  : 'Login to continue tracking shipments, stock, and pricing.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@agromart.com"
                  autoComplete="email"
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-slate-900 placeholder-slate-400 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pr-20 text-slate-900 placeholder-slate-400 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setRememberMe(checked)
                      if (!checked) {
                        localStorage.removeItem('agromart_remember_email')
                        setRememberedEmail('')
                      }
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Remember Me
                </label>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm font-semibold text-emerald-700 transition hover:text-emerald-600"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-1 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-lime-400 py-3.5 text-base font-semibold text-emerald-950 shadow-[0_18px_42px_rgba(22,101,52,0.2)] transition hover:from-emerald-400 hover:to-lime-300 focus:outline-none focus:ring-4 focus:ring-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-75"
              >
                {isLoading ? 'Signing in...' : isSignUpMode ? 'Create Account' : 'Login to Dashboard'}
              </button>
            </form>

            {errorMessage ? (
              <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {errorMessage}
              </p>
            ) : null}

            {successMessage ? (
              <p role="status" className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
                {successMessage}
              </p>
            ) : null}

            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-600">
              <span>{isSignUpMode ? 'Already have an account?' : "Don't have an account?"}</span>
              <button
                type="button"
                onClick={() => setAuthMode(isSignUpMode ? 'signin' : 'signup')}
                className="font-semibold text-emerald-700 transition hover:text-emerald-600"
              >
                {isSignUpMode ? 'Back to login' : 'Sign up'}
              </button>
            </div>

            <p className="mt-4 text-center text-xs leading-5 text-slate-500">
              {rememberedEmail ? `Welcome back, ${rememberedEmail}.` : 'Use your AgroMart credentials to continue.'}
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
