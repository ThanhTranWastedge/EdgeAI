interface Props {
  title: string
  description?: string
  children: React.ReactNode
}

export default function SectionCard({ title, description, children }: Props) {
  return (
    <div className="bg-white rounded-xl border border-amcs-grey-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-amcs-grey-100 bg-amcs-grey-50/50">
        <h3 className="text-base font-semibold text-amcs-black">{title}</h3>
        {description && <p className="text-xs text-amcs-grey-300 mt-1">{description}</p>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}
