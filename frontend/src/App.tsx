import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import LoginPage from './pages/LoginPage'
import ChatPage from './pages/ChatPage'
import AdminPage from './pages/AdminPage'
import ManagerPage from './pages/ManagerPage'
import HelpPage from './pages/HelpPage'

function App() {
  const { accessToken } = useAuthStore()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/chat" element={
          accessToken ? <ChatPage /> : <Navigate to="/login" />
        } />
        <Route path="/manager" element={
          accessToken ? <ManagerPage /> : <Navigate to="/login" />
        } />
        <Route path="/help" element={
          accessToken ? <HelpPage /> : <Navigate to="/login" />
        } />
        <Route path="/admin" element={
          accessToken ? <AdminPage /> : <Navigate to="/login" />
        } />
        <Route path="*" element={<Navigate to="/chat" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
