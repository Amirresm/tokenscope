export type GenerationTokenData = {
    token_string: string;
    token_id: number;
    confidence: number;
    position: number;
    token_types: string[];
    alternative_tokens?: GenerationTokenData[];

    branch_id: string;
};

export type GenerationToken = {
    token: string;
    tokenId: number;
    confidence: number;
    position: number;
    tokenTypes: string[];
    alternativeTokens?: GenerationToken[];
    branchId?: string;
    attentionSnapshot?: number[][];

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
    return {
        token: data.token_string,
        tokenId: data.token_id,
        confidence:
            typeof data.confidence === "string"
                ? parseFloat(data.confidence)
                : data.confidence,
        position: data.position,
        tokenTypes: data.token_types,
        branchId: data.branch_id,
        alternativeTokens: data.alternative_tokens
            ? data.alternative_tokens.map((token) =>
                  generationTokenFromData(token),
              )
            : undefined,
        stop: data.token_types.includes("stop"),
        prompt: data.token_types.includes("prompt"),
        manual: data.token_types.includes("manual"),
    };
}

export function getGenerationTokenSortBias(token: GenerationToken) {
    let bias = 0;
    if (token.tokenTypes.includes("prefix")) bias -= 10000;
    if (token.tokenTypes.includes("suffix")) bias += 10000;
    return bias;
}
