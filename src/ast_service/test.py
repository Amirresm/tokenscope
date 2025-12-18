import tree_sitter_python as tspython
from tree_sitter import Language, Node, Parser

PY_LANGUAGE = Language(tspython.language())

parser = Parser(PY_LANGUAGE)

# 4. Example code
code = b'''# Below is a Python script with a self-contained function that solves the problem and passes corresponding tests:
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

    best_selling_product = max(sales_data.items(), key=operator.itemgetter(1.0))[0]

    return best_selling_product'''
with open("./src/ts/test.py", "rb") as f:
    code = f.read()

tree = parser.parse(code)
root_node = tree.root_node

sample_dict = {
    "import_statement": "import_statement",
    "import_from_statement": "import_from_statement",
}

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
    "argument_list",
    "call",
    "subscript",
    "comment"
]

def detect_groups(parents: list[str]):
    for p in parents:
        if p in viable_groups:
            return p

    return None


# 6. Traverse and print detailed info
def walk_tree_vis(node, source_code, depth=0):
    if depth > 32:
        return
    indent = "  " * depth
    parent_types = [node.type]
    parent = node.parent
    while parent is not None:
        parent_types.append(parent.type)
        parent = parent.parent
    is_leaf = len(node.children) == 0
    if is_leaf:
        group = detect_groups(parent_types) or "None"
        parent_types = " -> ".join(reversed(parent_types[:5]))
        print(indent + "==== " + str(depth) + " - " + group)
        # print(
        #     f"{indent}{node.type} [start: {node.start_byte}, end: {node.end_byte}] -> '{source_code[node.start_byte:node.end_byte].decode()}'"
        # )
        print(f"{indent}Parent: {parent_types}")
        print(f"{indent}{node.text}")
        # print(f"{indent}Grammar: {node.grammar_name} {node.grammar_id}")
    for child in node.children:
        walk_tree_vis(child, source_code, depth + 1)


walk_tree_vis(root_node, code)


def extract_tokens(node, source_code):
    tokens = []
    if len(node.children) == 0:
        tokens.append({
            'type': node.type,
            'start_byte': node.start_byte,
            'end_byte': node.end_byte,
            'text': source_code[node.start_byte:node.end_byte].decode()
        })
    else:
        for child in node.children:
            tokens.extend(extract_tokens(child, source_code))
    return tokens

# tokens = extract_tokens(root_node, code)
# for tok in tokens:
#     print(tok)
