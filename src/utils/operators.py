OPERATORS = {
    "arith": ["+", "-", "*", "/", "//", "%", "**"],
    "comp": ["==", "!=", ">", "<", ">=", "<="],
    "assign": [
        "=",
        "+=",
        "-=",
        "*=",
        "/=",
        "//=",
        "%=",
        "**=",
        "&=",
        "|=",
        "^=",
        ">>=",
        "<<=",
        ":=",
    ],
    "logic": ["and", "or", "not"],
    "bit": ["&", "|", "^", "~", "<<", ">>"],
    "member": ["in", "not in"],
    "identity": ["is", "is not"],
}


def detect_operator_type(operator: str) -> str | None:
    """
    Detects the type of the given operator.

    Args:
        operator (str): The operator to be checked.

    Returns:
        str: The type of the operator, or 'unknown' if not found.
    """
    for op_type, ops in OPERATORS.items():
        if operator in ops:
            return op_type
    return None


def detect_delimiters(string: str) -> str | None:
    """
    Detects the type of delimiters used in the string.

    Args:
        string (str): The string to be checked for delimiters.

    Returns:
        str: The type of delimiter ('single_quote', 'double_quote', 'triple_quote', 'none') or None if no delimiter is found.
    """
    if string in ["[", "]", "{", "}", "(", ")"]:
        return "bracket"
    if string in ["'", '"', '"""', "'''"]:
        return "quote"
    if string in [".", ",", ":", ";"]:
        return "punctuation"

