const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function execWithTimeOut(f: () => any, msTimeOut: number) {
    return Promise.race([
        new Promise(res => res(f())),
        delay(msTimeOut)
    ])
}

export async function execWithRetries<T>(f: () => T, msTimeOuts: number[]): Promise<[T | undefined, number]> {
    let retries = 0;
    for (let t of msTimeOuts) {
        const result = await execWithTimeOut(f, t);
        if (result !== undefined) {
            return [<T>result, retries];
        }
        retries++;
    }
    return [undefined, -1];
}

