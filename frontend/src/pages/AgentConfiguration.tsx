import { useState } from 'react'
import { X, ChevronDown } from 'lucide-react'

export default function AgentConfiguration() {
  const [activeTab, setActiveTab] = useState('Configuration')

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-900">Agent Configuration</h1>
          <span className="bg-green-100 text-green-700 text-xs font-medium rounded-full px-2.5 py-1">
            Active
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 rounded-lg bg-white text-slate-600 text-sm font-medium border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
            Discard Changes
          </button>
          <button className="px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 transition-colors cursor-pointer">
            Save Configuration
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex gap-1 p-1 bg-slate-100 rounded-xl mb-8">
        {['Configuration', 'Prompt', 'Advanced'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer
              ${activeTab === tab
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Configuration Tab */}
      {activeTab === 'Configuration' && (
        <div className="space-y-6">
          {/* General Settings Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-base font-semibold text-slate-900">General Settings</h2>
              <p className="text-xs text-slate-400 mt-1">Basic identification and fallback behavior for this agent.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="agent-name" className="block text-sm font-medium text-slate-700 mb-1">Agent Name</label>
                <input
                  id="agent-name"
                  type="text"
                  defaultValue="Marketing Agent"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors"
                />
              </div>
              <div>
                <label htmlFor="empty-response" className="block text-sm font-medium text-slate-700 mb-1">Empty Response Message</label>
                <input
                  id="empty-response"
                  type="text"
                  defaultValue="I don't know"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors"
                />
                <p className="text-xs text-slate-400 mt-1">This message will be sent when the agent cannot find a relevant answer.</p>
              </div>
            </div>
          </div>

          {/* Retrieval & Model Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-base font-semibold text-slate-900">Retrieval & Model</h2>
              <p className="text-xs text-slate-400 mt-1">Configure which data this agent can access and its reasoning engine.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Connected Datasets</label>
                <div className="min-h-[46px] p-2 rounded-lg border border-slate-200 bg-slate-50 flex flex-wrap gap-2 items-center focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-500 transition-all">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-slate-700 text-sm border border-slate-200">
                    Marketing Playbooks
                    <button className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-slate-700 text-sm border border-slate-200">
                    Q3 Campaign Results
                    <button className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                  </span>
                  <input
                    type="text"
                    placeholder="Add dataset..."
                    className="flex-1 min-w-[120px] bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">The agent will only use information found within these datasets.</p>
              </div>
              <div>
                <label htmlFor="llm-select" className="block text-sm font-medium text-slate-700 mb-1">Language Model (LLM)</label>
                <div className="relative">
                  <select
                    id="llm-select"
                    defaultValue="gpt-4o"
                    className="w-full appearance-none px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors cursor-pointer"
                  >
                    <option value="gpt-4o">GPT-4o (OpenAI)</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo (OpenAI)</option>
                    <option value="claude-3-opus">Claude 3 Opus (Anthropic)</option>
                    <option value="claude-3-sonnet">Claude 3.5 Sonnet (Anthropic)</option>
                    <option value="mistral-large">Mistral Large (Mistral)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Placeholder for other tabs */}
      {activeTab !== 'Configuration' && (
        <div className="h-64 flex bg-white border border-dashed border-slate-300 rounded-xl items-center justify-center">
          <p className="text-slate-400 text-sm">Content for {activeTab} panel</p>
        </div>
      )}
    </div>
  )
}
