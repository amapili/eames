import type Serial from '../Serial'
import DateField from './DateField'
import UnknownField from "./UnknownField"
import StringField from "./StringField"
import NumberField from "./NumberField"
import BooleanField from "./BooleanField"
import BlobField from './BlobField'
import ListField from './ListField'
import TupleField from "./TupleField"
import ConstructField, { ConstructableConstructor } from './ConstructField'
import ObjectField from "./ObjectField"
import OptionalField from './OptionalField'
import EnumField from './EnumField'
import MapField from './MapField'
import SetField from './SetField'
import { Set } from 'immutable'
import PartialField from './PartialField'
import PartialData from '../PartialData'

export const boolean = (opt?: boolean) => new BooleanField(opt)
export const number = () => new NumberField()
export const string = () => new StringField()
export const date = () => new DateField()
export const unknown = () => new UnknownField()

type AT<T> = T extends ReadonlyArray<infer R> ? R : never

export const enumerated = <T extends (string | number)[]>(...s: T) => new EnumField<AT<T>>(Set<any>(s))

export const object = <T extends Serial.Class>(cons: T | (() => T)) => new ObjectField(cons)
export const construct = <C extends ConstructableConstructor>(cons: C) => new ConstructField(cons)

export const optional = <F extends Serial.Field<any>>(elem: F) => new OptionalField(elem)

type TT<T extends [...readonly Serial.Field<any>[]]> = { [K in keyof T]: T[K] extends Serial.Field<any> ? Serial.TypeOf<T[K]> : never }
export const tuple = <F extends [...readonly Serial.Field<any>[]]>(...elems: F) => new TupleField<Readonly<[...TT<F>]>>(elems)
export const list = <F extends Serial.Field<any>>(elem: F) => new ListField(elem)
export const map = <K extends Serial.Field<any>, V extends Serial.Field<any>>(key: K, value: V) => new MapField<Serial.TypeOf<K>, Serial.TypeOf<V>>(key, value)
export const set = <F extends Serial.Field<any>>(key: F) => new SetField(key)

export const blob = () => new BlobField()
export const partial = <C extends Serial.Class>(type: C) => new PartialField<PartialData<{ [K in keyof C["fields"]]: undefined | null | Serial.TypeOf<C["fields"][K]> }>>(type)
