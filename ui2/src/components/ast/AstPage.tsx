import { useQuery } from "@tanstack/react-query";
import sessionStore from "../../store/sessionStore";
import { fetchASTData } from "../../api/astAPI";
import React from "react";
import generationStore from "../../store/generationStore";
import { BlockView } from "./BlockView";
import { GenericAstView } from "./GenericAstView";
import astStore from "../../store/components/astStore";

type RangeSelectorProps = {
    source: string;
    onSelectRange: (start: number, end: number) => void;
};

function RangeSelector({ source, onSelectRange }: RangeSelectorProps) {
    const handleMouseUp = React.useCallback(
        (e: React.MouseEvent<HTMLPreElement>) => {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const preElement = e.currentTarget;
                if (preElement.contains(range.commonAncestorContainer)) {
                    const start = range.startOffset;
                    const end = range.endOffset;
                    if (start !== end) {
                        console.log("Selected range:", start, end);
                        console.log("Selected text:", selection.toString());
                        onSelectRange(start, end);
                    }
                }
            }
        },
        [onSelectRange],
    );

    return (
        <pre onMouseUp={handleMouseUp} className="whitespace-pre-wrap">
            {source}
        </pre>
    );
}

export enum ViewModesEnum {
    Type = "type",
    Category = "category",
    Group = "group",
    Block = "block",
    LineNumber = "lineNumber",
    AtomicBlock = "atomicBlock",
    AtomicBlock2 = "atomicBlock2",
}

export function AstPage() {
    const sessionId = sessionStore.sessionId.value;
    const branchId = sessionStore.branchId.value;

    const selectedRange = astStore.selectedRange.value;

    const [viewMode, setViewMode] = React.useState<ViewModesEnum>(
        ViewModesEnum.Type,
    );

    const source = generationStore.currentGeneration.value
        ?.map((t) => t.token)
        .join("");

    const astDataQuery = useQuery({
        queryKey: ["atomicBlocks", sessionId, branchId, selectedRange],
        queryFn: async () => fetchASTData(sessionId, branchId, selectedRange),
        enabled: !!sessionId && !!branchId && !!selectedRange,
    });

    if (!selectedRange)
        return (
            <div>
                {source ? (
                    <>
                        <div className="m-4 p-4 rounded-lg bg-base-200">
                            Select a range to view Atomic Blocks
                        </div>
                        <RangeSelector
                            source={source}
                            onSelectRange={(start, end) =>
                                (astStore.selectedRange.value = { start, end })
                            }
                        />
                    </>
                ) : (
                    <div className="m-4 p-4 rounded-lg bg-base-200">
                        Generate some text to view its AST structure.
                    </div>
                )}
            </div>
        );

    if (astDataQuery.isLoading)
        return (
            <div className="m-4 p-4 rounded-lg bg-base-200">
                Loading AST data...
            </div>
        );

    if (astDataQuery.isError || !astDataQuery.data)
        return (
            <div className="m-4 p-4 rounded-lg bg-base-200 text-red-500">
                Error loading AST data.
            </div>
        );

    return (
        <div className="m-4 min-h-0 flex flex-col">
            <div>
                <div className="dropdown">
                    <div tabIndex={0} role="button" className="btn m-1">
                        View Mode: {viewMode}
                    </div>
                    <ul
                        tabIndex={0}
                        className="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm"
                    >
                        {Object.values(ViewModesEnum).map((mode) => (
                            <li key={mode} onClick={() => setViewMode(mode)}>
                                <a
                                    className={
                                        viewMode === mode ? "font-bold" : ""
                                    }
                                >
                                    {mode}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            {viewMode === ViewModesEnum.AtomicBlock ? (
                <BlockView atomicBlocks={astDataQuery.data.atomicBlocks} />
            ) : (
                <GenericAstView
                    astTokens={astDataQuery.data.astTokens}
                    groupingMode={viewMode}
                />
            )}
        </div>
    );
}
