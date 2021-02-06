import SerialError from '../error/SerialError'
import type Serial from '../Serial'


export default class BooleanField implements Serial.Field<boolean> {
    optional: boolean
    constructor(optional?: boolean) {
        this.optional = !!optional
    }
    serialize(v: boolean) {
        return v
    }
    deserialize(v: unknown) {
        if (this.optional && v == null)
            return false
        SerialError.assert(typeof v === 'boolean' || (v === 1 || v === 0), `expected bool (got ${typeof v})`)
        return !!v
    }
}
