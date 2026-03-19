import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import ChatPage from './pages/ChatPage'
import AdminPage from './pages/AdminPage'
import ManagerPage from './pages/ManagerPage'
import HelpPage from './pages/HelpPage'
import SettingsPage from './pages/SettingsPage'
import AgentConfiguration from './pages/AgentConfiguration'

function App() {
  const { accessToken } = useAuthStore()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={accessToken ? <Layout /> : <Navigate to="/login" />}>
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/agents" element={<AgentConfiguration />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/manager" element={<ManagerPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/chat" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
