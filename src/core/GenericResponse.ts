export class GenericResponse<T> {
    private status: string;
    private error: string;
    private details: T;
    private msg: string;

    public getStatus(): string {
        return this.status;
    }

    public setStatus(status: string): void {
        this.status = status;
    }

    public getError(): string {
        return this.error;
    }

    public setError(error: string): void {
        this.error = error;
    }

    public getData(): T {
        return this.details;
    }

    public setData(data: T): void {
        this.details = data;
    }

    public getMsg(msg: string): string {
        return this.msg;
    }

    public setMsg(msg: string): void {
        this.msg = msg
    }

    public setEncryptedData(details: T): void {
        this.details = details;
    }
}
