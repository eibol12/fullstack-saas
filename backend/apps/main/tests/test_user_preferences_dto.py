from django.test import SimpleTestCase

from apps.main.services.rigging import RiggingDesignService
from domain.rigging.errors import ComponentNotFoundError
from domain.rigging.ports import ComponentRef, Shackle
from domain.rigging.resolve import resolve_user_preferences


class _FakeRepo:
    def __init__(self, component=None):
        self._component = component

    def get_component(self, ref: ComponentRef):
        return self._component


class TestUserPreferencesDTO(SimpleTestCase):
    def test_parse_user_preferences_dto_accepts_type_and_id(self):
        raw = {
            "0": {
                "type": "Shackle",
                "id": "abc",
                "capacity": "12.5",
                "manufacturer": "Crosby",
            }
        }
        parsed = RiggingDesignService._parse_user_preferences_dto(raw)
        self.assertEqual(
            parsed,
            {
                0: {
                    "component_ref": {"type": "Shackle", "id": "abc"},
                    "capacity": 12.5,
                    "manufacturer": "Crosby",
                }
            },
        )

    def test_parse_user_preferences_dto_rejects_component_object(self):
        raw = {"0": {"component": object()}}
        with self.assertRaises(ValueError):
            RiggingDesignService._parse_user_preferences_dto(raw)

    def test_resolve_user_preferences_component_ref(self):
        component = Shackle(
            id="s1",
            manufacturer="Test",
            model="M",
            working_load_limit=10.0,
            safety_factor=5.0,
            inside_width=1.0,
            tolerance_inside_width=0.1,
            bow_width=1.0,
            eye_diameter=1.0,
            bow_diameter=1.0,
            pin_diameter=1.0,
            name="S1",
        )
        repo = _FakeRepo(component=component)
        resolved = resolve_user_preferences(
            {0: {"component_ref": {"type": "Shackle", "id": "s1"}}},
            repo,
        )
        self.assertEqual(resolved[0]["resolved_component"], component)
        self.assertEqual(resolved[0]["component_type"], "Shackle")

    def test_resolve_user_preferences_component_not_found(self):
        repo = _FakeRepo(component=None)
        with self.assertRaises(ComponentNotFoundError):
            resolve_user_preferences(
                {0: {"component_ref": {"type": "Shackle", "id": "missing"}}},
                repo,
            )
