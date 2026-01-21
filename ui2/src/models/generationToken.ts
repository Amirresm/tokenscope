type AttentionSnapshotData = Record<string, [string, string][]>;
type AttentionSnapshot = Record<string, { index: number; attention: number }[]>;

function calculateStandardDeviation(values: number[]): number {
    const mean =
        values.reduce(
            (accumulator, currentValue) => accumulator + currentValue,
            0,
        ) / values.length;
    const squaredDifferences = values.map((value) => {
        const difference = value - mean;
        return difference * difference;
    });
    const variance =
        squaredDifferences.reduce(
            (accumulator, currentValue) => accumulator + currentValue,
            0,
        ) / values.length;
    return Math.sqrt(variance);
}

export type GenerationTokenData = {
    token_string: string;
    token_id: number;
    confidence: string;
    perplexity?: string;
    last_perplexity?: string;
    margin_confidence?: string;
    entropy?: string;
    position: number;
    token_time_ms: string;
    token_types: string[];
    alternative_tokens?: GenerationTokenData[];
    attention_snapshot?: AttentionSnapshotData;

    branch_id: string;
};

export type GenerationToken = {
    token: string;
    tokenId: number;

    confidence: number;
    perplexity?: number;
    lastPerplexity?: number;
    marginConfidence?: number;
    entropy?: number;

    attentionSaliences: Record<string, number>;

    position: number;
    tokenTimeMs: number;
    tokenTypes: string[];
    alternativeTokens?: GenerationToken[];
    branchId?: string;
    attentionSnapshot?: AttentionSnapshot;
    reverseAttentionSnapshot?: AttentionSnapshot;

    stop?: boolean;
    prompt?: boolean;
    manual?: boolean;

    // Local attributes
    lineNumber?: number;
    lineConfidence?: number;
    relativeAttention?: number;
};

export function generationTokenFromData(
    data: GenerationTokenData,
): GenerationToken {
    let attentionSnapshot: AttentionSnapshot | undefined = undefined;
    if (data.attention_snapshot) {
        attentionSnapshot = {};
        for (const head in data.attention_snapshot) {
            attentionSnapshot[head] = data.attention_snapshot[head].map(
                (pair) => ({
                    index: parseInt(pair[0], 10),
                    attention: parseFloat(pair[1]),
                }),
            );
        }
    }
    const tokenTypes = data.token_types || [];
    const alternativeTokens = data.alternative_tokens
        ? data.alternative_tokens.map((token) => generationTokenFromData(token))
        : [];
    alternativeTokens.forEach((token) => (token.position = data.position));

    return {
        token: data.token_string,
        tokenId: data.token_id,
        confidence:
            typeof data.confidence === "string"
                ? parseFloat(data.confidence)
                : data.confidence,
        perplexity: data.perplexity ? parseFloat(data.perplexity) : undefined,
        lastPerplexity: data.last_perplexity
            ? parseFloat(data.last_perplexity)
            : undefined,
        marginConfidence: data.margin_confidence
            ? parseFloat(data.margin_confidence)
            : undefined,
        attentionSaliences: {},
        entropy: data.entropy ? parseFloat(data.entropy) : undefined,
        position: data.position,
        tokenTimeMs: parseFloat(data.token_time_ms),
        tokenTypes: tokenTypes,
        branchId: data.branch_id,
        alternativeTokens: alternativeTokens,
        attentionSnapshot: attentionSnapshot,
        stop: tokenTypes.includes("stop"),
        prompt: tokenTypes.includes("prompt"),
        manual: tokenTypes.includes("manual"),
    };
}

export function getGenerationTokenSortBias(token: GenerationToken) {
    let bias = 0;
    if (token.tokenTypes.includes("prefix")) bias -= 10000;
    if (token.tokenTypes.includes("suffix")) bias += 10000;
    return bias;
}
