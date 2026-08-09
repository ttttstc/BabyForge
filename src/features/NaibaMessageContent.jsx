import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const ALLOWED_MARKDOWN_ELEMENTS = Object.freeze([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'strong', 'em', 'ul', 'ol', 'li',
  'code', 'pre', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr', 'br', 'del', 'input',
])

export function NaibaMessageContent({ role, text, locale = 'zh-CN' }) {
  const [copyState, setCopyState] = useState('idle')
  const isEnglish = locale === 'en-US'

  useEffect(() => {
    if (copyState === 'idle') return undefined
    const timer = window.setTimeout(() => setCopyState('idle'), 1500)
    return () => window.clearTimeout(timer)
  }, [copyState])

  if (role !== 'assistant') return <p>{text}</p>

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  const label = copyState === 'copied'
    ? (isEnglish ? 'Copied' : '已复制')
    : copyState === 'failed'
      ? (isEnglish ? 'Copy failed' : '复制失败')
      : (isEnglish ? 'Copy answer' : '复制回答')

  return <div className="naiba-message-content">
    <div className="naiba-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        allowedElements={ALLOWED_MARKDOWN_ELEMENTS}
        components={{
          a: ({ children, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>,
          input: ({ type, checked }) => type === 'checkbox' ? <input className="naiba-task-checkbox" type="checkbox" checked={checked} disabled readOnly /> : null,
        }}
      >{text}</ReactMarkdown>
    </div>
    <button className={`naiba-copy-answer ${copyState}`} type="button" onClick={copyText} aria-label={label} title={label}>
      {copyState === 'copied' ? <Check size={13} /> : <Copy size={13} />}
      <span>{label}</span>
    </button>
  </div>
}
