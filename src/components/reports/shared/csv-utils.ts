export function escapeCSV(value: unknown): string {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function downloadCSVFile(
    filename: string,
    rows: unknown[][],
): void {
    const csvContent = rows
        .map((row) => row.map(escapeCSV).join(","))
        .join("\r\n");

    const blob = new Blob(["\uFEFF", csvContent], {
        type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}