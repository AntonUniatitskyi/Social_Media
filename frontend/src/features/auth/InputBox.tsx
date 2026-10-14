import { useId, useState, type ComponentType, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  icon: ComponentType<{ className?: string }>
  error?: string
}

export function InputBox({ label, icon: Icon, error, type = 'text', ...rest }: Props) {
  const id = useId()
  const [shown, setShown] = useState(false)
  const isPassword = type === 'password'

  return (
    <div>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-stone-600" />
        <input
          {...rest}
          id={id}
          placeholder=" "
          aria-invalid={!!error}
          type={isPassword && shown ? 'text' : type}
          className={`peer h-14 w-full rounded-[14px] border bg-white/75 pb-1.5 pl-12 pr-12 pt-5 text-base
            text-stone-800 outline-none transition focus:border-clay focus:ring-[3px] focus:ring-clay/20
            ${error ? 'border-red-400' : 'border-sand'}`}
        />
        <label
          htmlFor={id}
          className="pointer-events-none absolute left-12 top-[11px] text-xs text-stone-600 transition-all
            peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base
            peer-focus:top-[11px] peer-focus:translate-y-0 peer-focus:text-xs"
        >
          {label}
        </label>
        {isPassword && (
          <button
            type="button"
            aria-label="Показати або сховати пароль"
            onClick={() => setShown((s) => !s)}
            className="absolute right-1.5 top-1.5 grid size-11 place-items-center rounded-[10px] text-stone-600 hover:bg-sand/50"
          >
            {shown ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        )}
      </div>
      {error && <p className="ml-1 mt-1.5 text-[13px] text-red-700">{error}</p>}
    </div>
  )
}