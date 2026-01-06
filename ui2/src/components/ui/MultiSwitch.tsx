import React from "react";

type MultiSwitchProps<T> = {
    options: readonly { label: string; value: T; icon: React.JSX.Element }[]; 
    selectedValue: T;
    onChange: (value: T) => void;
};

export function MultiSwitch<T>(props: MultiSwitchProps<T>) {
    return (
        <div className="flex gap-0">
            {props.options.map((option) => (
                <div
                    className="tooltip"
                    data-tip={option.label}
                    key={option.label}
                >
                    <button
                        className={`btn btn-ghost btn-sm ${
                            props.selectedValue === option.value
                                ? "btn-active"
                                : ""
                        }`}
                        onClick={() => props.onChange(option.value)}
                    >
                        {option.icon}
                    </button>
                </div>
            ))}
        </div>
    );
}
