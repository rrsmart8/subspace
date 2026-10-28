import sys
from pathlib import Path

# Make the market_mcp package importable without installing the project.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
