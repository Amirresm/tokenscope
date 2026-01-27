import React from "react";
import "./GenericAstView.css";
import {
    GenerationToken,
} from "../../models/generationToken";
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
    groupingMode: GroupingMode;
};

export function GenericAstView({ groupingMode }: GenericAstViewProps) {
    const enrichedAstTokens = astStore.enrichedAstTokens.value;
    const astColorVerbosity = astStore.astColorVerbosity.value;

    const groups = React.useMemo(() => {
        const groups: {
            index: number;
            id: string;
            tokens: GenerationToken[];
            group: string;
            averageConfidence: number;
        }[] = [];
        if (!enrichedAstTokens) {
            return groups;
        }
        for (let i = 0; i < enrichedAstTokens.length; i++) {
            const tokenInfo = enrichedAstTokens[i];
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
                    groupKey = `${tokenInfo.atomicBlock?.depth} > ${tokenInfo.atomicBlock?.type}`;
                    break;
            }
            const lastGroupKey =
                groups.length > 0 ? groups[groups.length - 1].group : null;
            if (groupKey !== lastGroupKey) {
                if (groups.length > 0) {
                    const lastGroup = groups[groups.length - 1];
                    lastGroup.averageConfidence = lastGroup
                        ? lastGroup.tokens.reduce(
                              (sum, t) => sum + t.confidence,
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
                ? lastGroup.tokens.reduce((sum, t) => sum + t.confidence, 0) /
                  lastGroup.tokens.length
                : 0;
        }
        return groups;
    }, [enrichedAstTokens, groupingMode]);

    React.useEffect(() => {
        astStore.astGroups.value = groups;
    }, [groups]);

    const getRangeColor = React.useCallback(
        (token: GenerationToken) => {
            const normalMode =
                astColorVerbosity === ASTColorVerbosityEnum.NORMAL;
            let color = "";
            if (normalMode) {
                color = getUniqueColor();
            } else {
                color = `var(${getConfidenceColorClass(token.confidence)})`;
            }

            return color;
        },
        [astColorVerbosity],
    );

    return (
        <div className="min-h-0 grow whitespace-pre-wrap p-4">
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
                            key={tk.token + tk.position}
                            className="tooltip tooltip-bottom inline before:max-w-56"
                            data-tip={`#${index} - ${itk}: ${t.group} (Conf.: ${(tk.confidence * 100).toFixed(2)}% | Avg Conf.: ${(
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
                                {visualizeWhitespace(tk.token)}
                            </span>
                        </span>
                    ))}
                </span>
            ))}
        </div>
    );
}
