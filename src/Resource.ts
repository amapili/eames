import { hash, Set } from "immutable"
import Future from "./Future"
import API from "./API"
import Query, { defaultAPI } from "./Query"
import SerialError from "./error/SerialError"
import ConstructField from "./fields/ConstructField"
import EnumField from "./fields/EnumField"
import NumberField from "./fields/NumberField"
import StringField from "./fields/StringField"
import Serial from "./Serial"
import { tuple } from "./fields"

export abstract class ResourceIdentifier<TypeID extends string, ID extends string | number> {
    readonly str: string
    readonly type: TypeID
    readonly id: ID

    constructor(type: TypeID, id: ID) {
        this.type = type
        this.id = id
        this.str = btoa(type + ':' + id)
    }

    static parse(str: string) {
        const s = atob(str),
            i = s.indexOf(':')
        if (i < 1 || i >= s.length - 1)
            throw new SerialError('invalid resource id')
        return [s.substring(0, i), s.substring(i + 1)] as const
    }

    toString() {
        return this.str
    }

    valueOf() {
        return this.str
    }

    equals(o: any) {
        return o.str === this.str
    }

    hashCode() {
        return hash(this.str)
    }
}

export type ResourceFuture<ID extends Resource<any>> = Future<Resource.Result<ID>> & { readonly id: ID }

type Str<T> = T extends string ? T : never

function Resource<
    Map extends { readonly [K in string]: Serial.Class<any, any> },
    IDField extends StringField | NumberField | EnumField<any>,
    ID extends Serial.TypeOf<IDField> = Serial.TypeOf<IDField>,
    TypeID extends Str<keyof Map> = Str<keyof Map>,
    >(idField: IDField, types: Map) {
    return class ResourceID extends ResourceIdentifier<TypeID, ID>  {
        static readonly types = types
        static readonly parseField = tuple(new EnumField(Set<TypeID>(Object.keys(types) as TypeID[])), idField)
        static readonly field = new StringField()
        static API = defaultAPI
        static typeName = ''
        static fromData(str: string) {
            const [type, id] = ResourceID.parseField.deserialize(ResourceIdentifier.parse(str))
            return new ResourceID(type, id)
        }
        toData() {
            return this.str
        }

        static fieldOfType<T extends TypeID>(type: T): Serial.Field<Resource<Pick<Map, T>, T, ID>> {
            return {
                serialize(v: ResourceID) {
                    return (idField as any).serialize(v.id)
                },
                deserialize(v: unknown) {
                    return new ResourceID(type, idField.deserialize(v)) as any
                }
            }
        }

        Result() { return (this.constructor as any as typeof ResourceID).types[this.type] }
        API() { return (this.constructor as any as typeof ResourceID).API }
        typeName() { return (this.constructor as any as typeof ResourceID).typeName }
    } as Resource.Class<Map, ID>
}

interface Resource<
    Map extends { readonly [P in string]: Serial.Class } = any,
    TypeID extends string & keyof Map = Str<keyof Map>,
    ID extends string | number = string | number> extends ResourceIdentifier<TypeID, ID> {
    Result(): Map[TypeID]
    API(): API
    typeName(): string
    toData(): string
}

declare module Resource {
    export interface Class<
        Map extends { readonly [P in string]: Serial.Class } = any,
        ID extends string | number = any> {
        new(type: string & keyof Map, id: ID): Resource<Map, Str<keyof Map>, ID>
        API: API
        typeName: string
        readonly types: Map
        readonly field: StringField
        fieldOfType<T extends Str<keyof Map>>(type: T): Serial.Field<Resource<Pick<Map, T>, T, ID>>
        fromData(str: string): InstanceType<this>
    }
    export type Result<R extends Resource, K extends keyof InstanceType<ReturnType<R["Result"]>> = keyof InstanceType<ReturnType<R["Result"]>>> = { [Key in K]: InstanceType<ReturnType<R["Result"]>[Key]> }[K]
    export type Type<R extends Class, K extends keyof R["types"]> = R["types"][K]

    export interface TypeProvider {
        getType<R extends Class, K extends string & keyof R["types"]>(rc: R, type: K): Type<R, K>
    }
}

export default Resource