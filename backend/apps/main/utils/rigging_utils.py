import csv
from pathlib import Path
from itertools import product
from apps.main.utils import headers
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from apps.main.models import (
Masterlink,
MasterlinkAssembly,
Shackle,
Thimble,
WireRope,
SlingConfiguration
)

from decimal import Decimal


def to_decimal(value, field_name, *, allow_blank=False):
    try:
        raw = str(value).strip()
        if allow_blank and raw == "":
            return None
        normalized = raw.replace(",", "")
        return Decimal(normalized)
    except Exception as e:
        raise ValueError(f"Invalid {field_name}: {value}") from e

def require_headers( filename: str, fieldnames: list[str], required_headers: list[str]):
    missing_headers = set(required_headers) - set(fieldnames)
    if missing_headers:
        raise ValueError(f"Missing required headers in {filename}: {missing_headers}")


def new_report():
    return {
        "created": 0,
        "updated": 0,
        "skipped": 0,
        "errors": 0,
        "row_errors": []
    }

def load_rigging_csvs(commander, data_dir: Path | None = None):
    data_dir = Path(data_dir) if data_dir else settings.RIGGING_DATA_DIR

    if not data_dir.exists():
        commander.stderr.write(f"Directory not found: {data_dir}")
        return

    for csv_path in sorted(data_dir.glob("*.csv")):
        try:
            with csv_path.open(mode="r", encoding="utf-8-sig", newline="") as csv_file:
                reader = csv.DictReader(csv_file)
                dispatch_by_component(commander,csv_path.stem, reader)

        except FileNotFoundError:
            commander.stderr.write(f"File not found: {csv_path}")
        except Exception as e:
            commander.stderr.write(f"Unexpected error: {e}")

def dispatch_by_component(commander, directory_name : str, rows):
    name = directory_name.lower()
    if "masterlink" in name:
        if not "assembly" in name:
            create_masterlinks(commander, rows)
        else:
            create_masterlink_assemblies(commander, rows)
        return

    if "shackle" in name:
        create_shackles(commander, rows)
        return

    if "wire_rope" in name:
        create_wire_ropes(commander, rows)
        return

    if "thimble" in name:
        create_thimbles(commander, rows)
        return
    commander.stdout.write(commander.style.WARNING(f"Skipping {directory_name}: no matching importer."))

def run_import(commander, rows, row_handler, *, max_error_samples=10):
    report = new_report()
    for index, row in enumerate(rows, start=1):
        try:
            action = row_handler(index, row)
            report[action] += 1
        except Exception as e:
            report["errors"] += 1
            if len(report["row_errors"]) < max_error_samples:
                report["row_errors"].append(f"{index}: {e}")
            commander.stderr.write(f"Error processing row {index}: {e}")
    return report


def create_masterlinks(commander, rows):
    def handle_row(index, row):
        manufacturer = row["MANUFACTURER"].strip()
        model = row["MODEL"].strip()

        wll = to_decimal(row["WORKING LOAD LIMIT"], "WORKING LOAD LIMIT")
        weight = to_decimal(row["WEIGHT"], "WEIGHT")
        sf = to_decimal(row["SAFETY FACTOR"], "SAFETY FACTOR")
        dia = to_decimal(row["DIAMETER"], "DIAMETER")
        l_inside = to_decimal(row["LENGTH INSIDE"], "LENGTH INSIDE")
        w_inside = to_decimal(row["WIDTH INSIDE"], "WIDTH INSIDE")

        obj, created = Masterlink.objects.get_or_create(
            manufacturer=manufacturer,
            model=model,
            working_load_limit=wll,
            defaults={  # Fields to set only for a new record
                "weight": weight,
                "safety_factor": sf,
                "diameter": dia,
                "length_inside": l_inside,
                "width_inside": w_inside
            }
        )

        if created:
            return "created"

        changed = False
        updates = {
            "working_load_limit": wll,
            "weight": weight,
            "safety_factor": sf,
            "diameter": dia,
            "length_inside": l_inside,
            "width_inside": w_inside
        }
        for field, value in updates.items():
            if getattr(obj, field) != value:
                setattr(obj, field, value)
                changed = True

        if changed:
            obj.save()

        return "updated" if changed else "skipped"

    require_headers(
        filename="masterlink CSV",
        fieldnames=rows.fieldnames,
        required_headers=headers.REQUIRED_MASTERLINK_HEADERS
    )

    report = run_import(commander, rows, handle_row)
    commander.stdout.write(f"Masterlinks: {report}")
    return report

def create_masterlink_assemblies(commander, rows):
    def handle_row(index, row):
        manufacturer = row["MANUFACTURER"].strip()
        model = row["MODEL"].strip()

        wll = to_decimal(row["WORKING LOAD LIMIT"], "WORKING LOAD LIMIT")
        weight = to_decimal(row["WEIGHT"], "WEIGHT")
        sf = to_decimal(row["SAFETY FACTOR"], "SAFETY FACTOR")
        dia = to_decimal(row["DIAMETER"], "DIAMETER")
        l_inside = to_decimal(row["LENGTH INSIDE"], "LENGTH INSIDE")
        w_inside = to_decimal(row["WIDTH INSIDE"], "WIDTH INSIDE")
        assembly_dia = to_decimal(row["ASSEMBLY DIAMETER"], "ASSEMBLY DIAMETER")
        assembly_l_inside = to_decimal(row["ASSEMBLY LENGTH INSIDE"], "ASSEMBLY LENGTH INSIDE")
        assembly_w_inside = to_decimal(row["ASSEMBLY WIDTH INSIDE"], "ASSEMBLY WIDTH INSIDE")


        obj, created = MasterlinkAssembly.objects.get_or_create(
            manufacturer=manufacturer,
            model=model,
            working_load_limit=wll,
            defaults={  # Fields to set only for a new record
                "weight": weight,
                "safety_factor": sf,
                "diameter": dia,
                "length_inside": l_inside,
                "width_inside": w_inside,
                "assembly_diameter": assembly_dia,
                "assembly_length_inside": assembly_l_inside,
                "assembly_width_inside": assembly_w_inside
            }
        )

        if created:
            return "created"

        changed = False
        updates = {
            "working_load_limit": wll,
            "weight": weight,
            "safety_factor": sf,
            "diameter": dia,
            "length_inside": l_inside,
            "width_inside": w_inside,
            "assembly_diameter": assembly_dia,
            "assembly_length_inside": assembly_l_inside,
            "assembly_width_inside": assembly_w_inside
        }
        for field, value in updates.items():
            if getattr(obj, field) != value:
                setattr(obj, field, value)
                changed = True

        if changed:
            obj.save()

        return "updated" if changed else "skipped"

    require_headers(
        filename="masterlink assembly CSV",
        fieldnames=rows.fieldnames,
        required_headers=headers.REQUIRED_MASTERLINK_ASSEMBLY_HEADERS
    )

    report = run_import(commander, rows, handle_row)
    commander.stdout.write(f"Masterlink Assemblies: {report}")
    return report

def create_shackles(commander, rows):
    def handle_row(index, row):
        manufacturer = row["MANUFACTURER"].strip()
        model = row["MODEL"].strip()
        wll = to_decimal(row["WORKING LOAD LIMIT"], "WORKING LOAD LIMIT")
        weight = to_decimal(row["WEIGHT"], "WEIGHT")
        sf = to_decimal(row["SAFETY FACTOR"], "SAFETY FACTOR")
        i_width = to_decimal(row["INSIDE WIDTH"], "INSIDE WIDTH")
        i_length = to_decimal(row["INSIDE LENGTH"], "INSIDE LENGTH")
        b_width = to_decimal(row["BOW WIDTH"], "BOW WIDTH")
        length = to_decimal(row["LENGTH"], "LENGTH")
        width = to_decimal(row["WIDTH"], "WIDTH")
        b_dia = to_decimal(row["BOW DIAMETER"], "BOW DIAMETER")
        e_dia = to_decimal(row["EYE DIAMETER"], "EYE DIAMETER")
        p_dia = to_decimal(row["PIN DIAMETER"], "PIN DIAMETER")
        bolt_len = to_decimal(row["BOLT LENGTH"], "BOLT LENGTH")
        tol_i_width = to_decimal(
            row["TOLERANCE INSIDE WIDTH"],
            "TOLERANCE INSIDE WIDTH",
            allow_blank=True
        )
        tol_i_length = to_decimal(
            row["TOLERANCE INSIDE LENGTH"],
            "TOLERANCE INSIDE LENGTH",
            allow_blank=True
        )

        obj, created = Shackle.objects.get_or_create(
            manufacturer=manufacturer,
            model=model,
            working_load_limit=wll,
            defaults={
                "weight": weight,
                "safety_factor": sf,
                "inside_width": i_width,
                "inside_length": i_length,
                "bow_width": b_width,
                "length": length,
                "width": width,
                "bow_diameter": b_dia,
                "eye_diameter": e_dia,
                "pin_diameter": p_dia,
                "bolt_length": bolt_len,
                "tolerance_inside_width": tol_i_width,
                "tolerance_inside_length": tol_i_length,
            }
        )

        if created:
            return "created"

        changed = False
        updates = {
            "working_load_limit": wll,
            "weight": weight,
            "safety_factor": sf,
            "inside_width": i_width,
            "inside_length": i_length,
            "bow_width": b_width,
            "length": length,
            "width": width,
            "bow_diameter": b_dia,
            "eye_diameter": e_dia,
            "pin_diameter": p_dia,
            "bolt_length": bolt_len,
            "tolerance_inside_width": tol_i_width,
            "tolerance_inside_length": tol_i_length,
        }

        for field, value in updates.items():
            if getattr(obj, field) != value:
                setattr(obj, field, value)
                changed = True

        if changed:
            obj.save()

        return "updated" if changed else "skipped"

    require_headers(
        filename="shackle CSV",
        fieldnames=rows.fieldnames,
        required_headers=headers.REQUIRED_SHACKLE_HEADERS
    )

    report = run_import(commander, rows, handle_row)
    commander.stdout.write(f"Shackles: {report}")
    return report

def create_wire_ropes(commander, rows):
    configs_created = 0

    def create_sling_configurations(wire_rope, content_type):
        configurations = [config[0] for config in SlingConfiguration.CONFIGURATIONS]
        terminations = [term[0] for term in SlingConfiguration.TERMINATIONS]
        eye_types = [eye[0] for eye in SlingConfiguration.EYE_TYPES]

        created_count = 0
        for config, term, eye in product(configurations, terminations, eye_types):
            sling_config, created = SlingConfiguration.objects.get_or_create(
                content_type=content_type,
                object_id=wire_rope.id,
                configuration=config,
                termination=term,
                eye_type=eye
            )
            if created:
                created_count += 1
        return created_count

    wire_rope_content_type = ContentType.objects.get_for_model(WireRope)

    def handle_row(index, row):
        construction_type = row["CONSTRUCTION TYPE"].strip()
        material = row["MATERIAL"].strip()
        nominal_diameter = to_decimal(row["NOMINAL DIAMETER"], "NOMINAL DIAMETER")
        tensile_strength = to_decimal(row["TENSILE STRENGTH"], "TENSILE STRENGTH")
        minimum_breaking_load = to_decimal(row["MINIMUM BREAKING LOAD"], "MINIMUM BREAKING LOAD")

        obj, created = WireRope.objects.get_or_create(
            construction_type=construction_type,
            material=material,
            nominal_diameter=nominal_diameter,
            defaults={
                "tensile_strength": tensile_strength,
                "minimum_breaking_load": minimum_breaking_load
            }
        )

        if created:
            action = "created"
        else:
            changed = False
            updates = {
                "nominal_diameter": nominal_diameter,
                "tensile_strength": tensile_strength,
                "minimum_breaking_load": minimum_breaking_load
            }
            for field, value in updates.items():
                if getattr(obj, field) != value:
                    setattr(obj, field, value)
                    changed = True

            if changed:
                obj.save()

            action = "updated" if changed else "skipped"

        nonlocal configs_created
        configs_created += create_sling_configurations(obj, wire_rope_content_type)
        return action

    require_headers(
        filename="wire rope CSV",
        fieldnames=rows.fieldnames,
        required_headers=headers.REQUIRED_WIRE_ROPE_HEADERS
    )

    report = run_import(commander, rows, handle_row)
    commander.stdout.write(
        f"Wire Ropes: {report}, sling configurations created: {configs_created}"
    )
    return report

def create_thimbles(commander, rows):
    def handle_row(index, row):
        weight = to_decimal(row["WEIGHT"], "WEIGHT")
        min_wr_dia = to_decimal(row["MIN WIRE ROPE DIAMETER"], "MIN WIRE ROPE DIAMETER")
        max_wr_dia = to_decimal(row["MAX WIRE ROPE DIAMETER"], "MAX WIRE ROPE DIAMETER")
        width_groove = to_decimal(row["WIDTH GROOVE"], "WIDTH GROOVE")
        width_overall = to_decimal(row["WIDTH OVERALL"], "WIDTH OVERALL")
        length = to_decimal(row["LENGTH"], "LENGTH")
        length_inside = to_decimal(row["LENGTH INSIDE"], "LENGTH INSIDE")
        width_inside = to_decimal(row["WIDTH INSIDE"], "WIDTH INSIDE")
        thickness_back = to_decimal(row["THICKNESS BACK"], "THICKNESS BACK")
        width = to_decimal(row["WIDTH"], "WIDTH")

        obj, created = Thimble.objects.get_or_create(
            weight=weight,
            min_wire_rope_diameter=min_wr_dia,
            max_wire_rope_diameter=max_wr_dia,
            width_groove=width_groove,
            width_overall=width_overall,
            length=length,
            length_inside=length_inside,
            width_inside=width_inside,
            thickness_back=thickness_back,
            width=width,
        )

        if created:
            return "created"

        changed = False
        updated = {
            "weight": weight,
            "min_wire_rope_diameter": min_wr_dia,
            "max_wire_rope_diameter": max_wr_dia,
            "width_groove": width_groove,
            "width_overall": width_overall,
            "length": length,
            "length_inside": length_inside,
            "width_inside": width_inside,
            "thickness_back": thickness_back,
            "width": width,
        }

        for field, value in updated.items():
            if getattr(obj, field) != value:
                setattr(obj, field, value)
                changed = True

        if changed:
            obj.save()

        return "updated" if changed else "skipped"

    require_headers(
        filename="thimble CSV",
        fieldnames=rows.fieldnames,
        required_headers=headers.REQUIRED_THIMBLE_HEADERS
    )

    report = run_import(commander, rows, handle_row)
    commander.stdout.write(f"Thimbles: {report}")
    return report



















