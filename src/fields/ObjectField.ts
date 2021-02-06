import type Serial from '../Serial'

export default class ObjectField<T extends Serial.Class> implements Serial.Field<InstanceType<T>> {
    private cons?: T
    private consConstruct: () => T = undefined as any
    constructor(cons: T | (() => T)) {
        const c = cons as any
        if (c.fields)
            this.cons = c
        else
            this.consConstruct = c
    }
    serialize(v: InstanceType<T>) {
        return v.serialize()
    }
    deserialize(v: unknown) {
        this.cons ??= this.consConstruct()
        return this.cons.deserialize(v, this.cons)
    }
}
