export default class SerialError extends Error {
    static assert(cond: boolean, msg?: string): asserts cond {
        if (!cond) throw new SerialError(msg)
    }
}
