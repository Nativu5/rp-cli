export function cloneModelForUserCode<TModel>(model: TModel): Readonly<TModel> {
  return deepFreeze(structuredClone(model));
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
