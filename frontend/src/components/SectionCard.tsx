interface Props {
  title: string
  description?: string
  children: React.ReactNode
}

export default function SectionCard({ title, description, children }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}
