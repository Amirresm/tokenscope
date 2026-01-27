import { GenerationToken, GenerationTokenData } from "./generationToken";

type Range = {
    start: number;
    end: number;
};

export type AtomicBlock = {
    id: number;
    type: string;
    range: Range;
    source: string;
    depth: number;
};

type AstMatchInfo = {
    matchType: string;
    token: string;
    type: string;
    category: string;
    group: string;
    priority: number;
    start: number;
    end: number;
};

export type AstTokenInfo = {
    token: GenerationTokenData;
    match: AstMatchInfo;
    blockId: number | null;
    blockType: string | null;
    blockDepth: number | null;
    atomicBlock: AtomicBlock | null;
    start: number;
    end: number;
    lineNumber: number;
};

export type EnrichedAstTokenInfo = {
    token: GenerationToken;
    match: AstMatchInfo;
    blockId: number | null;
    blockType: string | null;
    blockDepth: number | null;
    atomicBlock: AtomicBlock | null;
    start: number;
    end: number;
    lineNumber: number;
};

export function atomicBlockFromJson(data: any): AtomicBlock {
    return {
        id: data.id,
        type: data.type,
        range: {
            start: data.range.start,
            end: data.range.end,
        },
        source: data.source,
        depth: data.depth,
    };
}

export function astTokenInfoFromJson(data: any): AstTokenInfo {
    return {
        token: {
            token_string: data.token.token_string,
            token_id: data.token.token_id,
            confidence: data.token.confidence,
            position: data.token.position,
            token_types: data.token.token_types,
            alternative_tokens: data.token.alternative_tokens,
            branch_id: "",
        },
        match: {
            matchType: data.match.match_type,
            token: data.match.token,
            type: data.match.type,
            category: data.match.category,
            group: data.match.group,
            priority: data.match.priority,
            start: data.match.start,
            end: data.match.end,
        },
        blockId: data.block_id,
        blockType: data.block_type,
        blockDepth: data.block_depth,
        atomicBlock: data.atomic_block,
        start: data.start,
        end: data.end,
        lineNumber: data.line_number,
    };
}
