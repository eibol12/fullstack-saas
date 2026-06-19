from __future__ import annotations
from typing import Dict, List, Iterator, Tuple, Optional, Generic, TypeVar, Union, Any


from domain.geometry.node import Node3D
from domain.geometry.element import Element3D

# Define type variables for generic typing
T = TypeVar('T', Node3D, Element3D)
ID = int


class IndexedDict(Generic[T]):
    """
    A high-performance custom dictionary for geometry objects with auto-generated IDs.
    
    This data structure1 provides efficient storage and retrieval of objects
    with automatically assigned unique identifiers, while maintaining
    the original insertion order and supporting fast lookups by both ID and object.
    
    Type Parameters:
        T: The type of items stored (Node3D or Element3D)
    """
    
    def __init__(self) -> None:
        """Initialize an empty indexed dictionary."""
        self._data: List[T] = []                  # Store objects in insertion order
        self._id_map: Dict[ID, int] = {}          # Map IDs to indices in _data
        self._object_map: Dict[int, ID] = {}      # Map object hashes to their IDs
        self._next_id: ID = 0                     # Counter for generating unique IDs
    
    def add(self, item: T) -> ID:
        """
        Add a new item with automatic ID assignment.
        
        Args:
            item: The item to add (Node3D or Element3D)
            
        Returns:
            The unique ID assigned to the item
            
        Raises:
            TypeError: If item is not of the expected type
            ValueError: If the item already exists in the collection
        """
        # Type checking based on expected class
        expected_type = Node3D if self.__class__.__name__ == 'Node3DDict' else Element3D
        if not isinstance(item, expected_type):
            raise TypeError(f"Value must be an instance of {expected_type.__name__}")
        
        # Check if item already exists using hash
        item_hash = hash(item)
        if item_hash in self._object_map:
            raise ValueError(f"{expected_type.__name__} already exists in the collection")
        
        # Add the item with a new ID
        self._data.append(item)
        item_id = self._next_id
        index = len(self._data) - 1
        
        # Update mappings
        self._id_map[item_id] = index
        self._object_map[item_hash] = item_id
        self._next_id += 1
        
        return item_id
    
    def remove(self, item_id: ID) -> T:
        """
        Remove an item by its ID and return the removed item.
        
        Args:
            item_id: The unique ID of the item to remove
            
        Returns:
            The removed item
            
        Raises:
            KeyError: If the ID does not exist
        """
        if item_id not in self._id_map:
            raise KeyError(f"ID {item_id} does not exist")
        
        # Get the item and its index
        index = self._id_map[item_id]
        item = self._data[index]
        
        # Remove from data list
        self._data.pop(index)
        
        # Remove from mappings
        del self._id_map[item_id]
        del self._object_map[hash(item)]
        
        # Update indices for items that shifted
        self._rebuild_id_map()
        
        return item

    def update(self, item_id: ID, updated_item: T) -> None:
        """
        Update an existing item in the collection and refresh its hash mapping.

        Args:
            item_id: The ID of the item to update
            updated_item: The updated item

        Raises:
            KeyError: If the item ID doesn't exist
            TypeError: If the updated item is not of the expected type
        """
        # Check if ID exists
        if item_id not in self._id_map:
            raise KeyError(f"ID {item_id} does not exist")

        # Type checking
        expected_type = Node3D if self.__class__.__name__ == 'Node3DDict' else Element3D
        if not isinstance(updated_item, expected_type):
            raise TypeError(f"Updated value must be an instance of {expected_type.__name__}")

        # Get the current item and its index
        index = self._id_map[item_id]
        old_item = self._data[index]
        old_hash = hash(old_item)

        # Remove old hash mapping
        if old_hash in self._object_map:
            del self._object_map[old_hash]

        # Update the item in the data list
        self._data[index] = updated_item

        # Add new hash mapping
        new_hash = hash(updated_item)
        self._object_map[new_hash] = item_id
    
    def get(self, item_id: ID, default: Optional[Any] = None) -> Optional[T]:
        """
        Get an item by ID with an optional default value if not found.
        
        Args:
            item_id: The ID of the item to retrieve
            default: Value to return if ID is not found
            
        Returns:
            The corresponding item or the default value
        """
        try:
            return self[item_id]
        except KeyError:
            return default
    
    def get_id(self, item: T) -> ID:
        """
        Get the ID of an item.
        
        Args:
            item: The item to look up
            
        Returns:
            The ID of the item
            
        Raises:
            TypeError: If item is not of the expected type
            ValueError: If the item is not in the collection
        """
        expected_type = Node3D if self.__class__.__name__ == 'Node3DDict' else Element3D
        if not isinstance(item, expected_type):
            raise TypeError(f"Expected {expected_type.__name__}, got {type(item).__name__}")
        
        item_hash = hash(item)
        if item_hash not in self._object_map:
            raise ValueError(f"{expected_type.__name__} not found in collection")
        
        return self._object_map[item_hash]
    
    def index_to_id(self, index: int) -> ID:
        """
        Convert an index to the corresponding ID.
        
        Args:
            index: Position in the internal list
            
        Returns:
            The ID at that position
            
        Raises:
            IndexError: If index is out of range
        """
        if not 0 <= index < len(self._data):
            raise IndexError(f"Index {index} out of range")
        
        # Find ID with the given index value
        for item_id, idx in self._id_map.items():
            if idx == index:
                return item_id
                
        # This should never happen if internal state is consistent
        raise RuntimeError(f"No ID found for index {index}")
    
    def id_to_index(self, item_id: ID) -> int:
        """
        Convert an ID to its current index.
        
        Args:
            item_id: The ID to look up
            
        Returns:
            The current index of the item
            
        Raises:
            KeyError: If the ID doesn't exist
        """
        if item_id not in self._id_map:
            raise KeyError(f"ID {item_id} not found")
        
        return self._id_map[item_id]
    
    def _rebuild_id_map(self) -> None:
        """
        Rebuild internal mappings after items are removed.
        
        This ensures indices correctly reflect positions in the data list.
        """
        # Rebuild ID to index mapping
        old_id_map = self._id_map.copy()
        self._id_map.clear()
        
        # Create new mapping based on current positions
        for item_id in old_id_map:
            if item_id in self._id_map:
                continue  # Skip if already processed
                
            # Find the item's position
            for i, item in enumerate(self._data):
                item_hash = hash(item)
                if item_hash in self._object_map and self._object_map[item_hash] == item_id:
                    self._id_map[item_id] = i
                    break
    
    def clear(self) -> None:
        """Remove all items from the collection."""
        self._data.clear()
        self._id_map.clear()
        self._object_map.clear()
        # Don't reset _next_id to ensure IDs remain unique even after clearing
    
    def values(self) -> List[T]:
        """Get all items in insertion order."""
        return self._data.copy()
    
    def keys(self) -> List[ID]:
        """Get all IDs in insertion order."""
        return [self.index_to_id(i) for i in range(len(self._data))]
    
    def items(self) -> Iterator[Tuple[ID, T]]:
        """
        Yield (id, item) pairs in insertion order.
        
        Similar to dict.items() but maintains original insertion order.
        """
        for i, item in enumerate(self._data):
            yield self.index_to_id(i), item
    
    def __getitem__(self, item_id: ID) -> T:
        """
        Get an item by its ID using dictionary-style access.
        
        Args:
            item_id: The ID to look up
            
        Returns:
            The corresponding item
            
        Raises:
            KeyError: If the ID doesn't exist
        """
        if item_id not in self._id_map:
            raise KeyError(f"ID {item_id} not found")
        
        index = self._id_map[item_id]
        return self._data[index]
    
    def __contains__(self, item: Union[ID, T]) -> bool:
        """
        Check if an ID or item exists in the collection.
        
        Args:
            item: Either an ID or an object
            
        Returns:
            True if found, False otherwise
        """
        if isinstance(item, int):
            return item in self._id_map
        
        return hash(item) in self._object_map
    
    def __iter__(self) -> Iterator[T]:
        """Iterate through all items in insertion order."""
        return iter(self._data)
    
    def __len__(self) -> int:
        """Get the number of items in the collection."""
        return len(self._data)
    
    def __repr__(self) -> str:
        """Get a string representation of the collection."""
        items_repr = ", ".join(f"{id}: {item!r}" for id, item in self.items())
        return f"{self.__class__.__name__}({{{items_repr}}})"
    
    def to_dict(self) -> Dict[ID, Dict]:
        """
        Convert the collection to a serializable dictionary.
        
        Returns:
            A dictionary mapping IDs to serialized items
        """
        return {
            item_id: item.to_dict() if hasattr(item, 'to_dict') else str(item)
            for item_id, item in self.items()
        }


class Node3DDict(IndexedDict[Node3D]):
    """
    A specialized dictionary for managing Node3D objects with auto-generated IDs.
    
    This class provides efficient storage, retrieval, and management of Node3D 
    objects with unique identifiers, supporting operations needed for structural
    analysis and geometric modeling.
    """
    
    def find_closest_node(self, x: float, y: float, z: float) -> Tuple[ID, Node3D, float]:
        """
        Find the node closest to the given coordinates.
        
        Args:
            x: X coordinate
            y: Y coordinate
            z: Z coordinate
            
        Returns:
            Tuple of (node_id, node, distance)
            
        Raises:
            ValueError: If the collection is empty
        """
        if not self._data:
            raise ValueError("Cannot find closest node in empty collection")
        
        # Create a reference node
        reference = Node3D(x, y, z)
        
        # Find closest node
        closest_node = min(self._data, key=lambda node: reference.distance_to(node))
        closest_id = self.get_id(closest_node)
        distance = reference.distance_to(closest_node)
        
        return closest_id, closest_node, distance
    
    def nodes_within_radius(self, x: float, y: float, z: float, radius: float) -> List[Tuple[ID, Node3D]]:
        """
        Find all nodes within a specified radius of the given coordinates.
        
        Args:
            x: X coordinate
            y: Y coordinate
            z: Z coordinate
            radius: Maximum distance to include
            
        Returns:
            List of (node_id, node) tuples
        """
        result = []
        reference = Node3D(x, y, z)
        
        for node in self._data:
            distance = reference.distance_to(node)
            if distance <= radius:
                node_id = self.get_id(node)
                result.append((node_id, node))
                
        return result
    
    def get_bounding_box(self) -> Tuple[Node3D, Node3D]:
        """
        Get the minimum and maximum coordinates of all nodes.
        
        Returns:
            Tuple of (min_node, max_node) representing the bounding box
            
        Raises:
            ValueError: If the collection is empty
        """
        if not self._data:
            raise ValueError("Cannot calculate bounding box of empty collection")
        
        # Initialize with the first node
        min_x = max_x = self._data[0].x
        min_y = max_y = self._data[0].y
        min_z = max_z = self._data[0].z
        
        # Find min/max coordinates
        for node in self._data:
            min_x = min(min_x, node.x)
            max_x = max(max_x, node.x)
            min_y = min(min_y, node.y)
            max_y = max(max_y, node.y)
            min_z = min(min_z, node.z)
            max_z = max(max_z, node.z)
        
        return Node3D(min_x, min_y, min_z), Node3D(max_x, max_y, max_z)


class Element3DDict(IndexedDict[Element3D]):
    """
    A specialized dictionary for managing Element3D objects with auto-generated IDs.
    
    This class provides efficient storage, retrieval, and management of Element3D
    objects with unique identifiers, supporting operations needed for structural
    analysis and geometric modeling.
    """
    
    def find_by_nodes(self, initial_node: Node3D, end_node: Node3D) -> Optional[Tuple[ID, Element3D]]:
        """
        Find an element connecting two specific nodes.
        
        Args:
            initial_node: The first node
            end_node: The second node
            
        Returns:
            Tuple of (element_id, element) if found, None otherwise
        """
        for element in self._data:
            if (element.initial_node == initial_node and element.end_node == end_node) or \
               (element.initial_node == end_node and element.end_node == initial_node):
                element_id = self.get_id(element)
                return element_id, element
        
        return None
    
    def get_elements_with_node(self, node: Node3D) -> List[Tuple[ID, Element3D]]:
        """
        Find all elements connected to a specific node.
        
        Args:
            node: The node to search for
            
        Returns:
            List of (element_id, element) tuples
        """
        result = []
        
        for element in self._data:
            if node in element:  # Using __contains__ from Element3D
                element_id = self.get_id(element)
                result.append((element_id, element))
                
        return result
    
    def get_by_property_range(self, property_name: str, min_value: float, max_value: float) -> List[Tuple[ID, Element3D]]:
        """
        Find elements with a property value within a specified range.
        
        Args:
            property_name: Name of the property (e.g., 'length', 'elastic_modulus')
            min_value: Minimum value (inclusive)
            max_value: Maximum value (inclusive)
            
        Returns:
            List of (element_id, element) tuples
            
        Raises:
            AttributeError: If the property doesn't exist in Element3D
        """
        result = []
        
        # Validate property exists
        if not hasattr(self._data[0], property_name) if self._data else False:
            raise AttributeError(f"Element3D has no attribute '{property_name}'")
        
        for element in self._data:
            value = getattr(element, property_name)
            if min_value <= value <= max_value:
                element_id = self.get_id(element)
                result.append((element_id, element))
                
        return result
    
    def sort_by_property(self, property_name: str, reverse: bool = False) -> List[Tuple[ID, Element3D]]:
        """
        Get elements sorted by a specific property.
        
        Args:
            property_name: Name of the property to sort by
            reverse: True for descending order, False for ascending
            
        Returns:
            List of (element_id, element) tuples sorted by the property
            
        Raises:
            AttributeError: If the property doesn't exist in Element3D
        """
        # Validate property exists
        if not hasattr(self._data[0], property_name) if self._data else False:
            raise AttributeError(f"Element3D has no attribute '{property_name}'")
        
        # Create (id, element) pairs
        id_element_pairs = [(self.get_id(element), element) for element in self._data]
        
        # Sort by the specified property
        return sorted(
            id_element_pairs,
            key=lambda pair: getattr(pair[1], property_name),
            reverse=reverse
        )