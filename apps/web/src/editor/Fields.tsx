/**
 * Editable fields (ML-FR-001 AC2, ML-FR-002 AC1). An editable field is an inset dark input with a
 * visible border, accent monospace text and a trailing unit cell; computed values never use this
 * chrome (design-tokens.md section 1).
 *
 * NumberField keeps what the user typed as text while editing. Each change is converted ONCE
 * (display unit -> SI) and the store holds that value. When the store value changes from outside
 * (for example a new scenario), the text is replaced by the formatted stored value; when the text
 * still converts to exactly the stored value it is left alone, so typing is never rewritten.
 */
import { useEffect, useId, useState } from 'react';
import type { ValidationIssue } from '@mission-lab/contracts';
import { formatInputNumber, parseNumber } from '../format/units';

interface FieldFrameProps {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
  readonly issues: readonly ValidationIssue[];
  readonly note?: string | undefined;
  readonly testId: string;
  readonly wide?: boolean | undefined;
  readonly children: (describedBy: string | undefined, invalid: boolean) => React.ReactNode;
}

function FieldFrame({ id, label, unit, issues, note, testId, wide, children }: FieldFrameProps) {
  const msgId = `${id}-msg`;
  const noteId = `${id}-note`;
  const invalid = issues.length > 0;
  const describedBy =
    [invalid ? msgId : null, note !== undefined ? noteId : null].filter(Boolean).join(' ') ||
    undefined;
  return (
    <div className={wide === true ? 'f wide' : 'f'} data-testid={`field-${testId}`}>
      <label htmlFor={id}>{label}</label>
      <div className={invalid ? 'in bad' : 'in'}>
        {children(describedBy, invalid)}
        {unit !== '' && (
          <span className="unit" data-testid={`unit-${testId}`}>
            {unit}
          </span>
        )}
      </div>
      {note !== undefined && (
        <span className="u" id={noteId}>
          {note}
        </span>
      )}
      {invalid && (
        <span className="msg" id={msgId} data-testid={`error-${testId}`}>
          {issues.map((issue, i) => (
            <span key={i} className="msg-line">
              <span aria-hidden="true">&#10005;</span> <span className="sr-only">Error: </span>
              {issue.message} <span className="code">({issue.code})</span>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

export interface NumberFieldProps {
  readonly label: string;
  /** Display unit, always shown ("-" for dimensionless). */
  readonly unit: string;
  readonly testId: string;
  /** The stored (SI) value. */
  readonly stored: number;
  /** Stored -> display unit (to show a stored value). */
  readonly toDisplay: (stored: number) => number;
  /** Display unit -> stored; applied once to what the user types. */
  readonly fromDisplay: (display: number) => number;
  readonly onCommit: (stored: number) => void;
  readonly issues: readonly ValidationIssue[];
  readonly note?: string;
}

export function NumberField({
  label,
  unit,
  testId,
  stored,
  toDisplay,
  fromDisplay,
  onCommit,
  issues,
  note,
}: NumberFieldProps) {
  const id = useId();
  const [text, setText] = useState(() => formatInputNumber(toDisplay(stored)));

  useEffect(() => {
    // Leave the text alone if it still means the stored value; otherwise show the stored value.
    if (!Object.is(fromDisplay(parseNumber(text)), stored)) {
      setText(formatInputNumber(toDisplay(stored)));
    }
    // `text` is deliberately not a dependency: only an outside change of `stored` resets it.
  }, [stored]);

  return (
    <FieldFrame id={id} label={label} unit={unit} issues={issues} note={note} testId={testId}>
      {(describedBy, invalid) => (
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          data-testid={`input-${testId}`}
          value={text}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(e) => {
            setText(e.target.value);
            onCommit(fromDisplay(parseNumber(e.target.value)));
          }}
        />
      )}
    </FieldFrame>
  );
}

export interface TextFieldProps {
  readonly label: string;
  readonly unit: string;
  readonly testId: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly issues: readonly ValidationIssue[];
  readonly note?: string;
  readonly align?: 'left' | 'right';
  /** Label above a full-width input (for long values such as the epoch). */
  readonly wide?: boolean;
}

export function TextField({
  label,
  unit,
  testId,
  value,
  onChange,
  issues,
  note,
  align = 'right',
  wide,
}: TextFieldProps) {
  const id = useId();
  return (
    <FieldFrame
      id={id}
      label={label}
      unit={unit}
      issues={issues}
      note={note}
      testId={testId}
      wide={wide}
    >
      {(describedBy, invalid) => (
        <input
          id={id}
          type="text"
          autoComplete="off"
          spellCheck={false}
          style={{ textAlign: align }}
          data-testid={`input-${testId}`}
          value={value}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(e) => {
            onChange(e.target.value);
          }}
        />
      )}
    </FieldFrame>
  );
}
