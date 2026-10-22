import { CURRENCIES, type Currency } from "../api/types";
import { CURRENCY_SYMBOLS } from "../lib/money";

type Props = {
    label: string;
    value: Currency;
    onChange: (currency: Currency) => void;
    disabled?: boolean;
};

export function CurrencyChips({ label, value, onChange, disabled }: Props) {
    return (
        <div>
            <p className="section-label">{label}</p>
            <div className="choice-row" role="radiogroup" aria-label={label}>
                {CURRENCIES.map((currency) => {
                    const active = currency === value;

                    return (
                        <button
                            key={currency}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            disabled={disabled}
                            className={`chip glass${active ? " chip--active" : ""}`}
                            onClick={() => onChange(currency)}
                        >
                            <span className="chip-symbol">{CURRENCY_SYMBOLS[currency]}</span>
                            <span>{currency}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
