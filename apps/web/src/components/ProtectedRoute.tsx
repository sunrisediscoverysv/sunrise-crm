import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'

type Role = 'admin' | 'agente' | 'visor'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: Role
  /** Roles a los que se les niega el acceso (admin nunca se bloquea). */
  blockRoles?: Role[]
}

export function ProtectedRoute({ children, requiredRole, blockRoles }: ProtectedRouteProps) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f7f8f9]">
        <span className="h-8 w-8 border-3 border-brand-teal border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (requiredRole && profile?.role !== requiredRole && profile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  // Bloqueo por rol (admin es super-usuario y nunca se bloquea).
  if (blockRoles && profile?.role && profile.role !== 'admin' && blockRoles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
