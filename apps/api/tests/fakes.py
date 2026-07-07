"""A scripted fake of the Anthropic client for exercising the agent loop."""

from dataclasses import dataclass, field
from types import SimpleNamespace


@dataclass
class FakeTextBlock:
    text: str
    type: str = "text"


@dataclass
class FakeToolUseBlock:
    id: str
    name: str
    input: dict
    type: str = "tool_use"


@dataclass
class FakeResponse:
    content: list
    stop_reason: str
    usage: SimpleNamespace = field(
        default_factory=lambda: SimpleNamespace(input_tokens=100, output_tokens=50)
    )


class FakeMessages:
    def __init__(self, responses: list[FakeResponse]):
        self._responses = list(responses)
        self.calls: list[dict] = []

    def create(self, **kwargs) -> FakeResponse:
        self.calls.append(kwargs)
        if not self._responses:
            raise AssertionError("FakeAnthropic ran out of scripted responses")
        return self._responses.pop(0)


class FakeAnthropic:
    """Stands in for anthropic.Anthropic; returns scripted responses in order."""

    def __init__(self, responses: list[FakeResponse]):
        self.messages = FakeMessages(responses)
