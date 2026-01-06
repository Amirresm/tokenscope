type AttentionSnapshotData = Record<string, [string, string][]>;
type AttentionSnapshot = Record<string, { index: number; attention: number }[]>;

export type GenerationTokenData = {
    token_string: string;
    token_id: number;
    confidence: string;
    perplexity?: string;
    position: number;
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
    position: number;
    tokenTypes: string[];
    alternativeTokens?: GenerationToken[];
    branchId?: string;
    attentionSnapshot?: AttentionSnapshot;

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
        position: data.position,
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
