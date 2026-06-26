import { createContext, useContext } from 'react'

export type AuthContextValue = {
  isConfigured: boolean
  isLoaded: boolean
  isSignedIn: boolean
  userLabel: string
  requestSignIn: () => boolean
  requestSignUp: () => boolean
  getAuthToken: () => Promise<string | null>
}

export const disabledAuth: AuthContextValue = {
  isConfigured: false,
  isLoaded: true,
  isSignedIn: false,
  userLabel: '',
  requestSignIn: () => false,
  requestSignUp: () => false,
  getAuthToken: async () => null,
}

export const AuthContext = createContext<AuthContextValue>(disabledAuth)

export function useAppAuth() {
  return useContext(AuthContext)
}
