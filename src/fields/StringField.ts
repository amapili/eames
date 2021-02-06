import SerialError from '../error/SerialError'
import type Serial from '../Serial'


export default class StringField implements Serial.Field<string> {
    serialize(v: string) {
        return v
    }
    deserialize(v: unknown) {
        if (typeof v === 'number')
            return '' + v
        SerialError.assert(typeof v === 'string', `expected string (got ${typeof v})`)
        return v
    }
}
