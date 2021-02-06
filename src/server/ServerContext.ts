import { IncomingMessage, ServerResponse, IncomingHttpHeaders } from 'http'
import qs from 'querystring'
import CacheControl, { CacheControlBound } from './CacheControl'
import Session from "../Session"
import Logger from './Logger'
import Cookies from '../Cookies'
import HTTPServer from './HTTPServer'


export default class ServerContext {
    readonly id: string
    readonly req: IncomingMessage
    readonly res: ServerResponse

    readonly server: HTTPServer
    readonly log: Logger
    readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
    readonly url: string
    readonly path: string
    readonly host: string
    readonly headers: Readonly<IncomingHttpHeaders>
    readonly cookies: Cookies
    readonly query: qs.ParsedUrlQuery
    readonly params: { [k: string]: string | undefined} 
    readonly cache: CacheControl
    session: Session = new Session({ id: '', long: false });

    constructor(id: string, server: HTTPServer, log: Logger, req: IncomingMessage, res: ServerResponse) {
        this.id = id
        this.server = server
        this.req = req
        this.res = res
        this.method = (req.method || 'GET').toUpperCase() as any
        const url = req.url || '/',
            j = url.indexOf('?')
        this.url = url
        this.path = j === -1 ? url : url.substring(0, j)
        this.query = j === -1 ? {} : qs.parse(url.substring(j + 1))
        this.host = req.headers['host'] || (req.headers[':authority'] as string) || ''
        const h = Object.assign({}, req.headers)
        for (const k in h) {
            if (k[0] === ':')
                delete h[k]
        }
        this.headers = h
        this.cookies = new Cookies(req.headers['cookie'] || '', sc => this.set('set-cookie', sc))
        res?.on('finish', () => {
            this.log.http('<-- ' + this.method + ' ' + this.path, { status: res.statusCode })
        })
        this.log = log.child({ requestId: this.id })
        const logHeaders = Object.assign({}, h)
        delete logHeaders['cookie']
        this.log.http('--> ' + this.method + ' ' + this.path, { headers: logHeaders })
        this.params = {}
        this.cache = new CacheControlBound(s => this.set('cache-control', s))
    }

    private cached: Buffer | undefined
    private async buf() {
        if (this.cached)
            return this.cached
        const bufs = new Array<Buffer>()
        await new Promise((resolve) => {
            this.req.on('data', d => bufs.push(d))
            this.req.on('end', resolve)
        })
        return this.cached = Buffer.concat(bufs)
    }

    read(enc: null): Promise<Buffer>
    read(enc?: BufferEncoding): Promise<string>
    async read(enc: BufferEncoding | null = 'utf-8') {
        const buf = await this.buf()
        return enc === null ? buf : buf.toString(enc)
    }

    get status() {
        return this.res?.statusCode || 200
    }

    private setStatus = false;
    set status(status) {
        this.res.statusCode = status
        this.setStatus = true
    }

    statusIfNotSet(status = 200) {
        if (!this.res)
            return status
        if (this.setStatus)
            return this.res.statusCode || status
        return this.res.statusCode = status
    }

    set(header: string, value: string | number | string[] | undefined): this {
        this.res?.setHeader(header, value ?? '')
        return this
    }
}
