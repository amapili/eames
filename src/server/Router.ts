import { List, Map } from 'immutable'
import ServerContext from './ServerContext'
import { Handler, HandlerResponse } from './HTTPServer'

export default class Router {
    private handlers = Map<string, RouteNode>();
    private readonly host: boolean
    constructor(host?: boolean) {
        this.host = !!host
    }

    onMethod(method: string, route: string, handler: Handler) {
        const node = this.handlers.get(method, new RouteNode(''))
        node.add(route, handler)
        this.handlers = this.handlers.set(method, node)
    }

    all = (route: string, handler: Handler) => {
        this.onMethod('GET', route, handler)
        this.onMethod('POST', route, handler)
    }
    get = (route: string, handler: Handler) => this.onMethod('GET', route, handler)
    post = (route: string, handler: Handler) => this.onMethod('POST', route, handler)

    handle = (ctx: ServerContext, next: () => Promise<HandlerResponse>) => {
        const r = this.handlers.get(ctx.method)
        if (!r)
            return next()
        const h = r.get((this.host ? ctx.host + '/' : '') + ctx.path, ctx.params)
        if (!h)
            return next()
        const fn = (typeof h === 'object') ? h.handle : h
        return fn(ctx, next)
    }
}

class RouteNode {
    readonly name: string = '';
    readonly match: string = '';
    private children = Map<string, RouteNode>();
    private handler?: Handler
    constructor(route: string, handler?: Handler) {
        const e = route.indexOf('/')
        let str = route.substring(0, e === -1 ? undefined : e)
        if (str.startsWith(':') || route === '')
            this.name = str && str.substring(1)
        else if (!str)
            throw new Error('invalid route')

        else
            this.match = str

        if (e !== -1) {
            const n = new RouteNode(route.substring(e + 1), handler)
            this.children = Map({ [n.match]: n })
        } else {
            this.handler = handler
        }
    }
    private addNode(node: RouteNode) {
        const c = this.children.get(node.match)
        if (c) {
            const nc = node.children.valueSeq().get(0)
            if (nc) {
                c.addNode(nc)
                return
            } else {
                this.handler = node.handler
                return
            }
        }
        this.children = this.children.set(node.match, node)
    }
    add(route: string, handler: Handler) {
        const node = new RouteNode(route.split('/').filter(a => !!a).join('/'), handler)
        this.addNode(node)
    }
    private getList(route: List<string>, params: unknown): Handler | undefined {
        const r = route.get(0)
        if (r === undefined)
            return this.handler
        const c = this.children.get(r)
        if (c) {
            return c.getList(route.shift(), params) || this.handler
        } else {
            const w = this.children.get('')
            if (!w)
                return this.handler
            Object.assign(params, { [w.name]: r })
            return w.getList(route.shift(), params) || this.handler
        }
    }
    get(route: string, params: unknown) {
        return this.getList(List(route.split('/').filter(a => !!a)), params)
    }
}
