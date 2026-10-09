import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "Backend"))
from research.tau_recovery_matrix import build_cells


class MatrixTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.protocol = json.loads((ROOT / "docs/research/tau-recovery-protocol.json").read_text())

    def full(self):
        p = self.protocol
        return build_cells(p, p["task_ids"], p["seeds"], p["faults"], p["strategies"])

    def test_default_still_has_171_unique_cells(self):
        cells = self.full()
        self.assertEqual(len(cells), 171)
        self.assertEqual(len({tuple(c.values()) for c in cells}), 171)
        self.assertEqual(sum(c["fault"] == "none" for c in cells), 9)

    def test_subset_preserves_full_protocol_order(self):
        subset = build_cells(self.protocol, ["0"], [301, 302], ["empty_read"], ["no_recovery", "selective"], False)
        expected = [c for c in self.full() if c["task"] == "0" and c["seed"] in (301, 302)
                    and c["fault"] == "empty_read" and c["strategy"] in ("no_recovery", "selective")]
        self.assertEqual(subset, expected)
        self.assertEqual(len(subset), 4)

    def test_duplicate_selection_does_not_create_extra_trials(self):
        cells = build_cells(self.protocol, ["0", "0"], [301, 301], ["empty_read", "empty_read"], ["selective", "selective"], False)
        self.assertEqual(len(cells), 1)


if __name__ == "__main__":
    unittest.main()
