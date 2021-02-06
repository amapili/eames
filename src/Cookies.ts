import { Map } from 'immutable'

export interface CookieOptions {
    value: string | undefined
    path?: string
    domain?: string
    expires?: Date
    httpOnly?: boolean
    noEncode?: boolean
    noStrict?: boolean
}

const splitFirst = (split: string) => (str: string) => {
    const i = str.indexOf(split)
    if (i === -1) return [str, ''] as [string, string]
    return [str.substring(0, i), str.substring(i + split.length)] as [string, string]
}

export default class Cookies {
    readonly src: string
    public str: string
    readonly setCookie = new Array<string>()
    private cache?: Map<string, string>
    private readonly onSet?: (set: string[]) => unknown
    constructor(src = '', onSet?: (set: string[]) => unknown) {
        this.src = src
        this.str = src
        this.onSet = onSet
    }

    private parse() {
        if (this.cache) return this.cache
        return this.cache = Map<string, string>().withMutations(map => this.src.split(';')
            .map(splitFirst('='))
            .forEach(([name, val]) => {
                try {
                    const key = name.trim(),
                        value = decodeURIComponent(val)
                    key && value && map.set(key, value)
                } catch (e) { }
            }))
    }

    get(name: string): string | undefined {
        return this.parse().get(name)
    }

    set(name: string, { value, path, domain, expires, httpOnly, noEncode, noStrict }: CookieOptions) {
        const m = this.parse()
        this.cache = value == null || value === '' ? m.delete(name) : m.set(name, value)

        let out = name + '='
        out += noEncode ? (value || '') : encodeURIComponent(value || '')


        out += noStrict ? '' : '; samesite=strict'
        if (path) out += '; path=' + path
        if (domain) out += '; domain=' + domain
        if (expires) out += '; expires=' + expires.toUTCString()
        if (httpOnly) out += '; httponly'

        this.setCookie.push(out)
        this.str = this.cache.entrySeq().map(([key, value]) => `${key}=${encodeURIComponent(value || '')}`).filter(a => !!a).join(';')
        this.onSet && this.onSet(this.setCookie)
    }
}
