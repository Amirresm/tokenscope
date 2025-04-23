import React from "react";
import generationStore from "../../store/generationStore";
import type { GenerationToken } from "../../store/generationStore";
import drawerStore from "../../store/drawerStore";
import "./generation-view.css";
import { ArrowLineLeft, ArrowLineRight } from "@phosphor-icons/react";

const defaultColorMap = {
    0: "text-base-content",
};

const normalColorMap = {
    0: "text-red-300",
    0.2: "text-orange-300",
    0.4: "text-yellow-300",
    0.8: "",
};

const verboseColorMap = {
    0: "text-red-300",
    0.25: "text-orange-300",
    0.5: "text-yellow-300",
    0.75: "text-green-300",
    0.98: "text-blue-300",
};

type GenerationTokenProps = {
    generationToken: GenerationToken;
    colorVerbosity: "verbose" | "normal" | "none";
    isSelected?: boolean;
    isFimSelected?: boolean;
    isOnlyFimSelected?: boolean;
};

const GenerationToken = React.memo((props: GenerationTokenProps) => {
    const {
        generationToken,
        colorVerbosity,
        isSelected,
        isFimSelected,
        isOnlyFimSelected,
    } = props;
    const { index, token, confidence, tags, prompt, manual } = generationToken;

    const handleClick = React.useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            drawerStore.openDrawer();
            drawerStore.setDrawerTab("generation");
            generationStore.selectedToken.value = generationToken;
        },
        [generationToken],
    );

    const textColor = React.useMemo(() => {
        if (prompt) return "text-gray-400";
        if (manual) {
            if (tags.includes("prefix")) return "text-stone-400";
            return "text-gray-400";
        }

        const colorMap =
            colorVerbosity === "verbose"
                ? verboseColorMap
                : colorVerbosity === "normal"
                  ? normalColorMap
                  : defaultColorMap;
        const textColor = Object.entries(colorMap).reduce(
            (acc, [threshold, color]) => {
                if (confidence >= parseFloat(threshold)) {
                    return color;
                }
                return acc;
            },
            "",
        );
        return textColor;
    }, [prompt, manual, colorVerbosity, tags, confidence]);

    return (
        <>
            <span
                className={`${textColor} hover:text-blue-500 active-token
			${isSelected ? "selected-token" : ""}
			${isFimSelected ? "fim-selected-token" : ""}
			${isOnlyFimSelected ? "only-fim-selected-token" : ""}`}
                onClick={handleClick}
            >
                {isSelected && (
                    <span
                        className="token-arrow left-arrow"
                        onClick={(e) => {
                            e.stopPropagation();
                            generationStore.updateFimIndices(index - 1);
                        }}
                    >
                        <ArrowLineLeft />
                    </span>
                )}
                {token}
                {isSelected && (
                    <span
                        className="token-arrow right-arrow"
                        onClick={(e) => {
                            e.stopPropagation();
                            generationStore.updateFimIndices(index);
                        }}
                    >
                        <ArrowLineRight />
                    </span>
                )}
            </span>
        </>
    );
});

type GenerationListProps = {
    generationList: GenerationToken[];
    colorVerbosity: "verbose" | "normal" | "none";
    selectedTokenIndex?: number;
    fimStartTokenIndex: number | null;
    fimEndTokenIndex: number | null;
    specialTokenFilter?: boolean;
};

const GenerationList = React.memo((props: GenerationListProps) => {
    const {
        generationList,
        colorVerbosity,
        selectedTokenIndex,
        fimStartTokenIndex,
        fimEndTokenIndex,
        specialTokenFilter,
    } = props;

    return generationList
        .filter((token) =>
            specialTokenFilter ? !token.tags.includes("special") : true,
        )
        .map((token) => (
            <GenerationToken
                key={token.index + "-" + token.token}
                generationToken={token}
                colorVerbosity={colorVerbosity}
                isSelected={selectedTokenIndex === token.index}
                isFimSelected={
                    !!(
                        fimStartTokenIndex &&
                        token.index > fimStartTokenIndex &&
                        fimEndTokenIndex &&
                        token.index <= fimEndTokenIndex
                    )
                }
                isOnlyFimSelected={
                    !!(
                        fimStartTokenIndex &&
                        fimEndTokenIndex === null &&
                        token.index === fimStartTokenIndex
                    )
                }
            />
        ));
});

const GenerationView = () => {
    const bottomRef = React.useRef<HTMLSpanElement>(null);
    const generationList = generationStore.currentGenerationSignal.value;
    const colorVerbosity = generationStore.colorVerbosity.value;

    const fimStartToken = generationStore.fimStartToken.value;
    const fimEndToken = generationStore.fimEndToken.value;

    React.useEffect(() => {
        bottomRef.current?.scrollIntoView({});
    }, [generationList]);

    return (
        <div
            className="grow overflow-y-auto p-4"
            onClick={() => (generationStore.selectedToken.value = undefined)}
        >
            <div className="whitespace-pre-wrap">
                <GenerationList
                    generationList={generationList}
                    colorVerbosity={colorVerbosity}
                    selectedTokenIndex={
                        generationStore.selectedToken.value?.index
                    }
                    fimStartTokenIndex={fimStartToken}
                    fimEndTokenIndex={fimEndToken}
                    specialTokenFilter={
                        generationStore.specialTokenFilter.value
                    }
                />
            </div>
            <span ref={bottomRef}></span>
        </div>
    );
};

export default GenerationView;
