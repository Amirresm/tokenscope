export function calcPercentile<T>(
    data: T[],
    accessor: (item: T) => number,
    percentile: number,
): number | null {
    if (data.length === 0) return null;

    // Clamp percentile to [0, 100]
    const p = Math.min(100, Math.max(0, percentile));

    // Extract and sort numeric values
    const values = data
        .map(accessor)
        .filter(v => Number.isFinite(v))
        .sort((a, b) => a - b);

    if (values.length === 0) return null;

    // Nearest-rank method
    const rank = Math.ceil((p / 100) * values.length) - 1;
    const index = Math.min(Math.max(rank, 0), values.length - 1);

    return values[index];
}
