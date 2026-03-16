# Pydantic v2 Compatibility Fix

## Issue
The `PyObjectId` class was using deprecated Pydantic v1 methods (`__get_validators__` and `__modify_schema__`) which are not supported in Pydantic v2.

## Solution
Updated `PyObjectId` to use Pydantic v2's new schema generation methods:
- `__get_pydantic_core_schema__` - replaces `__get_validators__`
- `__get_pydantic_json_schema__` - replaces `__modify_schema__`

## Changes Made

### backend/app/models.py

**Before (Pydantic v1):**
```python
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

    @classmethod
    def __modify_schema__(cls, field_schema):
        field_schema.update(type="string")
```

**After (Pydantic v2):**
```python
class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_core_schema__(
        cls, source_type: Any, handler: Any
    ) -> core_schema.CoreSchema:
        def validate(value: Any) -> ObjectId:
            if isinstance(value, ObjectId):
                return value
            if isinstance(value, str):
                if ObjectId.is_valid(value):
                    return ObjectId(value)
                raise ValueError("Invalid ObjectId string")
            if isinstance(value, bytes):
                return ObjectId(value)
            raise ValueError("Invalid ObjectId")
        
        return core_schema.no_info_plain_validator_function(validate)

    @classmethod
    def __get_pydantic_json_schema__(
        cls, _core_schema: core_schema.CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        return {"type": "string", "format": "objectid"}
```

## Additional Changes
- Removed `default_factory=PyObjectId` from Field definitions (not needed for database-loaded fields)
- Added proper imports for Pydantic v2: `GetJsonSchemaHandler`, `JsonSchemaValue`, `core_schema`

## Testing
After installing dependencies, test the import:
```bash
cd backend
python -c "from app.models import PyObjectId; print('Success!')"
```

## Notes
- The updated requirements.txt uses Pydantic 2.10.0 which is compatible with these changes
- All models using `PyObjectId` should now work correctly with Pydantic v2
- The script `create_admin.py` should now run without errors

