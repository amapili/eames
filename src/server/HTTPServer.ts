import http, { IncomingMessage, ServerResponse } from 'http'
import { List } from 'immutable'
import { EventEmitter } from 'events'
import SessionManager, { NullSessionManager } from './SessionManager'
import { Socket, AddressInfo } from 'net'
import NotFoundError from '../error/NotFoundError'
import Logger, { consoleLogger } from './Logger'
import ServerContext from './ServerContext'

export default class HTTPServer extends EventEmitter {
    private readonly server: http.Server
    readonly session: SessionManager
    private handlers = List<Handler>()
    readonly id: string
    readonly log: Logger
    constructor(conf: { session?: SessionManager, log?: Logger, id?: string } = {}) {
        super()
        this.id = conf.id ?? quickId()
        this.log = conf.log ?? consoleLogger
        this.session = conf.session ?? new NullSessionManager()
        this.server = http.createServer(this.handle.bind(this))
        this.server.on('error', e => this.emit('error', e))
        this.server.on('close', () => this.emit('close'))
        this.server.on('upgrade', this.upgrade.bind(this))
        this.on('error', e => {
            if (this.listeners('error').length === 1)
                throw e
        })
    }

    use(handler: Handler) {
        this.handlers = this.handlers.push(handler)
    }

    useFirst(handler: Handler) {
        this.handlers = this.handlers.unshift(handler)
    }

    async listen(port: number) {
        await new Promise<void>(r => this.server.listen(port, r))
        this.log.http('server listening on port ' + (this.server.address() as AddressInfo).port)
    }

    on(ev: 'error', cb: (e: any) => unknown): this
    on(ev: 'close', cb: () => unknown): this
    on(ev: 'upgrade', cb: (ctx: ServerContext, socket: Socket, head: Buffer) => unknown): this
    on(ev: string, cb: (...args: any[]) => unknown) {
        return super.on(ev, cb)
    }

    close() {
        return new Promise<void>((resolve, reject) => this.server.close(err => err ? reject(err) : resolve()))
    }

    protected async upgrade(req: http.IncomingMessage, socket: Socket, head: Buffer) {
        try {
            if (!this.listenerCount('upgrade'))
                return socket.destroy()
            const ctx = new ServerContext(this.id + '-' + quickId(), this, this.log, req, undefined as any)
            ctx.session = await this.session.current(ctx)
            this.emit('upgrade', ctx, socket, head)
        } catch (e) {
            this.emit('error', e)
            socket.destroy()
        }
    }

    protected handle(req: IncomingMessage, res: ServerResponse) {
        res.on('error', e => this.emit('error', e))
        if (req.url === '/__health') {
            res.writeHead(200)
            res.end('ok')
            return
        }
        (async () => {
            let ignore = false
            try {
                const ctx = new ServerContext(this.id + '-' + quickId(), this, this.log, req, res)
                try {
                    ctx.session = await this.session.current(ctx)
                    let val = await runHandlers(ctx, this.handlers)
                    if (val === undefined) {
                        ignore = true
                        return
                    }
                    if (typeof val === 'string' || val instanceof Buffer) {
                        res.write(val)
                    } else if (val != null) {
                        for await (const d of val) {
                            !res.writableEnded && res.write(d)
                        }
                    } else {
                        if (!res.headersSent) res.writeHead(ctx.statusIfNotSet(204))
                    }
                    if (!res.headersSent) res.writeHead(ctx.statusIfNotSet(200))
                } catch (e) {
                    if (!res.headersSent) res.writeHead(ctx.statusIfNotSet(e instanceof NotFoundError ? 404 : 500))
                    if (!(e instanceof NotFoundError))
                        this.emit('error', e)
                }
            } catch (e) {
                this.emit('error', e)
            } finally {
                if (ignore)
                    return
                if (!res.headersSent) res.writeHead(500)
                res.end()
            }
        })()
    }
}

export type HandlerResponse = null | undefined | void | string | Buffer | AsyncIterable<Buffer | string>

function runHandlers(ctx: ServerContext, handlers: List<Handler>): Promise<HandlerResponse> {
    if (!handlers.size) return new Promise((_, r) => r(new NotFoundError()))
    const h = handlers.get(0, null as never),
        fn = (typeof h === 'object') ? h.handle : h
    return fn(ctx, () => runHandlers(ctx, handlers.shift()))
}

export type HandlerFn = (ctx: ServerContext, next: () => Promise<HandlerResponse>) => Promise<HandlerResponse>
export type HandlerClass = { handle: HandlerFn }
export type Handler = HandlerFn | HandlerClass

function quickId() {
    return Date.now().toString(36) + ((Math.random() * 1073741824 /*2^30*/) | 0).toString(36)
}
