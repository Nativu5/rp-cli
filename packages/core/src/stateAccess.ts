export function cloneStateForUserCode<TState>(state: TState): Readonly<TState> {
  return deepFreeze(structuredClone(state));
}

function deepFreeze<TValue>(value: TValue): Readonly<TValue> {
  if (!isObject(value) || Object.isFrozen(value)) {
    return value;
  }

  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  }

  return Object.freeze(value);
}

function isObject(value: unknown): value is object {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}
