import React from "react";
import generationStore from "../../store/generationStore";

function Content() {
    const currentGeneration = generationStore.currentGeneration.value;

    const promptTokens = React.useMemo(() => {
        if (!currentGeneration) return [];
        return currentGeneration.filter((t) => t.prompt);
    }, [currentGeneration]);

    const manualContinueTokens = React.useMemo(() => {
        if (!currentGeneration) return [];
        let nonPromptTokens = 0;
        const reversedGeneration = [...currentGeneration].reverse();
        for (const t of reversedGeneration) {
            if (t.manual) {
                break;
            }
            nonPromptTokens += 1;
        }

        return currentGeneration.slice(
            0,
            currentGeneration.length - nonPromptTokens,
        );
    }, [currentGeneration]);

    const copyToClipboard = React.useCallback(
        (target: "prompt" | "manual") => {
            let textToCopy = "";
            if (target === "prompt") {
                textToCopy = promptTokens.map((t) => t.token).join("");
            } else {
                textToCopy = manualContinueTokens.map((t) => t.token).join("");
            }
            navigator.clipboard.writeText(textToCopy);
        },
        [promptTokens, manualContinueTokens],
    );

    return (
        <div className="p-1">
            <div className="mt-2 h-full overflow-y-auto">
                <div className="text-lg font-bold mb-1">
                    Prompt Tokens ({promptTokens.length} Tokens)
                    <button
                        className="btn btn-sm btn-secondary btn-ghost ml-4"
                        onClick={() => copyToClipboard("prompt")}
                    >
                        Copy
                    </button>
                </div>
                <div className="whitespace-pre-wrap px-1">
                    {promptTokens.map((t) => (
                        <span
                            key={t.position}
                            className={`${
                                t.manual
                                    ? "text-yellow-200"
                                    : t.prompt
                                      ? "text-neutral-300"
                                      : ""
                            }`}
                        >
                            {t.token}
                        </span>
                    ))}
                </div>
            </div>
            {manualContinueTokens.length > 0 && (
                <div className="mt-6 h-full overflow-y-auto">
                    <div className="text-lg font-bold mb-1">
                        With Manual Tokens ({manualContinueTokens.length}{" "}
                        Tokens)
                        <button
                            className="btn btn-sm btn-secondary btn-ghost ml-4"
                            onClick={() => copyToClipboard("prompt")}
                        >
                            Copy
                        </button>
                    </div>
                    <div className="whitespace-pre-wrap px-1">
                        {manualContinueTokens.map((t) => (
                            <span
                                key={t.position}
                                className={`${
                                    t.manual
                                        ? "text-red-100"
                                        : t.prompt
                                          ? "text-neutral-300"
                                          : "text-neutral-400"
                                }`}
                            >
                                {t.token}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export function PromptModal() {
    const [isInView, setIsInView] = React.useState(false);

    React.useEffect(() => {
        const dialog = document.getElementById(
            "prompt_modal",
        ) as HTMLDialogElement;

        const observer = new MutationObserver(() => {
            if (dialog.open) {
                setIsInView(true);
            } else {
                setIsInView(false);
            }
        });

        observer.observe(dialog, {
            attributes: true,
            attributeFilter: ["open"],
        });

        return () => {
            observer.disconnect();
        };
    }, []);

    return (
        <dialog id="prompt_modal" className="modal">
            <div className="modal-box h-[80vh] w-10/12 max-w-10/12">
                {isInView && <Content />}
            </div>
            <form method="dialog" className="modal-backdrop">
                <button>close</button>
            </form>
        </dialog>
    );
}
