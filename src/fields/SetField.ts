import type Serial from '../Serial'
import { OrderedSet, Set } from 'immutable'
import SerialError from '../error/SerialError'

export default class SetField<T extends Serial.Field<any>> implements Serial.Field<Set<Serial.TypeOf<T>>> {
    readonly elem: T
    constructor(elem: T) {
        this.elem = elem
    }
    serialize(v: Set<Serial.TypeOf<T>>) {
        const out = new Array(v.size)
        let i = 0
        for (const e of v.values()) {
            out[i++] = this.elem.serialize(e)
        }
        return out
    }
    deserialize(v: unknown) {
        SerialError.assert(Array.isArray(v), `expected array (got ${typeof v})`)
        const d = new Array(v.length)
        let i = 0
        for (const e of v) {
            d[i++] = this.elem.deserialize(e)
        }
        return OrderedSet(d) as Set<Serial.TypeOf<T>>
    }
}
