import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import { LoginPage } from './features/auth/LoginPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './components/Layout/AppLayout'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { StatDetailPage } from './features/dashboard/StatDetailPage'
import { PipelinePage } from './features/pipeline/PipelinePage'
import { ClientsPage } from './features/clients/ClientsPage'
import { ClientDetailPage } from './features/clients/ClientDetailPage'
import { InboxPage } from './features/inbox/InboxPage'
import { CalendarPage } from './features/calendar/CalendarPage'
import { PropertiesPage } from './features/properties/PropertiesPage'
import { PropertyInsightsPage } from './features/properties/PropertyInsightsPage'
import { OperationsPage } from './features/operations/OperationsPage'
import { SettingsPage } from './features/settings/SettingsPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Routes>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/stats/stage/:stageId" element={<StatDetailPage />} />
                  <Route path="/stats/:detail" element={<StatDetailPage />} />
                  <Route path="/pipeline" element={<PipelinePage />} />
                  <Route path="/clients" element={<ClientsPage />} />
                  <Route path="/clients/:id" element={<ClientDetailPage />} />
                  <Route path="/inbox" element={<InboxPage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/properties" element={<PropertiesPage />} />
                  <Route path="/properties/insights" element={<PropertyInsightsPage />} />
                  <Route path="/operations" element={<OperationsPage />} />
                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute requiredRole="admin">
                        <SettingsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </AppLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  )
}
