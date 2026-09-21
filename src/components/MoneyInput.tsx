import { useState } from 'react';
import { parseMoney } from '../lib/money';

interface Props {
  id: string;
  value: number | null;
  onChange: (value: number | null) => void;
  big?: boolean;
  unit?: string;
  placeholder?: string;
  prefix?: string;
}

/** A dollar (or percent) field that keeps the user's typing but reports a number. */
export function MoneyInput({ id, value, onChange, big, unit, placeholder = '0', prefix = '$' }: Props) {
  const [text, setText] = useState(value === null ? '' : formatTyped(value));
  return (
    <div className={`input ${big ? 'big' : ''}`}>
      {prefix && <span className="unit">{prefix}</span>}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseMoney(e.target.value));
        }}
        onBlur={() => {
          const n = parseMoney(text);
          if (n !== null) setText(formatTyped(n));
        }}
      />
      {unit && <span className="unit small">{unit}</span>}
    </div>
  );
}

function formatTyped(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
