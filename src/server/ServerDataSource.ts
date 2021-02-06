import { ReactElement } from 'react'
import { renderToNodeStream } from 'react-dom/server'
import { Writable } from 'stream'
import DataSource from '../DataSource'
import Future from '../Future'
import Query from '../Query'
import Resource from '../Resource'
import Connection, { Request } from '../Connection'
import Cookies from '../Cookies'
import ServerContext from "./ServerContext"

const loading = Future(new Promise<void>(r => { }))

export default class ServerDataSource extends DataSource {
    private pendingRequests = new Map<string, Request<any>>()
    private resolved = new Map<string, { value: Future<any>, request: Request<any> }>()
    private readonly ctx: ServerContext
    constructor(ctx: ServerContext, connection: Connection) {
        super([], connection, ctx.session)
        this.ctx = ctx
        this.connection.cookies = new Cookies(ctx.cookies.src)
    }
    use(args: Query | Resource) {
        const req = this.getRequest(args),
            val = this.resolved.get(req.key)

        if (val)
            return val.value

        this.pendingRequests.set(req.key, req)

        return loading as any
    }
    get(args: Query | Resource) {
        return super.get(args as any, true)
    }
    async loadPending() {
        const promises = []
        for (const req of this.pendingRequests.values()) {
            promises.push((async () => {
                const out = this.store.get(req)
                await out.ready
                this.resolved.set(req.key, { request: req, value: out })
            })())
        }

        await Promise.all(promises)
        const loaded = !!this.pendingRequests.size
        this.pendingRequests.clear()

        return loaded
    }
    async load(root: ReactElement<any>) {
        do {
            await renderToNothing(root)
        } while (await this.loadPending())
    }
    cacheData() {
        const cache = new Array<[string, string, object, object]>()
        cache.push(['', '__', {}, this.getSession().serialize()])
        for (const { value, request } of this.resolved.values()) {
            if (!value.ok) continue
            cache.push([request.api.name, request.name, JSON.parse(request.data), (value.value as any).serialize()])
        }
        return cache
    }
    useSession() {
        return this.ctx.session
    }
    setSession() { }
}

function renderToNothing(root: ReactElement<any>) {
    const discard = new Writable()
    discard._write = (c, e, cb: () => unknown) => setImmediate(cb)
    return new Promise<void>((resolve, reject) => {
        const r = renderToNodeStream(root)
        r.on('end', resolve)
        r.on('error', reject)
        r.pipe(discard)
    })
}