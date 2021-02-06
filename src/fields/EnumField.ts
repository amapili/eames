import type Serial from '../Serial'
import { Set } from 'immutable'
import SerialError from '../error/SerialError'

export default class EnumField<T extends string | number> implements Serial.Field<T> {
    readonly options: Set<T>
    readonly strict: boolean
    constructor(options: Set<T>, strict = true) {
        this.options = options
        this.strict = strict
    }
    serialize(v: T) {
        return v
    }
    deserialize(v: unknown) {
        SerialError.assert(typeof v === 'string', 'expected string')
        if (!this.options.has(v as T)) {
            if (this.strict)
                throw new SerialError('invalid enum ' + v)
            else
                return this.options.first() as T
        }
        return v as T
    }
}
