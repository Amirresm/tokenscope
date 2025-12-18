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


from src.utils.text import visualize_whitespace
from src.ast_service.block import Block, BlockDetector
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
    text: str
    token_id: int
    prominent_match: Match | None
    matches: list[Match]
    block: Block | None
    start: int
    end: int
    line_number: int


class ASTService:
    def __init__(self):
        self.tokenizer = AutoTokenizer.from_pretrained(
            "/storage/c/ai/models/llm/Qwen/Qwen2.5-Coder-1.5B"
        )
        LANGUAGE = Language(tspython.language())
        self.parser = Parser(LANGUAGE)
        self.type_detector = TypeDetector(self.parser)
        self.block_detector = BlockDetector(self.parser)

    def map_parallel(
        self, source_code_tokens_list: list[list[tuple[str, int]]]
    ):
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

    def _map_parallel_worker(
        self, source_code_tokens_list: list[list[tuple[str, int]]]
    ):
        manager = mp.Manager()
        results: ListProxy[TokenInfo | None] = manager.list(
            [None] * len(source_code_tokens_list)
        )  # Pre-allocate for order
        processes = []

        def worker(idx, code):
            try:
                enriched, _ = self.map_ast_to_tokens(code)
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

    def map_ast_to_tokens(self, tokenized_code: list[tuple[str, int]]):
        code = "".join([t[0] for t in tokenized_code])
        tree = self.parser.parse(code.encode("utf8"))
        token_types = self.type_detector.detect_token_types(
            code, tree.root_node
        )
        blocks = self.block_detector.detect_blocks(code, tree.root_node)

        tokens = tokenized_code
        results: list[TokenInfo] = []

        token_type_search_start_index = 0
        start_index = 0

        line_counter = 1
        for token, token_id in tokens:
            end_index = start_index + len(token)

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

            token_type = TokenInfo(
                text=token,
                token_id=token_id,
                prominent_match=prominent_match,
                matches=matching_info,
                block=block_match,
                start=start_index,
                end=end_index,
                line_number=line_counter,
            )
            results.append(token_type)

            start_index = end_index
            if "\n" in token:
                # line_counter += token.count("\n")
                line_counter += 1

        return results, blocks

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

    def _find_block_matches(self, blocks, start_index, end_index):
        block_matches = []

        for block in blocks:
            if block.start <= start_index and block.end >= end_index:
                block_matches.append(("full", block))
            elif block.start >= start_index and block.start <= end_index:
                block_matches.append(("start_inside", block))
            elif block.end >= start_index and block.end <= end_index:
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
            token = visualize_whitespace(res.text)
            token_id = res.token_id
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
            text = token.text
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

            print(f"[{color}]{token.text}[/{color}]", end="")
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
            print(f"[{color}]{token.text}[/{color}]", end="")
            last_line_number = line_number
        print()


if __name__ == "__main__":
    code = '''<|begin_of_text|># Below is a Python script with a self-contained function that solves the problem and passes corresponding tests:
import numpy as np
import itertools
import random
import statistics

def task_func(T1, RANGE=100):
    """
    Convert elements in 'T1' to integers and create a list of random integers.
    The size of the list is the sum of the integers in `T1`. Calculate and 
    return the mean, median, and mode of the list.
    
    Parameters:
    T1 (tuple of tuples): Each tuple contains string representations of integers which are converted to integers.
    RANGE (int, optional): The upper limit for generating random integers. Default is 100.
    
    Returns:
    tuple: A tuple containing the mean, median, and mode of the generated list of random integers.
           The mean and median are floats, and the mode is an integer. The calculations use the generated
           list whose size is determined by the sum of converted integers from `T1`.
    
    Requirements:
    - numpy
    - itertools
    - random
    - statistics

    Raises:
    statistics.StatisticsError if T1 is empty
    
    Example:
    >>> import random
    >>> random.seed(42)
    >>> T1 = (('13', '17', '18', '21', '32'), ('07', '11', '13', '14', '28'), ('01', '05', '06', '08', '15', '16'))
    >>> stats = task_func(T1)
    >>> print(stats)
    (49.88, 48.0, 20)
    >>> stats = task_func(T1, RANGE=50)
    >>> print(stats)
    (23.773333333333333, 25.0, 15)
    """
    if not T1:
        raise statistics.StatisticsError("T1 is empty")
    T1 = [tuple(map(int, t)) for t in T1]
    T1 = [sum(t) for t in T1]
    T1 = [random.randint(0, RANGE) for _ in range(sum(T1))]
    return statistics.mean(T1), statistics.median(T1), statistics.mode(T1)

# The following code is used to test the function:
if __name__ == '__main__':
    import doctest
    doctest.testmod()'''
    # with open("./src/ts/block.py", "r") as f:
    #     code = f.read()

    ast_service = ASTService()

    # results = ast_service.map_parallel([code] * 1000)
    #
    # ASTService.type_pretty_print(results[995])
    tokenized_code = [
        (ast_service.tokenizer.decode([tid]), tid)
        for tid in ast_service.tokenizer.encode(code)
    ]

    results, _ = ast_service.map_ast_to_tokens(tokenized_code)

    # ast_service.report_tokens(results)
    ASTService.type_pretty_print(results)
    ASTService.block_pretty_print(results)
    ASTService.line_pretty_print(results)
