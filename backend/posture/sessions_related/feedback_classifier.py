from __future__ import annotations


def problem_feedback(feedback: list[str]) -> list[str]:
    return [item for item in feedback if is_problem_feedback(item)]


def is_problem_feedback(item: str) -> bool:
    lower = item.lower()
    non_issue_phrases = (
        "hold still",
        "starting analysis",
        "move into frame",
        "move fully into frame",
        "can't see",
        "no person detected",
        "frame could not be decoded",
        "please get fully into the frame",
        "ready for the next",
        "curl up",
        "squeeze at the top",
        "good",
        "great",
        "nice",
        "excellent",
        "strong",
    )
    if any(phrase in lower for phrase in non_issue_phrases):
        return False

    issue_markers = (
        "don't",
        "do not",
        "avoid",
        "too ",
        "short",
        "stop short",
        "caving",
        "cave",
        "rounding",
        "collapse",
        "lean",
        "shrug",
        "flare",
        "travel forward",
        "elbows pinned",
        "elbows tucked",
        "knees out",
        "knees pushed out",
        "knees outward",
        "deeper",
        "full elbow extension",
        "back straighter",
        "neutral spine",
        "torso upright",
        "chest up",
        "bar close",
        "complete the rep",
    )
    return any(marker in lower for marker in issue_markers)
