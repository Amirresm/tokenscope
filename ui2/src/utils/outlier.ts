export function getOutliers(nums: number[], margin = 0.025): [number, number] {
    if (nums.length < 4)
        return [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];

    let values, q1, q3, iqr, maxValue, minValue;

    values = nums.slice().sort((a, b) => a - b); //copy array fast and sort
    const len = values.length - 1;
    minValue = Math.round(len * margin);
    maxValue = len - minValue;
    return [values[minValue], values[maxValue]];

    if ((values.length / 4) % 1 === 0) {
        //find quartiles
        q1 =
            (1 / 2) *
            (values[values.length / 4] + values[values.length / 4 + 1]);
        q3 =
            (1 / 2) *
            (values[values.length * (3 / 4)] +
                values[values.length * (3 / 4) + 1]);
    } else {
        q1 = values[Math.floor(values.length / 4 + 1)];
        q3 = values[Math.ceil(values.length * (3 / 4) + 1)];
    }

    iqr = q3 - q1;
    maxValue = q3 + iqr * 3;
    minValue = q1 - iqr * 3;

    return [minValue, maxValue];
}

export function clampOutliers(nums: number[], margin = 0.025): number[] {
    const [minValue, maxValue] = getOutliers(nums, margin);
    return nums.map((num) => Math.min(Math.max(num, minValue), maxValue));
}
