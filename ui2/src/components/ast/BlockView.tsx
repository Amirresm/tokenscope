import { AtomicBlock } from "../../models/ast";
import "./BlockView.css";

function visualizeWhitespace(str: string) {
    return (
        str
            // .replace(/ /g, "␣") // space
            // .replace(/\t/g, "⇥") // tab
            .replace(/\n/g, "⏎\n")
    ); // newline
}

type BlockViewProps = {
    atomicBlocks: AtomicBlock[];
};

export function BlockView({ atomicBlocks }: BlockViewProps) {
    return (
        <div className="mt-4">
            <div className="whitespace-pre-wrap ms-44">
                {atomicBlocks.map((block, index) => (
                    <span
                        key={index}
                        data-content={`#${block.id}: ${block.depth} - ${block.type}`}
                        className={`atomic-block before:content-[attr(data-content)]`}
                    >
                        {visualizeWhitespace(block.source) +
                            (block.source.endsWith("\n") ? "" : "\n")}
                    </span>
                ))}
            </div>
        </div>
    );
}
