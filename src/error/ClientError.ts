export default class ClientError extends Error {
    code: string
    constructor(code: string, msg?: string) {
        super(msg)
        this.code = code
    }
}