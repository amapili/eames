import type Serial from '../Serial'
import { OrderedMap } from 'immutable'
import SerialError from '../error/SerialError'

export default class MapField<K, V> implements Serial.Field<OrderedMap<K, V>> {
    readonly key: Serial.Field<K>
    readonly value: Serial.Field<V>
    constructor(key: Serial.Field<K>, value: Serial.Field<V>) {
        this.key = key
        this.value = value
    }
    serialize(map: OrderedMap<K, V>) {
        const out = new Array(map.size)
        let i = 0
        for (const [k, v] of map.entries()) {
            out[i++] = [this.key.serialize(k), this.value.serialize(v)]
        }
        return out
    }
    deserialize(v: unknown) {
        SerialError.assert(Array.isArray(v), `expected array got ${typeof v}`)
        const d = new Array<[K, V]>(v.length)
        let i = 0
        for (const e of v) {
            SerialError.assert(Array.isArray(e) && e.length === 2, 'expected array of key/value')
            d[i++] = [this.key.deserialize(e[0]), this.value.deserialize(e[1])]
        }
        return OrderedMap(d)
    }
}
