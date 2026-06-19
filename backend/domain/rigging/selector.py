"""Public stub of the rigging component selectors.

The catalogue-filtering and candidate-ranking logic that powered component
selection (the project's intellectual property) has been removed from the
public version. The class names below are retained as inert placeholders so the
package imports cleanly; they are not used by the stubbed design engine.

See ``domain/STUB_NOTICE.md`` for details.
"""

import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class RiggingComponentSelector:
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        pass

    def select(self, *args: Any, **kwargs: Any) -> List[Dict[str, Any]]:
        return []


class MasterlinkSelector(RiggingComponentSelector):
    pass


class MasterlinkAssemblySelector(RiggingComponentSelector):
    pass


class ShackleSelector(RiggingComponentSelector):
    pass


class WireRopeSelector(RiggingComponentSelector):
    pass


class RiggingSelector:
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        pass

    def select_initial_components(self, *args: Any, **kwargs: Any) -> Dict[int, List[Any]]:
        return {}
