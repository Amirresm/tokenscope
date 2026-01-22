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
    group: string;
    count: number;
    avgConfidence: number;
};

function Chart() {
    const chartRef = useRef<am5xy.XYChart>(null);

    const isGenerating = generationStore.isGenerating.value;
    const astGroups = astStore.astGroups.value;

    const metrics = ["avgConfidence"];

    useLayoutEffect(() => {
        const root = am5.Root.new("astChartdiv");

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
                panX: true,
                panY: false,
                wheelX: "panX",
                wheelY: "zoomX",
                pinchZoomX: true,
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

        const colors = chart.get("colors");
        if (colors) colors.set("step", 3);

        const data: DataPoint[] = [];

        const renderer = am5xy.AxisRendererX.new(root, {});
        renderer.labels.template.setAll({
            rotation: 0,
            centerY: am5.p50,
            centerX: am5.p100,
            paddingRight: 15,
            oversizedBehavior: "fit",
        });
        let xAxis = chart.xAxes.push(
            am5xy.CategoryAxis.new(root, {
                maxDeviation: 0.1,
                renderer: renderer,
                categoryField: "group",
            }),
        );
        xAxis
            .get("renderer")
            .labels.template.adapters.add("text", function (text, target) {
                if (target.dataItem && target.dataItem.dataContext) {
                    return (target.dataItem.dataContext as DataPoint).group;
                }
                return text;
            });
        xAxis.data.setAll(data);

        // Create series
        for (const m of metrics) {
            let yRenderer = am5xy.AxisRendererY.new(root, {
                opposite: m.toLowerCase().includes("perplexity"),
            });
            let yAxis = chart.yAxes.push(
                am5xy.ValueAxis.new(root, {
                    maxDeviation: 1,
                    renderer: yRenderer,
                }),
            );

            if (chart.yAxes.indexOf(yAxis) > 0) {
                yAxis.set("syncWithAxis", chart.yAxes.getIndex(0));
            }

            let series = chart.series.push(
                am5xy.ColumnSeries.new(root, {
                    name: m.charAt(0).toUpperCase() + m.slice(1),
                    xAxis: xAxis,
                    yAxis: yAxis,
                    valueYField: m,
                    categoryXField: "group",
                }),
            );

            yRenderer.grid.template.set("strokeOpacity", 0.05);
            yRenderer.labels.template.set("fill", series.get("fill"));
            yRenderer.setAll({
                stroke: series.get("fill"),
                strokeOpacity: 1,
                opacity: 1,
            });

            series.data.setAll(data);

            const tooltip = series.set(
                "tooltip",
                am5.Tooltip.new(root, {
                    labelText: `{group}({count}): ${m.charAt(0).toUpperCase() + m.slice(1)}: {${m}}`,
                }),
            );
            // const background = tooltip.get("background");
            // if (background)
            //     background.adapters.add("fill", function (fill) {
            //         if (tooltip.dataItem) {
            //             return (tooltip.dataItem.dataContext as DataPoint)
            //                 .color;
            //         }
            //         return fill;
            //     });

            tooltip.on("pointTo", function () {
                const background = tooltip.get("background");
                if (background) background.set("fill", background.get("fill"));
            });
        }

        // Add legend
        let legend = chart.children.push(am5.Legend.new(root, {}));
        legend.data.setAll(chart.series.values);

        // Add cursor
        let cursor = chart.set(
            "cursor",
            am5xy.XYCursor.new(root, {
                xAxis: xAxis,
                behavior: "none",
            }),
        );
        cursor.lineY.set("visible", false);

        chartRef.current = chart;

        return () => {
            root.dispose();
        };
    }, []);

    useLayoutEffect(() => {
        if (chartRef.current && !isGenerating) {
            const chart = chartRef.current;

            const data: DataPoint[] = astGroups
                .map((group) => ({
                    group: group.group,
                    count: group.tokens.length,
                    avgConfidence: group.averageConfidence,
                    // color: "#10b981",
                }))
                .reduce((acc, curr) => {
                    const existing = acc.find((d) => d.group === curr.group);
                    if (existing) {
                        existing.count += curr.count;
                        existing.avgConfidence =
                            (existing.avgConfidence * existing.count +
                                curr.avgConfidence * curr.count) /
                            (existing.count + curr.count);
                    } else {
                        acc.push(curr);
                    }
                    return acc;
                }, [] as DataPoint[]);

            chart.series.each((series) => {
                series.data.setAll(data);
            });

            chart.xAxes.each((xAxis) => {
                xAxis.data.setAll(data);
            });
        }
    }, [astGroups, isGenerating]);

    return (
        <div id="astChartdiv" style={{ width: "100%", height: "100%" }}></div>
    );
}

export function ASTStatsChartModal() {
    const astViewMode = astStore.astViewMode.value;

    const [isInView, setIsInView] = React.useState(false);

    React.useEffect(() => {
        const dialog = document.getElementById(
            "ast_stats_chart_modal",
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
        <dialog id="ast_stats_chart_modal" className="modal">
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
