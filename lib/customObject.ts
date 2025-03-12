import {
  SchemaDefinition,
  ObjectDefinition,
} from '@hubspot/local-dev-lib/types/Schemas';

export function isSchemaDefinition(
  schema: unknown
): schema is SchemaDefinition {
  return (
    typeof schema === 'object' &&
    schema !== null &&
    'labels' in schema &&
    'name' in schema &&
    'properties' in schema &&
    'requiredProperties' in schema
  );
}

export function isObjectDefinition(
  object: unknown
): object is ObjectDefinition {
  return typeof object === 'object' && object !== null && 'inputs' in object;
}
