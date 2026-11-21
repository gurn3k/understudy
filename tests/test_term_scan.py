"""The keyed term scan (tools/term_scan.py), on made-up terms and a made-up key."""
import hashlib
import io
import os
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
import term_scan as T  # noqa: E402

TEST_KEY = {T.KEY_VAR: "test-key-not-the-real-one"}
with mock.patch.dict(os.environ, TEST_KEY):
    TERMS = [T.term("zebrafish", "sub"), T.term("qx", "token"), T.term("blue whale", "words")]


@mock.patch.dict(os.environ, TEST_KEY)
class TermScan(unittest.TestCase):
    def test_finds_a_term_inside_a_word_any_case(self):
        self.assertEqual(T.scan_text("fine\nThe ZebraFishes swam", TERMS), [2])

    def test_short_terms_match_whole_words_only(self):
        self.assertEqual(T.scan_text("qxz and aqx\nQX here", TERMS), [2])

    def test_phrases_match_across_spacing_and_case(self):
        self.assertEqual(T.scan_text("a Blue\t whale\nblue, whale\nbluewhale", TERMS), [1, 2])

    def test_clean_text_has_no_hits(self):
        self.assertEqual(T.scan_text("nothing to see\nzebra fish", TERMS), [])

    def test_the_stored_list_loads(self):
        terms = T.load_terms()
        self.assertTrue(terms)
        self.assertTrue(all(len(h) == 64 and m in {"sub", "token", "words"} for h, m, _ in terms))

    def test_hashes_are_keyed_so_a_guess_cannot_be_checked(self):
        self.assertNotEqual(T.sha("zebrafish"), hashlib.sha256(b"zebrafish").hexdigest())
        with mock.patch.dict(os.environ, {T.KEY_VAR: "another-key"}):
            self.assertNotEqual(T.sha("zebrafish"), TERMS[0][0])
        self.assertEqual(T.scan_text("zebrafish", TERMS), [1])


class NoKey(unittest.TestCase):
    def test_scan_stops_with_a_clear_message_without_the_key(self):
        env = {k: v for k, v in os.environ.items() if k != T.KEY_VAR}
        with mock.patch.dict(os.environ, env, clear=True), redirect_stdout(io.StringIO()) as out:
            self.assertEqual(T.main(), 2)
        self.assertIn("UNDERSTUDY_TERM_KEY is not set", out.getvalue())


if __name__ == "__main__":
    unittest.main()
