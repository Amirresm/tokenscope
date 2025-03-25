import React from "react";
import { DynamicTextarea } from "./DynamicTextarea";
import generationStore from "../store/generationStore";
import { handleStream } from "../api/generation";

export function PromptInput() {
    const abortRef = React.useRef<AbortController>(new AbortController());
    const [value, setValue] = React.useState("");

    const [isGenerating, setIsGenerating] = React.useState(false);
    const [shouldResume, setShouldResume] = React.useState(false);
    const lastToken = generationStore.lastGeneratedTokenSignal.value?.index;

    const handleChange = React.useCallback((v: string) => {
        setValue(v);
    }, []);

    const handleSubmit = React.useCallback(async () => {
        if (isGenerating) {
            abortRef.current.abort();
            abortRef.current = new AbortController();
            setIsGenerating(false);
            setShouldResume(true);
            return;
        }
        generationStore.clearGeneration();
        setIsGenerating(true);
        if (shouldResume) {
            setShouldResume(false);
            const response = await fetch("http://10.0.0.92:3000/api/continue", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    index: lastToken,
                }),
                signal: abortRef.current.signal,
            });
            if (!response.ok) {
                console.error("Error:", response.statusText);
                return;
            }
            await handleStream(response, generationStore.appendToGeneration);
        } else {
            const response = await fetch("http://10.0.0.92:3000/api/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    prompt: value,
                    max_tokens: 200,
                }),
                signal: abortRef.current.signal,
            });
            if (!response.ok) {
                console.error("Error:", response.statusText);
                return;
            }
            await handleStream(response, generationStore.appendToGeneration);
        }
        setIsGenerating(false);
    }, [isGenerating, lastToken, shouldResume, value]);

    return (
        <div className="">
            <DynamicTextarea value={value} onChange={handleChange} />
            <div className="flex justify-end gap-2 sticky top-4 mt-4">
                <button className="btn">Reset</button>
                <button className="btn btn-neutral" onClick={handleSubmit}>
                    {isGenerating ? "Stop" : "Generate"}
                </button>
            </div>
        </div>
    );
}
