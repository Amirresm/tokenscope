import React from "react";
import { DynamicTextarea } from "./DynamicTextarea";
import { signal } from "@preact/signals-react";
import generationStore from "../store/generationStore";

const handleStream = async (response: Response) => {
    if (!response.body) {
        console.error("No body in response");
        return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }

        const textList = decoder.decode(value).split("\n");
        textList.forEach((text) => {
            if (text === "") {
                return;
            }
            let data;
            try {
                data = JSON.parse(text);
            } catch (error) {
                console.log("Error:", error);
                console.log("Text:", text);
                return;
            }
            console.log(data);
            const token = data.token;
            const confidence = data.confidence;
            const allTokens = data.all_tokens;
            const allConfidences = data.all_confidences;
            const isStop = data.stop;
            const isPrompt = data.prompt;
            const isManual = data.manual;
            const tokenIndex = data.index;

	    generationStore.appendToGeneration({
		token,
		index: tokenIndex,
		confidence,
		allTokens,
		allConfidences,
		stop: isStop,
		prompt: isPrompt,
		manual: isManual,
	    })
        });
    }
};


export function PromptInput() {
    const [value, setValue] = React.useState("");

    const handleChange = React.useCallback((v: string) => {
        setValue(v);
    }, []);

    const handleSubmit = React.useCallback(async () => {
	generationStore.clearGeneration();
        const response = await fetch("http://10.0.0.92:3000/api/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                prompt: value,
                max_tokens: 200,
            }),
        });
        if (!response.ok) {
            console.error("Error:", response.statusText);
            return;
        }
	handleStream(response);
    }, [value]);

    return (
        <div className="flex flex-col justify-end gap-4  max-w-[1000px]">
            <DynamicTextarea value={value} onChange={handleChange} />
            <div className="flex justify-end gap-2">
                <button className="btn">Reset</button>
                <button className="btn btn-neutral" onClick={handleSubmit}>
                    Submit
                </button>
            </div>
        </div>
    );
}
