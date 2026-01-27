import React, { useRef, useLayoutEffect } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import am5themes_Dark from "@amcharts/amcharts5/themes/Dark";
import am5themes_Material from "@amcharts/amcharts5/themes/Material";
import * as am5plugins_exporting from "@amcharts/amcharts5/plugins/exporting";
import astStore, {
    ASTViewModeLabels,
    ViewModesEnum,
} from "../../store/components/astStore";
import generationStore from "../../store/generationStore";

type DataPoint = {
    sourceGroupId: string;
    targetGroupId: string;
    value: number;
};

function Chart() {
    const chartRef = useRef<am5xy.XYChart>(null);

    const astGroups = astStore.astGroups.value;
    const currentGeneration = generationStore.currentGeneration.value;
    const isGenerating = generationStore.isGenerating.value;
    const attentionTargetHead = generationStore.attentionTargetHead.value;

    useLayoutEffect(() => {
        const root = am5.Root.new("astAttentionHeatmapdiv");

        const darkMode =
            document.documentElement.getAttribute("data-theme") === "dark";

        const themes: any[] = [
            am5themes_Animated.new(root),
            am5themes_Material.new(root),
        ];

        if (darkMode) {
            themes.push(am5themes_Dark.new(root));
        }
        root.setThemes(themes);

        const chart = root.container.children.push(
            am5xy.XYChart.new(root, {
                panX: false,
                panY: false,
                wheelX: "none",
                wheelY: "none",
                paddingLeft: 0,
                layout: root.verticalLayout,
                background: am5.Rectangle.new(root, {
                    fill: darkMode ? am5.color(0x090909) : am5.color(0xffffff),
                    fillOpacity: 1,
                }),
            }),
        );

        am5plugins_exporting.Exporting.new(root, {
            menu: am5plugins_exporting.ExportingMenu.new(root, {}),
            pngOptions: {
                maintainPixelRatio: true,
            },
        });

        const yRenderer = am5xy.AxisRendererY.new(root, {
            visible: false,
            minGridDistance: 20,
            inversed: true,
            minorGridEnabled: true,
        });

        yRenderer.grid.template.set("visible", false);

        const yAxis = chart.yAxes.push(
            am5xy.CategoryAxis.new(root, {
                maxDeviation: 0,
                renderer: yRenderer,
                categoryField: "sourceGroupId",
            }),
        );

        const xRenderer = am5xy.AxisRendererX.new(root, {
            visible: false,
            minGridDistance: 30,
            opposite: true,
            minorGridEnabled: true,
        });
        xRenderer.labels.template.setAll({
            paddingTop: 15,
        });

        xRenderer.grid.template.set("visible", false);

        const xAxis = chart.xAxes.push(
            am5xy.CategoryAxis.new(root, {
                renderer: xRenderer,
                categoryField: "targetGroupId",
            }),
        );

        const series = chart.series.push(
            am5xy.ColumnSeries.new(root, {
                calculateAggregates: true,
                stroke: am5.color(0xffffff),
                clustered: false,
                xAxis: xAxis,
                yAxis: yAxis,
                categoryXField: "targetGroupId",
                categoryYField: "sourceGroupId",
                valueField: "value",
            }),
        );

        series.columns.template.setAll({
            tooltipText: "{categoryY} -> {categoryX} = {value}",
            strokeOpacity: 1,
            strokeWidth: 0,
            width: am5.percent(100),
            height: am5.percent(100),
        });

        series.columns.template.events.on("pointerover", function (event) {
            const di = event.target.dataItem;
            if (di) {
                const val = di.get("value", 0);
                typeof val === "number" && heatLegend.showValue(val);
            }
        });

        series.events.on("datavalidated", function () {
            heatLegend.set("startValue", series.getPrivate("valueHigh"));
            heatLegend.set("endValue", series.getPrivate("valueLow"));
        });

        series.set("heatRules", [
            {
                target: series.columns.template,
                min: am5.color(0x9f9b98),
                max: am5.color(0xfe131a),
                dataField: "value",
                key: "fill",
            },
        ]);

        const heatLegend = chart.bottomAxesContainer.children.push(
            am5.HeatLegend.new(root, {
                orientation: "horizontal",
                endColor: am5.color(0x9f9b98),
                startColor: am5.color(0xfe131a),
                startOpacity: 1,
                endOpacity: 1,
            }),
        );

        chartRef.current = chart;

        return () => {
            root.dispose();
        };
    }, []);

    useLayoutEffect(() => {
        if (chartRef.current && !isGenerating) {
            const chart = chartRef.current;
            const data: DataPoint[] = [];
            let groupIds: string[] = [];

            // Reconstruct avgAttentionMap from astStore data
            const avgAttentionMap: Record<
                string,
                Record<string, number[]>
            > = {};
            const groupNameKey = "group";

            if (attentionTargetHead) {
                for (const group of astGroups) {
                    avgAttentionMap[group[groupNameKey]] = {};
                    for (const token of group.tokens) {
                        const richToken = currentGeneration?.find(
                            (t) =>
                                t.position === token.position &&
                                t.token === token.token_string,
                        );
                        if (!richToken) {
                            console.error(
                                "Rich token not found for attention mapping",
                                token,
                            );
                            // throw new Error(
                            //     "Rich token not found for attention mapping",
                            // );
                            continue;
                        }
                        if (richToken.attentionSnapshot) {
                            const meanAttentionsPerHead =
                                richToken.attentionSnapshot[
                                    attentionTargetHead
                                ];
                            for (const {
                                index: tokenIndex,
                                attention: attentionValue,
                            } of meanAttentionsPerHead) {
                                // find the group and token for tokenIndex
                                let targetGroupId = null;
                                for (const g of astGroups) {
                                    for (const gt of g.tokens) {
                                        const targetRichToken =
                                            currentGeneration?.find(
                                                (t) =>
                                                    t.position ===
                                                        gt.position &&
                                                    t.token === gt.token_string,
                                            );
                                        if (targetRichToken && targetRichToken.position === tokenIndex) {
                                            targetGroupId = g[groupNameKey];
                                            break;
                                        }
                                    }
                                    if (targetGroupId) {
                                        break;
                                    }
                                }
                                if (!targetGroupId) {
                                    console.error(
                                        "Target group not found for attention mapping",
                                    );
                                    // throw new Error(
                                    //     "Target group not found for attention mapping",
                                    // );
                                }
                                if (
                                    !(
                                        targetGroupId in
                                        avgAttentionMap[group[groupNameKey]]
                                    )
                                ) {
                                    avgAttentionMap[group[groupNameKey]][
                                        targetGroupId
                                    ] = [];
                                }
                                avgAttentionMap[group[groupNameKey]][
                                    targetGroupId
                                ].push(attentionValue);
                            }
                        }
                    }
                }
                groupIds = Object.keys(avgAttentionMap);

                const filledAvgAttentionMap = { ...avgAttentionMap };
                for (let i = 0; i < groupIds.length; i++) {
                    for (let j = 0; j < i; j++) {
                        if (
                            !(groupIds[j] in filledAvgAttentionMap[groupIds[i]])
                        ) {
                            filledAvgAttentionMap[groupIds[i]][groupIds[j]] = [
                                0,
                            ];
                        }
                    }
                }

                for (const [sourceGroupId, targets] of Object.entries(
                    filledAvgAttentionMap,
                )) {
                    for (const [targetGroupId, values] of Object.entries(
                        targets,
                    )) {
                        const value =
                            values.reduce((sum, v) => sum + v, 0) /
                            values.length;
                        data.push({
                            sourceGroupId,
                            targetGroupId,
                            value,
                        });
                    }
                }
            }

            const xAxisKey = groupIds.map((id) => ({ targetGroupId: id }));
            const yAxisKey = groupIds.map((id) => ({ sourceGroupId: id }));

            // for (const x of xAxisKey) {
            //     for (const y of yAxisKey) {
            //         const exists = data.find(
            //             (d) =>
            //                 d.sourceGroupId === y.sourceGroupId &&
            //                 d.targetGroupId === x.targetGroupId,
            //         );
            //         if (!exists) {
            //             data.push({
            //                 sourceGroupId: y.sourceGroupId,
            //                 targetGroupId: x.targetGroupId,
            //                 value: 0,
            //             });
            //         }
            //     }
            // }

            chart.series.each((series) => {
                series.data.setAll(data);
            });

            chart.xAxes.each((xAxis) => {
                xAxis.data.setAll(xAxisKey);
            });
            chart.yAxes.each((yAxis) => {
                yAxis.data.setAll(yAxisKey);
            });
            console.log("AST Attention Heatmap data set:", data, groupIds);
        }
    }, [astGroups, currentGeneration, attentionTargetHead, isGenerating]);

    return (
        <div
            id="astAttentionHeatmapdiv"
            style={{ width: "100%", height: "100%" }}
        ></div>
    );
}

export function ASTAttentionHeatmapModal() {
    const currentGeneration = generationStore.currentGeneration.value;
    const attentionTargetHead = generationStore.attentionTargetHead.value;
    const astViewMode = astStore.astViewMode.value;

    const attentionTargetHeadOptions = React.useMemo(() => {
        if (currentGeneration.length === 0) return [];
        const firstWithAttention = currentGeneration.find(
            (t) =>
                t.attentionSnapshot &&
                Object.keys(t.attentionSnapshot).length > 0,
        );
        if (!firstWithAttention) return [];
        return Object.keys(firstWithAttention.attentionSnapshot!);
    }, [currentGeneration]);

    const [isInView, setIsInView] = React.useState(false);

    React.useEffect(() => {
        const dialog = document.getElementById(
            "ast_attention_heatmap_modal",
        ) as HTMLDialogElement;

        const observer = new MutationObserver(() => {
            if (dialog.open) {
                setIsInView(true);
            } else {
                setIsInView(false);
            }
        });

        observer.observe(dialog, {
            attributes: true,
            attributeFilter: ["open"],
        });

        return () => {
            observer.disconnect();
        };
    }, []);

    return (
        <dialog id="ast_attention_heatmap_modal" className="modal">
            <div className="modal-box h-[90vh] w-11/12 max-w-11/12">
                {isInView && (
                    <div className="flex flex-col h-full">
                        <div tabIndex={0} />
                        <div className="flex items-center gap-4 mb-4">
                            <div className="dropdown dropdown-bottom">
                                <div
                                    tabIndex={0}
                                    role="button"
                                    className="btn btn-sm"
                                >
                                    <span
                                        className={`${attentionTargetHeadOptions.length === 0 ? "text-gray-500" : ""}`}
                                    >
                                        Head {attentionTargetHead}
                                    </span>
                                </div>
                                <ul
                                    tabIndex={0}
                                    className="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm"
                                >
                                    {attentionTargetHeadOptions.map(
                                        (option) => (
                                            <li
                                                key={option}
                                                onClick={() =>
                                                    generationStore.setAttentionTargetHead(
                                                        option,
                                                    )
                                                }
                                            >
                                                <a>{option}</a>
                                            </li>
                                        ),
                                    )}
                                </ul>
                            </div>
                            <div className="dropdown dropdown-bottom">
                                <div
                                    tabIndex={0}
                                    role="button"
                                    className="btn btn-sm"
                                >
                                    AST Mode: {ASTViewModeLabels[astViewMode]}
                                </div>
                                <ul
                                    tabIndex={0}
                                    className="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm"
                                >
                                    {Object.values(ViewModesEnum).map(
                                        (mode) => (
                                            <li
                                                key={mode}
                                                onClick={() => {
                                                    astStore.astViewMode.value =
                                                        mode;
                                                }}
                                            >
                                                <a
                                                    className={
                                                        astViewMode === mode
                                                            ? "font-bold"
                                                            : ""
                                                    }
                                                >
                                                    {ASTViewModeLabels[mode]}
                                                </a>
                                            </li>
                                        ),
                                    )}
                                </ul>
                            </div>
                        </div>
                        <div className="grow min-h-0">
                            <Chart />
                        </div>
                    </div>
                )}
            </div>
            <form method="dialog" className="modal-backdrop">
                <button>close</button>
            </form>
        </dialog>
    );
}
