import { Chart, Datum } from "react-charts";
import { GenerationToken } from "../../../models/generationToken";
import React from "react";

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
    const data = React.useMemo(
        () => [
            {
                label: "Tokens",
                data: alternativeTokens.map((t) => ({
                    x: {
                        text: visualizeWhitespace(t.token),
                        original: t.token,
                    },
                    y: t.confidence,
                    sampledToken: token.tokenId === t.tokenId,
                })),
            },
        ],
        [alternativeTokens],
    );

    const primaryAxis = React.useMemo(
        () => ({
            getValue: (datum: any) => datum.x.text,
            scaleType: "band" as const,
        }),
        [],
    );

    const secondaryAxes = React.useMemo(
        () => [
            {
                getValue: (datum: any) => datum.y,
                scaleType: "linear" as const,
                min: 0,
                max: 1,
            },
        ],
        [],
    );

    const handleClick = React.useCallback(
        (
            datum: Datum<{
                x: { text: string; original: string };
                y: number;
            }> | null,
        ) => {
            console.log("Clicked datum:", datum);
            if (datum)
                datum.originalDatum.x &&
                    onClick(datum.originalDatum.x.original);
        },
        [],
    );

    return (
        <div>
            <div className="text-xl text-secondary-content">
                Alternate Tokens
            </div>
            <div className="h-64 w-full mt-4">
                <Chart
                    options={{
                        data,
                        primaryAxis,
                        secondaryAxes,
                        dark: true,
                        onClickDatum: handleClick,
                        getDatumStyle: (datum, status) => {
                            return {
                                fill: datum.originalDatum.sampledToken
                                    ? "#009979"
                                    : "#3b82f6",
                            };
                        },
                    }}
                />
            </div>
            {/* <div key={token.token} className="menu mt-4 w-full all-tokens-list"> */}
            {/*     {alternativeTokens.map((t) => ( */}
            {/*         <li key={t.token}> */}
            {/*             <a */}
            {/*                 className={`flex justify-between items-center p-1`} */}
            {/*                 onClick={() => onClick(t.token)} */}
            {/*             > */}
            {/*                 <div>{visualizeWhitespace(t.token)}</div> */}
            {/*                 <div>{t.confidence.toFixed(2)}</div> */}
            {/*                 {t.token === token.token && ( */}
            {/*                     <span> (current) </span> */}
            {/*                 )} */}
            {/*             </a> */}
            {/*         </li> */}
            {/*     ))} */}
            {/* </div> */}
        </div>
    );
}
