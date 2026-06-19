import numpy as np

def get_perpendicular_point(x1, y1, z1, x2, y2, z2, d=0.1):
    """
    Computes a point perpendicular to the mid-point of a 3D vector (sling) to position a label.

    Args:
        x1, y1, z1: Coordinates of the first point of the sling.
        x2, y2, z2: Coordinates of the second point of the sling.
        d: Distance to move the label along the perpendicular direction.

    Returns:
        (x_new, y_new, z_new): New label position
    """
    # Step 1: Compute midpoint
    mx, my, mz = (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2

    # Step 2: Compute direction vector of the sling
    vx, vy, vz = x2 - x1, y2 - y1, z2 - z1

    # Step 3: Compute a perpendicular vector (choosing an arbitrary perpendicular)
    if abs(vx) > abs(vz):  # Avoid zero division
        px, py, pz = -vy, vx, 0  # (Option 1)
    else:
        px, py, pz = 0, -vz, vy  # (Option 2)

    # Step 4: Normalize the perpendicular vector
    norm = np.sqrt(px**2 + py**2 + pz**2)
    if norm == 0:  # Edge case: if sling is aligned with an axis
        px, py, pz = 1, 0, 0  # Default perpendicular direction
        norm = 1
    px, py, pz = px / norm, py / norm, pz / norm  # Unit vector

    # Step 5: Compute new label position
    x_new, y_new, z_new = mx + d * px, my + d * py, mz + d * pz

    return x_new, y_new, z_new

def safe_to_convert_to_float(value):
    return float(value) if value else None