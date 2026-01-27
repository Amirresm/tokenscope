import {
    ChartBarIcon,
    ChartPolarIcon,
    ChartScatterIcon,
    CheckCircleIcon,
    CrosshairIcon,
    GraphIcon,
    PaintBrushIcon,
    TargetIcon,
    XCircleIcon,
} from "@phosphor-icons/react";
import tokenLevelViewStore, {
    ColorVerbosityEnum,
    TokenMetrics,
} from "../store/components/tokenLevelViewStore";
import { MultiSwitch } from "./ui/MultiSwitch";

const colorVerbosityOptions = [
    {
        label: "None",
        value: ColorVerbosityEnum.NONE,
        icon: <PaintBrushIcon size={16} />,
    },
    {
        label: "Normal",
        value: ColorVerbosityEnum.NORMAL,
        icon: <PaintBrushIcon size={16} className="text-orange-300" />,
    },
    {
        label: "Verbose",
        value: ColorVerbosityEnum.VERBOSE,
        icon: <PaintBrushIcon size={16} className="text-purple-500" />,
    },
];

const metricOptions = [
    {
        label: TokenMetrics.confidence.label,
        value: "confidence",
        icon: <TargetIcon size={16} />,
    },
    {
        label: TokenMetrics.marginConfidence.label,
        value: "marginConfidence",
        icon: <ChartBarIcon size={16} />,
    },
    {
        label: TokenMetrics.entropy.label,
        value: "entropy",
        icon: <ChartScatterIcon size={16} />,
    },
    {
        label: TokenMetrics.perplexity.label,
        value: "perplexity",
        icon: <CrosshairIcon size={16} />,
    },
    {
        label: TokenMetrics.lastPerplexity.label,
        value: "lastPerplexity",
        icon: <ChartPolarIcon size={16} />,
    },
    {
        label: TokenMetrics.attentionSaliency.label,
        value: "attentionSaliency",
        icon: <GraphIcon size={16} />,
    },
] as const;

function WideToggleButton(props: {
    label: string;
    enabled: boolean;
    onClick: () => void;
}) {
    return (
        <button className="btn btn-ghost w-full" onClick={props.onClick}>
            <div className="flex justify-between items-center w-full font-normal">
                {props.label}
                {props.enabled ? (
                    <CheckCircleIcon
                        size={20}
                        className="text-green-500 mr-3"
                    />
                ) : (
                    <XCircleIcon size={20} className="text-red-500 mr-3" />
                )}
            </div>
        </button>
    );
}

export function TokenLevelConfigDropdown() {
    return (
        <div
            className="dropdown bg-base-200 rounded-box z-1 py-4 px-2 shadow-sm w-96 overflow-x-hidden"
            popover="auto"
            id="token-level-config-popover"
            style={{ positionAnchor: "--token-level-config-anchor" }}
        >
            <div className="flex flex-col gap-2 text-sm">
                <h3 className="px-4 mb-4 font-semibold text-lg">
                    Token Level View Settings
                </h3>
                <div className="flex justify-between items-center px-4">
                    Color Verbosity
                    <MultiSwitch
                        options={colorVerbosityOptions}
                        selectedValue={
                            tokenLevelViewStore.config.value.colorVerbosity
                        }
                        onChange={(value) => {
                            tokenLevelViewStore.updateConfig({
                                colorVerbosity: value,
                            });
                        }}
                    />
                </div>
                <div className="flex justify-between items-center px-4">
                    <div className="min-w-52">Color by Metric</div>
                    <MultiSwitch
                        options={metricOptions}
                        selectedValue={
                            tokenLevelViewStore.config.value.tokenMetric
                        }
                        onChange={(value) => {
                            tokenLevelViewStore.updateConfig({
                                tokenMetric: value,
                            });
                        }}
                    />
                </div>
                <WideToggleButton
                    label="Show Special Tokens"
                    enabled={
                        !tokenLevelViewStore.config.value.specialTokenFilter
                    }
                    onClick={() => {
                        tokenLevelViewStore.updateConfig({
                            specialTokenFilter:
                                !tokenLevelViewStore.config.value
                                    .specialTokenFilter,
                        });
                    }}
                />
                <WideToggleButton
                    label="Show Line Info"
                    enabled={tokenLevelViewStore.config.value.showLineInfo}
                    onClick={() => {
                        tokenLevelViewStore.updateConfig({
                            showLineInfo:
                                !tokenLevelViewStore.config.value.showLineInfo,
                        });
                    }}
                />
            </div>
        </div>
    );
}
