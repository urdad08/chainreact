"""
Safe evaluator for WorkflowEdge.condition strings (e.g. "lead_score >= 50",
"priority == 'high'").

These strings are written by the LLM (workflow_generator.py), so they must
NEVER be passed to Python's eval()/exec() directly -- that would let a
compromised or confused model (or a crafted requirement) run arbitrary
code against the backend process. Instead, this parses the condition as
an expression AST and only permits a small allowlist of node types:
comparisons, boolean and/or, literals, and bare names (looked up in the
execution context, nothing else -- no attribute access, no calls, no
subscripting, no imports).
"""
from __future__ import annotations

import ast
from typing import Any, Dict

_ALLOWED_COMPARATORS = (ast.Lt, ast.LtE, ast.Gt, ast.GtE, ast.Eq, ast.NotEq, ast.In, ast.NotIn)


class UnsafeConditionError(ValueError):
    """Raised when a condition string contains anything outside the allowlist."""


def _coerce(value: Any, other: Any) -> Any:
    """Best-effort numeric coercion so "lead_score >= 50" works when
    lead_score arrived as the string "72" (every agent output in this
    system is typed as str -- see runtime/executor.py's OutputModel)."""
    if isinstance(value, str) and isinstance(other, (int, float)):
        try:
            return float(value) if "." in value else int(value)
        except ValueError:
            return value
    return value


def _eval_node(node: ast.AST, context: Dict[str, Any]) -> Any:
    if isinstance(node, ast.Expression):
        return _eval_node(node.body, context)
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.Name):
        return context.get(node.id)
    if isinstance(node, (ast.List, ast.Tuple)):
        return [_eval_node(el, context) for el in node.elts]
    if isinstance(node, ast.BoolOp):
        values = [_eval_node(v, context) for v in node.values]
        return all(values) if isinstance(node.op, ast.And) else any(values)
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
        return not _eval_node(node.operand, context)
    if isinstance(node, ast.Compare):
        left = _eval_node(node.left, context)
        result = True
        for op, comparator_node in zip(node.ops, node.comparators):
            if not isinstance(op, _ALLOWED_COMPARATORS):
                raise UnsafeConditionError(f"Operator {type(op).__name__} is not allowed in a condition.")
            right = _eval_node(comparator_node, context)
            left_c, right_c = _coerce(left, right), _coerce(right, left)
            if isinstance(op, ast.Lt):
                ok = left_c < right_c
            elif isinstance(op, ast.LtE):
                ok = left_c <= right_c
            elif isinstance(op, ast.Gt):
                ok = left_c > right_c
            elif isinstance(op, ast.GtE):
                ok = left_c >= right_c
            elif isinstance(op, ast.Eq):
                ok = left_c == right_c
            elif isinstance(op, ast.NotEq):
                ok = left_c != right_c
            elif isinstance(op, ast.In):
                ok = left_c in right_c
            else:
                ok = left_c not in right_c
            result = result and ok
            left = right
        return result
    raise UnsafeConditionError(f"'{type(node).__name__}' is not allowed in a workflow condition.")


def evaluate_condition(condition: str, context: Dict[str, Any]) -> bool:
    """Returns True/False, or True if the condition can't be parsed/evaluated
    at all (a malformed condition shouldn't silently dead-end an otherwise
    valid workflow -- it gets treated as 'always take this edge' and the
    parse problem is the caller's to log, not to use as a secret kill switch)."""
    try:
        tree = ast.parse(condition, mode="eval")
        return bool(_eval_node(tree, context))
    except (UnsafeConditionError, SyntaxError, TypeError, KeyError):
        return True
