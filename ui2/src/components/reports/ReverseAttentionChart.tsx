import React, { useRef, useLayoutEffect } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import am5themes_Dark from "@amcharts/amcharts5/themes/Dark";
import am5themes_Material from "@amcharts/amcharts5/themes/Material";
import * as am5plugins_exporting from "@amcharts/amcharts5/plugins/exporting";
import generationStore from "../../store/generationStore";
import { GenerationToken } from "../../models/generationToken";

function visualizeWhitespace(str: string) {
    return str
        .replace(/ /g, "␣") // space
        .replace(/\t/g, "⇥") // tab
        .replace(/\n/g, "⏎") // newline
        .replace("{", "{{")
        .replace("}", "}}")
        .replace("[", "[[")
        .replace("]", "]]");
}

type DataPoint = {
    head: string;
    position: string;
    token: string;
    value: number;
};

function Chart({
    isGenerating,
    currentGeneration,
    selectedToken,
    heads,
}: {
    isGenerating: boolean;
    currentGeneration: GenerationToken[];
    selectedToken: GenerationToken;
    heads: string[];
}) {
    const chartRef = useRef<am5xy.XYChart>(null);

    useLayoutEffect(() => {
        const root = am5.Root.new("reverseAttentionChart");
        const xAxisKey = "head";
        const yAxisKey = "position";

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
                categoryField: yAxisKey,
            }),
        );
        yAxis
            .get("renderer")
            .labels.template.adapters.add("text", function (text, target) {
                if (target.dataItem && target.dataItem.dataContext) {
                    return (target.dataItem.dataContext as DataPoint).token;
                }
                return text;
            });

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
                categoryField: xAxisKey,
            }),
        );

        const series = chart.series.push(
            am5xy.ColumnSeries.new(root, {
                calculateAggregates: true,
                stroke: am5.color(0xffffff),
                clustered: false,
                xAxis: xAxis,
                yAxis: yAxis,
                categoryXField: xAxisKey,
                categoryYField: yAxisKey,
                valueField: "value",
            }),
        );

        series.columns.template.setAll({
            tooltipText: "{position}: {token} -> {head} = {value}",
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
        if (
            chartRef.current &&
            !isGenerating &&
            selectedToken.reverseAttentionSnapshot
        ) {
            const chart = chartRef.current;

            const data: DataPoint[] = [];
            for (const head of heads) {
                if (selectedToken.reverseAttentionSnapshot[head]?.length) {
                    for (const { index, attention } of selectedToken
                        .reverseAttentionSnapshot[head]) {
                        const token = currentGeneration[index];
                        const attentionValue = attention || 0;

                        data.push({
                            head: head,
                            position: `# ${index + 1}`,
                            token: visualizeWhitespace(token.token),
                            value: attentionValue,
                        });
                    }
                }
            }

            const xAxisKeys = heads.map((head) => ({
                head: head,
            }));
            const yAxisKeys = [...new Set(data.map((d) => d.position))].map(
                (pos) => ({
                    position: pos,
                    token: data.find((d) => d.position === pos)?.token || "",
                }),
            );

            for (const x of xAxisKeys) {
                for (const y of yAxisKeys) {
                    const exists = data.find(
                        (d) => d.head === x.head && d.position === y.position,
                    );
                    if (!exists) {
                        data.push({
                            head: x.head,
                            position: y.position,
                            token: y.token,
                            value: 0.0,
                        });
                    }
                }
            }

            chart.series.each((series) => {
                series.data.setAll(data);
            });

            chart.xAxes.each((xAxis) => {
                xAxis.data.setAll(xAxisKeys);
            });
            chart.yAxes.each((yAxis) => {
                yAxis.data.setAll(yAxisKeys);
            });
        }
    }, [selectedToken, currentGeneration, heads, isGenerating]);

    return (
        <div
            id="reverseAttentionChart"
            style={{ width: "100%", height: "100%" }}
        ></div>
    );
}

export function ReverseAttentionModal() {
    const isGenerating = generationStore.isGenerating.value;
    const currentGeneration = generationStore.currentGeneration.value;
    const selectedToken = generationStore.selectedToken.value;

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
            "reverse_attention_modal",
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
        <dialog id="reverse_attention_modal" className="modal">
            <div className="modal-box h-[90vh] w-11/12 max-w-11/12">
                <div className="flex flex-col justify-center items-center h-full">
                    {isInView &&
                        (selectedToken && attentionTargetHeadOptions ? (
                            <Chart
                                isGenerating={isGenerating}
                                currentGeneration={currentGeneration}
                                selectedToken={selectedToken}
                                heads={attentionTargetHeadOptions}
                            />
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
