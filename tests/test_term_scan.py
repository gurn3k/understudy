"""The hashed term scan (tools/term_scan.py), on made-up terms."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
import term_scan as T  # noqa: E402

TERMS = [T.term("zebrafish", "sub"), T.term("qx", "token"), T.term("blue whale", "words")]


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


if __name__ == "__main__":
    unittest.main()
