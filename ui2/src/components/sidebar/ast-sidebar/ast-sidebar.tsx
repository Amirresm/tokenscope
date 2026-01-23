import { useQuery } from "@tanstack/react-query";
import React from "react";
import { fetchASTData } from "../../../api/astAPI";
import sessionStore from "../../../store/sessionStore";
import astStore, {
    ASTViewModeLabels,
    ViewModesEnum,
} from "../../../store/components/astStore";

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
                        groupKey = `${tokenInfo.atomicBlock?.depth} > ${tokenInfo.atomicBlock?.type}`;
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
            <div className="flex flex-col gap-1 p-5">
                <h3 className="mt-1 mb-4 font-bold">Code Analysis Statistics</h3>
                <button
                    className="btn btn-ghost btn-secondary mb-4"
                    onClick={() => {
                        const modal = document.getElementById(
                            "ast_stats_chart_modal",
                        ) as HTMLDialogElement;
                        modal.showModal();
                    }}
                >
                    View Statistics Plot
                </button>
                <button
                    className="btn btn-ghost btn-secondary mb-4"
                    onClick={() => {
                        const modal = document.getElementById(
                            "ast_attention_heatmap_modal",
                        ) as HTMLDialogElement;
                        modal.showModal();
                    }}
                >
                    View Attention Heatmap
                </button>
                <h2 className="">
                    Average {metric} by {ASTViewModeLabels[astViewMode]}
                </h2>
                <table className="table table-sm">
                    <thead>
                        <tr className="text-xs">
                            <th>Entity</th>
                            <th>Average</th>
                            <th>Count</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(stats).map(([type, values]) => {
                            const avg =
                                values.reduce((sum, v) => sum + v, 0) /
                                values.length;
                            return (
                                <tr key={type} className="text-sm">
                                    <td className="text-xs">{type}</td>
                                    <td>{avg.toFixed(4)}</td>
                                    <td>{values.length}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
