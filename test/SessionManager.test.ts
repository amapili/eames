import { string } from '../src/fields'
import Session from "../src/Session"
import SessionManager from '../src/server/SessionManager'

const TestSession = Session.extend({ str: string() })
Session.add('test', TestSession)

class TestSessionManager extends SessionManager {
    constructor(key: string) {
        super(Buffer.from(key.padStart(64, '0')).toString('base64'),
            2000, 3000, 1000)
    }
    checkRevoked = jest.fn(async (session: Session) => {
        return session
    })
    revoke = jest.fn(async (session: Session, expires: Date) => {

    })

    async createSession(str: string, long = false) {
        return super.create(new TestSession({ id: await this.newId(), long, str }))
    }
}

test('session', async () => {
    const m1 = new TestSessionManager('1'),
        m2 = new TestSessionManager('2'),
        { token } = await m1.createSession('test')

    expect(await m1.get(token)).toHaveProperty('str', 'test')
    await expect(m2.get(token)).rejects.toBeDefined()
    expect(m1.checkRevoked).toBeCalledTimes(0)
    await new Promise(r => setTimeout(r, 1500))
    expect(await m1.get(token)).toHaveProperty('str', 'test')
    expect(m1.checkRevoked).toBeCalledTimes(1)
})