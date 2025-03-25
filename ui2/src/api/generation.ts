import { GenerationToken } from "../store/generationStore";

export const handleStream = async (
    response: Response,
    handleData: (data: GenerationToken) => void,
) => {
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
            const token = data.token;
            const confidence = data.confidence;
            const allTokens = data.all_tokens;
            const allConfidences = data.all_confidences;
            const isStop = data.stop;
            const isPrompt = data.prompt;
            const isManual = data.manual;
            const tokenIndex = data.index;

            handleData({
                token,
                index: tokenIndex,
                confidence,
                allTokens,
                allConfidences,
                stop: isStop,
                prompt: isPrompt,
                manual: isManual,
            });
        });
    }
};
