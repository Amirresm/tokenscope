from dataclasses import dataclass
import multiprocessing as mp
from multiprocessing.managers import ListProxy

import tree_sitter_python as tspython
from tree_sitter import Language, Parser
from transformers import AutoTokenizer
from rich import print
from rich.table import Table
from rich.console import Console
from tqdm import tqdm


from src.generator.token_node import Token
from src.utils.text import visualize_whitespace
from src.ast_service.block import AtomicBlock, Block, BlockDetector
from src.ast_service.type_detection import TypeDetector


@dataclass
class Match:
    match_type: str
    token: str
    type: str
    category: str
    priority: int
    group: str
    start: int
    end: int


@dataclass
class TokenInfo:
    token: Token
    prominent_match: Match | None
    matches: list[Match]
    block: Block | None
    atomic_block: AtomicBlock | None
    start: int
    end: int
    line_number: int


class ASTService:
    def __init__(self, tokenizer_name_or_path: str | None = None):
        self.tokenizer = AutoTokenizer.from_pretrained(
            tokenizer_name_or_path or "gpt2"
        )
        LANGUAGE = Language(tspython.language())
        self.parser = Parser(LANGUAGE)
        self.type_detector = TypeDetector(self.parser)
        self.block_detector = BlockDetector(self.parser)

    def update_tokenizer(self, tokenizer_name_or_path: str):
        self.tokenizer = AutoTokenizer.from_pretrained(tokenizer_name_or_path)
        print(f"ASTService: Updated tokenizer to {tokenizer_name_or_path}")

    def map_parallel(self, source_code_tokens_list: list[list[Token]]):
        if len(source_code_tokens_list) < 10:
            print("Mapping AST to tokens in serial...")
            return [
                self.map_ast_to_tokens(token_list)[0]
                for token_list in source_code_tokens_list
            ]
        else:
            batch_size = 300
            print(
                f"Mapping AST to tokens in parallel with batch size {batch_size}..."
            )
            results = []
            for i in tqdm(
                range(0, len(source_code_tokens_list), batch_size),
                desc="Processing batches",
            ):
                batch = source_code_tokens_list[i : i + batch_size]
                results.extend(self._map_parallel_worker(batch))
            return results

    def _map_parallel_worker(self, source_code_tokens_list: list[list[Token]]):
        manager = mp.Manager()
        results: ListProxy[TokenInfo | None] = manager.list(
            [None] * len(source_code_tokens_list)
        )  # Pre-allocate for order
        processes = []

        def worker(idx, code):
            try:
                enriched, _, _ = self.map_ast_to_tokens(code)
            except Exception as e:
                print(f"Error processing code at index {idx}: {e}")
                print(f"Code:\n{code}")
                enriched = []
            results[idx] = enriched

        for i, code in enumerate(source_code_tokens_list):
            p = mp.Process(target=worker, args=(i, code))
            p.start()
            processes.append(p)

        for p in processes:
            p.join()

        return list(results)

    def map_ast_to_tokens(self, tokenized_code: list[Token]):
        code = "".join([t.token_string for t in tokenized_code])
        tree = self.parser.parse(code.encode("utf8"))
        token_types = self.type_detector.detect_token_types(
            code, tree.root_node
        )
        blocks, atomic_blocks = self.block_detector.detect_blocks(
            code, tree.root_node
        )

        tokens = tokenized_code
        results: list[TokenInfo] = []

        token_type_search_start_index = 0
        start_index = 0

        line_counter = 1
        for token in tokens:
            token_string = token.token_string
            end_index = start_index + len(token_string)

            matching_info, token_type_search_start_index = (
                self._find_type_matches(
                    token_types,
                    start_index,
                    end_index,
                    token_type_search_start_index,
                )
            )

            prominent_match = matching_info[0] if matching_info else None

            block_match = self._find_block_matches(
                blocks, start_index, end_index
            )

            atomic_block_match = self._find_atomic_block_matches(
                atomic_blocks, start_index, end_index
            )

            token_type = TokenInfo(
                token=token,
                prominent_match=prominent_match,
                matches=matching_info,
                block=block_match,
                atomic_block=atomic_block_match,
                start=start_index,
                end=end_index,
                line_number=line_counter,
            )
            results.append(token_type)

            start_index = end_index
            if "\n" in token_string:
                # line_counter += token.count("\n")
                line_counter += 1

        return results, blocks, atomic_blocks

    def _find_type_matches(
        self, token_types, start_index, end_index, search_start_index=0
    ):
        matching_info: list[Match] = []

        search_start_index = max(0, search_start_index)
        search_start_index = min(search_start_index, len(token_types) - 1)

        within_token_type = None
        within_token_index = 0

        first_hit_index = 0

        for i in range(search_start_index, len(token_types)):
            token_type = token_types[i]
            match_start = token_type.start_byte
            match_end = token_type.end_byte

            token_info_token = token_type.text

            match = Match(
                match_type="",
                token=token_info_token,
                type=token_type.type,
                category=token_type.category or "",
                priority=token_type.priority,
                group=token_type.group,
                start=match_start,
                end=match_end,
            )

            if (
                within_token_type is None
                and match_start < start_index
                and match_end > end_index
            ):
                within_token_type = token_type
                within_token_index = i

            if match_start == start_index and match_end == end_index:
                match_type = "exact"
                match.match_type = match_type
                if first_hit_index == 0:
                    first_hit_index = i
            elif match_start >= start_index and match_end <= end_index:
                match_type = "full_inside"
                match.match_type = match_type
                if first_hit_index == 0:
                    first_hit_index = i
            elif match_start >= start_index and match_start < end_index:
                match_type = "start_inside"
                match.match_type = match_type
                if first_hit_index == 0:
                    first_hit_index = i
            elif match_end > start_index and match_end <= end_index:
                match_type = "end_inside"
                match.match_type = match_type
                if first_hit_index == 0:
                    first_hit_index = i

            if match.match_type:
                matching_info.append(match)

        if within_token_type:
            match_type = "within"
            match = Match(
                match_type=match_type,
                token=within_token_type.text,
                type=within_token_type.type,
                category=within_token_type.category,
                priority=within_token_type.priority,
                group=within_token_type.group,
                start=within_token_type.start_byte,
                end=within_token_type.end_byte,
            )
            matching_info.append(match)
            if first_hit_index == 0:
                first_hit_index = within_token_index

        matching_info.sort(key=lambda x: x.priority, reverse=True)
        return matching_info, first_hit_index

    def _find_block_matches(self, blocks: list[Block], start_index, end_index):
        block_matches = []

        for block in blocks:
            for ur in block.unique_ranges:
                if ur.start <= start_index and ur.end >= end_index:
                    block_matches.append(("full", block))
                elif ur.start >= start_index and ur.start <= end_index:
                    block_matches.append(("start_inside", block))
                elif ur.end >= start_index and ur.end <= end_index:
                    block_matches.append(("end_inside", block))

        if len(block_matches) == 0:
            return None
        match = next(
            iter([m for m in block_matches if m[0] == "full"]), block_matches[0]
        )
        return match[1]

    def _find_atomic_block_matches(
        self, blocks: list[AtomicBlock], start_index, end_index
    ):
        block_matches = []

        for block in blocks:
            if (
                block.range.start <= start_index
                and block.range.end >= end_index
            ):
                block_matches.append(("full", block))
            elif (
                block.range.start >= start_index
                and block.range.start <= end_index
            ):
                block_matches.append(("start_inside", block))
            elif (
                block.range.end >= start_index and block.range.end <= end_index
            ):
                block_matches.append(("end_inside", block))
        if len(block_matches) == 0:
            return None
        match = next(
            iter([m for m in block_matches if m[0] == "full"]), block_matches[0]
        )
        return match[1]

    def report_tokens(self, enriched_tokens: list[TokenInfo]):
        console = Console()
        table = Table(title="Token Analysis Results")
        table.add_column("Token", style="bold cyan")
        table.add_column("ID", style="bold white")
        table.add_column("Match", style="bold green")
        table.add_column("Match Type", style="bold green")
        table.add_column("Type", style="bold yellow")
        table.add_column("Category", style="bold magenta")
        table.add_column("Group", style="bold blue")
        table.add_column("Block", style="bold blue")
        table.add_column("Block Depth", style="bold blue")

        # table.add_column("Start-End", style="bold white")
        # table.add_column("MStart-End", style="bold white")

        for res in enriched_tokens:
            token = visualize_whitespace(res.token.token_string)
            token_id = res.token.token_id
            prominent_match = res.prominent_match

            table.add_row(
                token,
                str(token_id),
                prominent_match.token[:20] if prominent_match else "-",
                prominent_match.match_type if prominent_match else "-",
                prominent_match.type if prominent_match else "-",
                prominent_match.category if prominent_match else "-",
                prominent_match.group if prominent_match else "-",
                res.block.type if res.block else "-",
                str(res.block.depth) if res.block else "-",
                # f"{res.start}-{res.end}",
                # (
                #     f"{prominent_match.start}-{prominent_match.end}"
                #     if prominent_match
                #     else "-"
                # ),
            )

        console.print(table)

    @staticmethod
    def type_pretty_print(enriched_tokens: list[TokenInfo]):
        for token in enriched_tokens:
            color = "white"
            if token.prominent_match is not None:
                if token.prominent_match.category == "fill":
                    color = "red"
                elif token.prominent_match.type == "keyword":
                    color = "blue"
                elif token.prominent_match.type == "attribute":
                    color = "cyan"
                elif token.prominent_match.type == "function":
                    color = "yellow"
                elif token.prominent_match.category == "identifier":
                    color = "green"
                elif token.prominent_match.category == "literal":
                    color = "yellow"
                elif token.prominent_match.category == "operator":
                    color = "magenta"

            # text = visualize_whitespace(token.text)
            text = token.token.token_string
            print(f"[{color}]{text}[/{color}]", end="")
        print()

    @staticmethod
    def block_pretty_print(enriched_tokens: list[TokenInfo]):
        text_colors = [
            "red",
            "green",
            "blue",
            "yellow",
            "magenta",
            "cyan",
            "white",
        ]
        for token in enriched_tokens:
            color = "white"
            if token.block is not None:
                color = text_colors[token.block.id % len(text_colors)]

            print(f"[{color}]{token.token.token_string}[/{color}]", end="")
        print()

    @staticmethod
    def line_pretty_print(enriched_tokens: list[TokenInfo]):
        text_colors = [
            "red",
            "green",
            "blue",
            "yellow",
            "magenta",
            "cyan",
            "white",
        ]
        last_line_number = 1
        for token in enriched_tokens:
            line_number = token.line_number
            color = text_colors[line_number % len(text_colors)]
            if line_number != last_line_number:
                if last_line_number != -1:
                    print(line_number, end="")
            print(f"[{color}]{token.token.token_string}[/{color}]", end="")
            last_line_number = line_number
        print()
