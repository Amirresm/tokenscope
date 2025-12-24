import {
    AstTokenInfo,
    astTokenInfoFromJson,
    AtomicBlock,
    atomicBlockFromJson,
} from "../models/ast";
import { API_BASE_URL } from "./constants";

export async function fetchASTData(
    sessionId: string,
    branchId: string,
    selectedRange: { start: number; end: number },
) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/get_ast?session_id=${sessionId}&branch_id=${branchId}&start=${selectedRange.start}&end=${selectedRange.end}`,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            },
        );
        if (!response.ok) {
            console.error("Error:", response.statusText);
            return;
        }
        const data = await response.json();

        const atomicBlocks: AtomicBlock[] =
            data.atomic_blocks.map(atomicBlockFromJson);

        const astTokens: AstTokenInfo[] = data.tokens.map((tokenData: any) =>
            astTokenInfoFromJson(tokenData),
        );

        return { atomicBlocks, astTokens };
    } catch (error) {
        console.error("Error:", error);
    }
}
