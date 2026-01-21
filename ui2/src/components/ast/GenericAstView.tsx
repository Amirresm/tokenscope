import React from "react";
import { AstTokenInfo, AtomicBlock } from "../../models/ast";
import "./GenericAstView.css";
import { GenerationTokenData } from "../../models/generationToken";
import { getUniqueColor } from "../../utils/unqiueColorGenerator";
import astStore, {
    ASTColorVerbosityEnum,
    ViewModesEnum,
} from "../../store/components/astStore";

function visualizeWhitespace(str: string) {
    return str;
    // .replace(/ /g, "␣") // space
    // .replace(/\t/g, "⇥") // tab
    // .replace(/\n/g, "⏎\n") // newline
}

const verboseColorMap = {
    0.0: "--ast-grade-0",
    0.1: "--ast-grade-1",
    0.2: "--ast-grade-2",
    0.35: "--ast-grade-3",
    0.5: "--ast-grade-4",
    0.65: "--ast-grade-5",
    0.75: "--ast-grade-6",
    0.85: "--ast-grade-7",
    0.9: "--ast-grade-8",
    0.98: "--ast-grade-9",
};

const getConfidenceColorClass = (confidence: number) => {
    const textColor = Object.entries(verboseColorMap).reduce(
        (acc, [threshold, color]) => {
            if (confidence >= parseFloat(threshold)) {
                return color;
            }
            return acc;
        },
        "",
    );
    return textColor;
};

type GroupingMode =
    | ViewModesEnum.Type
    | ViewModesEnum.Category
    | ViewModesEnum.Group
    // | ViewModesEnum.Block
    | ViewModesEnum.LineNumber
    | ViewModesEnum.AtomicBlock2;

type GenericAstViewProps = {
    astTokens: AstTokenInfo[];
    groupingMode: GroupingMode;
};

export function GenericAstView({
    astTokens,
    groupingMode,
}: GenericAstViewProps) {
    const astColorVerbosity = astStore.astColorVerbosity.value;

    const groups = React.useMemo(() => {
        const groups: {
            index: number;
            id: string;
            tokens: GenerationTokenData[];
            group: string;
            averageConfidence: number;
        }[] = [];
        for (let i = 0; i < astTokens.length; i++) {
            const tokenInfo = astTokens[i];
            let groupKey = "";
            switch (groupingMode) {
                case ViewModesEnum.Type:
                    groupKey = tokenInfo.match.type;
                    break;
                case ViewModesEnum.Category:
                    groupKey = tokenInfo.match.category;
                    break;
                case ViewModesEnum.Group:
                    groupKey = tokenInfo.match.group;
                    break;
                // case ViewModesEnum.Block:
                //     groupKey = `${tokenInfo.blockType}-${tokenInfo.blockId}`;
                //     break;
                case ViewModesEnum.LineNumber:
                    groupKey = `Line ${tokenInfo.lineNumber}`;
                    break;
                case ViewModesEnum.AtomicBlock2:
                    groupKey = `${tokenInfo.atomicBlock?.type} - ${tokenInfo.atomicBlock?.depth}`;
                    break;
            }
            const lastGroupKey =
                groups.length > 0 ? groups[groups.length - 1].group : null;
            if (groupKey !== lastGroupKey) {
                if (groups.length > 0) {
                    const lastGroup = groups[groups.length - 1];
                    lastGroup.averageConfidence = lastGroup
                        ? lastGroup.tokens.reduce(
                              (sum, t) => sum + parseFloat(t.confidence),
                              0,
                          ) / lastGroup.tokens.length
                        : 0;
                }

                groups.push({
                    index: i,
                    id: `${i}|${groupKey}`,
                    tokens: [tokenInfo.token],
                    group: groupKey,
                    averageConfidence: 0,
                });
            } else {
                groups[groups.length - 1].tokens.push(tokenInfo.token);
            }
        }
        if (groups.length > 0) {
            const lastGroup = groups[groups.length - 1];
            lastGroup.averageConfidence = lastGroup
                ? lastGroup.tokens.reduce(
                      (sum, t) => sum + parseFloat(t.confidence),
                      0,
                  ) / lastGroup.tokens.length
                : 0;
        }
        return groups;
    }, [astTokens, groupingMode]);

    React.useEffect(() => {
        astStore.astGroups.value = groups;
    }, [groups]);

    const getRangeColor = React.useCallback(
        (token: GenerationTokenData) => {
            const normalMode =
                astColorVerbosity === ASTColorVerbosityEnum.NORMAL;
            let color = "";
            if (normalMode) {
                color = getUniqueColor();
            } else {
                color = `var(${getConfidenceColorClass(
                    parseFloat(token.confidence),
                )})`;
            }

            return color;
        },
        [astColorVerbosity],
    );

    return (
        <div className="min-h-0 grow overflow-y-auto whitespace-pre-wrap p-4">
            {groups.map((t, index) => (
                <span
                    data-content={`#${index}: ${t.group}`}
                    className={`atomic-block`}
                    style={{
                        color: getRangeColor(t.tokens[0]),
                    }}
                    key={index}
                >
                    {t.tokens.map((tk, itk) => (
                        <span
                            key={tk.token_string + tk.position}
                            className="tooltip tooltip-bottom inline before:z-50"
                            data-tip={`#${index} - ${itk}: ${t.group} (C: ${(parseFloat(tk.confidence) * 100).toFixed(2)}% | AC: ${(
                                t.averageConfidence * 100
                            ).toFixed(2)}% for ${t.tokens.length} tokens)`}
                        >
                            <span
                                className="hover:text-blue-400"
                                onClick={() => {
                                    // TODO:
                                    // generationStore.selectedToken.value = tk;
                                    // globalStore.viewMode.value = "generation";
                                }}
                            >
                                {visualizeWhitespace(tk.token_string)}
                            </span>
                        </span>
                    ))}
                </span>
            ))}
        </div>
    );
}
