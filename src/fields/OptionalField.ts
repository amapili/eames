import type Serial from '../Serial'

export default class OptionalField<T extends Serial.Field<any>> implements Serial.Field<Serial.TypeOf<T> | undefined> {
    readonly elem: T
    constructor(elem: T) {
        this.elem = elem
    }
    serialize(v: Serial.TypeOf<T> | undefined) {
        return v != null ? this.elem.serialize(v) : null
    }
    deserialize(v: unknown): Serial.TypeOf<T> | undefined {
        if (v == null) return undefined
        return this.elem.deserialize(v)
    }
}
