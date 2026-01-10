import { useRef, useLayoutEffect } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import am5themes_Dark from "@amcharts/amcharts5/themes/Dark";
import generationStore from "../../store/generationStore";

function visualizeWhitespace(str: string) {
    return str
        .replace(/ /g, "␣") // space
        .replace(/\t/g, "⇥") // tab
        .replace(/\n/g, "⏎") // newline
        .replace("{", "\{")
        .replace("}", "\}")
        .replace("[", "\[")
        .replace("]", "\]");
}

type DataPoint = {
    position: number;
    tokenString: string;
    confidence: number;
    perplexity: number;
    lastPerplexity: number;
    stdDev: number;
    color: string;
};

function Chart() {
    const chartRef = useRef<am5xy.XYChart>(null);

    const currentGeneration = generationStore.currentGeneration.value;

    const metrics = ["confidence", "perplexity", "lastPerplexity", "stdDev"];

    useLayoutEffect(() => {
        const root = am5.Root.new("chartdiv");

        root.setThemes([
            am5themes_Animated.new(root),
            am5themes_Dark.new(root),
        ]);

        const chart = root.container.children.push(
            am5xy.XYChart.new(root, {
                panX: true,
                panY: true,
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
            rotation: -90,
            centerY: am5.p50,
            centerX: am5.p100,
            paddingRight: 15,
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
                am5xy.LineSeries.new(root, {
                    name: m.charAt(0).toUpperCase() + m.slice(1),
                    xAxis: xAxis,
                    yAxis: yAxis,
                    valueYField: m,
                    categoryXField: "position",
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

            // series1.bullets.push(function () {
            //     let circleTemplate = am5.Template.new({
            //         radius: 6,
            //         templateField: "bulletSettings",
            //         fill: series1.get("fill"),
            //         strokeWidth: 2,
            //         stroke: root.interfaceColors.get("background"),
            //     });
            //
            //     let circle = am5.Circle.new(root, {}, circleTemplate);
            //
            //     return am5.Bullet.new(root, {
            //         sprite: circle,
            //         locationX: 0,
            //     });
            // });
            //
            // series1.bullets.push(function () {
            //     let label = am5.Label.new(root, {
            //         populateText: true,
            //         text: "{tokenString}",
            //         centerX: am5.p50,
            //         centerY: 30,
            //         fontSize: 10,
            //         fontWeight: "bold",
            //         paddingBottom: 4,
            //         paddingTop: 4,
            //         paddingLeft: 6,
            //         paddingRight: 6,
            //         fill: am5.Color.brighten(series1.get("fill"), -0.1),
            //     });
            //
            //     label.set(
            //         "background",
            //         am5.RoundedRectangle.new(root, {
            //             fill: am5.color(0xffffff),
            //             fillOpacity: 0.75,
            //             cornerRadiusBL: 3,
            //             cornerRadiusBR: 3,
            //             cornerRadiusTL: 3,
            //             cornerRadiusTR: 3,
            //             stroke: series1.get("fill"),
            //         }),
            //     );
            //
            //     return am5.Bullet.new(root, {
            //         sprite: label,
            //         locationX: 0,
            //     });
            // });

            const tooltip = series.set(
                "tooltip",
                am5.Tooltip.new(root, {
                    labelText: `{position}: '{tokenString}'\n${m.charAt(0).toUpperCase() + m.slice(1)}: {${m}}`,
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

        // Add scrollbar
        // https://www.amcharts.com/docs/v5/charts/xy-chart/scrollbars/
        // let scrollbar = chart.set(
        //     "scrollbarX",
        //     am5xy.XYChartScrollbar.new(root, {
        //         orientation: "horizontal",
        //         height: 50,
        //     }),
        // );
        //
        // let sbXAxis = chart.xAxes.push(
        //     am5xy.CategoryAxis.new(root, {
        //         renderer: am5xy.AxisRendererX.new(root, {}),
        //         categoryField: "position",
        //     }),
        // );
        // sbXAxis
        //     .get("renderer")
        //     .labels.template.adapters.add("text", function (text, target) {
        //         if (target.dataItem && target.dataItem.dataContext) {
        //             return target.dataItem.dataContext.tokenString;
        //         }
        //         return text;
        //     });
        //
        // let sbValueAxis = scrollbar.chart.yAxes.push(
        //     am5xy.ValueAxis.new(root, {
        //         renderer: am5xy.AxisRendererY.new(root, {}),
        //     }),
        // );
        //
        // var sbseries = scrollbar.chart.series.push(
        //     am5xy.LineSeries.new(root, {
        //         xAxis: sbXAxis,
        //         yAxis: sbValueAxis,
        //         valueYField: "y",
        //         valueXField: "x",
        //     }),
        // );
        // sbseries.data.setAll(data);
        // let series2 = chart.series.push(
        //     am5xy.LineSeries.new(root, {
        //         name: "Perplexity",
        //         xAxis: xAxis,
        //         yAxis: yAxis,
        //         valueYField: "perplexity",
        //         categoryXField: "position",
        //     }),
        // );
        // series2.data.setAll(data);

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

        // add scrollbar
        chart.set(
            "scrollbarX",
            am5.Scrollbar.new(root, {
                orientation: "horizontal",
            }),
        );

        chartRef.current = chart;

        return () => {
            root.dispose();
        };
    }, []);

    useLayoutEffect(() => {
        if (chartRef.current) {
            const chart = chartRef.current;

            const data: DataPoint[] = currentGeneration.map((token) => ({
                x: token.position + 1,
                position: token.position,
                tokenString: visualizeWhitespace(token.token),
                confidence: token.confidence || 0,
                perplexity: token.perplexity || 0,
                lastPerplexity: token.lastPerplexity || 0,
                stdDev: token.std || 0,
                color: "#10b981",
            }));

            chart.series.each((series) => {
                series.data.setAll(data);
            });

            chart.xAxes.each((xAxis) => {
                xAxis.data.setAll(data);
            });
        }
    }, [currentGeneration.length]);

    return <div id="chartdiv" style={{ width: "100%", height: "100%" }}></div>;
}

export function TrendChartModal() {
    return (
        <dialog id="trend_modal" className="modal">
            <div className="modal-box h-[90vh] w-11/12 max-w-11/12">
                <Chart />
            </div>
            <form method="dialog" className="modal-backdrop">
                <button>close</button>
            </form>
        </dialog>
    );
}
