import { List, Map } from 'immutable'
import Query from '../Query'
import Session from "../Session"
import Resource from '../Resource'
import API from '../API'
import { construct, list, number, string, tuple, unknown } from '../fields'
import SerialError from '../error/SerialError'
import NotFoundError from '../error/NotFoundError'
import UnauthorizedError from '../error/UnauthorizedError'
import ClientError from '../error/ClientError'
import ForbiddenError from '../error/ForbiddenError'
import Serial from '../Serial'
import ServerContext from "./ServerContext"

function isResource(q: any): q is Resource.Class {
    return !!q.fieldOfType
}

export type HandlerFn<S, C extends Query | Resource, R extends Serial> = (args: C, session: S, ctx: ServerContext) => Promise<R>

export default class APIHandler<SC extends { new(...args: any[]): any } = typeof Session, S = InstanceType<SC>> {
    private handlers = Map<Query.Class | Resource.Class, HandlerFn<S, any, Serial>>()
    private SessionType: SC
    readonly api: API
    constructor(api: API, session?: SC) {
        this.api = api
        this.SessionType = session ?? (Session as any)
    }

    on<C extends Query.Class>(args: C, handler: HandlerFn<S, InstanceType<C>, Query.Result<InstanceType<C>>>): this
    on<C extends Resource.Class>(args: C, handler: HandlerFn<S, InstanceType<C>, Resource.Result<InstanceType<C>>>): this
    on(args: any, handler: any) {
        this.handlers = this.handlers.set(args, handler)
        return this
    }

    private convertError(e: any, serverSide: boolean) {
        const out: any = { error: true }
        let status = 500
        switch (e.constructor) {
            case NotFoundError:
                status = 404
                break
            case UnauthorizedError:
                status = 401
                break
            case ForbiddenError:
                status = 403
                break
            case SerialError:
                status = serverSide ? 500 : 400
                break
            default:
                if (!(e instanceof ClientError)) {
                    status = 500
                    break
                }
            //fallthrough
            case ClientError:
                status = 422
                out.code = e.code
                break
        }
        return [status, out] as const
    }

    run(batch: List<readonly [string, unknown]>, files: readonly Blob[], ctx: ServerContext) {
        if (!batch.size) throw new SerialError()
        return Promise.all(batch.map(async ([q, data]) => {
            let serverSide = false
            try {
                const type = this.api.get(q)
                if (!type) throw new NotFoundError()
                const args = isResource(type) ? Serial({ id: construct(type) }).deserialize(data, undefined, files).id : type.deserialize(data, undefined, files)

                ctx.log.debug('handle ' + type.typeName)

                const handle = this.handlers.get(type)
                if (!handle)
                throw new NotFoundError()
                if (!(ctx.session instanceof this.SessionType))
                    throw new UnauthorizedError()
                    

                serverSide = true
                return [200, (await handle(args as any, ctx.session as any, ctx)).serialize()] as const
            } catch (e) {
                const r = this.convertError(e, serverSide)
                if (r[0] >= 500)
                    ctx.log.warn('server error', e)
                else
                    ctx.log.debug('client error', e)
                return r
            }
        }))
    }

    handle = async (ctx: ServerContext) => {
        try {
            if (ctx.headers['content-type'] !== 'application/json') {
                throw new SerialError()
            }
            let data: string, files = new Array<Blob>()
            const sizes = ctx.headers['x-sizes']
            if (ctx.session instanceof this.SessionType && typeof ctx.query.q === 'string' && typeof sizes === 'string') {
                const b = sizesField.deserialize(sizes).toArray()
                if (b.length === 0)
                    throw new SerialError()

                let acc = 0

                const all = await ctx.read(null),
                    blobs = b.map(len => all.slice(acc, acc += len))
                data = blobs[0].toString('utf-8')
                files = blobs.slice(1).map(b => ({ size: b.byteLength, async arrayBuffer() { return Buffer.from(b).buffer } } as any))
            } else {
                data = await ctx.read('utf-8')
            }
            ctx.set('content-type', 'application/json')

            const batch = ctx.query.batch ? batchData.deserialize(data) : List([['' + ctx.query.q, data] as const]),
                res = await this.run(batch, files, ctx)
            if (batch.size > 1)
                return JSON.stringify(res)
            ctx.status = res[0][0]
            return JSON.stringify(res[0][1])
        } catch (e) {
            const [status, out] = this.convertError(e, false)
            ctx.status = status
            ctx.set('content-type', 'application/json')
            if (status >= 500)
                ctx.log.warn('server error', e)
            else
                ctx.log.debug('client error', e)

            return JSON.stringify(out)
        }
    }
}

const sizesField = list(number()),
    batchData = list(tuple(string(), unknown()))
