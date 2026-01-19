import React, { useRef, useLayoutEffect } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import am5themes_Dark from "@amcharts/amcharts5/themes/Dark";
import generationStore from "../../store/generationStore";
import { GenerationToken } from "../../models/generationToken";

type DataPoint = {
    headName: string;
    relativeAttention: number;
};

function Chart({
    isGenerating,
    selectedToken,
    attentionTargetToken,
}: {
    isGenerating: boolean;
    selectedToken: GenerationToken;
    attentionTargetToken: GenerationToken;
}) {
    const chartRef = useRef<am5xy.XYChart>(null);

    const metrics = ["relativeAttention"];

    useLayoutEffect(() => {
        const root = am5.Root.new("relativeAttentionChart");

        root.setThemes([
            am5themes_Animated.new(root),
            am5themes_Dark.new(root),
        ]);

        const chart = root.container.children.push(
            am5xy.XYChart.new(root, {
                panX: true,
                panY: false,
                wheelX: "panX",
                wheelY: "zoomX",
                pinchZoomX: true,
                paddingLeft: 0,
                layout: root.verticalLayout,
            }),
        );
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
                categoryField: "headName",
            }),
        );
        xAxis
            .get("renderer")
            .labels.template.adapters.add("text", function (text, target) {
                if (target.dataItem && target.dataItem.dataContext) {
                    return (target.dataItem.dataContext as DataPoint).headName;
                }
                return text;
            });
        xAxis.data.setAll(data);

        // Create series
        for (const m of metrics) {
            let yRenderer = am5xy.AxisRendererY.new(root, {});
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
                    categoryXField: "headName",
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
                    labelText: `{headName}: ${m.charAt(0).toUpperCase() + m.slice(1)}: {${m}}`,
                }),
            );

            tooltip.on("pointTo", function () {
                const background = tooltip.get("background");
                if (background) background.set("fill", background.get("fill"));
            });
        }

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
        if (
            chartRef.current &&
            !isGenerating &&
            attentionTargetToken.attentionSnapshot
        ) {
            const chart = chartRef.current;

            const data: DataPoint[] = Object.entries(
                attentionTargetToken.attentionSnapshot,
            ).map(([headName, attentionValues]) => {
                const relativeAttention = attentionValues.find(
                    (av) => av.index === selectedToken.position,
                )?.attention;
                if (relativeAttention !== undefined) {
                    return {
                        headName: headName,
                        relativeAttention: relativeAttention,
                    };
                }
                return {
                    headName: headName,
                    relativeAttention: 0,
                };
            });

            console.log(data);

            chart.series.each((series) => {
                series.data.setAll(data);
            });

            chart.xAxes.each((xAxis) => {
                xAxis.data.setAll(data);
            });
        }
    }, [selectedToken, attentionTargetToken, isGenerating]);

    return (
        <div
            id="relativeAttentionChart"
            style={{ width: "100%", height: "100%" }}
        ></div>
    );
}

export function RelativeAttentionModal() {
    const isGenerating = generationStore.isGenerating.value;
    const selectedToken = generationStore.selectedToken.value;
    const attentionTargetToken = generationStore.attentionTargetToken.value;

    const [isInView, setIsInView] = React.useState(false);

    React.useEffect(() => {
        const dialog = document.getElementById(
            "relative_attention_modal",
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
        <dialog id="relative_attention_modal" className="modal">
            <div className="modal-box h-[90vh] w-11/12 max-w-11/12">
                <div className="flex flex-col justify-center items-center h-full">
                    {isInView &&
                        (selectedToken && attentionTargetToken ? (
                            <>
                                <div className="mb-4">
                                    <span>Viewing Relative Attention from</span>
                                    <span className="font-bold mx-1">
                                        {attentionTargetToken.token}
                                    </span>
                                    <span>to</span>
                                    <span className="font-bold mx-1">
                                        {selectedToken.token}
                                    </span>
                                </div>
                                <Chart
                                    isGenerating={isGenerating}
                                    selectedToken={selectedToken}
                                    attentionTargetToken={attentionTargetToken}
                                />
                            </>
                        ) : (
                            <p>
                                Set attention target token and select a token to
                                view the relative attention chart.
                            </p>
                        ))}
                </div>
            </div>
            <form method="dialog" className="modal-backdrop">
                <button>close</button>
            </form>
        </dialog>
    );
}
