import type { FinancialYear } from "./useFinancialYears";

type FinancialYearSelectorProps = {
    financialYears: FinancialYear[];
    selectedFinancialYearId: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    className?: string;
};

export function FinancialYearSelector({
    financialYears,
    selectedFinancialYearId,
    onChange,
    disabled = false,
    className = "",
}: FinancialYearSelectorProps) {
    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <label
                htmlFor="financial-year-selector"
                className="whitespace-nowrap text-sm font-medium"
            >
                Financial Year
            </label>

            <select
                id="financial-year-selector"
                value={selectedFinancialYearId}
                onChange={(event) => onChange(event.target.value)}
                disabled={disabled || financialYears.length === 0}
                className="h-10 min-w-[170px] rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
                {financialYears.length === 0 ? (
                    <option value="">No financial years available</option>
                ) : (
                    financialYears.map((year) => (
                        <option key={year.id} value={year.id}>
                            {year.year_label}
                        </option>
                    ))
                )}
            </select>
        </div>
    );
}