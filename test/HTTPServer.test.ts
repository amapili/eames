import { request } from "http"
import HTTPServer from "../src/server/HTTPServer"
import Router from "../src/server/Router"

function get(path: string) {
    return new Promise((resolve, reject) => {
        request({ host: 'localhost', port: 1234, path }, res => {
            if (res.statusCode !== 200)
                return reject(new Error('status ' + res.statusCode))
            const d: Buffer[] = []
            res.on('data', buf => d.push(buf))
            res.on('error', reject)
            res.on('end', () => resolve(Buffer.concat(d).toString('utf-8')))
        }).on('error', reject).end()
    })

}

let server: HTTPServer

beforeEach(async () => {
    server = new HTTPServer()
    await server.listen(1234)
})

afterEach(async () => {
    await server.close()
})

test('handler order', async () => {
    const routes = new Router()
    routes.get('/test', async (ctx, next) => (f |= 2, 'test'))

    let f = 0

    server.use(async (ctx, next) => {
        f |= 1
        return next()
    })
    server.use(routes)
    server.use(async (ctx, next) => {
        f |= 4
        return next()
    })

    await expect(get('/test')).resolves.toBe('test')
    expect(f).toBe(1 | 2)
    f = 0
    await expect(get('/none'))
        .rejects.toBeDefined()
    expect(f).toBe(1 | 4)
})

test('route matching', async () => {
    const routes = new Router()
    routes.get('/test', async () => 'test')
    routes.post('/post', async () => 'test')
    routes.get('/test/:test', async (ctx) => 'test ' + ctx.params.test)
    routes.get('/test/test2', async () => 'test2')
    routes.get('/test/test1', async () => '1test')
    routes.get('/test/:test/deep', async (ctx) => 'test deep ' + ctx.params.test)
    routes.get('/test/:test/:t2', async (ctx) => 'test ' + ctx.params.test + ' ' + ctx.params.t2)
    server.use(routes)

    await expect(get('/test')).resolves.toBe('test')
    await expect(get('/test/test2')).resolves.toBe('test2')
    await expect(get('/test/test1')).resolves.toBe('1test')
    await expect(get('/test/echo')).resolves.toBe('test echo')
    await expect(get('/test/echo/deep')).resolves.toBe('test deep echo')
    await expect(get('/test/echo/wildcard')).resolves.toBe('test echo wildcard')
    await expect(get('/test/echo/wildcard/notfound')).resolves.toBe('test echo wildcard')
    await expect(get('/best/echo/wildcard/notfound'))
        .rejects.toBeDefined()
    await expect(get('/post'))
        .rejects.toBeDefined()
})

test('nested routers', async () => {
    const routes = new Router(),
        r2 = new Router()
    routes.get('/test', async () => 'test')
    routes.all('/nest', r2)
    r2.get('/nest', async () => 'nest')
    r2.get('/nest/test', async () => 'nest test')
    r2.get('/nest/echo/:str', async (ctx) => ctx.params.str)

    server.use(routes)

    await expect(get('/test')).resolves.toBe('test')
    await expect(get('/nest')).resolves.toBe('nest')
    await expect(get('/nest/test')).resolves.toBe('nest test')
    await expect(get('/nest/echo/testing')).resolves.toBe('testing')
})