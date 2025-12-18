/**
 * JSON Canonicalizer
 * 
 * Produces deterministic JSON strings by:
 * 1. Sorting object keys alphabetically
 * 2. Removing undefined values
 * 3. Ensuring consistent formatting
 * 
 * Same input will always produce the same output across machines.
 */

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue | undefined };
type JsonArray = JsonValue[];

/**
 * Recursively canonicalize a value
 */
function canonicalizeValue(value: JsonValue | undefined): JsonValue | undefined {
    if (value === undefined) {
        return undefined;
    }

    if (value === null) {
        return null;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map(item => canonicalizeValue(item)).filter(item => item !== undefined) as JsonArray;
    }

    if (typeof value === 'object') {
        return canonicalizeObject(value as JsonObject);
    }

    return value;
}

/**
 * Canonicalize an object by sorting keys and removing undefined values
 */
function canonicalizeObject(obj: JsonObject): JsonObject {
    const sortedKeys = Object.keys(obj).sort();
    const result: JsonObject = {};

    for (const key of sortedKeys) {
        const value = obj[key];
        if (value !== undefined) {
            const canonicalized = canonicalizeValue(value);
            if (canonicalized !== undefined) {
                result[key] = canonicalized;
            }
        }
    }

    return result;
}

/**
 * Convert an object to a canonical JSON string
 * 
 * Guarantees:
 * - Keys are sorted alphabetically
 * - No whitespace (compact output)
 * - Undefined values are excluded
 * - Same input always produces same output
 */
export function canonicalize(obj: unknown): string {
    if (obj === null || obj === undefined) {
        throw new Error('Cannot canonicalize null or undefined');
    }

    if (typeof obj !== 'object') {
        throw new Error('Can only canonicalize objects');
    }

    const canonicalized = canonicalizeValue(obj as JsonValue);
    return JSON.stringify(canonicalized);
}

/**
 * Parse and re-canonicalize a JSON string
 * Useful for verifying canonical form
 */
export function parseAndCanonicalize(jsonString: string): string {
    const parsed = JSON.parse(jsonString) as JsonValue;

    if (parsed === null || typeof parsed !== 'object') {
        throw new Error('Can only canonicalize objects');
    }

    return canonicalize(parsed);
}

/**
 * Check if a JSON string is in canonical form
 */
export function isCanonical(jsonString: string): boolean {
    try {
        const recanonicalized = parseAndCanonicalize(jsonString);
        return jsonString === recanonicalized;
    } catch {
        return false;
    }
}
