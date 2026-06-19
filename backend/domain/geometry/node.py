from __future__ import annotations
from typing import Any, Union, Tuple, ClassVar, Optional, List
import numpy as np
from numpy.typing import NDArray

from ..utils import validation


class Node3D:
    """
    Represents a point in 3D space with x, y, and z coordinates.

    This class provides functionality for working with points in 3D space,
    including vector operations, coordinate transformations, and mathematical
    operations between nodes.

    Attributes:
        x (float): The x-coordinate of the node
        y (float): The y-coordinate of the node
        z (float): The z-coordinate of the node
    """

    # Class constants
    DIMENSIONS: ClassVar[int] = 3

    def __init__(self, x: float, y: float, z: float) -> None:
        """
        Initialize a node in 3D space.

        Args:
            x: The x-coordinate of the node
            y: The y-coordinate of the node
            z: The z-coordinate of the node

        Raises:
            TypeError: If coordinates are not valid numbers
        """
        self.x = x
        self.y = y
        self.z = z

    def __len__(self) -> int:
        """Return the dimensionality of the node (always 3)."""
        return self.DIMENSIONS

    def __repr__(self) -> str:
        """Return a developer-friendly string representation of the node."""
        return f"{self.__class__.__name__}(x={self.x}, y={self.y}, z={self.z})"

    def __str__(self) -> str:
        """Return a user-friendly string representation of the node."""
        return f"({self.x}, {self.y}, {self.z})"

    def __eq__(self, other: Any) -> bool:
        """
        Compare this node with another object for equality.

        Two nodes are equal if they have identical x, y, and z coordinates.

        Args:
            other: The object to compare with

        Returns:
            True if the objects are equal, False otherwise
        """
        if not isinstance(other, Node3D):
            return False

        return (
                self.x == other.x and
                self.y == other.y and
                self.z == other.z
        )

    def __add__(self, other: Node3D) -> Node3D:
        """
        Add another node's coordinates to this node.

        Args:
            other: The node to add

        Returns:
            A new node with summed coordinates

        Raises:
            TypeError: If other is not a Node3D instance
        """
        if not isinstance(other, Node3D):
            raise TypeError(f"Unsupported operand type: {type(other).__name__}")

        return Node3D(
            x=self.x + other.x,
            y=self.y + other.y,
            z=self.z + other.z
        )

    def __sub__(self, other: Node3D) -> Node3D:
        """
        Subtract another node's coordinates from this node.

        Args:
            other: The node to subtract

        Returns:
            A new node with the difference of coordinates

        Raises:
            TypeError: If other is not a Node3D instance
        """
        if not isinstance(other, Node3D):
            raise TypeError(f"Unsupported operand type: {type(other).__name__}")

        return Node3D(
            x=self.x - other.x,
            y=self.y - other.y,
            z=self.z - other.z
        )

    def __hash__(self) -> int:
        """
        Calculate a hash value for this node.

        This allows nodes to be used as dictionary keys or in sets.

        Returns:
            A hash value based on the node's coordinates
        """
        return hash((self.x, self.y, self.z))

    @classmethod
    def from_numpy_array(cls, array: Union[List[float], Tuple[float, float, float], NDArray]) -> Node3D:
        """
        Create a Node3D from a numpy array or compatible sequence.

        Args:
            array: A sequence or numpy array with 3 values [x, y, z]

        Returns:
            A new Node3D instance

        Raises:
            ValueError: If the array doesn't have exactly 3 elements
            TypeError: If the values are not valid numbers
        """
        if not hasattr(array, '__len__') or len(array) != cls.DIMENSIONS:
            raise ValueError(f"Array must have exactly {cls.DIMENSIONS} elements.")

        # Convert to numpy array if necessary
        if not isinstance(array, np.ndarray):
            array = np.array(array, dtype=float)

        # Extract values from array
        x, y, z = array

        # Validate values
        validation.validate_number_real(name="x", value=x)
        validation.validate_number_real(name="y", value=y)
        validation.validate_number_real(name="z", value=z)

        # Create and return a new node
        return cls(x, y, z)

    @property
    def x(self) -> float:
        """
        Get the x-coordinate of the node.

        Returns:
            The x-coordinate
        """
        return self._x

    @x.setter
    def x(self, value: float) -> None:
        """
        Set the x-coordinate of the node.

        Args:
            value: The new x-coordinate

        Raises:
            TypeError: If value is not a valid number
        """
        validation.validate_number_real(name="x", value=value)
        self._x = float(value)

    @property
    def y(self) -> float:
        """
        Get the y-coordinate of the node.

        Returns:
            The y-coordinate
        """
        return self._y

    @y.setter
    def y(self, value: float) -> None:
        """
        Set the y-coordinate of the node.

        Args:
            value: The new y-coordinate

        Raises:
            TypeError: If value is not a valid number
        """
        validation.validate_number_real(name="y", value=value)
        self._y = float(value)

    @property
    def z(self) -> float:
        """
        Get the z-coordinate of the node.

        Returns:
            The z-coordinate
        """
        return self._z

    @z.setter
    def z(self, value: float) -> None:
        """
        Set the z-coordinate of the node.

        Args:
            value: The new z-coordinate

        Raises:
            TypeError: If value is not a valid number
        """
        validation.validate_number_real(name="z", value=value)
        self._z = float(value)

    def to_numpy_array(self) -> NDArray:
        """
        Convert the node to a numpy array.

        Returns:
            A numpy array with the node's coordinates [x, y, z]
        """
        return np.array([self.x, self.y, self.z], dtype=float)

    def distance_to(self, other: Node3D) -> float:
        """
        Calculate the Euclidean distance to another node.

        Args:
            other: The node to calculate distance to

        Returns:
            The distance between the nodes

        Raises:
            TypeError: If other is not a Node3D instance
        """
        if not isinstance(other, Node3D):
            raise TypeError(f"Expected Node3D instance, got {type(other).__name__}")

        return float(np.linalg.norm(self.to_numpy_array() - other.to_numpy_array()))

    def dot_product(self, other: Node3D) -> float:
        """
        Calculate the dot product with another node.

        Args:
            other: The node to calculate dot product with

        Returns:
            The dot product value

        Raises:
            TypeError: If other is not a Node3D instance
        """
        if not isinstance(other, Node3D):
            raise TypeError(f"Expected Node3D instance, got {type(other).__name__}")

        return float(np.dot(self.to_numpy_array(), other.to_numpy_array()))

    def cross_product(self, other: Node3D) -> Node3D:
        """
        Calculate the cross product with another node.

        Args:
            other: The node to calculate cross product with

        Returns:
            A new Node3D representing the cross product vector

        Raises:
            TypeError: If other is not a Node3D instance
        """
        if not isinstance(other, Node3D):
            raise TypeError(f"Expected Node3D instance, got {type(other).__name__}")

        result = np.cross(self.to_numpy_array(), other.to_numpy_array())
        return Node3D.from_numpy_array(result)

    def magnitude(self) -> float:
        """
        Calculate the magnitude (length) of the position vector from origin.

        Returns:
            The magnitude of the vector
        """
        return float(np.linalg.norm(self.to_numpy_array()))

    def normalize(self) -> Node3D:
        """
        Create a unit vector in the same direction as this node.

        Returns:
            A new Node3D with unit length

        Raises:
            ValueError: If the node is at the origin (zero magnitude)
        """
        magnitude = self.magnitude()
        if magnitude == 0:
            raise ValueError("Cannot normalize a zero-magnitude vector")

        return Node3D(
            x=self.x / magnitude,
            y=self.y / magnitude,
            z=self.z / magnitude
        )

    def to_dict(self) -> dict:
        """
        Convert the node to a dictionary for serialization.

        Returns:
            A dictionary representation of the node
        """
        return {
            'x': float(self.x),
            'y': float(self.y),
            'z': float(self.z)
        }

    @classmethod
    def from_dict(cls, data: dict) -> Node3D:
        """
        Create a Node3D from a dictionary.

        Args:
            data: A dictionary with 'x', 'y', and 'z' keys

        Returns:
            A new Node3D instance

        Raises:
            KeyError: If required keys are missing
            TypeError: If values are not valid numbers
        """
        required_keys = {'x', 'y', 'z'}
        if not required_keys.issubset(data.keys()):
            missing = required_keys - data.keys()
            raise KeyError(f"Missing required keys: {missing}")

        return cls(
            x=data['x'],
            y=data['y'],
            z=data['z']
        )