import unittest

from understudy.triage import CLR, IR, timing


def ev(act, day, kind="manual"):
    return {"act": act, "ts": f"2018-06-{day:02d}T10:00:00+00:00", "kind": kind}


class Touches(unittest.TestCase):
    def test_counts_only_first_receipt_to_first_clearing(self):
        case = {"id": "x", "events": [
            ev("Create Purchase Order Item", 1), ev("Remove Payment Block", 2),  # before the invoice: not counted
            ev(IR, 3), ev("Remove Payment Block", 4), ev(CLR, 5),             # counted: 2
            ev(IR, 10), ev(CLR, 11), ev("Remove Payment Block", 12),          # later invoice: not counted
        ]}
        t = timing(case)
        self.assertEqual(t["manual_touches"], 2)
        self.assertEqual(t["clear_ts"], "2018-06-05T10:00:00+00:00")

    def test_batch_events_are_not_touches(self):
        case = {"id": "y", "events": [ev(IR, 3), ev(CLR, 5, kind="batch")]}
        self.assertEqual(timing(case)["manual_touches"], 0)


if __name__ == "__main__":
    unittest.main()
