
export interface LogFunction {
    (message: string, ...meta: any[]): unknown
    (message: any): unknown
    (infoObject: object): unknown
}

export default interface Logger {
    error: LogFunction
    warn: LogFunction
    info: LogFunction
    debug: LogFunction
    http: LogFunction
    child(options: Object): Logger
}

export const consoleLogger: Logger = {
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console),
    http: console.debug.bind(console),
    child() { return consoleLogger }
}
