from typing import Optional, Sequence

from django.contrib.contenttypes.models import ContentType

from apps.main.models import (
Masterlink as DjangoMasterlinkModel,
MasterlinkAssembly as DjangoMasterlinkAssemblyModel,
Shackle as DjangoShackleModel,
SlingConfiguration as DjangoSlingConfigurationModel,
Thimble as DjangoThimbleModel,
WireRope as DjangoWireRopeModel
)

from domain.rigging.ports import (
ComponentRef,
Id,
Masterlink as DomainMasterlink,
MasterlinkAssembly as DomainMasterlinkAssembly,
RiggingRepository,
RiggingComponent,
Shackle as DomainShackle,
SlingConfiguration as DomainSlingConfiguration,
Thimble as DomainThimble,
WireRope as DomainWireRope
)

class DjangoRiggingRepository(RiggingRepository):
    def to_domain(self, obj):
        if isinstance(obj, DjangoMasterlinkModel):
            return self._masterlink_to_data(obj)
        if isinstance(obj, DjangoMasterlinkAssemblyModel):
            return self._masterlink_assembly_to_data(obj)
        if isinstance(obj, DjangoShackleModel):
            return self._shackle_to_data(obj)
        if isinstance(obj, DjangoWireRopeModel):
            return self._wire_rope_to_data(obj)
        if isinstance(obj, DjangoSlingConfigurationModel):
            return self._sling_configuration_to_data(obj)
        if isinstance(obj, DjangoThimbleModel):
            return self._thimble_to_data(obj)
        return None

    def _masterlink_to_data(self, object: DjangoMasterlinkModel)-> DomainMasterlink:
        return DomainMasterlink(
            id = object.id,
            manufacturer = getattr(object, 'manufacturer', None),
            model = getattr(object, 'model', None),
            working_load_limit = float(object.working_load_limit),
            safety_factor = float(object.safety_factor),
            diameter = float(object.diameter),
            width_inside = float(object.width_inside),
            name = getattr(object, 'name', None)
        )

    def _masterlink_assembly_to_data(self, object: DjangoMasterlinkAssemblyModel)-> DomainMasterlinkAssembly:
        return DomainMasterlinkAssembly(
            id = object.id,
            manufacturer = getattr(object, 'manufacturer', None),
            model = getattr(object, 'model', None),
            working_load_limit = float(object.working_load_limit),
            safety_factor = float(object.safety_factor),
            assembly_diameter = float(object.assembly_diameter),
            assembly_width_inside = float(object.assembly_width_inside),
            name = getattr(object, 'name', None)
        )

    def _shackle_to_data(self, object: DjangoShackleModel)-> DomainShackle:
        return DomainShackle(
            id = object.id,
            manufacturer = getattr(object, 'manufacturer', None),
            model = getattr(object, 'model', None),
            working_load_limit = float(object.working_load_limit),
            safety_factor = float(object.safety_factor),
            inside_width = float(object.inside_width),
            tolerance_inside_width = float(object.tolerance_inside_width),
            bow_width = float(object.bow_width),
            eye_diameter = float(object.eye_diameter),
            bow_diameter = float(object.bow_diameter),
            pin_diameter = float(object.pin_diameter),
            name = getattr(object, 'name', None)
        )

    def _wire_rope_to_data(self, object: DjangoWireRopeModel)-> DomainWireRope:
        return DomainWireRope(
            id = object.id,
            minimum_breaking_load = float(object.minimum_breaking_load),
            nominal_diameter = float(object.nominal_diameter),
            material = getattr(object, 'material', None),
            name = getattr(object, 'name', None)
        )

    def _sling_configuration_to_data(self, object: DjangoSlingConfigurationModel)-> DomainSlingConfiguration:
        return DomainSlingConfiguration(
            id = object.id,
            configuration = getattr(object, 'configuration', None),
            termination = getattr(object, 'termination', None),
            eye_type = getattr(object, 'eye_type', None)
        )

    def _thimble_to_data(self, object: DjangoThimbleModel) -> DomainThimble:
        return DomainThimble(
            id = object.id,
            min_wire_rope_diameter = float(object.min_wire_rope_diameter),
            max_wire_rope_diameter = float(object.max_wire_rope_diameter),
            thickness_back = float(object.thickness_back),
            length_inside = float(object.length_inside),
            width_inside = float(object.width_inside)
        )

    def list_masterlinks(
            self,
            manufacturer: Optional[str] = None,
            model: Optional[str] = None,
    )-> Sequence[DomainMasterlink]:
        qs = DjangoMasterlinkModel.objects.order_by("working_load_limit")
        if manufacturer: qs = qs.filter(manufacturer=manufacturer)
        if model: qs = qs.filter(model=model)
        return [self._masterlink_to_data(object) for object in qs]

    def list_masterlink_assemblies(
            self,
            manufacturer: Optional[str] = None,
            model: Optional[str] = None,
    )-> Sequence[DomainMasterlinkAssembly]:
        qs = DjangoMasterlinkAssemblyModel.objects.order_by("working_load_limit")
        if manufacturer: qs = qs.filter(manufacturer=manufacturer)
        if model: qs = qs.filter(model=model)
        return [self._masterlink_assembly_to_data(object) for object in qs]

    def list_shackles(
            self,
            manufacturer: Optional[str] = None,
            model: Optional[str] = None,
    )-> Sequence[DomainShackle]:
        qs = DjangoShackleModel.objects.order_by("working_load_limit")
        if manufacturer: qs = qs.filter(manufacturer=manufacturer)
        if model: qs = qs.filter(model=model)
        return [self._shackle_to_data(object) for object in qs]

    def list_wire_ropes(self) -> Sequence[DomainWireRope]:
        qs = DjangoWireRopeModel.objects.order_by("minimum_breaking_load")
        return [self._wire_rope_to_data(object) for object in qs]

    def get_sling_configuration_for_wire_rope(
            self,
            wire_rope_id: int,
            configuration: str,
            termination: str,
            eye_type: str,
    ) -> Optional[DomainSlingConfiguration]:
        content_type = ContentType.objects.get_for_model(DjangoWireRopeModel)
        object = DjangoSlingConfigurationModel.objects.filter(
            content_type=content_type,
            object_id=wire_rope_id,
            configuration=configuration,
            termination=termination,
            eye_type=eye_type,
        ).first()
        return self._sling_configuration_to_data(object) if object else None

    def list_thimbles_for_diameter(
            self,
            diameter: float,
    )-> Sequence[DomainThimble]:
        if hasattr(DjangoThimbleModel.objects, "for_diameter"):
            qs = DjangoThimbleModel.objects.for_diameter(diameter = diameter).order_by("min_wire_rope_diameter")
        else:
            qs = DjangoThimbleModel.objects.filter(
                min_wire_rope_diameter__lte=diameter,
                max_wire_rope_diameter__gte=diameter,
            ).order_by("min_wire_rope_diameter")
        return [self._thimble_to_data(object) for object in qs]

    def list_thimbles(self) -> Sequence[DomainThimble]:
        qs = DjangoThimbleModel.objects.order_by("min_wire_rope_diameter")
        return [self._thimble_to_data(object) for object in qs]

    def get_shackle(self, id: Id) -> Optional[DomainShackle]:
        obj = DjangoShackleModel.objects.filter(id=id).first()
        return self._shackle_to_data(obj) if obj else None

    def get_masterlink(self, id: Id) -> Optional[DomainMasterlink]:
        obj = DjangoMasterlinkModel.objects.filter(id=id).first()
        return self._masterlink_to_data(obj) if obj else None

    def get_masterlink_assembly(self, id: Id) -> Optional[DomainMasterlinkAssembly]:
        obj = DjangoMasterlinkAssemblyModel.objects.filter(id=id).first()
        return self._masterlink_assembly_to_data(obj) if obj else None

    def get_wire_rope(self, id: Id) -> Optional[DomainWireRope]:
        obj = DjangoWireRopeModel.objects.filter(id=id).first()
        return self._wire_rope_to_data(obj) if obj else None

    def get_component(self, ref: ComponentRef) -> Optional[RiggingComponent]:
        if ref.type == "Shackle":
            return self.get_shackle(ref.id)
        if ref.type == "Masterlink":
            return self.get_masterlink(ref.id)
        if ref.type == "MasterlinkAssembly":
            return self.get_masterlink_assembly(ref.id)
        if ref.type == "WireRope":
            return self.get_wire_rope(ref.id)
        return None


