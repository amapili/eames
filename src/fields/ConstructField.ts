import type Serial from '../Serial'

export interface ConstructableInstance<T extends Serial.Field<any>> {
    toData(): Serial.TypeOf<T>
}

export interface ConstructableConstructor<D extends Serial.Field<any> = any, T extends ConstructableInstance<D> = any> {
    field: D
    fromData(d: Serial.TypeOf<D>): T
}

type TT<T> = T extends ConstructableConstructor<any, infer R> ? R : never
type DT<T> = T extends ConstructableConstructor<infer R, any> ? R : never

export default class ConstructField<C extends ConstructableConstructor> implements Serial.Field<TT<C>> {
    readonly elem: DT<C>
    readonly cons: C
    constructor(cons: C) {
        this.cons = cons
        this.elem = cons.field
    }
    serialize(v: TT<C>) {
        return this.elem.serialize(v.toData())
    }
    deserialize(v: unknown) {
        return this.cons.fromData(this.elem.deserialize(v)) as TT<C>
    }
}
