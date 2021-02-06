import SerialError from '../error/SerialError'
import type Serial from '../Serial'


export default class NumberField implements Serial.Field<number> {
    serialize(v: number) {
        return v
    }
    deserialize(v: unknown) {
        if (typeof v !== 'number' || isNaN(v)) {
            if (typeof v === 'string') {
                const i = parseInt(v)
                if (isFinite(i) && i + '' === v)
                    return i
                const n = parseFloat(v)
                if (isFinite(n))
                    return n
            }
            throw new SerialError(`expected number (got ${typeof v})`)
        }
        return v
    }
}
