import { hash } from 'immutable'
import API from './API'
import type Mutation from './Mutation'
import Serial from './Serial'

export const defaultAPI = new API('')

export interface QueryMethods<R extends Serial.Class = any> {
    Response(): R
    API(): API
    typeName(): string
    isMutation(): this is Mutation
}

type Query<T extends Serial.Fields = any, R extends Serial.Class = any> = Serial<T> & QueryMethods<R>

declare module Query {
    export interface Class<T extends Serial.Fields = any, R extends Serial.Class = any, I extends Query<T, R> = Query<T, R>> extends Serial.Class<T, I> {
        API: API
        typeName: string
        Res: R
        clone(): Class<T, R>
        clone<R2 extends Serial.Class>(r: R2, keepData?: boolean): Class<T, R2>

        key(): string
    }

    export type Result<T extends Query> = InstanceType<ReturnType<T["Response"]>>
}

function Query<Req extends Serial.Fields, Res extends Serial.Fields>(reqFields: Req, resFields: Res): Query.Class<Req, Query.Class<Res>>
function Query<Req extends Serial.Fields, Res extends Serial.Class>(reqFields: Req, res: Res): Query.Class<Req, Res>
function Query<Req extends Serial.Class, Res extends Serial.Class>(req: Req, res: Res): Query.Class<Req["fields"], Res>
function Query(req: any, res: any) {
    const out: any = req.fields ? class extends req { } : Serial(req)
    out.API = defaultAPI
    out.typeName = ''
    out.Res = res.fields ? res : Serial(res)
    out.clone = (r: any, keepData?: boolean) => {
        const copy: any = class extends out { }
        if (!keepData) {
            copy.typeName = undefined
            copy.API = defaultAPI
        }
        if (r !== undefined)
            copy.Res = r
        return copy
    }
    out.prototype.Response = function (this: any) { return this.constructor.Res }
    out.prototype.API = function (this: any) { return this.constructor.API }
    out.prototype.typeName = function (this: any) { return this.constructor.typeName }
    out.prototype.key = function (this: any) {
        return this.API().name + '-' + this.constructor.typeName + '-' + this.stringify()
    }
    out.prototype.equals = function (this: any, o: any) { return this === o || this.key() === o.key() }
    out.prototype.hashCode = function (this: any) { return hash(this.key()) }
    out.prototype.isMutation = () => false

    return out
}

export default Query
