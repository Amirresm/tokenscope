import { useQuery } from "@tanstack/react-query";
import React from "react";
import { fetchASTData } from "../../../api/astAPI";
import sessionStore from "../../../store/sessionStore";
import astStore, { ViewModesEnum } from "../../../store/components/astStore";

export default function AstSidebar() {
    const sessionId = sessionStore.sessionId.value;
    const branchId = sessionStore.branchId.value;
    const selectedRange = astStore.selectedRange.value;

    const astViewMode = astStore.astViewMode.value;

    const astDataQuery = useQuery({
        queryKey: ["atomicBlocks", sessionId, branchId, selectedRange],
        queryFn: async () => fetchASTData(sessionId, branchId, selectedRange),
        enabled: !!sessionId && !!branchId && !!selectedRange,
    });

    const metric = "confidence";

    const stats = React.useMemo(() => {
        const stats: Record<string, number[]> = {};
        if (astDataQuery.data) {
            for (const tokenInfo of astDataQuery.data.astTokens) {
                let groupKey = "";
                switch (astViewMode) {
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
                const metricValue = parseFloat(tokenInfo.token[metric]);

                if (groupKey in stats) {
                    stats[groupKey].push(metricValue);
                } else {
                    stats[groupKey] = [metricValue];
                }
            }
        }

        return stats;
    }, [astDataQuery.data, astViewMode, metric]);

    return (
        <div className="w-full flex flex-col gap-2">
            <div className="flex flex-col gap-1">
                <button
                    className="btn btn-ghost btn-secondary mb-4"
                    onClick={() => {
                        const modal = document.getElementById(
                            "ast_attention_heatmap_modal",
                        ) as HTMLDialogElement;
                        modal.showModal();
                    }}
                >
                    Show Attention Heatmap
                </button>
                <button
                    className="btn btn-ghost btn-secondary mb-4"
                    onClick={() => {
                        const modal = document.getElementById(
                            "ast_stats_chart_modal",
                        ) as HTMLDialogElement;
                        modal.showModal();
                    }}
                >
                    Show Stats Chart
                </button>

                <h2 className="font-semibold">AST {astViewMode} Stats</h2>
                <div>
                    <ul className="list-disc list-inside">
                        {Object.entries(stats).map(([type, values]) => {
                            const avg =
                                values.reduce((sum, v) => sum + v, 0) /
                                values.length;
                            return (
                                <li key={type}>
                                    {type}: {avg.toFixed(4)} (n=
                                    {values.length})
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>
        </div>
    );
}
