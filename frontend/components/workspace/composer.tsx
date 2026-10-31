'use client'

import { ArrowUp } from 'lucide-react'
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type FormEvent, type KeyboardEvent } from 'react'
import { Spinner } from './primitives'

export interface ComposerHandle {
  focus: () => void
}

interface ComposerProps {
  value: string
  onChange: (value: string) => void
  onSend: (value: string) => void
  sending: boolean
}

const MAX_HEIGHT = 200

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer({ value, onChange, onSend, sending }, ref) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useImperativeHandle(ref, () => ({
    focus: () => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    },
  }))

  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
  }, [value])

  function submit(event?: FormEvent) {
    event?.preventDefault()
    if (!value.trim() || sending) return
    onSend(value)
    onChange('')
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    event.preventDefault()
    submit()
  }

  return (
    <form onSubmit={submit}>
      <div className="flex items-end gap-2 rounded-xl border border-input bg-card p-2 pl-4 transition-colors duration-150 focus-within:border-cobalt">
        <label htmlFor="ws-composer" className="sr-only">
          描述你要办理的银行业务
        </label>
        <textarea
          id="ws-composer"
          name="message"
          ref={textareaRef}
          value={value}
          autoComplete="off"
          enterKeyHint="send"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="描述你要办理的业务，例如：给张三转 300 元，备注项目款"
          className="ws-scroll min-h-9 flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={!value.trim() || sending}
          aria-label="发送（Enter 发送，Shift + Enter 换行）"
          title="Enter 发送 · Shift + Enter 换行"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-cobalt text-primary-foreground transition-colors duration-150 hover:bg-cobalt-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? <Spinner /> : <ArrowUp className="size-4" aria-hidden />}
        </button>
      </div>
    </form>
  )
})
