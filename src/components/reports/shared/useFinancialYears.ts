import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FinancialYear = {
    id: string;
    year_label: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
};

export function useFinancialYears() {
    const [selectedFinancialYearId, setSelectedFinancialYearId] =
        useState(() =>
            typeof window !== "undefined"
                ? window.sessionStorage.getItem("abjad-selected-financial-year") ?? ""
                : ""
        );

    const {
        data: financialYears = [],
        isLoading,
        error,
    } = useQuery({
        queryKey: ["rep-ledger-financial-years"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("f_year")
                .select("id, year_label, start_date, end_date, is_active")
                .order("start_date", { ascending: false });

            if (error) throw error;

            return (data ?? []) as FinancialYear[];
        },
    });

    useEffect(() => {
        if (financialYears.length === 0) return;

        const selectedExists = financialYears.some(
            (year) => year.id === selectedFinancialYearId
        );

        if (selectedExists) return;

        const defaultYear =
            financialYears.find((year) => year.is_active) ??
            financialYears[0];

        setSelectedFinancialYearId(defaultYear.id);
    }, [financialYears, selectedFinancialYearId]);

    useEffect(() => {
        if (selectedFinancialYearId) {
            sessionStorage.setItem(
                "abjad-selected-financial-year",
                selectedFinancialYearId
            );
        }
    }, [selectedFinancialYearId]);

    const selectedFinancialYear = financialYears.find(
        (year) => year.id === selectedFinancialYearId,
    );

    return {
        financialYears,
        selectedFinancialYear,
        selectedFinancialYearId,
        setSelectedFinancialYearId,
        isLoading,
        error,
    };
}