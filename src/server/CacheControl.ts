export default interface CacheControl {
    cache: boolean
    store: boolean
    immutable: boolean
    public: boolean
    expires: Date
}

export class CacheControlBound implements CacheControl {
    private _cache?: boolean
    public get cache(): boolean {
        return this._cache || false
    }
    public set cache(value: boolean) {
        this._cache = value
        this.flush()
    }

    private _store?: boolean
    public get store(): boolean {
        return this._store ?? true
    }
    public set store(value: boolean) {
        this._store = value
        this.flush()
    }

    private _immutable: boolean = false
    public get immutable(): boolean {
        return this._immutable
    }
    public set immutable(value: boolean) {
        this._immutable = value
        this._cache = this._cache ?? true
        this._store = this._store ?? true
        this._expires = this._expires ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
        this._public = this._public ?? true
        this.flush()
    }

    private _public?: boolean
    public get public(): boolean {
        return this._public || false
    }
    public set public(value: boolean) {
        this._public = value
        this.flush()
    }

    private _expires?: Date
    public get expires(): Date {
        return this._expires || new Date()
    }
    public set expires(value: Date) {
        this._expires = value
        this._cache = this._cache ?? true
        this.flush()
    }

    readonly update: (c: string) => unknown
    constructor(update: (c: string) => unknown) {
        this.update = update
    }

    toString() {
        if (!this.store)
            return 'no-store'
        const pub = this.public ? 'public' : 'private'
        if (!this.cache)
            return pub + ', no-cache'
        return `${pub}, max-age=${Math.max(1, Math.round((this.expires.getTime() - Date.now()) / 1000))}${this.immutable ? ', immutable' : ''}`
    }

    private flush() {
        this.update(this.toString())
    }
}

export function parseCache(str?: string) {
    const out: CacheControl = { cache: false, store: true, immutable: false, public: false, expires: new Date() }
    if (!str) return out
    for (const v of str.split(',').map(a => a.trim())) {
        if (v === 'immutable') {
            out.immutable = true
            out.cache = out.store = out.public = true
            out.expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
        } else if (v === 'no-store') {
            out.store = false
            out.cache = false
        } else if (v === 'no-cache') {
            out.cache = false
        } else if (v === 'public') {
            out.public = true
        } else if (v === 'private') {
            out.public = false
        } else if (v.startsWith('max-age=')) {
            const n = parseInt(v.substring(8))
            if (isFinite(n) && n >= 0)
                out.expires = new Date(Date.now() + 1000 * n)
        }
    }

    return out
}

