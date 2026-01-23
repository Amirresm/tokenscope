import ast
from dataclasses import dataclass
import asttokens
import tokenize
import keyword
from io import StringIO
from rich.table import Table
from rich.console import Console

from transformers import AutoTokenizer


@dataclass
class Match:
    match_type: str
    token: str
    token_type: str
    token_class: str
    class_priority: str
    modality: str
    ast_types: list[str]
    start: int
    end: int


@dataclass
class TokenInfo:
    token: str
    token_id: int
    prominent_match: Match | None
    matches: list[Match]
    start: int
    end: int


def visualize_whitespace(code: str) -> str:
    """
    Visualizes whitespace in the given code by replacing spaces with dots and tabs with arrows.
    """
    return code.replace(" ", "␣").replace("\t", "⇥").replace("\n", "⏎")


class ASTService:

    def __init__(self, tokenizer_name_or_path: str):
        self.tokenizer = AutoTokenizer.from_pretrained(tokenizer_name_or_path)

    def get_token_types(self, raw_code: str, return_deepest: bool = False):
        atok = asttokens.ASTTokens(code, parse=True)
        tokens = list(atok.get_tokens(atok.tree))

        # Collect all nodes with their span positions
        node_spans = []
        for node in ast.walk(atok.tree):
            if hasattr(node, "first_token") and node.first_token:
                start = node.first_token.startpos
                end = node.last_token.endpos
                node_spans.append((start, end, type(node).__name__))

        result = []

        for token in tokens:
            matching_nodes = []
            for start, end, node_type in node_spans:
                if start <= token.startpos < end:
                    matching_nodes.append(
                        (end - start, node_type)
                    )  # use span length for depth

            matching_nodes.sort()  # from outer to inner (shorter span = deeper)
            node_types = [node_type for _, node_type in matching_nodes]

            result.append(
                {
                    "token": token.string,
                    "token_type": token.type,
                    "ast_node_types": node_types,
                    "deepest_ast_node": node_types[-1] if node_types else None,
                }
                if return_deepest
                else {
                    "token": token.string,
                    "token_type": token.type,
                    "ast_node_types": node_types,
                }
            )

        return result

    def get_detailed_token_info(self, code: str):
        atok = asttokens.ASTTokens(code, parse=True)
        node_spans = []
        for node in ast.walk(atok.tree):
            if hasattr(node, "first_token") and node.first_token:
                start = node.first_token.startpos
                end = node.last_token.endpos
                node_spans.append((start, end, type(node).__name__))

        result = []
        for tok in tokenize.generate_tokens(StringIO(code).readline):
            tok_class, class_priority = self._classify_token(tok)
            modelity = "source_code"
            if tok_class == "comment":
                modelity = "natural_language"
            if tok_class == "literal" and len(tok.string.split(" ")) > 3:
                modelity = "natural_language"

            pos = (
                sum(
                    len(line) + 1
                    for line in code.splitlines()[: tok.start[0] - 1]
                )
                + tok.start[1]
            )

            matching_nodes = []
            for start, end, node_type in node_spans:
                if start <= pos < end:
                    matching_nodes.append((end - start, node_type))
            matching_nodes.sort()
            node_types = [node_type for _, node_type in matching_nodes]

            start_index = (
                sum(
                    len(line) + 1
                    for line in code.splitlines()[: tok.start[0] - 1]
                )
                + tok.start[1]
            )
            end_index = (
                sum(
                    len(line) + 1
                    for line in code.splitlines()[: tok.end[0] - 1]
                )
                + tok.end[1]
            )

            result.append(
                {
                    "token": tok.string,
                    "token_type": tokenize.tok_name[tok.type],
                    "token_class": tok_class,
                    "class_priority": class_priority,
                    "modality": modelity,
                    "ast_node_types": node_types,
                    "start": tok.start,
                    "end": tok.end,
                    "start_index": start_index,
                    "end_index": end_index,
                }
            )

        return result

    def _classify_token(self, tok: tokenize.TokenInfo):
        tok_type = tokenize.tok_name[tok.type]
        tok_str = tok.string

        if tok_type == "NL":
            return "whitespace", 10
        elif tok_type == "NEWLINE":
            return "newline", 11
        elif tok_type == "ENDMARKER":
            return "eof", 12
        elif tok_type == "DEDENT":
            return "dedentation", 13
        elif tok_type == "INDENT":
            return "indentation", 14
        elif tok_type == "OP":
            if tok_str in "()[]{},:.;":
                return "delimiter", 16
            else:
                return "operator", 19
        elif tok_type == "ENCODING":
            return "encoding", 79
        elif tok_type == "COMMENT":
            return "comment", 89
        elif tok_type in ["NUMBER", "STRING"]:
            return "literal", 97
        elif tok_type == "NAME":
            if tok_str in keyword.kwlist:
                return "keyword", 98
            else:
                return "identifier", 99
        else:
            return tok_type.lower(), 100

    def find_common_regions(self, tokens: list[dict]):
        common_regions = {}

        for depth in range(1, 10):
            for i in range(len(tokens) - 1):
                start_token = tokens[i]
                types = start_token["ast_node_types"]

                if len(types) <= depth:
                    continue

                common_types = types[-depth:]
                region_tokens = [start_token]

                key = tuple(common_types)

                if (
                    key in common_regions
                    and start_token in common_regions[key]["tokens"]
                ):
                    continue

                for j in range(i + 1, len(tokens)):
                    next_token = tokens[j]
                    next_types = next_token["ast_node_types"]
                    if (
                        len(next_types) >= depth
                        and common_types == next_types[-depth:]
                    ):
                        region_tokens.append(next_token)
                    else:
                        if len(region_tokens) > 3:
                            common_regions[key] = {
                                "tokens": region_tokens,
                                "start": start_token["start"],
                            }
                        break

        return common_regions

    def map_ast_to_tokens(self, code: str):
        info = self.get_detailed_token_info(code)

        tokens = self.tokenizer(code)["input_ids"]
        tokens = [(self.tokenizer.decode([token]), token) for token in tokens]

        results: list[TokenInfo] = []

        start_index = 0
        for token, token_id in tokens:
            end_index = start_index + len(token)
            token = visualize_whitespace(token)

            matching_info: list[Match] = []

            within_token_info = None

            for token_info in info:
                if (
                    within_token_info is None
                    and token_info["start_index"] < start_index
                    and token_info["end_index"] > end_index
                ):
                    within_token_info = token_info

                token_info_token = visualize_whitespace(token_info["token"])
                if (
                    token_info["start_index"] == start_index
                    and token_info["end_index"] == end_index
                ):
                    match_type = "exact"
                    match = Match(
                        match_type=match_type,
                        token=token_info_token,
                        token_type=token_info["token_type"],
                        token_class=token_info["token_class"],
                        class_priority=token_info["class_priority"],
                        modality=token_info["modality"],
                        ast_types=token_info["ast_node_types"],
                        start=start_index,
                        end=end_index,
                    )
                    matching_info.append(match)
                    continue

                if (
                    token_info["start_index"] >= start_index
                    and token_info["end_index"] <= end_index
                ):
                    match_type = "full_inside"
                    match = Match(
                        match_type=match_type,
                        token=token_info_token,
                        token_type=token_info["token_type"],
                        token_class=token_info["token_class"],
                        class_priority=token_info["class_priority"],
                        modality=token_info["modality"],
                        ast_types=token_info["ast_node_types"],
                        start=start_index,
                        end=end_index,
                    )
                    matching_info.append(match)
                    continue

                if (
                    token_info["start_index"] >= start_index
                    and token_info["start_index"] < end_index
                ):
                    match_type = "start_inside"
                    match = Match(
                        match_type=match_type,
                        token=token_info_token,
                        token_type=token_info["token_type"],
                        token_class=token_info["token_class"],
                        class_priority=token_info["class_priority"],
                        modality=token_info["modality"],
                        ast_types=token_info["ast_node_types"],
                        start=start_index,
                        end=end_index,
                    )
                    matching_info.append(match)
                    continue

                if (
                    token_info["end_index"] > start_index
                    and token_info["end_index"] <= end_index
                ):
                    match_type = "end_inside"
                    match = Match(
                        match_type=match_type,
                        token=token_info_token,
                        token_type=token_info["token_type"],
                        token_class=token_info["token_class"],
                        class_priority=token_info["class_priority"],
                        modality=token_info["modality"],
                        ast_types=token_info["ast_node_types"],
                        start=start_index,
                        end=end_index,
                    )
                    matching_info.append(match)
                    continue

            if within_token_info:
                match_type = "within"
                match = Match(
                    match_type=match_type,
                    token=visualize_whitespace(within_token_info["token"]),
                    token_type=within_token_info["token_type"],
                    token_class=within_token_info["token_class"],
                    class_priority=within_token_info["class_priority"],
                    modality=within_token_info["modality"],
                    ast_types=within_token_info["ast_node_types"],
                    start=start_index,
                    end=end_index,
                )
                matching_info.append(match)

            matching_info.sort(key=lambda x: x.class_priority, reverse=True)
            prominent_match = matching_info[0] if matching_info else None

            token_info = TokenInfo(
                token=token,
                token_id=token_id,
                prominent_match=prominent_match,
                matches=matching_info,
                start=start_index,
                end=end_index,
            )
            results.append(token_info)

            start_index = end_index

        return results

    def visualize_code(self, enriched_tokens: list[TokenInfo]):
        console = Console()
        table = Table(title="Token Analysis Results")
        table.add_column("Token", style="bold cyan")
        table.add_column("ID", style="bold white")
        table.add_column("Match", style="bold green")
        table.add_column("Match Type", style="bold green")
        table.add_column("AST Types", style="bold yellow")
        table.add_column("Class", style="bold magenta")
        table.add_column("Modality", style="bold blue")

        for res in enriched_tokens:
            token = visualize_whitespace(res.token)
            token_id = res.token_id
            prominent_match = res.prominent_match
            matches = res.matches

            for i, match in enumerate(matches):
                table.add_row(
                    token if i == 0 else "",
                    str(token_id),
                    match.token[:20] if match else "-",
                    match.match_type if match else "-",
                    (", ".join(match.ast_types[:4]) if match else "-"),
                    match.token_class if match else "-",
                    match.modality if match else "-",
                )

        console.print(table)


if __name__ == "__main__":
    code = '''# Below is a Python script with a self-contained function that solves the problem and passes corresponding tests:
import csv
import collections
import operator

def task_func(csv_file_path):
    """
    Find the best-selling product from a given CSV file with sales data.

    This function parses a CSV file assumed to have a header followed by rows containing
    two columns: 'product' and 'quantity'. It computes the total sales per product and
    determines the product with the highest cumulative sales. The CSV file must include
    at least these two columns, where 'product' is the name of the product as a string
    and 'quantity' is the number of units sold as an integer.

    Args:
        csv_file_path (str): The file path to the CSV file containing sales data.

    Returns:
        str: The name of the top-selling product based on the total quantity sold.

    Requirements:
    - csv
    - collections
    - operator

    Example:
    >>> task_func("path/to/sales.csv")
    'Product ABC'
    """
with open(csv_file_path, 'r') as file:
    reader = csv.DictReader(file)
    sales_data = collections.defaultdict(int)
    for row in reader:
        product = row['product']
        quantity = int(row['quantity'])
        sales_data[product] += quantity

    best_selling_product = max(sales_data.items(), key=operator.itemgetter(1))[0]

    return best_selling_product'''

    print(code)

    ast_service = ASTService()

    results = ast_service.map_ast_to_tokens(code)

    ast_service.visualize_code(results)

    exit(0)

    # res = ast_service.get_token_types(code)
    #
    # for info in res:
    #     token = info["token"]
    #     token_type = info["token_type"]
    #     ast_types = info["ast_node_types"]
    #     deepest_ast_type = info.get("deepest_ast_node")
    #
    #     print(f"Token: {token}, Type: {token_type}, AST Type: {ast_types[0:2]}")

    res = ast_service.get_detailed_token_info(code)

    common_regions = ast_service.find_common_regions(res)

    for ast_types, region in common_regions.items():
        tokens = region["tokens"]
        ast_types = list(ast_types)

        print("=" * 20, f"Common Region: AST Types: {ast_types}")
        # print("Tokens:")
        # print(" ".join([token["token"] for token in tokens]))
        # print("-" * 20)

        start_pos = tokens[0]["start"]
        end_pos = tokens[-1]["end"]
        start_index = (
            sum(len(line) + 1 for line in code.splitlines()[: start_pos[0] - 1])
            + start_pos[1]
        )
        end_index = (
            sum(len(line) + 1 for line in code.splitlines()[: end_pos[0] - 1])
            + end_pos[1]
        )

        snippet = code[start_index:end_index]
        print("Code Snippet:")
        print(snippet)
        print("-" * 20)

    for info in res:
        token = visualize_whitespace(info["token"])
        token_type = info["token_type"]
        token_class = info["token_class"]
        ast_types = info["ast_node_types"]
        start_pos = info["start"]
        end_pos = info["end"]

        print(
            f"Token: {token}, Type: {token_type}, Class: {token_class}, AST Type: {ast_types[0:4]}, Start: {start_pos}, End: {end_pos} "
            f"Depth: {len(ast_types) - 1 if ast_types else 0}"
        )
