"""
Vercel Serverless Entry Point
Exposes the FastAPI app for Vercel's Python runtime.
"""

import sys
from pathlib import Path

# Ensure project root is in Python path
root = str(Path(__file__).parent.parent)
if root not in sys.path:
    sys.path.insert(0, root)

from server import app  # noqa: F401 — Vercel picks up `app` automatically
