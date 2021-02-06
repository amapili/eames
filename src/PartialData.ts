import Serial from './Serial'
import { Map as IMap, Record } from 'immutable'
import SerialError from './error/SerialError'

const recordTypes = typeof WeakMap !== 'undefined' ? new WeakMap<Serial.Class, Record.Factory<any>>() : new Map<Serial.Class, Record.Factory<any>>()

interface PartialData<T extends { [k: string]: any }> extends Record<T> {
    serialize(): { [k: string]: Serial.Data }
}

function PartialData<T extends Serial.Class>(type: T, serial?: unknown): PartialData<{ [K in keyof T["fields"]]: undefined | null | Serial.TypeOf<T["fields"][K]> }>
function PartialData<T extends Serial>(obj: T, serial?: unknown): PartialData<{ [K in keyof ReturnType<T["fields"]>]: undefined | null | Serial.TypeOf<ReturnType<T["fields"]>[K]> }>
function PartialData(consOrObj: any, serial?: unknown) {
    const cons: Serial.Class = typeof consOrObj === 'function' ? consOrObj : consOrObj.constructor,
        data = typeof consOrObj === 'object' ? Object.fromEntries(consOrObj.entries()) : {}
    let Type = recordTypes.get(cons)
    if (!Type) {
        const RecordType = Record(Object.fromEntries(cons.fieldEntries.map(([name]) => [name, undefined] as const))),
            Constructor: any = function PartialData(this: any) {
                RecordType.apply(this, arguments)
            },
            RecordTypePrototype = (Constructor.prototype = Object.create(RecordType.prototype))
        RecordTypePrototype.constructor = Constructor
        RecordTypePrototype.serialize = function (this: Record<any>) {
            const obj: any = {}
            cons.fieldEntries.forEach(([name, field]) => {
                const value = this.get(name)
                if (value === undefined)
                    return
                if (value === null)
                    return obj[name] = null
                return obj[name] = field.serialize(value)
            })
            return obj
        }
        Type = Constructor as typeof RecordType
        recordTypes.set(cons, Type)
    }
    const out = new Type(data)
    if (serial === undefined)
        return out
    return out.withMutations(record => {
        let obj: any = serial
        if (typeof obj === 'string')
            obj = JSON.parse(obj)
        else if (IMap.isMap(obj))
            obj = obj.toObject()
        obj = obj === null ? {} : obj
        SerialError.assert(typeof obj === 'object' && obj !== null, `expected object (got ${obj === null ? 'null' : typeof obj})`)
        cons.fieldEntries.forEach(([name, field]) => {
            try {
                if (obj[name] == null)
                    return record.set(name, obj[name])
                record.set(name, field.deserialize(obj[name]))
            } catch (e) {
                (e as Error).message = name + ': ' + (e as Error).message
                throw e
            }
            return
        })
    })
}

export default PartialData
