import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import Layout from '../components/Layout'
import IntegrationList from '../components/IntegrationList'
import SessionHistory from '../components/SessionHistory'
import ChatWindow from '../components/ChatWindow'

export default function ChatPage() {
  const { checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [])

  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', width: 220, borderRight: '1px solid #30363d' }}>
        <IntegrationList />
        <SessionHistory />
      </div>
      <ChatWindow />
    </Layout>
  )
}
