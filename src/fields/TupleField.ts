import type Serial from '../Serial'
import SerialError from '../error/SerialError'

export default class TupleField<T extends readonly [... any[]]> implements Serial.Field<T> {
    readonly elems: ReadonlyArray<Serial.Field<unknown>>
    constructor(elems: ReadonlyArray<Serial.Field<unknown>>) {
        this.elems = elems
    }
    serialize(v: T) {
        return this.elems.map((e, i) => e.serialize(v[i]))
    }
    deserialize(n: unknown) {
        SerialError.assert(Array.isArray(n), `expected array got ${typeof n}`)
        SerialError.assert(n.length === this.elems.length, `expected array of length ${this.elems.length} got n.length`)
        return n.map((a, i) => this.elems[i].deserialize(a)) as any as T
    }
}
