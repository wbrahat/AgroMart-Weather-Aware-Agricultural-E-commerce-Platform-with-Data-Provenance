import { useState, useEffect } from 'react'
import Onboarding from './components/Onboarding'
import Login from './components/Login'

export default function App() {
  const pathname = window.location.pathname
  const params = new URLSearchParams(window.location.search)
  const shouldShowOnboarding = pathname === '/onboarding' || params.has('onboarding')
  const shouldShowLogin =
    pathname === '/' || pathname === '/login' || params.has('login') || !shouldShowOnboarding

  const [showOnboarding, setShowOnboarding] = useState(shouldShowOnboarding)

  useEffect(() => {
    const token = sessionStorage.getItem('agromart_token')

    if (token && !shouldShowOnboarding) {
      window.location.replace('/dashboard.html')
      return
    }

    if (shouldShowOnboarding) {
      setShowOnboarding(true)
      return
    }

    if (shouldShowLogin) {
      setShowOnboarding(false)
      return
    }
  }, [shouldShowLogin, shouldShowOnboarding])

  const handleOnboardingComplete = () => {
    localStorage.setItem('hasSeenOnboarding', 'true')
    window.history.replaceState({}, '', '/login')
    setShowOnboarding(false)
  }

  return showOnboarding ? (
    <Onboarding onComplete={handleOnboardingComplete} />
  ) : (
    <Login />
  )
}
