import { Map } from 'immutable'
import SerialError from './error/SerialError'

type Serial<F extends Serial.Fields = any> = SerialBase<F> & Serial.Values<F>

type OptionalKeys<T> = { [P in keyof T]: undefined extends T[P] ? P : never }[keyof T]
type Opt<T> = Omit<T, OptionalKeys<T>> & Partial<T>

declare module Serial {
    export type Data = string | number | boolean | null | undefined | Data[] | { [k: string]: Data }

    export interface Field<T> {
        serialize(v: T, blobs?: Blob[]): Data
        deserialize(v: unknown, blobs?: readonly Blob[]): T
    }

    export type TypeOf<F extends Field<any>> = F extends Field<infer T> ? T : any

    export type Fields = { [k: string]: Field<any> }

    export type Values<Fields extends { [k: string]: Field<any> }> = { readonly [K in keyof Fields]: TypeOf<Fields[K]> }

    export interface Class<F extends Fields = any, T extends Serial<F> = Serial<F>> {
        fields: F
        fieldEntries: ReadonlyArray<readonly [string, Values<F>[keyof F]]>
        extend<F2 extends Fields>(f: F2): Class<F & F2, Serial<F & F2>>
        deserialize<C extends Class>(v: unknown, type: undefined | C, blobs?: readonly Blob[]): InstanceType<C>
        deserialize(v: unknown): T
        new(entries: Opt<Values<F>> | ReadonlyArray<readonly [keyof F, Values<F>[keyof F]]>): T
    }
}

export class SerialBase<F extends Serial.Fields = {}, K extends keyof F = keyof F, V extends Serial.Values<F>[keyof F] = Serial.Values<F>[keyof F]> {
    constructor(values: Opt<Serial.Values<F>> | ReadonlyArray<readonly [K, V]>) {
        Object.assign(this, Array.isArray(values) ? Object.fromEntries(values) : values)
    }

    fields(): F { throw new SerialError() }
    keys(): ReadonlyArray<string> { throw new SerialError() }
    values(): ReadonlyArray<any> { throw new SerialError() }
    entries(): ReadonlyArray<readonly [string, any]> { throw new SerialError() }
    indices(): { readonly [k in string]: number } { throw new SerialError() }
    [Symbol.iterator]() { return this.entries() }

    get<Key extends keyof F>(key: K): Serial.TypeOf<F[Key]>
    get(key: string): unknown
    get(key: any) {
        return (this as any)[key]
    }

    set<Key extends keyof F>(key: K, value: Serial.TypeOf<F[Key]>): this
    set(key: string, value: unknown): this
    set(key: any, value: any) {
        const ind = this.indices()[key as string]
        SerialError.assert(ind !== undefined)
        return new (this.constructor as any)(this.entries().map((e, i) => i === ind ? [e[0], value] : e))
    }

    static deserialize<T extends Serial.Class>(v: unknown, type: T, blobs?: readonly Blob[]) {
        let obj: any = v
        if (typeof obj === 'string')
            obj = JSON.parse(obj)
        else if (Map.isMap(obj))
            obj = obj.toObject()
        obj = obj === null ? {} : obj
        SerialError.assert(typeof obj === 'object' && obj !== null, `expected object (got ${obj === null ? 'null' : typeof obj})`)
        return new type(type.fieldEntries.map(([name, field]) => {
            try {
                return [name, field.deserialize(obj[name], blobs)]
            } catch (e) {
                (e as Error).message = name + ': ' + (e as Error).message
                throw e
            }
        })) as InstanceType<T>
    }

    serialize(blobs?: Blob[]) {
        const out: any = {}, fields = this.fields()
        this.entries().forEach(([name, value]) => out[name] = fields[name].serialize(value, blobs))
        return out
    }

    private _strCache: string | undefined
    private _blobsCache = new Array<Blob>()
    stringify(blobs?: Blob[]) {
        if (blobs && this._blobsCache.length)
            blobs.push(...this._blobsCache)
        return this._strCache ??= JSON.stringify(this.serialize(blobs ? (this._blobsCache = blobs) : this._blobsCache))
    }
}

function Serial<F extends Serial.Fields>(fields: F, proto = SerialBase): Serial.Class<F> {
    const keys = Object.keys(fields) as any as ReadonlyArray<string>,
        indices = Object.fromEntries(keys.map((k, i) => [k, i] as const)) as { readonly [k in keyof F]: number }
    return class SerialObject extends proto {
        constructor(values: any) {
            super({})
            Object.assign(this, Array.isArray(values) ? Object.fromEntries(values) : values)
        }
        static fields = fields
        static fieldEntries = Object.entries(fields)
        static deserialize(v: any, t: any, blobs?: Blob[]) { return SerialBase.deserialize(v, t || this, blobs) }
        static extend<F2 extends Serial.Fields>(newFields: F2) {
            return Serial({ ...fields, ...newFields }, this as any)
        }
        fields() { return fields }
        keys() { return keys }
        private _values?: ReadonlyArray<Serial.Values<F>[keyof F]> = undefined
        values() { return this._values ??= keys.map(k => (this as any)[k] as Serial.Values<F>[keyof F]) }
        private _entries?: ReadonlyArray<readonly [string, Serial.Values<F>[keyof F]]> = undefined
        entries() { return this._entries ??= keys.map(k => [k, (this as any)[k] as Serial.Values<F>[keyof F]] as const) }
        indices() { return indices }
    } as any
}

export default Serial