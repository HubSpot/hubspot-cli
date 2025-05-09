// Makes a single property of a type optional and leaves the rest as required
export type PartialProp<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;
