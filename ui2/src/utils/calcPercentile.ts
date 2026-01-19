export function calcPercentile<T>(
    data: T[],
    percentile: number,
    accessor: (item: T) => number = (item) => Number(item),
): number | null {
    if (data.length === 0) return null;

    // Clamp percentile to [0, 100]
    const p = Math.min(100, Math.max(0, percentile));

    // Extract and sort numeric values
    const values = data
        .map(accessor)
        .filter((v) => Number.isFinite(v))
        .sort((a, b) => a - b);

    if (values.length === 0) return null;

    // Nearest-rank method
    const rank = Math.ceil((p / 100) * values.length) - 1;
    const index = Math.min(Math.max(rank, 0), values.length - 1);

    return values[index];
}

export function calcAllPercentiles<T>(
    data: T[],
    numBuckets: number,
    accessor: (item: T) => number = (item) => Number(item),
): number[] {
    const percentilesValues: number[] = [];
    for (let i = 0; i < 100; i += 100 / numBuckets) {
        const value = calcPercentile(data, i, accessor);
        if (value !== null) {
            percentilesValues.push(value);
        }
    }
    return Array.from(new Set(percentilesValues));
}
