import React from "react";

let lastExpanded = false;
const handleResize = (
    textarea: HTMLTextAreaElement | null,
    collapsed: boolean,
) => {
    if (textarea) {
        const minHightExpanded = 150;
        const maxHightExpanded = 500;

        const minHightCollapsed = 50;
        const maxHightCollapsed = 75;
        const minHeight = collapsed ? minHightCollapsed : minHightExpanded;
        const maxHeight = collapsed ? maxHightCollapsed : maxHightExpanded;

        textarea.style.height = `${minHeight}px`;

        if (lastExpanded !== collapsed) {
            lastExpanded = collapsed;
            textarea.classList.add("transition-all");
            textarea.classList.add("duration-500");
            setTimeout(() => {
                textarea.classList.remove("transition-all");
                textarea.classList.remove("duration-500");
            }, 500);
        }

        const height = Math.max(
            minHeight,
            Math.min(maxHeight, textarea.scrollHeight),
        );
        textarea.style.height = `${height}px`;
    }
};

type DynamicTextareaProps = {
    value?: string;
    onChange?: (value: string) => void;
    onSubmit?: () => void;
    disabled?: boolean;
    focus?: boolean;
    collapsed?: boolean;
};

export default React.memo((props: DynamicTextareaProps) => {
    const { value, onChange, onSubmit, focus, collapsed } = props;
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const [isFocused, setIsFocused] = React.useState(false);

    const handleChange = React.useCallback(
        (event: React.ChangeEvent<HTMLTextAreaElement>) => {
            if (onChange) {
                onChange(event.target.value);
            }
            handleResize(textareaRef.current, !!collapsed && !isFocused);
        },
        [collapsed, isFocused, onChange],
    );

    React.useEffect(() => {
        handleResize(textareaRef.current, !!collapsed && !isFocused);
    }, [collapsed, value, isFocused]);

    React.useEffect(() => {
        const textarea = textareaRef.current;

        const keypressHandler = (e: KeyboardEvent) => {
            if (textarea && onSubmit && e.key === "Enter" && e.shiftKey) {
                onSubmit();
            }
        };
        const focusHandler = () => {
            setIsFocused(true);
        };
        const blurHandler = () => {
            setIsFocused(false);
        };

        if (textarea) {
            if (focus) textarea.focus();
            textarea.addEventListener("keydown", keypressHandler);
            textarea.addEventListener("focus", focusHandler);
            textarea.addEventListener("blur", blurHandler);
        }
        return () => {
            if (textarea) {
                textarea.removeEventListener("keydown", keypressHandler);
                textarea.removeEventListener("focus", focusHandler);
                textarea.removeEventListener("blur", blurHandler);
            }
        };
    }, [onSubmit, focus]);

    return (
        <div className="w-full">
            <div
                className={`rounded-field border ${props.disabled ? "border-warning" : "border-base-300"} bg-base-200 px-2 py-2`}
            >
                <textarea
                    ref={textareaRef}
                    className="w-full resize-none outline-none"
                    value={value}
                    onChange={handleChange}
                    disabled={props.disabled}
                ></textarea>
            </div>
        </div>
    );
});
