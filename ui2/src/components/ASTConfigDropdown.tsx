import { PaintBrushIcon } from "@phosphor-icons/react";
import { MultiSwitch } from "./ui/MultiSwitch";
import astStore, { ASTColorVerbosityEnum } from "../store/components/astStore";

const colorVerbosityOptions = [
    {
        label: "Normal",
        value: ASTColorVerbosityEnum.NORMAL,
        icon: <PaintBrushIcon size={16} className="text-orange-300" />,
    },
    {
        label: "Confidence",
        value: ASTColorVerbosityEnum.CONFIDENCE,
        icon: <PaintBrushIcon size={16} className="text-purple-500" />,
    },
];

export function ASTConfigDropdown() {
    return (
        <div
            className="dropdown bg-base-200 rounded-box z-1 py-4 px-2 shadow-sm w-96 overflow-x-hidden"
            popover="auto"
            id="ast-config-dropdown"
            style={{ positionAnchor: "--ast-config-dropdown-anchor" }}
        >
            <div className="flex flex-col gap-2 text-sm">
                <h3 className="px-4 mb-4 font-semibold text-lg">
                    Code Analysis View Config
                </h3>
                <div className="flex justify-between items-center px-4">
                    Color Verbosity
                    <MultiSwitch
                        options={colorVerbosityOptions}
                        selectedValue={astStore.astColorVerbosity.value}
                        onChange={(value) => {
                            astStore.astColorVerbosity.value = value;
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
