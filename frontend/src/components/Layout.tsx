import { useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { MessageSquare, Bot, Users, Shield, HelpCircle, Settings, LogOut } from 'lucide-react'

interface NavItemProps {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}

function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer
        ${active
          ? 'bg-sky-50 text-sky-600 font-semibold'
          : 'text-slate-600 hover:bg-slate-100'
        }`}
    >
      {icon}
      {label}
    </button>
  )
}

export default function Layout() {
  const { user, logout, checkAuth } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    checkAuth()
  }, [])

  const isActive = (path: string) => location.pathname === path
  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin'
  const isAdmin = user?.role === 'admin'

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-60 flex flex-col bg-slate-50 border-r border-slate-200">
        {/* Logo */}
        <div className="h-16 px-6 flex items-center">
          <span
            className="text-xl font-bold text-sky-500 cursor-pointer"
            onClick={() => navigate('/chat')}
          >
            EdgeAI
          </span>
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-3 space-y-1">
          <NavItem
            icon={<MessageSquare className="w-5 h-5" />}
            label="Chat"
            active={isActive('/chat')}
            onClick={() => navigate('/chat')}
          />
          <NavItem
            icon={<Bot className="w-5 h-5" />}
            label="Agents"
            active={isActive('/agents')}
            onClick={() => navigate('/agents')}
          />

          {/* Role-gated items */}
          {isManagerOrAdmin && (
            <div className="border-t border-slate-200 my-2 pt-2">
              <NavItem
                icon={<Users className="w-5 h-5" />}
                label="Manager"
                active={isActive('/manager')}
                onClick={() => navigate('/manager')}
              />
              {isAdmin && (
                <NavItem
                  icon={<Shield className="w-5 h-5" />}
                  label="Admin"
                  active={isActive('/admin')}
                  onClick={() => navigate('/admin')}
                />
              )}
            </div>
          )}
        </nav>

        {/* Bottom section */}
        <div className="px-3 pb-4 space-y-1">
          <div className="border-t border-slate-200 pt-3 mb-1" />
          <NavItem
            icon={<HelpCircle className="w-5 h-5" />}
            label="Help"
            active={isActive('/help')}
            onClick={() => navigate('/help')}
          />
          <NavItem
            icon={<Settings className="w-5 h-5" />}
            label="Settings"
            active={isActive('/settings')}
            onClick={() => navigate('/settings')}
          />

          {/* User info + logout */}
          <div className="border-t border-slate-200 mt-3 pt-3 px-4">
            <div className="text-sm font-medium text-slate-900">
              {user?.fullname || user?.username}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs bg-slate-200 text-slate-600 rounded-full px-2 py-0.5">
                {user?.role}
              </span>
              <button
                onClick={logout}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 h-screen overflow-y-auto bg-slate-50">
        <Outlet />
      </main>
    </div>
  )
}
