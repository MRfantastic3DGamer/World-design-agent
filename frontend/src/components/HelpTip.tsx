import type { ReactNode } from 'react'

interface HelpTipProps {
  text: string
}

export function HelpTip({ text }: HelpTipProps) {
  return (
    <span className="help-tip">
      <button type="button" className="help-tip__btn" aria-label="Help" tabIndex={0}>
        ?
      </button>
      <span className="help-tip__popup" role="tooltip">
        {text}
      </span>
    </span>
  )
}

interface FieldLabelProps {
  label: string
  tip: string
  helper?: string
  htmlFor?: string
  children?: ReactNode
}

export function FieldLabel({ label, tip, helper, htmlFor, children }: FieldLabelProps) {
  return (
    <div className="field-label">
      <div className="field-label__row">
        <label htmlFor={htmlFor}>{label}</label>
        <HelpTip text={tip} />
      </div>
      {helper ? <p className="field-label__helper">{helper}</p> : null}
      {children}
    </div>
  )
}
