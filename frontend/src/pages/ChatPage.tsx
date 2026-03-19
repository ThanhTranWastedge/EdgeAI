import IntegrationList from '../components/IntegrationList'
import SessionHistory from '../components/SessionHistory'
import ChatWindow from '../components/ChatWindow'

export default function ChatPage() {
  return (
    <div className="flex h-full">
      <div className="w-56 flex flex-col border-r border-amcs-grey-100 bg-white">
        <IntegrationList />
        <SessionHistory />
      </div>
      <ChatWindow />
    </div>
  )
}
