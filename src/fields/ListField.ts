import type Serial from '../Serial'
import { List } from 'immutable'
import SerialError from '../error/SerialError'

function parseListStr(str: string) {
    if (str.startsWith('[')) return JSON.parse(str)
    return str ? str.split(',').map(a => parseInt(a)) : []
}

export default class ListField<T extends Serial.Field<any>> implements Serial.Field<List<Serial.TypeOf<T>>> {
    readonly elem: T
    constructor(elem: T) {
        this.elem = elem
    }
    serialize(v: List<Serial.TypeOf<T>>) {
        return v.valueSeq().map(v => this.elem.serialize(v)).toArray()
    }
    deserialize(v: unknown): List<Serial.TypeOf<T>> {
        const n = (typeof v === 'string' ? parseListStr(v) : v) ?? []
        SerialError.assert(Array.isArray(n), `expected array got ${typeof n}`)
        return List(n.map(a => this.elem.deserialize(a)))
    }
}
