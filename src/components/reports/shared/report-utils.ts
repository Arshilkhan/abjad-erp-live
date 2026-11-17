import { toast } from "sonner";

export function downloadCSV(filename: string, rows: any[]) {
    if (!rows.length) {
        toast.error("No data to export");
        return;
    }

    const headers = Object.keys(rows[0]);

    const escapeCSV = (value: any) =>
        `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csv = [
        headers.join(","),
        ...rows.map((row) =>
            headers.map((header) => escapeCSV(row[header])).join(","),
        ),
    ].join("\n");

    const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    anchor.click();

    URL.revokeObjectURL(url);
}

export const startOfYear = () => {
    const date = new Date();
    return `${date.getFullYear()}-04-01`;
};

export const today = () => {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};
