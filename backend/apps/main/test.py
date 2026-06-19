from django.test import TestCase
from django.contrib.contenttypes.models import ContentType
from apps.main.models import WireRope, Grommet, FibreSling, SlingConfiguration

# Create your tests here.
class TestSlingModels(TestCase):
    def test_wire_rope_creation(self):
        wire_rope = WireRope.objects.create(
            sling_type = "Wire Rope",
            construction_type="6x36 IWRC",
            material= "steel",
            nominal_diameter= 8, #mm
            tensile_strength= 1770, #MPa
            minimum_breaking_load= 4.113 #Te
        )

        self.assertEqual(WireRope.objects.count(), 1)
        self.assertEqual(wire_rope.tensile_strength, 1770)

    def test_grommet_creation(self):
        grommet = Grommet.objects.create(
            sling_type = "Grommet",
            construction_type= "6x36 IWRC",
            material= "Steel",
            nominal_diameter= 10, #mm
            safety_factor=5,
            working_load_limit=4.5 #Te
        )

        self.assertEqual(Grommet.objects.count(), 1)
        self.assertEqual(grommet.working_load_limit, 4.5)

    def test_fibre_sling_creation(self):
        fibre_sling = FibreSling.objects.create(
            sling_type= "Fibre",
            construction_type="round sling",
            material="HMPE",
            nominal_diameter= 15, #mm
            safety_factor= 7,
            working_load_limit= 8.5 #Te
        )
        self.assertEqual(FibreSling.objects.count(), 1)
        self.assertEqual(fibre_sling.material, "HMPE")

class TestSlingConfiguration(TestCase):
    def test_sling_configuration_creation(self):
        #Step 1: Create a Wire Rope Object
        wire_rope1 = WireRope.objects.create(
            sling_type="Wire Rope",
            construction_type="6x36 IWRC",
            material="steel",
            nominal_diameter=12,  # mm
            tensile_strength=1770,  # MPa
            minimum_breaking_load=8.5,  # Te
        )

        wire_rope2 = WireRope.objects.create(
            sling_type="Wire Rope",
            construction_type="6x36 IWRC",
            material="steel",
            nominal_diameter=16,  # mm
            tensile_strength=1770,  # MPa
            minimum_breaking_load=10,  # Te
        )
        #Step 2: Create a Grommet Object
        grommet = Grommet.objects.create(
            sling_type="Grommet",
            construction_type="6x36 IWRC",
            material="steel",
            nominal_diameter=10,  # mm
            safety_factor=5,
            working_load_limit=4.5,  # Te
        )

        #Step 3: Create a FibreSling Object
        fibre_sling = FibreSling.objects.create(
            sling_type="Fibre Sling",
            construction_type="round sling",
            material="HMPE",
            nominal_diameter=15,  # mm
            safety_factor=7,
            working_load_limit=8.5,  # Te
        )

        #Step 4: Get ContentType instances for each model
        wire_rope_content_type = ContentType.objects.get_for_model(WireRope)
        grommet_content_type = ContentType.objects.get_for_model(Grommet)
        fibre_sling_content_type = ContentType.objects.get_for_model(FibreSling)

        # Step 5: Create multiple SlingConfigurations referencing the Wire Rope 1
        SlingConfiguration.objects.create(
            sling_type=wire_rope_content_type,
            sling_id=wire_rope1.id,
            sling_object=wire_rope1,
            termination="Ferrule",  # Example termination
            eye_type="Soft",
            configuration="vertical",
        )

        SlingConfiguration.objects.create(
            sling_type=wire_rope_content_type,
            sling_id=wire_rope1.id,
            sling_object=wire_rope1,
            termination="hand splice",
            eye_type="Hard",
            configuration="basket",
        )
        SlingConfiguration.objects.create(
            sling_type=wire_rope_content_type,
            sling_id=wire_rope1.id,
            sling_object=wire_rope1,
            termination="ferrule",
            eye_type="hard",
            configuration="vertical",
        )

        #Step 6: Create Sling Configuration objects for Wire Rope 2
        SlingConfiguration.objects.create(
            sling_type=wire_rope_content_type,
            sling_id=wire_rope2.id,
            sling_object=wire_rope2,
            termination="Ferrule",  # Example termination
            eye_type="Soft",
            configuration="vertical",
        )

        SlingConfiguration.objects.create(
            sling_type=wire_rope_content_type,
            sling_id=wire_rope2.id,
            sling_object=wire_rope2,
            termination="hand splice",
            eye_type="Hard",
            configuration="basket",
        )
        SlingConfiguration.objects.create(
            sling_type=wire_rope_content_type,
            sling_id=wire_rope2.id,
            sling_object=wire_rope2,
            termination="ferrule",
            eye_type="hard",
            configuration="vertical",
        )

        #Step 7: Create Sling Configuration for grommet
        SlingConfiguration.objects.create(
            sling_type=grommet_content_type,
            sling_id=grommet.id,
            sling_object=grommet,
            termination="hand splice",
            eye_type= None,
            configuration="basket",
        )

        #Step 8: Create Sling Configuration for Fibre Slings
        SlingConfiguration.objects.create(
            sling_type=fibre_sling_content_type,
            sling_id=fibre_sling.id,
            sling_object=fibre_sling,
            termination="hand splice",
            configuration="choke",
        )


        #Step 9: Assertions for SlingConfiguration counts
        #Assert total of sling records
        self.assertEqual(SlingConfiguration.objects.count(), 8)

        #Assert count of SlingConfiguration for each model
        self.assertEqual(SlingConfiguration.objects.filter(sling_type=wire_rope_content_type).count(), 6)

        self.assertEqual(SlingConfiguration.objects.filter(sling_type=grommet_content_type).count(), 1)

        self.assertEqual(SlingConfiguration.objects.filter(sling_type=fibre_sling_content_type).count(), 1)

        #Ensure SlingConfiguration is attached to the correct sling IDs
        for config in SlingConfiguration.objects.filter(sling_type=wire_rope_content_type):
            self.assertIn(config.sling_id, [wire_rope1.id, wire_rope2.id])

        for config in SlingConfiguration.objects.filter(sling_type=grommet_content_type):
            self.assertEqual(config.sling_id, grommet.id)

        for config in SlingConfiguration.objects.filter(sling_type=fibre_sling_content_type):
            self.assertEqual(config.sling_id, fibre_sling.id)
