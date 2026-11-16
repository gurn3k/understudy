"""Hostile or malformed input is treated as bad input, never as a crash."""
import tempfile
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

from understudy import contender_b as B
from understudy import contender_c as C
from understudy.claude_call import Caller, extract_json
from understudy.parse import _value, resource_kind, to_utc


class ModelReplies(unittest.TestCase):
    def test_unparseable_numbers_and_nesting_are_no_answer(self):
        self.assertIsNone(extract_json('{"n": ' + "9" * 5000 + "}"))
        self.assertIsNone(extract_json("{" + '"a":[' * 200000 + "1" + "]" * 200000 + "}"))
        self.assertIsNone(extract_json('{"n": NaN}'))
        self.assertIsNone(extract_json('{"n": Infinity}'))

    def test_b_non_string_id_or_decision_fails_closed(self):
        out, issues = B.gate(["x1"], {"decisions": [{"id": ["x1"], "decision": "straight_through"}]})
        self.assertEqual(out, {"x1": False})
        out, issues = B.gate(["x1"], {"decisions": [{"id": "x1", "decision": {"a": 1}}]})
        self.assertEqual(out, {"x1": False})
        self.assertTrue(issues)

    def test_c_non_string_field_or_op_is_invalid(self):
        for cond in ({"field": ["vendor"], "op": "eq", "value": "v"}, {"field": "vendor", "op": ["eq"], "value": "v"}):
            policy = {"default": "leave_to_person", "rules": [{"if": [cond], "then": "straight_through"}]}
            self.assertTrue(any("must be strings" in e for e in C.validate(policy)))

    def test_cache_key_cannot_leave_the_store(self):
        with tempfile.TemporaryDirectory() as d:
            c = Caller("replay", d, "sys")
            for key in ("../evil", "a/b", "a" + chr(92) + "b", "C:x", ".hidden", ""):
                with self.assertRaises(ValueError):
                    c.path(key)


class LogValues(unittest.TestCase):
    def test_bad_timestamps_are_unreadable_not_fatal(self):
        for v in (None, 3.5, "abc", "2018-13-45T00:00:00", "0001-01-01T00:00:00+23:59"):
            self.assertIsNone(to_utc(v))

    def test_bad_float_and_non_string_user(self):
        self.assertIsNone(_value(ET.fromstring('<float key="x" value="abc"/>')))
        self.assertIsNone(_value(ET.fromstring('<float key="x"/>')))
        self.assertEqual(resource_kind(True), "unclassified")


if __name__ == "__main__":
    unittest.main()


class LimitMessageIsNotAnAnswer(unittest.TestCase):
    """A usage-limit or error reply from the CLI must stop the run and never be saved as an answer."""

    def test_error_reply_stops_and_saves_nothing(self):
        import tempfile
        from unittest import mock
        from understudy.claude_call import Caller, StopRun
        with tempfile.TemporaryDirectory() as d:
            c = Caller("live", Path(d), "sys", max_live_calls=1, workdir=d)
            fake = mock.Mock(stdout='{"is_error": true, "subtype": "success", "result": "Usage limit reached"}', stderr="", returncode=1)
            with mock.patch("understudy.claude_call.subprocess.run", return_value=fake):
                with self.assertRaises(StopRun):
                    c.ask("k1", "prompt")
            self.assertEqual(list(Path(d).iterdir()), [])
