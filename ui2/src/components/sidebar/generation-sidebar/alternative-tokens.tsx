import { GenerationToken } from "../../../store/generationStore";

function visualizeWhitespace(str: string) {
    return str
        .replace(/ /g, "␣") // space
        .replace(/\t/g, "⇥") // tab
        .replace(/\n/g, "⏎\n"); // newline
}

export default function AlternativeTokens({
    token,
    alternativeTokens,
    onClick,
}: {
    token: GenerationToken;
    alternativeTokens: GenerationToken[];
    onClick: (tokens: string) => void;
}) {
    return (
        <div>
            <div className="text-xl text-secondary-content">
                Alternate Tokens
            </div>
            <div key={token.token} className="menu mt-4 w-full all-tokens-list">
                {alternativeTokens.map((t) => (
                    <li key={t.token}>
                        <a
                            className={`flex justify-between items-center p-1`}
                            onClick={() => onClick(t.token)}
                        >
                            <div>{visualizeWhitespace(t.token)}</div>
                            <div>{t.confidence.toFixed(2)}</div>
                            {t.token === token.token && (
                                <span> (current) </span>
                            )}
                        </a>
                    </li>
                ))}
            </div>
        </div>
    );
}
