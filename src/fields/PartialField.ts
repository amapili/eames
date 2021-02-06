import PartialData from '../PartialData'
import type Serial from '../Serial'

export default class PartialField<T extends PartialData<any>> implements Serial.Field<T> {
    private cons: Serial.Class
    constructor(cons: Serial.Class) {
        this.cons = cons
    }
    serialize(v: T) {
        return v.serialize()
    }
    deserialize(v: unknown) {
        return PartialData(this.cons, v) as T
    }
}
