import pytest
import numpy as np
from domain.geometry.node import Node3D

# ==============================================================================
# 1. HAPPY PATHS
# ==============================================================================

def test_node3d_initialization_happy_path():
    """
    Description: Verify Node3D initialization with standard coordinates (x, y, z).
    Pillar: Happy Path
    """
    # 1. ARRANGE
    x, y, z = 1.5, -2.0, 3.75

    # 2. ACT
    node = Node3D(x, y, z)

    # 3. ASSERT
    assert node.x == x
    assert node.y == y
    assert node.z == z
    assert isinstance(node.x, float)
    assert isinstance(node.y, float)
    assert isinstance(node.z, float)
    assert len(node) == 3
    assert repr(node) == "Node3D(x=1.5, y=-2.0, z=3.75)"
    assert str(node) == "(1.5, -2.0, 3.75)"


def test_node3d_coordinate_update_happy_path():
    """
    Description: Verify updating coordinates via property setters works correctly.
    Pillar: Happy Path
    """
    # 1. ARRANGE
    node = Node3D(1.0, 2.0, 3.0)

    # 2. ACT
    node.x = 10.0
    node.y = 20.0
    node.z = 30.0

    # 3. ASSERT
    assert node.x == 10.0
    assert node.y == 20.0
    assert node.z == 30.0


def test_node3d_addition_happy_path():
    """
    Description: Verify vector addition (__add__) of two Node3D objects.
    Pillar: Happy Path
    """
    # 1. ARRANGE
    node1 = Node3D(1.0, 2.0, 3.0)
    node2 = Node3D(4.0, 5.0, 6.0)

    # 2. ACT
    result = node1 + node2

    # 3. ASSERT
    assert result == Node3D(5.0, 7.0, 9.0)
    assert result is not node1
    assert result is not node2


def test_node3d_subtraction_happy_path():
    """
    Description: Verify vector subtraction (__sub__) of two Node3D objects.
    Pillar: Happy Path
    """
    # 1. ARRANGE
    node1 = Node3D(5.0, 7.0, 9.0)
    node2 = Node3D(1.0, 2.0, 3.0)

    # 2. ACT
    result = node1 - node2

    # 3. ASSERT
    assert result == Node3D(4.0, 5.0, 6.0)
    assert result is not node1
    assert result is not node2


def test_node3d_equality_happy_path():
    """
    Description: Verify vector equality (__eq__) for identical and different nodes.
    Pillar: Happy Path
    """
    # 1. ARRANGE
    node1 = Node3D(1.0, 2.0, 3.0)
    node2 = Node3D(1.0, 2.0, 3.0)
    node3 = Node3D(1.0, 2.0, 4.0)

    # 2. ACT & ASSERT
    assert node1 == node2
    assert node1 != node3
    assert node1 != "not_a_node"


def test_node3d_dot_product_happy_path():
    """
    Description: Verify dot_product calculation between two standard Node3D objects.
    Pillar: Happy Path
    """
    # 1. ARRANGE
    node1 = Node3D(1.0, 2.0, 3.0)
    node2 = Node3D(4.0, 5.0, 6.0)

    # 2. ACT
    result = node1.dot_product(node2)

    # 3. ASSERT
    # 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
    assert result == 32.0


def test_node3d_cross_product_happy_path():
    """
    Description: Verify cross_product calculation between two standard Node3D objects.
    Pillar: Happy Path
    """
    # 1. ARRANGE
    node1 = Node3D(1.0, 0.0, 0.0)
    node2 = Node3D(0.0, 1.0, 0.0)

    # 2. ACT
    result = node1.cross_product(node2)

    # 3. ASSERT
    # i x j = k
    assert result == Node3D(0.0, 0.0, 1.0)


def test_node3d_distance_to_happy_path():
    """
    Description: Verify distance_to calculation between two standard Node3D objects.
    Pillar: Happy Path
    """
    # 1. ARRANGE
    node1 = Node3D(1.0, 2.0, 3.0)
    node2 = Node3D(4.0, 6.0, 3.0)

    # 2. ACT
    result = node1.distance_to(node2)

    # 3. ASSERT
    # sqrt((4-1)^2 + (6-2)^2 + (3-3)^2) = sqrt(9 + 16 + 0) = 5
    assert result == 5.0


def test_node3d_magnitude_and_normalization_happy_path():
    """
    Description: Verify magnitude and normalize operations on non-zero vectors.
    Pillar: Happy Path
    """
    # 1. ARRANGE
    node = Node3D(3.0, 4.0, 0.0)

    # 2. ACT
    mag = node.magnitude()
    normalized_node = node.normalize()

    # 3. ASSERT
    assert mag == 5.0
    assert normalized_node == Node3D(0.6, 0.8, 0.0)
    assert np.isclose(normalized_node.magnitude(), 1.0)


def test_node3d_dict_serialization_happy_path():
    """
    Description: Verify to_dict and from_dict serialization methods with correct values.
    Pillar: Happy Path
    """
    # 1. ARRANGE
    original_node = Node3D(1.23, -4.56, 7.89)

    # 2. ACT
    serialized_dict = original_node.to_dict()
    deserialized_node = Node3D.from_dict(serialized_dict)

    # 3. ASSERT
    assert serialized_dict == {'x': 1.23, 'y': -4.56, 'z': 7.89}
    assert deserialized_node == original_node


def test_node3d_numpy_serialization_happy_path():
    """
    Description: Verify to_numpy_array and from_numpy_array serialization methods.
    Pillar: Happy Path
    """
    # 1. ARRANGE
    original_node = Node3D(10.0, -20.0, 30.0)

    # 2. ACT
    arr = original_node.to_numpy_array()
    deserialized_node = Node3D.from_numpy_array(arr)

    # 3. ASSERT
    assert isinstance(arr, np.ndarray)
    assert np.array_equal(arr, np.array([10.0, -20.0, 30.0]))
    assert deserialized_node == original_node


def test_node3d_hashing_happy_path():
    """
    Description: Verify hash calculation and usability in dictionaries/sets.
    Pillar: Happy Path
    """
    # 1. ARRANGE
    node1 = Node3D(1.0, 2.0, 3.0)
    node2 = Node3D(1.0, 2.0, 3.0)
    node_set = {node1}

    # 2. ACT & ASSERT
    assert hash(node1) == hash(node2)
    assert node2 in node_set


# ==============================================================================
# 2. EDGE CASES
# ==============================================================================

def test_node3d_zero_vector_edge_case():
    """
    Description: Verify operations on a Zero Vector Node3D(0.0, 0.0, 0.0).
    Pillar: Edge Case
    """
    # 1. ARRANGE
    zero_node = Node3D(0.0, 0.0, 0.0)
    other_node = Node3D(1.0, 2.0, 3.0)

    # 2. ACT
    add_res = zero_node + other_node
    sub_res = other_node - zero_node
    dot_res = zero_node.dot_product(other_node)
    cross_res = zero_node.cross_product(other_node)
    mag_res = zero_node.magnitude()
    dist_res = zero_node.distance_to(other_node)

    # 3. ASSERT
    assert add_res == other_node
    assert sub_res == other_node
    assert dot_res == 0.0
    assert cross_res == Node3D(0.0, 0.0, 0.0)
    assert mag_res == 0.0
    assert dist_res == other_node.magnitude()


def test_node3d_extreme_values_edge_case():
    """
    Description: Test coordinates using extremely large, small, and negative values.
    Pillar: Edge Case
    """
    # 1. ARRANGE
    large_val = 1e30
    small_val = 1e-30
    neg_val = -999999.9

    # 2. ACT
    node = Node3D(large_val, small_val, neg_val)

    # 3. ASSERT
    assert node.x == large_val
    assert node.y == small_val
    assert node.z == neg_val


def test_node3d_from_numpy_array_collection_types_edge_case():
    """
    Description: Test from_numpy_array with exact dimensions but different collection types.
    Pillar: Edge Case
    """
    # 1. ARRANGE
    list_input = [1.0, 2.0, 3.0]
    tuple_input = (4.0, 5.0, 6.0)
    ndarray_input = np.array([7.0, 8.0, 9.0], dtype=float)

    # 2. ACT
    node_list = Node3D.from_numpy_array(list_input)
    node_tuple = Node3D.from_numpy_array(tuple_input)
    node_ndarray = Node3D.from_numpy_array(ndarray_input)

    # 3. ASSERT
    assert node_list == Node3D(1.0, 2.0, 3.0)
    assert node_tuple == Node3D(4.0, 5.0, 6.0)
    assert node_ndarray == Node3D(7.0, 8.0, 9.0)


# ==============================================================================
# 3. SAD PATHS & WORST-CASE SCENARIOS
# ==============================================================================

def test_node3d_initialization_invalid_types_sad_path():
    """
    Description: Verify TypeError is raised when initializing Node3D or setting coordinates with non-number inputs.
    Pillar: Sad Path
    """
    # 1. ARRANGE & ACT & ASSERT
    # Test initialization with invalid types
    with pytest.raises(TypeError) as excinfo:
        Node3D("1.0", 2.0, 3.0)
    assert "must be a real number" in str(excinfo.value)

    with pytest.raises(TypeError) as excinfo:
        Node3D(1.0, [2.0], 3.0)
    assert "must be a real number" in str(excinfo.value)

    with pytest.raises(TypeError) as excinfo:
        Node3D(1.0, 2.0, None)
    assert "must be a real number" in str(excinfo.value)

    # Test property setters with invalid types
    node = Node3D(1.0, 2.0, 3.0)
    
    with pytest.raises(TypeError) as excinfo:
        node.x = "invalid"
    assert "must be a real number" in str(excinfo.value)

    with pytest.raises(TypeError) as excinfo:
        node.y = {}
    assert "must be a real number" in str(excinfo.value)

    with pytest.raises(TypeError) as excinfo:
        node.z = (3.0,)
    assert "must be a real number" in str(excinfo.value)


def test_node3d_operations_invalid_operand_sad_path():
    """
    Description: Verify TypeError is raised when vector operations are invoked with non-Node3D operands.
    Pillar: Sad Path
    """
    # 1. ARRANGE
    node = Node3D(1.0, 2.0, 3.0)
    invalid_operand = [1.0, 2.0, 3.0]

    # 2. ACT & ASSERT
    with pytest.raises(TypeError) as excinfo:
        _ = node + invalid_operand
    assert "Unsupported operand type" in str(excinfo.value)

    with pytest.raises(TypeError) as excinfo:
        _ = node - invalid_operand
    assert "Unsupported operand type" in str(excinfo.value)

    with pytest.raises(TypeError) as excinfo:
        node.distance_to(invalid_operand)
    assert "Expected Node3D instance" in str(excinfo.value)

    with pytest.raises(TypeError) as excinfo:
        node.dot_product(invalid_operand)
    assert "Expected Node3D instance" in str(excinfo.value)

    with pytest.raises(TypeError) as excinfo:
        node.cross_product(invalid_operand)
    assert "Expected Node3D instance" in str(excinfo.value)


def test_node3d_normalize_zero_magnitude_sad_path():
    """
    Description: Verify ValueError is raised when calling normalize() on a zero-magnitude vector (0, 0, 0).
    Pillar: Sad Path
    """
    # 1. ARRANGE
    zero_node = Node3D(0.0, 0.0, 0.0)

    # 2. ACT & ASSERT
    with pytest.raises(ValueError) as excinfo:
        zero_node.normalize()
    assert "Cannot normalize a zero-magnitude vector" in str(excinfo.value)


def test_node3d_from_dict_missing_keys_sad_path():
    """
    Description: Verify KeyError is raised in from_dict() if 'x', 'y', or 'z' keys are missing.
    Pillar: Sad Path
    """
    # 1. ARRANGE
    missing_x = {'y': 2.0, 'z': 3.0}
    missing_y = {'x': 1.0, 'z': 3.0}
    missing_z = {'x': 1.0, 'y': 2.0}

    # 2. ACT & ASSERT
    with pytest.raises(KeyError) as excinfo:
        Node3D.from_dict(missing_x)
    assert "x" in str(excinfo.value)

    with pytest.raises(KeyError) as excinfo:
        Node3D.from_dict(missing_y)
    assert "y" in str(excinfo.value)

    with pytest.raises(KeyError) as excinfo:
        Node3D.from_dict(missing_z)
    assert "z" in str(excinfo.value)


def test_node3d_from_dict_invalid_values_sad_path():
    """
    Description: Verify TypeError is raised in from_dict() if values are not valid numbers.
    Pillar: Sad Path
    """
    # 1. ARRANGE
    invalid_data = {'x': '1.0', 'y': 2.0, 'z': 3.0}

    # 2. ACT & ASSERT
    with pytest.raises(TypeError) as excinfo:
        Node3D.from_dict(invalid_data)
    assert "must be a real number" in str(excinfo.value)


def test_node3d_from_numpy_array_invalid_size_sad_path():
    """
    Description: Verify ValueError is raised in from_numpy_array() if input size is not exactly 3.
    Pillar: Sad Path
    """
    # 1. ARRANGE
    too_short = [1.0, 2.0]
    too_long = [1.0, 2.0, 3.0, 4.0]
    empty = []

    # 2. ACT & ASSERT
    with pytest.raises(ValueError) as excinfo:
        Node3D.from_numpy_array(too_short)
    assert "Array must have exactly 3 elements" in str(excinfo.value)

    with pytest.raises(ValueError) as excinfo:
        Node3D.from_numpy_array(too_long)
    assert "Array must have exactly 3 elements" in str(excinfo.value)

    with pytest.raises(ValueError) as excinfo:
        Node3D.from_numpy_array(empty)
    assert "Array must have exactly 3 elements" in str(excinfo.value)


def test_node3d_from_numpy_array_invalid_types_sad_path():
    """
    Description: Verify TypeError/ValueError is raised in from_numpy_array() if coordinates are not valid numbers.
    Pillar: Sad Path
    """
    # 1. ARRANGE
    invalid_list = [1.0, "two", 3.0]
    invalid_ndarray = np.array([1.0, "two", 3.0], dtype=object)

    # 2. ACT & ASSERT
    # A list containing a string cannot be converted to a float numpy array, raising ValueError
    with pytest.raises(ValueError) as excinfo:
        Node3D.from_numpy_array(invalid_list)
    assert "could not convert string to float" in str(excinfo.value)

    # A numpy array of object type skips conversion but fails validation, raising TypeError
    with pytest.raises(TypeError) as excinfo:
        Node3D.from_numpy_array(invalid_ndarray)
    assert "must be a real number" in str(excinfo.value)
