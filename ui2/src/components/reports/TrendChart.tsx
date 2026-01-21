import React, { useRef, useLayoutEffect } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import am5themes_Dark from "@amcharts/amcharts5/themes/Dark";
import am5themes_Material from "@amcharts/amcharts5/themes/Material";
import * as am5plugins_exporting from "@amcharts/amcharts5/plugins/exporting";
import generationStore from "../../store/generationStore";
import { getOutliers } from "../../utils/outlier";

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
    position: number;
    tokenString: string;
    isPromptOrManual: boolean;
    confidence: number;
    perplexity: number;
    lastPerplexity: number;
    marginConfidence: number;
    entropy: number;
    color: string;
};

function Chart() {
    const chartRef = useRef<am5xy.XYChart>(null);

    const currentGeneration = generationStore.currentGeneration.value;
    const selectedToken = generationStore.selectedToken.value;

    const metrics = [
        "confidence",
        "marginConfidence",
        "entropy",
        "perplexity",
        "lastPerplexity",
    ];

    useLayoutEffect(() => {
        const root = am5.Root.new("chartdiv");
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
                paddingRight: 0,
                layout: root.verticalLayout,
                background: am5.Rectangle.new(root, {
                    fill: darkMode ? am5.color(0x090909) : am5.color(0xffffff),
                    fillOpacity: 1,
                }),
            }),
        );
        const colors = chart.get("colors");
        if (colors) colors.set("step", 3);

        const exporting = am5plugins_exporting.Exporting.new(root, {
            menu: am5plugins_exporting.ExportingMenu.new(root, {}),
            pngOptions: {
                maintainPixelRatio: true,
            },
        });

        const data: DataPoint[] = [];

        const renderer = am5xy.AxisRendererX.new(root, {
            minGridDistance: 10,
        });

        renderer.labels.template.setAll({
            rotation: -90,
            centerY: am5.p50,
            centerX: am5.p100,
            fontSize: 10,
        });
        let xAxis = chart.xAxes.push(
            am5xy.CategoryAxis.new(root, {
                maxDeviation: 0.1,
                renderer: renderer,
                categoryField: "position",
            }),
        );
        xAxis
            .get("renderer")
            .labels.template.adapters.add("text", function (text, target) {
                if (target.dataItem && target.dataItem.dataContext) {
                    return (target.dataItem.dataContext as DataPoint)
                        .tokenString;
                }
                return text;
            });
        xAxis.data.setAll(data);

        // Create series
        for (const m of metrics) {
            let yRenderer = am5xy.AxisRendererY.new(root, {
                opposite:
                    m.toLowerCase().includes("perplexity") ||
                    m.toLowerCase().includes("entropy"),
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
                am5xy.LineSeries.new(root, {
                    name: m.charAt(0).toUpperCase() + m.slice(1),
                    xAxis: xAxis,
                    yAxis: yAxis,
                    valueYField: m,
                    categoryXField: "position",
                    minBulletDistance: 10,
                }),
            );

            series.strokes.template.setAll({ strokeWidth: 1 });

            yRenderer.grid.template.set("strokeOpacity", 0.05);
            yRenderer.labels.template.set("fill", series.get("fill"));
            yRenderer.setAll({
                stroke: series.get("fill"),
                strokeOpacity: 1,
                opacity: 1,
            });

            series.data.setAll(data);
            series.events.on("datavalidated", function () {
                am5.array.each(series.dataItems, function (dataItem) {
                    const p = xAxis.dataItemToPosition(dataItem);
                    const axisDataItem = xAxis.getSeriesItem(series, p);
                    const dataContext = axisDataItem?.dataContext as DataPoint;
                    if (!dataContext.isPromptOrManual) {
                        const circle = am5.Circle.new(root, {
                            radius: 2,
                            fill: series.get("fill"),
                            strokeWidth: 1,
                            centerX: am5.percent(50),
                            centerY: am5.percent(50),
                            stroke: root.interfaceColors.get("background"),
                        });
                        const bullet = am5.Bullet.new(root, {
                            sprite: circle,
                            locationX: 1,
                            locationY: 1,
                        });
                        series.addBullet(dataItem, bullet);
                    }
                });
            });

            series.bullets.push(function () {
                let circle = am5.Circle.new(root, {
                    radius: 3,
                    fill: series.get("fill"),
                    strokeWidth: 1,
                    centerX: am5.percent(50),
                    centerY: am5.percent(50),
                    stroke: root.interfaceColors.get("background"),
                });

                const bullet = am5.Bullet.new(root, {
                    sprite: circle,
                    locationX: 0.5,
                });

                return bullet;
            });

            const tooltip = series.set(
                "tooltip",
                am5.Tooltip.new(root, {
                    labelText: `[fontSize: 10px]{position}: '{tokenString}'\n${m.charAt(0).toUpperCase() + m.slice(1)}: {${m}}[/]`,
                }),
            );
            const background = tooltip.get("background");
            if (background)
                background.adapters.add("fill", function (fill) {
                    if (tooltip.dataItem) {
                        return (tooltip.dataItem.dataContext as DataPoint)
                            .color;
                    }
                    return fill;
                });

            tooltip.on("pointTo", function () {
                const background = tooltip.get("background");
                if (background) background.set("fill", background.get("fill"));
            });
        }

        // Add legend
        let legend = chart.children.push(
            am5.Legend.new(root, { marginBottom: 16 }),
        );
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

        const scrollbar = am5.Scrollbar.new(root, {
            orientation: "horizontal",
        });

        chart.set("scrollbarX", scrollbar);
        exporting.events.on("exportstarted", function () {
            scrollbar.hide(0);
        });

        exporting.events.on("exportfinished", function () {
            scrollbar.show(0);
        });

        chartRef.current = chart;

        return () => {
            root.dispose();
        };
    }, []);

    useLayoutEffect(() => {
        if (chartRef.current) {
            const chart = chartRef.current;

            const data: DataPoint[] = currentGeneration.map((token) => ({
                x: token.position,
                position: token.position + 1,
                tokenString: visualizeWhitespace(token.token),
                isPromptOrManual: token.prompt || token.manual || false,
                confidence: token.confidence || 0,
                perplexity: token.perplexity || 0,
                lastPerplexity: token.lastPerplexity || 0,
                marginConfidence: token.marginConfidence || 0,
                entropy: token.entropy || 0,
                color: "#10b981",
            }));

            // const [lpplMin, lpplMax] = getOutliers(
            //     data.map((d) => d.lastPerplexity),
            // );
            // const [pplMin, pplMax] = getOutliers(data.map((d) => d.perplexity));
            //
            // for (const d of data) {
            //     if (d.lastPerplexity < lpplMin) d.lastPerplexity = lpplMin;
            //     if (d.lastPerplexity > lpplMax) d.lastPerplexity = lpplMax;
            //     if (d.perplexity < pplMin) d.perplexity = pplMin;
            //     if (d.perplexity > pplMax) d.perplexity = pplMax;
            // }

            chart.series.each((series) => {
                series.data.setAll(data);
            });

            const lastPromptOrManualTokenIndex = data
                .map((d) => d.isPromptOrManual)
                .lastIndexOf(true);
            const lastPromptOrManualToken =
                currentGeneration[lastPromptOrManualTokenIndex];

            chart.xAxes.each((xAxis) => {
                xAxis.data.setAll(data);
            });
            const xAxis = chart.xAxes.getIndex(0);

            if (xAxis) {
                if (xAxis.axisRanges.length > 0) {
                    xAxis.axisRanges.clear();
                }
                if (lastPromptOrManualToken) {
                    const rangeDataItem = xAxis.makeDataItem({
                        category: data[0].position,
                        endCategory: lastPromptOrManualToken.position + 1,
                    });

                    const color = am5.color(0xff621f);
                    xAxis.createAxisRange(rangeDataItem);
                    const axisFill = rangeDataItem.get("axisFill");
                    if (axisFill) {
                        axisFill.setAll({
                            stroke: color,
                            strokeWidth: 1,
                            strokeOpacity: 1,
                            fill: color,
                            fillOpacity: 0.05,
                            visible: true,
                        });
                    }
                    const label = rangeDataItem.get("label");
                    if (label) {
                        label.setAll({
                            text: "Prompt",
                            inside: true,
                            rotation: 0,
                            centerY: am5.p50,
                            centerX: am5.p50,
                            height: 400,
                            location: 0.5,
                            fill: color,
                        });
                    }
                }
                if (selectedToken) {
                    const rangeDataItem = xAxis.makeDataItem({
                        category: selectedToken.position + 1,
                    });

                    const color = am5.color(0x1e90ff);
                    xAxis.createAxisRange(rangeDataItem);

                    const axisFill = rangeDataItem.get("axisFill");
                    if (axisFill) {
                        axisFill.setAll({
                            stroke: color,
                            strokeWidth: 1,
                            strokeOpacity: 1,
                            fill: color,
                            fillOpacity: 0.05,
                            visible: true,
                        });
                    }
                    const label = rangeDataItem.get("label");
                    if (label) {
                        label.setAll({
                            text: "Selected Token",
                            inside: true,
                            rotation: 0,
                            centerY: am5.p50,
                            centerX: am5.p50,
                            height: 400,
                            location: 0.5,
                            fill: color,
                        });
                    }
                }
            }
        }
    }, [currentGeneration.length, selectedToken, 2]);

    return <div id="chartdiv" style={{ width: "100%", height: "100%" }}></div>;
}

export function TrendChartModal() {
    const [isInView, setIsInView] = React.useState(false);

    React.useEffect(() => {
        const dialog = document.getElementById(
            "trend_modal",
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
        <dialog id="trend_modal" className="modal">
            <div className="modal-box h-[90vh] w-11/12 max-w-11/12">
                {isInView && <Chart />}
            </div>
            <form method="dialog" className="modal-backdrop">
                <button>close</button>
            </form>
        </dialog>
    );
}
