import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function NaibaMessageContent({ role, text, locale = 'zh-CN' }) {
  const [copyState, setCopyState] = useState('idle')
  const isEnglish = locale === 'en-US'

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
        components={{ a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer">{children}</a> }}
      >{text}</ReactMarkdown>
    </div>
    <button className={`naiba-copy-answer ${copyState}`} type="button" onClick={copyText} aria-label={label} title={label}>
      {copyState === 'copied' ? <Check size={13} /> : <Copy size={13} />}
      <span>{label}</span>
    </button>
  </div>
}
