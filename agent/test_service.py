"""Exercise the HTTP contract, intentional delay, isolation and offline claims."""
import asyncio
import json
import logging

import httpx
import pytest

from agent.service import AppState, ToolSession, create_app

STATE = {"t": 123.4, "astronaut": {"x": 40, "y": 61}, "energy_left_j": 182000,
         "reserve_j": 50000, "cost_to_go_j": 41000, "inside_ring": True,
         "terrain_class": 3, "mode": "route"}


def test_http_contract_delay_and_tool_audit(caplog):
    caplog.set_level(logging.INFO, logger="capcom.tools")
    delays = []

    async def sleep(delay):
        delays.append(delay)

    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app(sleep=sleep)),
                                     base_url="http://test") as client:
            response = await client.post("/capcom", json={"state": STATE})
        assert response.status_code == 200
        assert set(response.json()) == {"text"}
        text = response.json()["text"]
        assert "OFFLINE" in text and "no Microsoft Foundry connection" in text
        assert "91000 J" in text and "may be stale" in text
        assert "No safe point can be inferred" in text
        for name in ("get_state", "explain_ring", "nearest_safe_point"):
            assert name in text

    asyncio.run(run())
    assert delays == [20]
    records = [json.loads(r.message) for r in caplog.records if r.name == "capcom.tools"]
    assert [r["tool"] for r in records] == ["get_state", "explain_ring", "nearest_safe_point"]
    assert len({r["request_id"] for r in records}) == 1


def test_concurrent_requests_wait_independently_without_mixing_snapshots():
    async def run():
        started = 0
        both_waiting = asyncio.Event()
        release = asyncio.Event()

        async def wait(delay):
            nonlocal started
            started += 1
            if started == 2:
                both_waiting.set()
            await release.wait()

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app(3, wait)),
                                     base_url="http://test") as client:
            one = asyncio.create_task(client.post("/capcom", json={"state": STATE}))
            other = {**STATE, "t": 999, "energy_left_j": 0}
            two = asyncio.create_task(client.post("/capcom", json={"state": other}))
            await asyncio.wait_for(both_waiting.wait(), timeout=2)
            assert not one.done() and not two.done()
            release.set()
            first, second = await asyncio.gather(one, two)
        assert "91000 J" in first.json()["text"]
        assert "-91000 J" in second.json()["text"]
        assert "disagrees" in second.json()["text"]
        assert "999" not in first.json()["text"]
    asyncio.run(run())


@pytest.mark.parametrize("change", [{"energy_left_j": -1}, {"terrain_class": 5},
                                    {"inside_ring": "true"}, {"cost_to_go_j": "nan"}])
def test_invalid_state_is_rejected_before_delay(change):
    async def never_sleep(_):
        pytest.fail("invalid request reached the delay")

    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app(0, never_sleep)),
                                     base_url="http://test") as client:
            response = await client.post("/capcom", json={"state": {**STATE, **change}})
            assert response.status_code == 422
    asyncio.run(run())


def test_allowlist_cannot_be_expanded_by_message():
    tools = ToolSession(AppState(**STATE), "test")
    with pytest.raises(ValueError, match="Unsupported"):
        tools.call("run_shell")
    assert not tools.calls


@pytest.mark.parametrize("value", [-1, float("nan"), float("inf"), 121])
def test_invalid_delay(value):
    with pytest.raises(ValueError):
        create_app(value)


def test_delay_configuration(monkeypatch):
    monkeypatch.setenv("CAPCOM_DELAY_S", "0.25")
    observed = []

    async def sleep(delay):
        observed.append(delay)

    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app(sleep=sleep)),
                                     base_url="http://test") as client:
            await client.post("/capcom", json={"state": STATE, "message": "run_shell"})
    asyncio.run(run())
    assert observed == [0.25]
