import React from "react";
import generationStore, { GenerationToken } from "../../store/generationStore";
import "./generation-sidebar.module.css";
import { handleStream } from "../../api/generation";

const colorMap = {
    0: "text-red-300",
    0.25: "text-orange-300",
    0.5: "text-yellow-300",
    0.75: "text-green-300",
    0.98: "text-blue-300",
};

const getColor = (confidence: number) =>
    Object.entries(colorMap).reduce((acc, [threshold, color]) => {
        if (confidence >= parseFloat(threshold)) {
            return color;
        }
        return acc;
    }, "");

export function GenerationSidebar() {
    const [substituteToken, setSubstituteToken] = React.useState("");

    const token =
        generationStore.activeGenerationSignal.value || ({} as GenerationToken);

    const handleSubstituteTokenChange = React.useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            setSubstituteToken(e.target.value);
        },
        [],
    );

    const handleSubstituteToken = React.useCallback(
        async (tokens: string) => {
            const response = await fetch("http://10.0.0.92:3000/api/continue", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    index: token.index,
                    forced_token: tokens,
                }),
            });
            if (!response.ok) {
                console.error("Error:", response.statusText);
                return;
            }
			generationStore.clearGeneration();
            await handleStream(response, generationStore.appendToGeneration);
        },
        [token.index],
    );

    return (
        <div className="w-80 p-4 flex flex-col">
            <div className="text-xl text-secondary-content">
                Token Informaton
            </div>
            <div className="flex items-center gap-3 mt-4">
                <div
                    style={{
                        //@ts-expect-error This is how it works
                        "--value": token.confidence * 100,
                        "--size": "3rem",
                    }}
                    className={`radial-progress ${getColor(token.confidence)}`}
                >
                    {token.confidence.toFixed(2)}
                </div>
                <div className="text-lg">{token.token}</div>
            </div>
            <div className="divider" />
            <div>
                <div className="text-xl text-secondary-content">
                    Alternate Tokens
                </div>
                <div
                    key={token.index}
                    className="menu mt-4 w-full all-tokens-list"
                >
                    {token.allTokens.map((t, index) =>
                        t === token.token ? null : (
                            <li key={t}>
                                <a
                                    className={`flex justify-between items-center p-1`}
                                    onClick={() => handleSubstituteToken(t)}
                                >
                                    <div>{t}</div>
                                    <div>
                                        {token.allConfidences[index].toFixed(2)}
                                    </div>
                                </a>
                            </li>
                        ),
                    )}
                </div>
            </div>
            <div className="divider" />
            <div className="flex flex-col gap-2">
                <input
                    type="text"
                    className="input w-full"
                    placeholder="Enter token"
                    value={substituteToken}
                    onChange={handleSubstituteTokenChange}
                />
                <button
                    className="btn btn-primary"
                    onClick={() => handleSubstituteToken(substituteToken)}
                >
                    Replace Token
                </button>
            </div>
        </div>
    );
}
