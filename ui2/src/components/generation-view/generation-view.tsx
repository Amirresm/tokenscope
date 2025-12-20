import React from "react";
import generationStore from "../../store/generationStore";
import "./generation-view.css";
import { ArrowLineLeftIcon, ArrowLineRightIcon } from "@phosphor-icons/react";
import type { GenerationToken } from "../../models/generationToken";
import drawerStore, {
    DrawerTabsEnum,
} from "../../store/components/drawerStore";
import tokenLevelViewStore from "../../store/components/tokenLevelViewStore";

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

const attentionColorMap = {
    "-0.001": "border-red-300",
    0.25: "border-orange-300",
    0.5: "border-yellow-300",
    0.75: "border-green-300",
    0.999: "border-blue-300",
};

function visualizeWhitespace(str: string) {
    return str
        .replace(/ /g, "␣") // space
        .replace(/\t/g, "⇥") // tab
        .replace(/\n/g, "⏎\n"); // newline
}

type GenerationTokenProps = {
    generationToken: GenerationToken;
    colorVerbosity: "verbose" | "normal" | "none";
    showLineInfo?: boolean;
    isSelected?: boolean;
    isFimSelected?: boolean;
    isOnlyFimSelected?: boolean;
    isAttentionTarget?: boolean;
    attentionVisibleRange?: number[];
};

const GenerationToken = React.memo((props: GenerationTokenProps) => {
    const {
        generationToken,
        colorVerbosity,
        showLineInfo,
        isSelected,
        isFimSelected,
        isOnlyFimSelected,
        isAttentionTarget,
        attentionVisibleRange,
    } = props;

    const {
        position,
        token,
        confidence,
        tokenTypes,
        prompt,
        manual,
        lineConfidence,
        lineNumber,
        relativeAttention,
    } = generationToken;

    const handleClick = React.useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            drawerStore.openDrawer();
            drawerStore.setDrawerTab(DrawerTabsEnum.GENERATION);
            generationStore.selectedToken.value = generationToken;
        },
        [generationToken],
    );

    const textColor = React.useMemo(() => {
        if (prompt) return "text-gray-400";
        if (manual) {
            if (tokenTypes.includes("prefix")) return "text-stone-400";
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
    }, [prompt, manual, colorVerbosity, tokenTypes, confidence]);

    const startOfLineMarkerColor = React.useMemo(() => {
        if (lineConfidence === undefined) return "";

        if (prompt) return "text-gray-400";
        if (manual) {
            if (tokenTypes.includes("prefix")) return "text-stone-400";
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
                if (lineConfidence >= parseFloat(threshold)) {
                    return color;
                }
                return acc;
            },
            "",
        );
        return textColor;
    }, [prompt, manual, colorVerbosity, tokenTypes, lineConfidence]);

    const relativeAttentionColor = React.useMemo(() => {
        if (relativeAttention === undefined) return "";

        const minAttention = attentionVisibleRange?.[0] || 0;
        const maxAttention = attentionVisibleRange?.[1] || 1;
        const correctedAttention =
            (relativeAttention - minAttention) / (maxAttention - minAttention);

        if (correctedAttention < 0 && correctedAttention > 1) {
            return "";
        }

        const colorMap = attentionColorMap;
        const textColor = Object.entries(colorMap).reduce(
            (acc, [threshold, color]) => {
                if (correctedAttention >= parseFloat(threshold)) {
                    return color;
                }
                return acc;
            },
            "",
        );
        return textColor;
    }, [attentionVisibleRange, relativeAttention]);

    return (
        <>
            <span
                className={`${textColor} hover:text-blue-500 active-token
			${isSelected ? "selected-token" : ""}
			${isFimSelected ? "fim-selected-token" : ""}
			${isOnlyFimSelected ? "only-fim-selected-token" : ""}
			${isAttentionTarget && !isSelected ? "attention-target-token" : ""}
			${relativeAttentionColor ? `border ${relativeAttentionColor}` : ""}`}
                onClick={handleClick}
            >
                {isSelected && (
                    <span
                        className="token-arrow left-arrow"
                        onClick={(e) => {
                            e.stopPropagation();
                            generationStore.updateFimIndices(position - 1);
                        }}
                    >
                        <ArrowLineLeftIcon />
                    </span>
                )}
                {showLineInfo && lineNumber !== undefined && (
                    <span className="text-gray-500 text-sm mr-2">
                        {String(lineNumber).padStart(2, "0")}
                    </span>
                )}
                {showLineInfo && lineConfidence !== undefined && (
                    <span
                        className={`${startOfLineMarkerColor} text-xs border rounded-lg px-1 mr-1`}
                    >
                        {lineConfidence.toFixed(2)}
                    </span>
                )}
                <div
                    className="tooltip inline"
                    data-tip={`Confidence: ${confidence.toFixed(2)}`}
                >
                    {isSelected ? visualizeWhitespace(token) : token}
                </div>
                {isSelected && (
                    <span
                        className="token-arrow right-arrow"
                        onClick={(e) => {
                            e.stopPropagation();
                            generationStore.updateFimIndices(position);
                        }}
                    >
                        <ArrowLineRightIcon />
                    </span>
                )}
            </span>
        </>
    );
});

type GenerationListProps = {
    generationList: GenerationToken[];
    colorVerbosity: "verbose" | "normal" | "none";
    showLineInfo?: boolean;
    selectedTokenIndex?: number;
    fimStartTokenIndex: number | null;
    fimEndTokenIndex: number | null;
    attentionTargetTokenIndex?: number;
    attentionTargetHead?: number;
    attentionVisibleRange?: number[];
    specialTokenFilter?: boolean;
};

const GenerationList = React.memo((props: GenerationListProps) => {
    const {
        generationList,
        colorVerbosity,
        showLineInfo,
        selectedTokenIndex,
        fimStartTokenIndex,
        fimEndTokenIndex,
        attentionTargetTokenIndex,
        attentionTargetHead,
        attentionVisibleRange,
        specialTokenFilter,
    } = props;

    return generationList
        .filter((token) =>
            specialTokenFilter ? !token.tokenTypes.includes("special") : true,
        )
        .map((token) => (
            <GenerationToken
                key={
                    token.position +
                    "-" +
                    token.token +
                    "-" +
                    attentionTargetTokenIndex +
                    "-" +
                    attentionTargetHead
                }
                generationToken={token}
                colorVerbosity={colorVerbosity}
                showLineInfo={showLineInfo}
                isSelected={selectedTokenIndex === token.position}
                isFimSelected={
                    !!(
                        fimStartTokenIndex &&
                        token.position > fimStartTokenIndex &&
                        fimEndTokenIndex &&
                        token.position <= fimEndTokenIndex
                    )
                }
                isOnlyFimSelected={
                    !!(
                        fimStartTokenIndex &&
                        fimEndTokenIndex === null &&
                        token.position === fimStartTokenIndex
                    )
                }
                isAttentionTarget={token.position === attentionTargetTokenIndex}
                attentionVisibleRange={attentionVisibleRange}
            />
        ));
});

const GenerationView = () => {
    const bottomRef = React.useRef<HTMLSpanElement>(null);

    const colorVerbosity = tokenLevelViewStore.colorVerbosity.value;
    const showLineInfo = tokenLevelViewStore.showLineInfo.value;
    const specialTokenFilter = tokenLevelViewStore.specialTokenFilter.value;

    const generationList = generationStore.currentGeneration.value;
    const selectedToken = generationStore.selectedToken.value;
    const isGenerating = generationStore.isGenerating.value;

    const fimStartToken = generationStore.fimStartToken.value;
    const fimEndToken = generationStore.fimEndToken.value;

    const attentionTargetToken = generationStore.attentionTargetToken.value;
    const attentionTargetHead = generationStore.attentionTargetHead.value;
    const attentionVisibleRange = generationStore.attentionVisibleRange.value;

    React.useEffect(() => {
        if (isGenerating) bottomRef.current?.scrollIntoView({});
    }, [generationList, isGenerating]);

    return (
        <div
            className="grow overflow-y-auto p-4"
            onClick={() => (generationStore.selectedToken.value = undefined)}
        >
            <div className="whitespace-pre-wrap">
                <GenerationList
                    generationList={generationList}
                    colorVerbosity={colorVerbosity}
                    showLineInfo={showLineInfo}
                    selectedTokenIndex={selectedToken?.position}
                    fimStartTokenIndex={fimStartToken}
                    fimEndTokenIndex={fimEndToken}
                    attentionTargetTokenIndex={attentionTargetToken?.position}
                    attentionTargetHead={attentionTargetHead}
                    attentionVisibleRange={attentionVisibleRange}
                    specialTokenFilter={specialTokenFilter}
                />
            </div>
            <span ref={bottomRef}></span>
        </div>
    );
};

export default GenerationView;
