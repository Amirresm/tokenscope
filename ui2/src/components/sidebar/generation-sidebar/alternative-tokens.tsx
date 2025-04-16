import { GenerationToken } from "../../../store/generationStore";

export default function AlternativeTokens({
    token,
    tokens,
    confidences,
    onClick,
}: {
    token: GenerationToken;
    tokens: string[];
    confidences: number[];
    onClick: (tokens: string) => void;
}) {
    return (
        <div>
            <div className="text-xl text-secondary-content">
                Alternate Tokens
            </div>
            <div key={token.token} className="menu mt-4 w-full all-tokens-list">
                {tokens.map((t, index) =>
                    t === token.token ? null : (
                        <li key={t}>
                            <a
                                className={`flex justify-between items-center p-1`}
                                onClick={() => onClick(t)}
                            >
                                <div>{t}</div>
                                <div>{confidences[index].toFixed(2)}</div>
                            </a>
                        </li>
                    ),
                )}
            </div>
        </div>
    );
}
