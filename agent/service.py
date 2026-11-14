"""Delayed offline CAPCOM contract implementation; no Foundry calls are claimed."""
import asyncio
import json
import logging
import math
import os
import uuid

from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict, Field

LOG = logging.getLogger("capcom.tools")


class Position(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    x: float = Field(ge=0)
    y: float = Field(ge=0)


class AppState(BaseModel):
    # Additional future app fields are ignored, never treated as tool instructions.
    model_config = ConfigDict(allow_inf_nan=False)
    t: float = Field(ge=0)
    astronaut: Position
    buddy: Position | None = None  # current appState() does not include a buddy yet.
    energy_left_j: float = Field(ge=0)
    reserve_j: float = Field(ge=0)
    cost_to_go_j: float = Field(ge=0)
    inside_ring: bool = Field(strict=True)
    terrain_class: int = Field(ge=0, le=4, strict=True)
    mode: str = Field(min_length=1, max_length=40)


class CapcomRequest(BaseModel):
    state: AppState
    message: str = Field(default="", max_length=2000)


class CapcomReply(BaseModel):
    text: str


def explain_ring(state):
    margin = state.energy_left_j - state.reserve_j - state.cost_to_go_j
    return {"margin_j": margin, "inside_ring": margin >= 0,
            "reported_state_consistent": state.inside_ring == (margin >= 0),
            "snapshot_t": state.t}


def nearest_safe_point(state):
    # The request has no world identity, grid, traversability or scouted coverage.
    # Do not silently select a cell from a different local/synthetic world.
    return {"available": False,
            "reason": "The supplied snapshot has no world grid or verified route. No safe point can be inferred.",
            "snapshot_t": state.t}


class ToolSession:
    """Request-local allowlist; no eval, network, file access or model-selected code."""
    def __init__(self, state, request_id):
        self.state = state
        self.request_id = request_id
        self.calls = []

    def call(self, name):
        functions = {
            "get_state": lambda: self.state.model_dump(exclude_none=True),
            "explain_ring": lambda: explain_ring(self.state),
            "nearest_safe_point": lambda: nearest_safe_point(self.state),
        }
        if name not in functions:
            raise ValueError("Unsupported CAPCOM tool")
        result = functions[name]()
        record = {"request_id": self.request_id, "tool": name, "result": result}
        self.calls.append(record)
        LOG.info(json.dumps(record, allow_nan=False))
        return result


def offline_reply(tools):
    state = tools.call("get_state")
    ring = tools.call("explain_ring")
    point = tools.call("nearest_safe_point")
    status = "within" if ring["inside_ring"] else "outside"
    consistency = "" if ring["reported_state_consistent"] else " The reported inside_ring flag disagrees with the energy values."
    trace = "; ".join(f"{call['tool']}: {json.dumps(call['result'], allow_nan=False)}"
                      for call in tools.calls)
    return (
        f"[OFFLINE CAPCOM DEMO — no Microsoft Foundry connection] "
        f"Delayed snapshot at t={state['t']:g}s: {status} the modeled return ring, "
        f"margin after reserve {ring['margin_j']:.0f} J.{consistency} "
        "This snapshot may be stale; use the current onboard display for decisions. "
        f"{point['reason']}\nTools: {trace}"
    )


def create_app(delay_s=None, sleep=asyncio.sleep):
    if delay_s is None:
        delay_s = float(os.environ.get("CAPCOM_DELAY_S", "20"))
    if not math.isfinite(delay_s) or not 0 <= delay_s <= 120:
        raise ValueError("CAPCOM_DELAY_S must be finite and between 0 and 120 seconds")
    app = FastAPI(title="Martian Map offline CAPCOM")

    @app.post("/capcom", response_model=CapcomReply)
    async def capcom(request: CapcomRequest):
        # Each request owns its immutable input snapshot and log; concurrent walks do not mix.
        tools = ToolSession(request.state.model_copy(deep=True), uuid.uuid4().hex)
        text = offline_reply(tools)
        await sleep(delay_s)  # asynchronous: other requests and the app keep running.
        return CapcomReply(text=text)

    return app
