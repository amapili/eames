import Query, { defaultAPI } from "./Query"
import Resource from "./Resource"
import Serial from "./Serial"

export interface DataView extends Resource.TypeProvider {
    get<R extends Query>(args: R): Query.Result<R> | undefined
    get<R extends Resource>(id: R): Resource.Result<R> | undefined
}

export interface MutableDataView extends DataView {
    set<R extends Query>(args: R, value: Query.Result<R>): void
    set<R extends Resource>(id: R, value: Resource.Result<R>): void
    create<R extends Resource>(fakeId: R, value: Resource.Result<R>, realId?: R): void
    delete<R extends Resource>(id: R): void
}

export interface MutationConfig<D extends Serial, R extends Serial> {
    update?: (data: D, view: MutableDataView, response?: R) => void
}

type Mutation<T extends Serial.Fields = any, R extends Serial.Class = any> = Query<T, R> & { mutationConfig: MutationConfig<Serial<T>, InstanceType<R>> }

declare module Mutation {
    export interface Class<T extends Serial.Fields = any, R extends Serial.Class = any> extends Query.Class<T, R, Mutation<T, R>> {
        clone(): Class<T, R>
        clone<R2 extends Serial.Class>(r: R2, keepData?: boolean): Class<T, R2>

        key(): string
    }

    export type Result<T extends Mutation> = InstanceType<ReturnType<T["Response"]>>
}

function Mutation<Req extends Serial.Fields, Res extends Serial.Fields>(reqFields: Req, resFields: Res, config?: MutationConfig<Serial<Req>, Serial<Res>>): Mutation.Class<Req, Mutation.Class<Res>>
function Mutation<Req extends Serial.Fields, Res extends Serial.Class>(reqFields: Req, res: Res, config?: MutationConfig<Serial<Req>, InstanceType<Res>>): Mutation.Class<Req, Res>
function Mutation<Req extends Serial.Class, Res extends Serial.Class>(req: Req, res: Res, config?: MutationConfig<InstanceType<Req>, InstanceType<Res>>): Req extends Serial.Class<infer F> ? Mutation.Class<F, Res> : never
function Mutation(req: any, res: any, config: any) {
    const out: any = Query(req, res)
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
    out.prototype.isMutation = () => true
    out.prototype.mutationConfig = config ?? {}

    return out
}

export default Mutation