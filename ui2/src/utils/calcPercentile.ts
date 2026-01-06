export function calcPercentile<T>(
    data: T[],
    accessor: (item: T) => number,
    percentile: number,
): number | null {
    if (data.length === 0) return null;
    const sorted = data
        .map(accessor)
        .filter((v) => !isNaN(v))
        .sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    if (Number.isInteger(index)) {
        return sorted[index];
    } else {
        const lowerIndex = Math.floor(index);
        const upperIndex = Math.ceil(index);
        const weight = index - lowerIndex;
        return sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight;
    }
}
