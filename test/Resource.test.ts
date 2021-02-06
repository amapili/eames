import { mockRequest } from './util/request'
import DataSource from '../src/DataSource'
import { string } from '../src/fields'
import Resource from '../src/Resource'
import Serial from '../src/Serial'

test('resource (de-)serialize', async () => {
    const A = Serial({ a: string() }),
        B = Serial({ b: string() }),
        Test = Resource(string(), { 'a': A, 'b': B })
    mockRequest.response(new Test('a', '1'), new A({ a: 'test' }))
    mockRequest.response(new Test('b', '1'), new B({ b: 'test' }))

    const d = new DataSource([])

    await expect(d.get(new Test('a', '1'))).resolves.toHaveProperty('a', 'test')
    await expect(d.get(new Test('b', '1'))).resolves.toHaveProperty('b', 'test')

    await expect(d.get(new Test('a', '2'))).rejects.toBeDefined()
    await expect(d.get(new Test('b', '2'))).rejects.toBeDefined()
})

test('dynamic schema', async () => {
    const A = Serial({ a: string() }),
        B = Serial({ b: string() }),
        B2 = B.extend({ dyn: string() }),
        d = new DataSource([])
    const Test = Resource(string(), { 'a': A, 'b': B })
    mockRequest.response(new Test('a', '1'), new A({ a: 'test' }))
    mockRequest.response(new Test('b', '1'), new B2(({ b: 'test', dyn: 'dynamic' })))

    await d.get(new Test('a', '1'))

    await expect(d.get(new Test('a', '1'))).resolves.toHaveProperty('a', 'test')
    await expect(d.get(new Test('b', '1'))).resolves.toHaveProperty('b', 'test')
    /*await expect(d.get(new Test('b', '1'))).resolves.not.toHaveProperty('dyn')
    await expect(d.get(new Test('b', '1'))).resolves.not.toHaveProperty('dyn')*/
    d.setTypes(Test, { 'a': A, 'b': B2 })
    await expect(d.get(new Test('b', '1'))).resolves.toHaveProperty('dyn', 'dynamic')
})
