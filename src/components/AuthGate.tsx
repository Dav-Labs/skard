import { useState, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'

interface Props {
  children: ReactNode
}

export function AuthGate({ children }: Props) {
  const { session, loading, signUp, signIn } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [signUpSuccess, setSignUpSuccess] = useState(false)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-dvh">
        <span className="text-violet-400 animate-pulse text-lg">Loading...</span>
      </div>
    )
  }

  if (session) return <>{children}</>

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const err = isSignUp
      ? await signUp(email, password)
      : await signIn(email, password)

    setSubmitting(false)

    if (err) {
      setError(err.message)
    } else if (isSignUp) {
      setSignUpSuccess(true)
    }
  }

  if (signUpSuccess) {
    return (
      <div className="flex flex-col items-center justify-center h-dvh p-6 gap-4">
        <h1 className="text-2xl font-bold text-violet-400">Skard</h1>
        <div className="bg-green-900/30 border border-green-700 rounded-xl p-4 text-center max-w-sm">
          <p className="text-green-300 font-medium">Check your email</p>
          <p className="text-sm text-gray-400 mt-1">Click the confirmation link to activate your account, then sign in.</p>
        </div>
        <button
          onClick={() => { setSignUpSuccess(false); setIsSignUp(false) }}
          className="text-sm text-violet-400 underline"
        >
          Back to sign in
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-dvh p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-center text-violet-400">Skard</h1>
        <p className="text-sm text-gray-400 text-center">
          {isSignUp ? 'Create an account' : 'Sign in to your account'}
        </p>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          minLength={6}
          className="px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
        />

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-600 text-white rounded-xl font-medium transition-colors"
        >
          {submitting ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
        </button>

        <button
          type="button"
          onClick={() => { setIsSignUp(!isSignUp); setError('') }}
          className="text-sm text-violet-400 underline"
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </form>
    </div>
  )
}
