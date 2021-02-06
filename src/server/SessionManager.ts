import assert from 'assert'
import ServerContext from "./ServerContext"
import { createHmac, timingSafeEqual, randomBytes } from 'crypto'
import Session from "../Session"
import SerialError from '../error/SerialError'
import NotFoundError from '../error/NotFoundError'
import Logger, { consoleLogger } from './Logger'

function getHmac(b: Buffer, secret: Buffer) {
    return new Promise<Buffer>((resolve, reject) => {
        const hmac = createHmac('sha256', secret)
        hmac.on('readable', () => {
            const data = hmac.read()
            if (Buffer.isBuffer(data))
                resolve(data)
            else
                reject(new SerialError())
        })

        hmac.write(b)
        hmac.end()
    })
}

function dataToBuffer(payload: Buffer, tShort: number, tLong: number) {
    const h = Buffer.alloc(14)
    h.writeUInt16LE(payload.byteLength, 0)
    h.writeUIntLE(tShort, 2, 6)
    h.writeUIntLE(tLong, 8, 6)
    return Buffer.concat([h, payload])
}

function parseBuffer(b: Buffer) {
    if (b.byteLength < 14) throw new SerialError('invalid session')
    const len = b.readUInt16LE(0),
        tShort = b.readUIntLE(2, 6),
        tLong = b.readUIntLE(8, 6)
    if (b.byteLength !== 14 + len + 32) throw new SerialError('invalid session')
    const payload = b.slice(14, 14 + len),
        hmac = b.slice(14 + len)
    return { payload, hmac, tShort, tLong }
}

async function parseToken(token: string, secret: Buffer) {
    const { payload, hmac, tShort, tLong } = parseBuffer(Buffer.from(token, 'base64'))

    const buf = dataToBuffer(payload, tShort, tLong)
    const hm2 = await getHmac(buf, secret)
    if (!timingSafeEqual(hmac, hm2))
        throw new SerialError('invalid session')
    return { payload, tShort, tLong }

}

export class ExpiredSessionError extends Error {}

function parseSession(token: string | undefined, secret: Buffer): Promise<Session>
function parseSession(token: string | undefined, secret: Buffer, long: true): Promise<{ session: Session, expires: Date }>
async function parseSession(token: string | undefined, secret: Buffer, long?: true): Promise<any> {
    if (!token) throw new NotFoundError()
    const { payload, tShort, tLong } = await parseToken(token, secret)
    if (Date.now() - (long ? tLong : tShort) * 1000 >= 0)
        throw new ExpiredSessionError()
    const s: any = Session.deserialize(payload.toString('utf-8'))
    if (!(s instanceof Session))
        throw new NotFoundError()
    return long ? { session: s, expires: new Date(tLong * 1000) } : s
}

export default abstract class SessionManager {
    private readonly secret: Buffer
    private readonly short: number
    private readonly med: number
    private readonly long: number

    constructor(secret: string, persistMsec: number, longPersistMsec: number, ttlMsec: number = 30 * 60 * 1000) {
        this.secret = Buffer.from(secret, 'base64')
        assert.strictEqual(this.secret.byteLength, 64, 'key byte length should be 64')
        this.short = Math.round(ttlMsec / 1000)
        this.med = Math.round(persistMsec / 1000)
        this.long = Math.round(longPersistMsec / 1000)
    }

    protected setAuthCookie(ctx: ServerContext, s?: { token: string, exp: Date }) {
        ctx.cookies.set('session', {
            value: s && s.token,
            path: '/',
            expires: s && s.exp,
            httpOnly: true,
        })
    }

    async generateSession(data: Session, log: Logger) {
        log.debug('new session', data)
        const str = JSON.stringify(data.serialize())
        const n = Math.round(Date.now() / 1000), tShort = n + this.short, tLong = n + (data.long ? this.long : this.med), buf = dataToBuffer(Buffer.from(str, 'utf-8'), tShort, tLong)
        const hmac = await (getHmac(buf, this.secret))
        const token = Buffer.concat([buf, hmac]).toString('base64')
        return ({ token, exp: new Date(tLong * 1000) })
    }

    async verifySession(token: string, ctx?: ServerContext) {
        const logger = ctx?.log || consoleLogger
        try {
            const { session } = await parseSession(token, this.secret, true)
            const info = await (this.checkRevoked(session, logger))
            const s = await (this.generateSession(info, logger))
            ctx && this.setAuthCookie(ctx, s)
            return info
        } catch (e) {
            ctx && this.setAuthCookie(ctx)
            throw new ExpiredSessionError()
        }
    }

    protected async newId() {
        return (await new Promise<Buffer>((rs, rj) => randomBytes(18, (err, buf) => err ? rj(err) : rs(buf)))).toString('base64')
    }


    protected async create(session: Session, ctx?: ServerContext) {
        const s = await this.generateSession(session, ctx?.log || consoleLogger)
        if (ctx) {
            this.setAuthCookie(ctx, s)
            return s
        } else {
            return s
        }
    }

    async revokeSession(ctx: ServerContext) {
        try {
            const { session: sp, expires } = await parseSession(ctx.cookies.get('session'), this.secret, true)
            await this.revoke(sp, expires, ctx.log)
            this.setAuthCookie(ctx)
        } catch (e) {
            return this.setAuthCookie(ctx)
        }
    }

    async get(token?: string, ctx?: ServerContext) {
        try {
            return await parseSession(token, this.secret)
        } catch (err) {
            if (token && err instanceof ExpiredSessionError)
                return this.verifySession(token, ctx)
            throw err
        }
    }

    async current(ctx: ServerContext) {
        try {
            return await this.get(ctx.cookies.get('session'), ctx)
        } catch (err) {
            if (err instanceof ExpiredSessionError)
                throw err
            return new Session({ id: '', long: false })
        }
    }

    protected abstract checkRevoked(session: Session, log: Logger): Promise<Session>
    protected abstract revoke(session: Session, expires: Date, log: Logger): Promise<void>
}

export class NullSessionManager extends SessionManager {
    constructor() {
        super(Buffer.from('0'.repeat(64)).toString('base64'), 0, 0, 0)
    }

    async checkRevoked(session: Session) {
        return session
    }

    async revoke(session: Session, expires: Date) {

    }

    async createSession(str: string, long = false) {
        throw new NotFoundError()
    }

    async current(ctx: ServerContext) {
        return new Session({ id: '', long: false })
    }
}