import React from "react";

const handleResize = (textarea: HTMLTextAreaElement | null) => {
    if (textarea) {
        textarea.style.height = "inherit";
        const maxHeight = Math.max(0, Math.min(500, textarea.scrollHeight));
        textarea.style.height = `${maxHeight}px`;
    }
};

type DynamicTextareaProps = {
    value?: string;
    onChange?: (value: string) => void;
    onSubmit?: () => void;
    focus?: boolean;
};

export function DynamicTextarea(props: DynamicTextareaProps) {
    const { value, onChange, onSubmit, focus } = props;
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const handleChange = React.useCallback(
        (event: React.ChangeEvent<HTMLTextAreaElement>) => {
            if (onChange) {
                onChange(event.target.value);
            }
            handleResize(textareaRef.current);
        },
        [onChange],
    );

    React.useEffect(() => {
        handleResize(textareaRef.current);
    }, [value]);

    React.useEffect(() => {
        const textarea = textareaRef.current;

        const keypressHandler = (e: KeyboardEvent) => {
            if (textarea && onSubmit && e.key === "Enter" && e.shiftKey) {
                onSubmit();
            }
        };
        if (textarea) {
            if (focus) textarea.focus();
            textarea.onkeydown = keypressHandler;
        }
        return () => {
            if (textarea) {
                textarea.removeEventListener("keydown", keypressHandler);
            }
        };
    }, [onSubmit, focus]);

    return (
        <div className="w-full">
            <div className="rounded-field border border-base-300 bg-base-200 px-2 py-2">
                <textarea
                    ref={textareaRef}
                    className="w-full resize-none outline-none"
                    value={value}
                    onChange={handleChange}
                ></textarea>
            </div>
        </div>
    );
}
