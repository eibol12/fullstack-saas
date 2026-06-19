from numbers import Real




DEFAULT_MIN_ERROR = "{} cannot be less than {}"
DEFAULT_MAX_ERROR = "{} cannot be greater than {}"
DEFAULT_NOT_ALLOWED_ERROR = "Invalid {}"


def validate_number_real(name, value, condition=None):
    """
    Validates a given value as a number.Real with specific conditions.

    Args:
        name (str): The name of the argument (used in error messages).
        value (any): The value to validate.
        condition (dict): A dictionary specifying the validation type and rules.
                          Options:
                            - {"type": "range", "min_value": <min_value>, "max_value": <max_value>}
                            - {"type": "allowed", "allowed_values": [<allowed_values>]}

    Raises:
        TypeError: If the value is not of type number.Real.
        ValueError: If the value violates the specified condition.
    """
    if not isinstance(value, Real):
        raise TypeError(f"{name} must be a real number.")

    if condition is not None:
        if condition.get("type") == "range":
            min_value = condition.get("min_value")
            max_value = condition.get("max_value")
            if min_value is not None and not isinstance(min_value, Real):
                raise TypeError("min_value must be a real number.")
            if max_value is not None and not isinstance(max_value, Real):
                raise TypeError("max_value must be a real number.")
            if min_value is not None and value < min_value:
                raise ValueError(DEFAULT_MIN_ERROR.format(name, min_value))
            if max_value is not None and value > max_value:
                raise ValueError(DEFAULT_MAX_ERROR.format(name, max_value))


        elif condition.get("type") == "allowed":
            allowed_values = condition.get("allowed_values")
            if allowed_values is None:
                raise ValueError("allowed_values must be provided.")
            if not isinstance(allowed_values, (set, list, tuple)):
                raise TypeError(f"{name} is invalid.")
            if len(allowed_values) == 0:
                raise ValueError("allowed_values cannot be empty.")
            if value not in allowed_values:
                raise ValueError(DEFAULT_NOT_ALLOWED_ERROR.format(name))

        else:
            raise ValueError("Invalid condition type. Must be 'range' or 'allowed'.")

def validate_number_integer(name, value, condition=None):
    """
    Validates a given value as an integer with specific conditions.

    Args:
        name (str): The name of the argument (used in error messages).
        value (any): The value to validate.
        condition (dict): A dictionary specifying the validation type and rules.
                          Options:
                            - {"type": "range", "min_value": <min_value>, "max_value": <max_value>}
                            - {"type": "allowed", "allowed_values": [<allowed_values>]}

    Raises:
        TypeError: If the value is not of type int
        ValueError: If the value violates the specified condition.
    """
    if not isinstance(value, int):
        raise TypeError(f"{name} must be an integer.")

    if condition is not None:
        if condition.get("type") == "range":
            min_value = condition.get("min_value")
            max_value = condition.get("max_value")
            if min_value is not None and not isinstance(min_value, int):
                raise TypeError("min_value must be an integer number.")
            if max_value is not None and not isinstance(max_value, int):
                raise TypeError("max_value must be an integer number.")
            if min_value is not None and value < min_value:
                raise ValueError(DEFAULT_MIN_ERROR.format(name, min_value))
            if max_value is not None and value > max_value:
                raise ValueError(DEFAULT_MAX_ERROR.format(name, max_value))


        elif condition.get("type") == "allowed":
            allowed_values = condition.get("allowed_values")
            if allowed_values is None:
                raise ValueError("allowed_values must be provided.")
            if not isinstance(allowed_values, (set, list, tuple)):
                raise TypeError(f"{name} is invalid.")
            if len(allowed_values) == 0:
                raise ValueError("allowed_values cannot be empty.")
            if value not in allowed_values:
                raise ValueError(DEFAULT_NOT_ALLOWED_ERROR.format(name))

        else:
            raise ValueError("Invalid condition type. Must be 'range' or 'allowed'.")

def validate_string(name, value, allowed_values=None, allow_empty=False):
    """
    Validates a given value as a string with specific rules.

    Args:
        name (str): The name of the argument (used in error messages).
        value (any): The value to validate.
        allowed_values (iterable, optional): A collection of valid string values. Defaults to None.
        allow_empty (bool, optional): Whether empty strings are allowed. Defaults to False.

    Raises:
        TypeError: If the value is not a string.
        ValueError: If value is empty when allow_empty is False.
        ValueError: If value is not in allowed_values when provided.
    """
    if not isinstance(value, str):
        raise TypeError(f"{name} must be a string.")

    if not allow_empty and value.strip() == "":
        raise ValueError(f"{name} cannot be empty or whitespace.")

    if allowed_values is not None:
        if not isinstance(allowed_values, (set, list, tuple)):
            raise TypeError(f"{name} is invalid.")
        if not all(isinstance(item, str) for item in allowed_values):
            raise TypeError("All elements in allowed_values must be strings.")
        if value.strip().lower() not in allowed_values:
            raise ValueError(f"Invalid {name}. The value is not allowed.")

