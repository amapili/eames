import type Serial from '../Serial'


export default class UnknownField implements Serial.Field<unknown> {
    serialize(v: unknown) {
        return v as any
    }
    deserialize(v: unknown) {
        return v
    }
}
