import React from "react";
import generationStore from "../store/generationStore";
import type { GenerationToken } from "../store/generationStore";
import drawerStore from "../store/drawerStore";

type GenerationTokenProps = {
    generationToken: GenerationToken;
    showColor: boolean;
};

const colorMap = {
    0: "text-red-300",
    0.25: "text-orange-300",
    0.5: "text-yellow-300",
    0.75: "text-green-300",
    0.98: "text-blue-300",
};

function GenerationToken(props: GenerationTokenProps) {
    const { generationToken, showColor } = props;
    const { token, confidence, stop, prompt, manual } = generationToken;

    const handleClick = React.useCallback(() => {
        drawerStore.openDrawer();
        drawerStore.setDrawerTab("generation");
        generationStore.setActiveGeneration(generationToken);
    }, [generationToken]);

    const textColor = React.useMemo(() => {
        const textColor = prompt
            ? ""
            : manual
              ? "blue"
              : Object.entries(colorMap).reduce((acc, [threshold, color]) => {
                    if (confidence >= parseFloat(threshold)) {
                        return color;
                    }
                    return acc;
                }, "");
        return textColor;
    }, [prompt, manual, confidence]);

    return (
        <span
            className={`
${showColor ? textColor : "text-base-content"}
hover:text-blue-500
relative before:opacity-0 hover:before:opacity-100 before:transition-opacity
before:-z-10 before:inset-[-4px] before:absolute before:bg-gray-800 before:p-0
before:border before:border-base-300
before:rounded-field
`}
            onClick={handleClick}
        >
            {token}
        </span>
    );
}

export function GenerationView() {
    const [showColor, setShowColor] = React.useState(true);
    return (
        <div>
            <button
                className="btn"
                onClick={() => setShowColor((prev) => !prev)}
            >
                {showColor ? "Hide" : "Show"} confidence colors
            </button>
            <button className="btn" onClick={generationStore.clearGeneration}>
                Clear
            </button>
            <div className="whitespace-pre-wrap">
                {generationStore.currentGenerationSignal.value.map(
                    (token) => (
                        <GenerationToken
                            key={token.index}
                            generationToken={token}
                            showColor={showColor}
                        />
                    ),
                )}
            </div>
        </div>
    );
}
