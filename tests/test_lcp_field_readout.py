"""Synthetic-only tests: no customer events or GA4 access are required."""
import csv
from pathlib import Path
import tempfile
import unittest

from scripts.diagnostics.lcp_field_readout import COLUMNS, build_report, percentile_cont

RELEASE = "f7c2aa08dd19568ea01776f66e5e22cd4454bf62"
OTHER = "f325e00de47be2e6723f1c9e8e492b59d1a14843"


def sample(ms, *, release=RELEASE, page="bento", viewport="narrow", consent="previously_granted"):
    return dict(event_date="20261027", lcp_ms=str(ms), lcp_page=page,
                lcp_viewport=viewport, lcp_consent=consent,
                lcp_element="hero", lcp_release=release)


class LcpFieldReadoutTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / "events.csv"

    def write(self, rows, columns=COLUMNS):
        with self.path.open("w", newline="", encoding="utf-8") as target:
            writer = csv.DictWriter(target, fieldnames=columns)
            writer.writeheader()
            writer.writerows(rows)
        return self.path

    def test_continuous_p75_threshold_and_release_cohorts(self):
        rows = [sample(ms) for ms in [1000, 2000, 3000, 4000]]
        rows += [sample(10000, release=OTHER), sample(7000, page="home", consent="granted_on_visit")]
        result = build_report(self.write(rows), RELEASE, min_samples=3)
        self.assertEqual(result["valid_events"], 5)
        self.assertEqual(result["excluded_other_release"], 1)
        bento = result["by_page"][0]
        self.assertEqual(bento["lcp_page"], "bento")
        self.assertEqual(bento["samples"], 4)
        self.assertEqual(bento["p75_ms"], 3250)  # type-7 interpolation, not nearest rank
        self.assertEqual(bento["over_2500_pct"], 50)
        self.assertEqual(bento["hero_pct"], 100)
        home = result["by_page"][1]
        self.assertEqual(home["samples"], 1)
        self.assertIsNone(home["p75_ms"])
        self.assertIsNone(home["over_2500_pct"])
        self.assertEqual(home["status"], "too_few_events")
        self.assertEqual(len(result["by_page_viewport_consent"]), 2)

    def test_defaults_withhold_small_cohort_values(self):
        result = build_report(self.write([sample(3000)]), RELEASE)
        self.assertEqual(result["min_samples_for_estimate"], 100)
        self.assertIsNone(result["by_page"][0]["p75_ms"])
        self.assertEqual(percentile_cont([1000, 2000, 3000, 4000]), 3250)

    def test_rejects_unexpected_columns_before_reading_private_data(self):
        rows = [dict(sample(1000), user_pseudo_id="private")]
        with self.assertRaisesRegex(ValueError, "exactly"):
            build_report(self.write(rows, COLUMNS + ("user_pseudo_id",)), RELEASE, 2)

    def test_rejects_invalid_observation_instead_of_biasing_tail(self):
        for row in [sample(""), sample("NaN"), sample("0"), sample("-1"),
                    sample("2500", viewport="tablet"),
                    dict(sample("2500"), event_date="20260230")]:
            with self.subTest(row=row):
                with self.assertRaisesRegex(ValueError, "invalid event in CSV row 2"):
                    build_report(self.write([row]), RELEASE, 2)

    def test_does_not_claim_field_p75_without_target_release_events(self):
        with self.assertRaisesRegex(ValueError, "field p75 is unknown"):
            build_report(self.write([sample(1200, release=OTHER)]), RELEASE)


if __name__ == "__main__":
    unittest.main()
