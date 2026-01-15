import { Chart, Datum } from "react-charts";
import { GenerationToken } from "../../../models/generationToken";
import React from "react";
// import {
//     ChartConfig,
//     ChartContainer,
//     ChartLegend,
//     ChartLegendContent,
//     ChartTooltip,
//     ChartTooltipContent,
// } from "../../ui/Chart";
import {
    Bar,
    BarChart,
    BarRectangleItem,
    CartesianGrid,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

function visualizeWhitespace(str: string) {
    return str
        .replace(/ /g, "␣") // space
        .replace(/\t/g, "⇥") // tab
        .replace(/\n/g, "⏎\n"); // newline
}

export default function AlternativeTokens({
    token,
    alternativeTokens,
    onClick,
}: {
    token: GenerationToken;
    alternativeTokens: GenerationToken[];
    onClick: (tokens: string) => void;
}) {
    // const chartConfig = {
    //     token: {
    //         label: "Alternative Tokens",
    //         color: "#25837b",
    //     },
    //     sampled: { label: "Sampled Token", color: "#d0d060" },
    // } satisfies ChartConfig;

    const chartData = React.useMemo(
        () =>
            alternativeTokens.map((t) => ({
                tokenStringVisualized: visualizeWhitespace(t.token),
                confidence: t.confidence,
                tokenString: t.token,
                sampledToken: token.tokenId === t.tokenId,
                fill:
                    token.tokenId === t.tokenId
                        ? "var(--color-sampled)"
                        : "var(--color-token)",
            })),
        [alternativeTokens],
    );

    const handleClick = React.useCallback((data: BarRectangleItem) => {
        if (data)
            data.payload?.tokenString && onClick(data.payload.tokenString);
    }, []);

    return (
        <div>
            <div className="text-xl text-secondary-content">
                Alternate Tokens
            </div>
            <div className="mt-4">
                <BarChart
                    height={300}
                    width="100%"
                    accessibilityLayer
                    data={chartData}
                    margin={{ top: 8, right: 0, bottom: 24, left: -16 }}
                    
                >
                    {/* <CartesianGrid vertical={false} /> */}
                    <XAxis
                        style={{ fontSize: "0.75rem" }}
                        dataKey="tokenStringVisualized"
                        tickMargin={24}
                        tickLine={false}
                        axisLine={false}
                        angle={-45}
                    />
                    <YAxis
                        style={{ fontSize: "0.75rem" }}
                        dataKey="confidence"
                        tickMargin={10}
                        axisLine={false}
                        domain={[0, 1]}
                    />
                    <Tooltip
                        cursor={{
                            fill: "var(--color-base-200)",
                        }}
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                    <div className="text-xs bg-base-100 p-2 rounded-lg border border-base-300 shadow-lg">
                                        <div className="font-bold mb-1">
                                            Token: "{data.tokenStringVisualized}
                                            "
                                        </div>
                                        <div>
                                            Confidence:{" "}
                                            {(data.confidence * 100).toFixed(2)}
                                            %
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Bar
                        dataKey="confidence"
                        radius={4}
                        onClick={handleClick}
                        className="cursor-pointer"
                    />
                </BarChart>
            </div>
        </div>
    );
}
