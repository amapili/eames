import { optional, string } from '../src/fields'
import Query from '../src/Query'
import Serial from '../src/Serial'

test('factory', async () => {
    const Test = Query({
        opt: optional(string()),
        required: string()
    }, {
        opt2: optional(string()),
        required2: string()
    }),
        req = new Test({ required: 'test' }),
        res = new Test.Res({ required2: 'test' })

    expect(req.required).toBe('test')
    expect(req.opt).not.toBeDefined()
    expect(res.required2).toBe('test')
    expect(res.opt2).not.toBeDefined()

    expect(req.constructor).toBe(Test)
    expect(res.constructor).toBe(Test.Res)

    expect(req instanceof Test).toBe(true)
    expect(res instanceof Test.Res).toBe(true)

    expect(Test.Res.API).not.toBeDefined()
})

test('arguments', async () => {
    const Res = Serial({})
    const Test = Query({
        opt: optional(string()),
        required: string()
    }, Res),
        T2Q = Serial({ f: string() }),
        Test2 = Query(T2Q, Res),
        req = new Test({ required: 't' }),
        res = new Test.Res({}),
        req2 = new Test2({ f: 'test' })

    expect(req.constructor).toBe(Test)
    expect(res.constructor).toBe(Test.Res)
    expect(res.constructor).toBe(Res)
    expect(req2.constructor).toBe(Test2)
})

test('extend', () => {
    const Base = Query({
        opt: optional(string()),
        required: string()
    }, {
        opt2: optional(string()),
        required2: string()
    }), Test = Query(Base.extend({
            opt3: optional(string()),
            required3: string()
    }), Base.Res.extend({
            opt3: optional(string()),
            required3: string()
        }
    )),
        req = new Test({ required: 'inherited', required3: 'test' }),
        res = new Test.Res({ required2: 'inherited', required3: 'test' })

    expect(req.required).toBe('inherited')
    expect(res.required2).toBe('inherited')
    expect(req.required3).toBe('test')
    expect(res.required3).toBe('test')

    expect(req.constructor).toBe(Test)
    expect(res.constructor).toBe(Test.Res)

    expect(req instanceof Test).toBe(true)
    expect(res instanceof Test.Res).toBe(true)

    expect(req instanceof Base).toBe(true)
    expect(res instanceof Base.Res).toBe(true)

    expect(req instanceof Base.Res).toBe(false)
    expect(res instanceof Base).toBe(false)
})
