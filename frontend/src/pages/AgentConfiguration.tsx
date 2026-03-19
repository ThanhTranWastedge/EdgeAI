import { useState } from 'react'
import { X, ChevronDown } from 'lucide-react'
import SectionCard from '../components/SectionCard'
import { inputCls, selectCls, btnPrimaryCls, labelCls } from '../styles'

export default function AgentConfiguration() {
  const [activeTab, setActiveTab] = useState('Configuration')

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-amcs-black">Agent Configuration</h1>
          <span className="bg-amcs-positive-light text-amcs-positive text-xs font-medium rounded-full px-2.5 py-1">
            Active
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 rounded-lg bg-amcs-white text-amcs-grey-500 text-sm font-medium border border-amcs-grey-100 hover:bg-amcs-grey-50 transition-colors cursor-pointer">
            Discard Changes
          </button>
          <button className={btnPrimaryCls}>
            Save Configuration
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex gap-1 p-1 bg-amcs-grey-100 rounded-xl mb-8">
        {['Configuration', 'Prompt', 'Advanced'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer
              ${activeTab === tab
                ? 'bg-amcs-white text-amcs-black shadow-sm'
                : 'text-amcs-grey-400 hover:text-amcs-grey-600'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Configuration Tab */}
      {activeTab === 'Configuration' && (
        <div className="space-y-6">
          <SectionCard title="General Settings" description="Basic identification and fallback behavior for this agent.">
            <div className="space-y-4">
              <div>
                <label htmlFor="agent-name" className={labelCls}>Agent Name</label>
                <input id="agent-name" type="text" defaultValue="Marketing Agent" className={`w-full ${inputCls}`} />
              </div>
              <div>
                <label htmlFor="empty-response" className={labelCls}>Empty Response Message</label>
                <input id="empty-response" type="text" defaultValue="I don't know" className={`w-full ${inputCls}`} />
                <p className="text-xs text-amcs-grey-300 mt-1">This message will be sent when the agent cannot find a relevant answer.</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Retrieval & Model" description="Configure which data this agent can access and its reasoning engine.">
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Connected Datasets</label>
                <div className="min-h-[46px] p-2 rounded-lg border border-amcs-grey-100 bg-amcs-grey-50 flex flex-wrap gap-2 items-center focus-within:ring-2 focus-within:ring-amcs-primary-light/30 focus-within:border-amcs-primary transition-all">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amcs-white text-amcs-grey-600 text-sm border border-amcs-grey-100">
                    Marketing Playbooks
                    <button className="text-amcs-grey-300 hover:text-amcs-grey-500 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amcs-white text-amcs-grey-600 text-sm border border-amcs-grey-100">
                    Q3 Campaign Results
                    <button className="text-amcs-grey-300 hover:text-amcs-grey-500 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                  </span>
                  <input
                    type="text"
                    placeholder="Add dataset..."
                    className="flex-1 min-w-[120px] bg-transparent text-sm text-amcs-grey-600 placeholder:text-amcs-grey-300 focus:outline-none"
                  />
                </div>
                <p className="text-xs text-amcs-grey-300 mt-1">The agent will only use information found within these datasets.</p>
              </div>
              <div>
                <label htmlFor="llm-select" className={labelCls}>Language Model (LLM)</label>
                <div className="relative">
                  <select id="llm-select" defaultValue="gpt-4o" className={`w-full appearance-none ${selectCls}`}>
                    <option value="gpt-4o">GPT-4o (OpenAI)</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo (OpenAI)</option>
                    <option value="claude-3-opus">Claude 3 Opus (Anthropic)</option>
                    <option value="claude-3-sonnet">Claude 3.5 Sonnet (Anthropic)</option>
                    <option value="mistral-large">Mistral Large (Mistral)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-amcs-grey-300">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Placeholder for other tabs */}
      {activeTab !== 'Configuration' && (
        <div className="h-64 flex bg-amcs-white border border-dashed border-amcs-grey-200 rounded-xl items-center justify-center">
          <p className="text-amcs-grey-300 text-sm">Content for {activeTab} panel</p>
        </div>
      )}
    </div>
  )
}
