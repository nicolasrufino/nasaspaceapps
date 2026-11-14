"""The CAPCOM agent (agent/) must load with no Azure keys and no network.

CI never has Azure / Microsoft Foundry keys. Every module in agent/ is imported
with those variables removed and outbound sockets blocked; reading a key or
calling Azure at import time fails here. Put real calls behind a function that
runs per request, and test replies with the Foundry client mocked.
A module whose third-party package is not installed is skipped, not failed.
"""

import importlib.util
import os
import pathlib
import socket
import sys

import pytest

ROOT = pathlib.Path(__file__).parents[1]
AGENT = ROOT / 'agent'
MODULES = sorted(p for p in AGENT.rglob('*.py') if '.venv' not in p.parts and not p.name.startswith('test_'))
KEY_HINTS = ('AZURE', 'FOUNDRY', 'OPENAI', 'AI_PROJECT', 'CAPCOM')


@pytest.fixture
def offline(monkeypatch):
    for k in list(os.environ):
        if any(h in k.upper() for h in KEY_HINTS):
            monkeypatch.delenv(k)
    real_connect = socket.socket.connect

    def connect(self, addr):
        if isinstance(addr, tuple) and addr[0] not in ('127.0.0.1', '::1', 'localhost'):
            raise OSError(f'network blocked in tests: tried to reach {addr[0]}')
        return real_connect(self, addr)

    monkeypatch.setattr(socket.socket, 'connect', connect)
    monkeypatch.syspath_prepend(str(ROOT))
    monkeypatch.syspath_prepend(str(AGENT))


@pytest.mark.parametrize('path', MODULES or [None], ids=lambda p: str(p.relative_to(ROOT)) if p else 'no-agent-code-yet')
def test_agent_module_imports_without_keys_or_network(path, offline):
    if path is None:
        pytest.skip('agent/ has no Python code yet')
    name = f'agent_offline_{abs(hash(path))}'
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(mod)
    except ModuleNotFoundError as e:
        if e.name and (AGENT / e.name.split('.')[0]).exists():
            raise
        pytest.skip(f'{e.name} not installed (install agent/requirements.txt to run this)')
    finally:
        sys.modules.pop(name, None)
