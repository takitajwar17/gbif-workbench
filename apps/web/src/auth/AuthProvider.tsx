import { useCallback, useMemo, type ReactNode } from 'react'
import { ClerkProvider, UserButton, useAuth, useClerk, useUser } from '@clerk/react'
import { LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthContext, disabledAuth, useAppAuth, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

  if (!publishableKey) {
    return <AuthContext.Provider value={disabledAuth}>{children}</AuthContext.Provider>
  }

  return (
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/">
      <ClerkAuthBridge>{children}</ClerkAuthBridge>
    </ClerkProvider>
  )
}

function ClerkAuthBridge({ children }: { children: ReactNode }) {
  const clerk = useClerk()
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const { user } = useUser()

  const requestSignIn = useCallback(() => {
    if (!isLoaded) return false
    if (isSignedIn) return true
    clerk.openSignIn()
    return false
  }, [clerk, isLoaded, isSignedIn])

  const requestSignUp = useCallback(() => {
    if (!isLoaded) return false
    if (isSignedIn) return true
    clerk.openSignUp()
    return false
  }, [clerk, isLoaded, isSignedIn])

  const getAuthToken = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return null
    return getToken()
  }, [getToken, isLoaded, isSignedIn])

  const value = useMemo<AuthContextValue>(() => {
    const email = user?.primaryEmailAddress?.emailAddress || ''
    const userLabel = user?.fullName || user?.firstName || email || 'Signed in'
    return {
      isConfigured: true,
      isLoaded,
      isSignedIn: Boolean(isSignedIn),
      userLabel,
      requestSignIn,
      requestSignUp,
      getAuthToken,
    }
  }, [getAuthToken, isLoaded, isSignedIn, requestSignIn, requestSignUp, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function AuthControls() {
  const auth = useAppAuth()

  if (!auth.isConfigured) {
    return (
      <Button type="button" variant="outline" size="sm" disabled title="Add VITE_CLERK_PUBLISHABLE_KEY to enable sign-in.">
        <LogIn />
        Sign in
      </Button>
    )
  }

  if (!auth.isLoaded) {
    return (
      <Button type="button" variant="outline" size="sm" disabled>
        <LogIn />
        Sign in
      </Button>
    )
  }

  if (auth.isSignedIn) {
    return (
      <div className="flex items-center gap-2" title={auth.userLabel}>
        <UserButton />
      </div>
    )
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={auth.requestSignIn}>
      <LogIn />
      Sign in
    </Button>
  )
}
