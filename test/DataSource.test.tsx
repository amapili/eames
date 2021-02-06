import '@testing-library/jest-dom/extend-expect'
import { mockRequest } from "./util/request"
import DataSource from '../src/DataSource'
import { act, render, waitFor } from '@testing-library/react'
import Query from '../src/Query'
import { string } from '../src/fields'
import Mutation from '../src/Mutation'

const Test = Query({
    str: string()
}, {
    str: string()
})
type Test = InstanceType<typeof Test>

const myobj = new Test({ str: 'Testing' }), myres = new Test.Res({ str: 'Testing' })

const Mut = Mutation({ str: string() }, Test, {
    update(_, view, res) {
        const t = view.get(myobj)?.str
        view.set(myobj, new Test.Res({ str: t === 'testing' ? 'optimistic' : t === 'live' ? 'optimistic 2' : 'bad: ' + t }))
    }
})

test('data interface fetch success', async () => {
    mockRequest.response(myobj, myres)

    const d = new DataSource([])
    await expect(d.get(myobj)).resolves.toHaveProperty('str', myres.str)
    await expect(d.get(myobj)).resolves.toHaveProperty('str', myres.str)
})

function UseFetchTest({ d, q }: { d: DataSource, q?: Test }) {
    const res = d.use(q || myobj)

    if (res.ok)
        return <h1>{res.value.str}</h1>
    else if (res.loading)
        return <h2>loading</h2>
    else
        return <h2>failed {(console.warn(res.value), res.value.name)}</h2>
}

test('data interface useFetch', async () => {
    const q2 = new Test({ str: 'testing' }),
        r2 = new Test.Res({ str: 'testing' }),
        mut = new Mut({ str: 'mutation' })
    let res = () => { }
    mockRequest.response(myobj, r2)
    mockRequest.response(mut, myobj)
    mockRequest.response(q2, new Test.Res({ str: 'testing update' }))

    const d = new DataSource([])

    const { getByRole, getByText, rerender, findByText } = render(<UseFetchTest d={d} />)
    expect(getByRole('heading')).toHaveTextContent('loading')

    await waitFor(() => getByText('testing'))

    mockRequest.response(myobj, new Promise(r => res = () => r(new Test.Res({ str: 'live' }))))

    const acted = act(async () => {
        await d.mutate(mut)
    })

    await findByText('optimistic')
    res()
    await acted
    await waitFor(() => getByText('live'))

    mockRequest.response(myobj, new Promise(r => res = () => r(new Test.Res({ str: 'live 2' }))))
    const acted2 = act(async () => {
        await d.mutate(mut)
    })

    await findByText('optimistic 2')
    res()
    await acted2
    await waitFor(() => getByText('live 2'))

    rerender(<UseFetchTest d={d} q={q2} />)

    expect(await findByText('testing update')).toBeDefined()
})