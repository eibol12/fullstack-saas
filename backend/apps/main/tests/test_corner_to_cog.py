"""Unit tests for the corner-reference → COG-relative geometry converter.

Asserts that legacy L/h/B fixtures fed through the converter produce the
same engine `configuration`, and ultimately the same `RiggingAnalysisResults`,
when expressed as corner-reference coordinates.
"""
from __future__ import annotations

from django.test import SimpleTestCase

from domain.geometry.corner_to_cog import convert_corner_coords_to_cog_config
from domain.standards.dnv import DNVLiftingOperations
from domain.utils.exceptions import DomainValidationError


class TestCornerToCogConverter(SimpleTestCase):
    """Pure-function tests; no DB required."""

    def test_two_point_round_trip_matches_legacy_config(self):
        # Legacy fixture (COG-relative)
        legacy = {
            "lifting_points_qty": 2,
            "L1": 3.0,
            "L2": 3.0,
            "h1": 1.5,
            "h2": 1.5,
        }
        # Equivalent corner-reference payload: COG at the centre of a 6x2x4
        # skid, lifting points at the two short ends, 1.5m above COG.
        geometry_input = {
            "skid": {"length": 6.0, "width": 2.0, "height": 4.0},
            "cog": {"x": 3.0, "y": 1.0, "z": 1.0},
            "points": [
                {"x": 0.0, "y": 1.0, "z": 2.5},  # left  → L1=3, B1=0, h1=1.5
                {"x": 6.0, "y": 1.0, "z": 2.5},  # right → L2=3, B2=0, h2=1.5
            ],
        }

        derived = convert_corner_coords_to_cog_config(geometry_input)

        self.assertEqual(derived["lifting_points_qty"], 2)
        self.assertAlmostEqual(derived["L1"], legacy["L1"])
        self.assertAlmostEqual(derived["L2"], legacy["L2"])
        self.assertAlmostEqual(derived["h1"], legacy["h1"])
        self.assertAlmostEqual(derived["h2"], legacy["h2"])
        self.assertAlmostEqual(derived["B1"], 0.0)
        self.assertAlmostEqual(derived["B2"], 0.0)
        # The raw payload must be round-tripped for UI rehydration.
        self.assertIn("geometry_input", derived)
        self.assertEqual(derived["geometry_input"]["skid"]["length"], 6.0)

    def test_four_point_round_trip_matches_legacy_config(self):
        legacy = {
            "lifting_points_qty": 4,
            "L1": 2.0, "L2": 2.0, "L3": 2.0, "L4": 2.0,
            "B1": 1.0, "B2": 1.0, "B3": 1.0, "B4": 1.0,
            "h1": 0.5, "h2": 0.5, "h3": 0.5, "h4": 0.5,
        }
        # 4x2x3 skid; COG at centre; four corner lifting points 0.5m above COG.
        geometry_input = {
            "skid": {"length": 4.0, "width": 2.0, "height": 3.0},
            "cog": {"x": 2.0, "y": 1.0, "z": 1.5},
            "points": [
                {"x": 0.0, "y": 0.0, "z": 2.0},  # front-left
                {"x": 4.0, "y": 0.0, "z": 2.0},  # front-right
                {"x": 4.0, "y": 2.0, "z": 2.0},  # back-right
                {"x": 0.0, "y": 2.0, "z": 2.0},  # back-left
            ],
        }

        derived = convert_corner_coords_to_cog_config(geometry_input)

        self.assertEqual(derived["lifting_points_qty"], 4)
        for k, expected in legacy.items():
            if k == "lifting_points_qty":
                continue
            self.assertAlmostEqual(derived[k], expected, msg=f"mismatch on {k}")

    def test_engine_results_identical_for_corner_payload(self):
        """Engine output must be unchanged whether the L/h/B config comes from
        a legacy fixture or from the corner-reference converter."""
        legacy_config = {
            "lifting_points_qty": 4,
            "h_max": 5.0,
            "L1": 2.0, "L2": 2.0, "L3": 2.0, "L4": 2.0,
            "B1": 1.0, "B2": 1.0, "B3": 1.0, "B4": 1.0,
            "h1": 0.5, "h2": 0.5, "h3": 0.5, "h4": 0.5,
        }
        geometry_input = {
            "skid": {"length": 4.0, "width": 2.0, "height": 3.0},
            "cog": {"x": 2.0, "y": 1.0, "z": 1.5},
            "points": [
                {"x": 0.0, "y": 0.0, "z": 2.0},
                {"x": 4.0, "y": 0.0, "z": 2.0},
                {"x": 4.0, "y": 2.0, "z": 2.0},
                {"x": 0.0, "y": 2.0, "z": 2.0},
            ],
        }
        derived = convert_corner_coords_to_cog_config(geometry_input)
        derived["h_max"] = legacy_config["h_max"]  # carried over by serializer

        kwargs = dict(maximum_gross_weight=5.0, location="onshore")

        legacy_engine = DNVLiftingOperations(configuration=legacy_config, **kwargs)
        legacy_engine.analyze()
        legacy_out = legacy_engine.to_dict()

        # Strip our round-trip key before handing to the engine
        derived_for_engine = {k: v for k, v in derived.items() if k != "geometry_input"}
        derived_engine = DNVLiftingOperations(configuration=derived_for_engine, **kwargs)
        derived_engine.analyze()
        derived_out = derived_engine.to_dict()

        self.assertEqual(
            legacy_out.get("static_results"), derived_out.get("static_results")
        )
        self.assertEqual(
            legacy_out.get("dynamic_results"), derived_out.get("dynamic_results")
        )

    # --- Validation ------------------------------------------------------

    def test_rejects_missing_skid(self):
        with self.assertRaises(DomainValidationError):
            convert_corner_coords_to_cog_config({
                "cog": {"x": 0, "y": 0, "z": 0},
                "points": [{"x": 0, "y": 0, "z": 0}],
            })

    def test_rejects_invalid_point_count(self):
        with self.assertRaises(DomainValidationError):
            convert_corner_coords_to_cog_config({
                "skid": {"length": 1, "width": 1, "height": 1},
                "cog": {"x": 0.5, "y": 0.5, "z": 0.5},
                "points": [{"x": 0, "y": 0, "z": 1}] * 5,  # 5 LPs not allowed
            })

    def test_rejects_point_outside_skid(self):
        with self.assertRaises(DomainValidationError):
            convert_corner_coords_to_cog_config({
                "skid": {"length": 1, "width": 1, "height": 1},
                "cog": {"x": 0.5, "y": 0.5, "z": 0.5},
                "points": [{"x": 99.0, "y": 0.5, "z": 1.0}],
            })

    def test_rejects_non_numeric_coordinate(self):
        with self.assertRaises(DomainValidationError):
            convert_corner_coords_to_cog_config({
                "skid": {"length": 1, "width": 1, "height": 1},
                "cog": {"x": "not-a-number", "y": 0.5, "z": 0.5},
                "points": [{"x": 0.0, "y": 0.5, "z": 1.0}],
            })
