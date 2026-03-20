import { useEffect, useState, useRef, useCallback } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { MessageSquare, Users, Shield, HelpCircle, Settings, LogOut, ChevronLeft, ChevronRight } from 'lucide-react'
import IntegrationList from './IntegrationList'
import SessionHistory from './SessionHistory'

const SIDEBAR_KEY = 'sidebar-collapsed'
const BREAKPOINT = 768

interface NavItemProps {
  icon: React.ReactNode
  label: string
  active: boolean
  collapsed: boolean
  onClick: () => void
}

function NavItem({ icon, label, active, collapsed, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer
        ${active
          ? 'bg-we-accent/15 text-we-accent font-semibold'
          : 'text-white/60 hover:bg-we-sidebar-hover hover:text-white/80'
        }`}
    >
      {icon}
      {!collapsed && label}
    </button>
  )
}

function getInitials(fullname: string | undefined, username: string | undefined): string {
  const name = fullname || username || ''
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export default function Layout() {
  const { user, logout, checkAuth } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const initialCollapsed = localStorage.getItem(SIDEBAR_KEY) !== 'false'
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed)
  const isManualCollapseRef = useRef(initialCollapsed)

  const toggleSidebar = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_KEY, String(next))
      isManualCollapseRef.current = next
      return next
    })
  }, [])

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < BREAKPOINT) {
        setIsCollapsed(true)
      } else if (!isManualCollapseRef.current) {
        setIsCollapsed(false)
      }
    }
    window.addEventListener('resize', handleResize)
    handleResize() // check on mount
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    checkAuth()
  }, [])

  const isActive = (path: string) => location.pathname === path
  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin'
  const isAdmin = user?.role === 'admin'

  return (
    <div className="flex h-screen bg-we-canvas">
      {/* Sidebar */}
      <aside className={`${isCollapsed ? 'w-16' : 'w-60'} flex flex-col bg-we-sidebar transition-all duration-300 overflow-hidden`}>
        {/* Logo + toggle */}
        <div className={`h-16 flex items-center shrink-0 ${isCollapsed ? 'justify-center' : 'px-5 justify-between'} border-b border-white/8`}>
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/chat')}>
            <div className="w-7 h-7 bg-we-accent rounded-md flex items-center justify-center text-xs font-extrabold text-white">E</div>
            {!isCollapsed && <span className="text-base font-bold text-white">EdgeAI</span>}
          </div>
          <button
            onClick={toggleSidebar}
            className="text-white/30 hover:text-white/60 transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        {/* Main nav */}
        <nav className={`${isCollapsed ? 'px-1' : 'px-3'} py-2 space-y-1 shrink-0 border-b border-white/6`}>
          <NavItem
            icon={<MessageSquare className="w-5 h-5" />}
            label="Chat"
            active={isActive('/chat')}
            collapsed={isCollapsed}
            onClick={() => navigate('/chat')}
          />

          {/* Role-gated items */}
          {isManagerOrAdmin && (
            <>
              <NavItem
                icon={<Users className="w-5 h-5" />}
                label="Manager"
                active={isActive('/manager')}
                collapsed={isCollapsed}
                onClick={() => navigate('/manager')}
              />
              {isAdmin && (
                <NavItem
                  icon={<Shield className="w-5 h-5" />}
                  label="Admin"
                  active={isActive('/admin')}
                  collapsed={isCollapsed}
                  onClick={() => navigate('/admin')}
                />
              )}
            </>
          )}
        </nav>

        {/* Scrollable middle — integrations + recent sessions */}
        <div className="flex-1 overflow-y-auto">
          <IntegrationList collapsed={isCollapsed} />
          <SessionHistory collapsed={isCollapsed} />
        </div>

        {/* Bottom section */}
        <div className={`${isCollapsed ? 'px-1' : 'px-3'} pb-4 space-y-1 shrink-0`}>
          <div className="border-t border-white/8 pt-3 mb-1" />
          <NavItem
            icon={<HelpCircle className="w-5 h-5" />}
            label="Help"
            active={isActive('/help')}
            collapsed={isCollapsed}
            onClick={() => navigate('/help')}
          />
          <NavItem
            icon={<Settings className="w-5 h-5" />}
            label="Settings"
            active={isActive('/settings')}
            collapsed={isCollapsed}
            onClick={() => navigate('/settings')}
          />

          {/* User info + logout */}
          {isCollapsed ? (
            <div className="border-t border-white/8 mt-3 pt-3 flex flex-col items-center gap-2">
              <div
                className="w-8 h-8 rounded-full bg-we-blue flex items-center justify-center text-xs font-semibold text-white"
                title={user?.fullname || user?.username}
              >
                {getInitials(user?.fullname ?? undefined, user?.username ?? undefined)}
              </div>
              <button
                onClick={logout}
                className="text-white/30 hover:text-amcs-negative transition-colors cursor-pointer"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="border-t border-white/8 mt-3 pt-3 px-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-we-blue flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {getInitials(user?.fullname ?? undefined, user?.username ?? undefined)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white/90 truncate">
                    {user?.fullname || user?.username}
                  </div>
                  <div className="text-xs text-white/40">{user?.role}</div>
                </div>
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-1 text-xs text-white/30 hover:text-amcs-negative mt-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 h-screen overflow-y-auto bg-we-canvas">
        <Outlet />
      </main>
    </div>
  )
}
