import type { ReactNode } from 'react'

export function AuthLayout({ title, children, footer }: {
  title: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-page px-4 py-10 font-sans">
      <div className="flex w-full max-w-105 flex-col gap-7 rounded-3xl border border-sand bg-cream px-9 pb-8 pt-10 shadow-[0_18px_50px_rgba(74,44,24,.12)]">
        <div className="flex flex-col items-center gap-1.5">
          <div className="font-brand text-[44px] leading-tight text-bark">Roon</div>
          <h1 className="text-lg font-medium text-stone-600">{title}</h1>
        </div>
        {children}
        <p className="text-center text-[15px] text-stone-600">{footer}</p>
      </div>
    </div>
  )
}

export const submitBtn =
  'mt-1.5 min-h-12.5 w-full rounded-[14px] bg-bark font-semibold text-cream transition ' +
  'hover:bg-clay disabled:opacity-60 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-clay/40'

export const linkCls = 'font-semibold text-clay hover:text-bark hover:underline'