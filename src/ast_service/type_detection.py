from dataclasses import dataclass
import tree_sitter_python as tspython
from tree_sitter import Language, Node, Parser
from rich import print
from rich.table import Table
from rich.console import Console

import keyword

from src.utils.operators import detect_operator_type, detect_delimiters
from src.utils.text import visualize_whitespace


@dataclass
class TokenType:
    group: str
    type: str
    start_byte: int
    end_byte: int
    text: str
    category: str

    priority: int = 0

    def __post_init__(self):
        if self.category == "identifier":
            if self.type == "keyword":
                self.priority = 99
            elif self.type == "variable":
                self.priority = 98
            elif self.type == "attribute":
                self.priority = 97
            elif self.type == "function":
                self.priority = 96
            elif self.type == "constant":
                self.priority = 95
            else:
                self.priority = 94
        elif self.category == "operator":
            self.priority = 89
        elif self.category == "literal":
            self.priority = 79
        elif self.category == "delimiter":
            self.priority = 69
        elif self.category == "fill":
            self.priority = 59

    def __repr__(self):
        return f"TokenType(type='{self.type}', start_byte={self.start_byte}, end_byte={self.end_byte}, text='{self.text}')"


class TypeDetector:
    def __init__(self, parser: Parser):
        self.parser = parser

    def detect_token_types(
        self, source_code, root_node: Node | None = None
    ) -> list[TokenType]:
        if root_node is None:
            tree = self.parser.parse(source_code.encode("utf8"))
            root_node = tree.root_node
        token_types = self._walk(root_node, source_code, depth=0)

        if len(token_types) == 0:
            return []

        token_types = self._fill_missing(token_types, source_code)

        return token_types

    def _walk(
        self,
        node: Node,
        source_code,
        depth=0,
        token_types: list[TokenType] = [],
    ):
        if depth > 32:
            return token_types

        parent_types = self._extract_parent_types(node)

        if len(node.children) == 0 and node.text is not None:
            token = self._create_token_type(node, source_code, parent_types)
            token_types.append(token)

        for child in node.children:
            self._walk(child, source_code, depth + 1, token_types)

        return token_types

    def _detect_fill_type(self, text: str) -> str:
        if "\n" in text:
            return "newline"
        elif "\t" in text:
            return "tab"
        elif text.isspace():
            return "whitespace"
        else:
            return "unknown"

    def _fill_missing(self, token_types, source_code):
        if token_types[0].start_byte != 0:
            s = 0
            e = token_types[0].start_byte
            text = source_code[s:e]
            token_types.insert(
                0,
                TokenType(
                    type=self._detect_fill_type(text),
                    category="fill",
                    group="module",
                    start_byte=s,
                    end_byte=e,
                    text=text,
                ),
            )
        if token_types[-1].end_byte != len(source_code):
            s = token_types[-1].end_byte
            e = len(source_code)
            text = source_code[s:e]
            token_types.append(
                TokenType(
                    type=self._detect_fill_type(text),
                    category="fill",
                    group=token_types[-1].group,
                    start_byte=s,
                    end_byte=e,
                    text=text,
                ),
            )

        fill_tokens = []
        for i, token_type in enumerate(token_types):
            if i < len(token_types) - 1:
                next_token = token_types[i + 1]
                if next_token.start_byte - token_type.end_byte != 0:
                    s = token_type.end_byte
                    e = next_token.start_byte
                    text = source_code[s:e]
                    fill_tokens.append(
                        TokenType(
                            type=self._detect_fill_type(text),
                            category="fill",
                            group=token_types[i + 1].group,
                            start_byte=s,
                            end_byte=e,
                            text=text,
                        ),
                    )
        token_types = token_types + fill_tokens
        token_types.sort(key=lambda x: x.start_byte)
        return token_types

    def _create_token_type(
        self, node: Node, source_code: str, parent_types: list[str]
    ) -> TokenType:
        assert node.text is not None, "Node text must not be None"
        type = parent_types[0]
        parent = parent_types[1] if len(parent_types) > 1 else "unknown"
        group = self._detect_group(parent_types)
        category = type

        if type in keyword.kwlist:
            type = "keyword"
            category = "identifier"
        elif operator := detect_operator_type(type):
            type = f"op_{operator}"
            category = "operator"
        elif delimiter := detect_delimiters(node.text.decode("utf8")):
            type = f"delim_{delimiter}"
            category = "delimiter"
        elif type == "identifier":
            if (
                parent == "attribute"
                and node.prev_sibling is not None
                and node.prev_sibling.type == "."
            ):
                type = "attribute"
            elif parent == "call":
                type = "function"
            elif node.text.isupper():
                type = "constant"
            else:
                type = "variable"
        elif type == "string_content":
            category = "literal"
        if node.type in ["integer", "float"]:
            category = "literal"
        if node.type in ["false", "true", "none"]:
            category = "literal"

        token = TokenType(
            group=group,
            type=type,
            start_byte=node.start_byte,
            end_byte=node.end_byte,
            text=source_code[node.start_byte : node.end_byte],
            category=category,
        )
        return token

    def _extract_parent_types(self, node: Node):
        parent_types = [node.type]
        parent = node.parent
        while parent is not None:
            parent_types.append(parent.type)
            parent = parent.parent
        return parent_types

    def _detect_group(self, parents: list[str]):
        viable_groups = [
            "import_statement",
            "import_from_statement",
            "function_definition",
            "class_definition",
            "with_statement",
            "if_statement",
            "for_statement",
            "while_statement",
            "try_statement",
            "match_statement",
            "return_statement",
            "expression_statement",
            "assignment_statement",
            "call_expression",
            "binary_expression",
            "unary_expression",
            "attribute_expression",
            "list_expression",
            "dictionary_expression",
            "set_expression",
            "tuple_expression",
            "lambda_expression",
            "await_expression",
            "yield_expression",
            "assignment",
            # "argument_list",
            "call",
            # "subscript",
            "comment",
            "list",
            "dictionary",
            "set",
            "tuple",
        ]

        for p in parents:
            if p in viable_groups:
                if "import" in p:
                    p = "import_statement"
                return p

        return "module"

    @staticmethod
    def type_pretty_print(token_types: list[TokenType]):
        for token in token_types:
            color = "white"
            if token.category == "fill":
                color = "red"
            elif token.type == "keyword":
                color = "blue"
            elif token.type == "attribute":
                color = "cyan"
            elif token.type == "function":
                color = "yellow"
            elif token.category == "identifier":
                color = "green"
            elif token.category == "literal":
                color = "yellow"
            elif token.category == "operator":
                color = "magenta"

            # text = visualize_whitespace(token.text)
            text = token.text
            print(f"[{color}]{text}[/{color}]", end="")
        print()

    @staticmethod
    def group_pretty_print(token_types: list[TokenType]):
        colors = [
            "red",
            "green",
            "blue",
            "yellow",
            "magenta",
            "cyan",
            "white",
        ]

        unique_groups = set(token.group for token in token_types)
        legend = {
            group: colors[i % len(colors)]
            for i, group in enumerate(unique_groups)
        }

        last_group = token_types[0].group if token_types else ""
        for token in token_types:
            group_color = legend.get(token.group, "white")

            if token.group != last_group:
                last_group_color = legend.get(last_group, "white")
                print(f"[bright_{last_group_color}]{{{last_group}}}[/]", end="")
                last_group = token.group

            print(f"[{group_color}]{token.text}[/]", end="")

        print("\nLegend:")
        for group, color in legend.items():
            print(f"[{color}]{group}[/]")

    @staticmethod
    def report_types(
        token_types: list[TokenType],
        use_group: bool = False,
        mix_all: bool = False,
    ):
        """
        Create a rich table of types with their counts and percentages.
        """
        if mix_all:
            title = "Mixed Token Types Report"
            first_col = "Category (Type) - Group"
            targets = [
                f"{token.category} ({token.type}) - {token.group}"
                for token in token_types
            ]
        else:
            title = f"Token {"Groups" if use_group else "Types"} Report"
            first_col = "Group" if use_group else "Category (Type)"
            targets = [
                (
                    token.group
                    if use_group
                    else (
                        token.type
                        if token.category is None
                        else f"{token.category} ({token.type})"
                    )
                )
                for token in token_types
            ]

        console = Console()
        table = Table(title=title)
        table.add_column(first_col, justify="left", style="cyan", no_wrap=True)
        table.add_column("Count", justify="right", style="magenta")
        table.add_column("Percentage", justify="right", style="green")

        type_counts = {}
        for target in targets:
            if target not in type_counts:
                type_counts[target] = 0
            type_counts[target] += 1

        total_count = len(token_types)
        for type, count in sorted(
            type_counts.items(), key=lambda x: x[1], reverse=True
        ):
            percentage = (count / total_count) * 100
            table.add_row(type, str(count), f"{percentage:.2f}%")

        console.print(table)

    @staticmethod
    def report_tokens(
        token_types: list[TokenType],
    ):
        console = Console()
        table = Table(title="Token Types Report")
        table.add_column("Token", style="bold cyan")
        table.add_column("Type", style="bold white")
        table.add_column("Category", style="bold blue")
        table.add_column("Group", style="bold green")
        table.add_column("Start Byte", style="bold yellow")
        table.add_column("End Byte", style="bold magenta")

        for token in token_types:
            table.add_row(
                visualize_whitespace(token.text),
                token.type,
                token.category,
                token.group,
                str(token.start_byte),
                str(token.end_byte),
            )

        console.print(table)


def main():
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
    # with open("./src/ts/test.py", "r") as f:
    #     code = f.read()

    LANGUAGE = Language(tspython.language())
    parser = Parser(LANGUAGE)

    ast_service = TypeDetector(parser)
    token_types = ast_service.detect_token_types(code)

    print("\n=====================Detected Token Types:")
    TypeDetector.type_pretty_print(token_types)

    print("\n=====================Grouped Token Types:")
    TypeDetector.group_pretty_print(token_types)
    # self.report_types(token_types)
    # self.report_types(token_types, use_group=True)
    # self.report_types(token_types, mix_all=True)

    ast_service.report_tokens(token_types)


if __name__ == "__main__":
    main()
